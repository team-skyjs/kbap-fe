/**
 * ReviewCellParts (P-182/KB-307) — 리뷰 2depth 셀 확장 공통 문법.
 * 개별 디테일(review/[id]) 소멸 — 목록 ReviewResponse가 풀 필드(전문·사진·likedByMe)라
 * 셀 안에서 전부 소비(쿠팡식). 전 표면(상세 프리뷰·전체 목록·커뮤니티 피드·내 리뷰) 공용:
 *   - ExpandableBody: 3줄 클램프 + See more/less 셀 내 펼침
 *   - ReviewPhotoStrip: 가로 스트립 + 탭 = 풀스크린 뷰어(페이징·닫기 — 기존 뷰어 부재로 표준 신설)
 *   - ReviewEditSheet: 본인 리뷰 수정(별점+본문 — 구 디테일 editing 이식, buildReviewUpdate 경유)
 */
import * as React from 'react';
import { RemoteImage } from '@/components/RemoteImage';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { Btn, IconClose, IconMapPin, IconSmile, IconZap, Star } from '@/components';
import { EMPTY_EXTRAS, getLocalExtras, hasAnyExtras, saveLocalExtras, type ReviewExtras } from '@/lib/review/reviewExtras';
import { PlaceTagSheet } from '@/features/community/placeMap';
import { TagChip } from '@/features/community/parts';
import { useSegments } from 'expo-router';
import { EVENTS, track } from '@/lib/analytics';
import { useQuery } from '@tanstack/react-query';
import { fetchNearbyPlaces, fetchSearchPlaces, type ReviewPlace } from '@/lib/api/places';
import { IconPlus, IconSearch } from '@/components';
import { KeyboardDismissBar } from '@/components/KeyboardDismissBar';
import { Input } from '@/components/KeyboardDismissBar';
import { useToggleReviewLike } from '@/lib/data/useReviewMutations';
import { useIsGuest } from '@/lib/auth/useSession';
import { FLAGS } from '@/lib/flags';
import type { Review } from '@/lib/api/types';

type TFn = (k: string, o?: Record<string, unknown>) => string;

/** 본문 3줄 클램프 + See more/less — 셀 내 펼침(P-182 ②). */
export function ExpandableBody({ body, t, style }: { body: string; t: TFn; style?: object }) {
  const [expanded, setExpanded] = React.useState(false);
  const [clamped, setClamped] = React.useState(false);
  return (
    <View style={{ gap: 3 }}>
      <Text
        style={[styles.body, style]}
        numberOfLines={expanded ? undefined : 3}
        onTextLayout={(e) => {
          if (!expanded && e.nativeEvent.lines.length >= 3) setClamped(true);
        }}
      >
        {body}
      </Text>
      {(clamped || expanded) && (
        <Pressable hitSlop={8} onPress={() => setExpanded((v) => !v)} testID="body-toggle">
          <Text style={styles.toggle}>{expanded ? t('reviews.seeLess') : t('reviews.seeMore')}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** 사진 가로 스트립 + 탭 = 풀스크린 뷰어(가로 페이징·X 닫기·인덱스). */
export function ReviewPhotoStrip({ photos, size = 72 }: { photos: string[]; size?: number }) {
  const [openAt, setOpenAt] = React.useState<number | null>(null);
  const { width } = useWindowDimensions();
  const [page, setPage] = React.useState(0);
  if (!photos.length) return null;
  return (
    <>
      <View style={styles.strip}>
        {photos.slice(0, 3).map((uri, i) => (
          <Pressable key={uri} hitSlop={4} onPress={() => { setPage(i); setOpenAt(i); }} testID={`photo-${i}`}>
            <RemoteImage uri={uri} style={{ width: size, height: size, borderRadius: 10, backgroundColor: C.surface2 }} />
          </Pressable>
        ))}
      </View>
      <Modal visible={openAt != null} transparent animationType="fade" onRequestClose={() => setOpenAt(null)}>
        <View style={styles.viewer} testID="photo-viewer">
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (openAt ?? 0) * width, y: 0 }}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {photos.map((uri) => (
              <View key={uri} style={{ width, justifyContent: 'center' }}>
                <RemoteImage uri={uri} style={{ width, height: width * 1.2 }} contentFit="contain" />
              </View>
            ))}
          </ScrollView>
          {/* P-193: X = 아이콘만(배경·보더 소멸 — P-181 연필 문법), 터치는 hitSlop */}
          <Pressable style={styles.viewerClose} hitSlop={14} onPress={() => setOpenAt(null)} testID="viewer-close">
            <IconClose size={22} color="#fff" />
          </Pressable>
          {photos.length > 1 && (
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
              ))}
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

/** P-201: 리뷰 장소 태그 — MANUAL(직접 입력)은 좌표·주소 null. */
export type ReviewPlaceTag = { name: string; roadAddress: string | null; latitude?: number | null; longitude?: number | null };
const toTag = (p: ReviewPlace): ReviewPlaceTag => ({ name: p.name, roadAddress: p.address, latitude: p.latitude, longitude: p.longitude });

/**
 * 장소 픽커 시트 (P-095 목 → P-201 실연결) — 작성·수정 공용:
 * 열림 = nearby(고정 좌표 — 강남역) 탑10 프리로드 · 입력 = search 실호출 ·
 * 직접 입력(MANUAL) = 결과 미선택 채로 이름만 태그. Recent·typeahead·Skip 푸터.
 */
export function PlacePickerSheet({
  open,
  onClose,
  onPick,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (p: ReviewPlaceTag) => void;
  t: TFn;
}) {
  const [q, setQ] = React.useState('');
  const term = q.trim();
  const nearby = useQuery({ queryKey: ['places', 'nearby'], queryFn: fetchNearbyPlaces, enabled: open, staleTime: 60_000 });
  const search = useQuery({ queryKey: ['places', 'search', term], queryFn: () => fetchSearchPlaces(term), enabled: open && term.length > 0 });
  const active = term ? search : nearby;
  const results = active.data ?? [];
  if (!open) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Pressable hitSlop={10} onPress={onClose}>
              <IconClose size={20} color={C.ink2} />
            </Pressable>
            <Text style={styles.pickerTitle}>{t('review.placeSheetTitle')}</Text>
            <View style={{ width: 20 }} />
          </View>
          <View style={styles.searchBox}>
            <IconSearch size={17} color={C.ink2} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder={t('community.searchPlaces')}
              placeholderTextColor={C.ink3}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
          {!term && <Text style={styles.recentLbl}>{t('review.placeNearby')}</Text>}
          <ScrollView keyboardDismissMode="on-drag" style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {/* P-201: 직접 입력(MANUAL) — 결과 미선택 채로 이름만 태그(좌표·주소 없음) */}
            {!!term && (
              <Pressable style={styles.resultRow} onPress={() => onPick({ name: term, roadAddress: null })} testID="place-manual">
                <IconPlus size={16} color={C.ink3} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.resultText} numberOfLines={1}>{t('review.placeManual', { name: term })}</Text>
                </View>
              </Pressable>
            )}
            {active.isLoading ? (
              <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                <ActivityIndicator color={C.ink3} />
              </View>
            ) : results.length === 0 && !term ? (
              <Text style={styles.noResults}>{t('review.placeNoResults')}</Text>
            ) : (
              results.map((p) => (
                <Pressable key={`${p.name}-${p.latitude ?? ''}`} style={styles.resultRow} onPress={() => onPick(toTag(p))} testID={`place-pick-${p.name}`}>
                  <IconMapPin size={16} color={C.ink3} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.resultText} numberOfLines={1}>{p.name}</Text>
                    {!!p.address && <Text style={styles.resultSub} numberOfLines={1}>{p.address}</Text>}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
          {/* Skip 푸터 — 장소 없이 게시 (D-09) */}
          <Pressable style={styles.skipRow} onPress={onClose} hitSlop={6}>
            <Text style={styles.skipText}>{t('review.placeSkip')}</Text>
          </Pressable>
        </View>
      </View>
      <KeyboardDismissBar modal />
    </Modal>
  );
}

/**
 * 장소 줄 (P-201/KB-249) — 전 리뷰 표면 공용: 장소 칩(P-211 ② — 핀+회색 텍스트가
 * 묻혀서 커뮤니티 게시글 TagChip 배경 칩으로 교체, 새 발명 0), 탭 = 3사 지도 시트.
 * 좌표 보유(카카오 선택분) = 좌표 딥링크 · MANUAL(이름만) = 이름 검색 폴백 —
 * 분기는 tagSheets mapUrls 한 곳. 무태그 = 미렌더. 플래그 게이트는 호출측 아닌
 * 여기서(표면 4곳 개별 게이트 금지 — P-196 단일화 원칙 승계).
 */
export function ReviewPlaceLine({ place }: { place: Review['place'] }) {
  const [open, setOpen] = React.useState(false);
  if (!FLAGS.reviewPlaceEnabled || !place?.name) return null;
  return (
    <>
      <View style={{ alignSelf: 'flex-start' }}>
        <TagChip kind="place" label={place.name} onPress={() => setOpen(true)} testID="review-place" />
      </View>
      {open && (
        <PlaceTagSheet
          place={{ name: place.name, roadAddress: place.roadAddress ?? '', latitude: place.latitude, longitude: place.longitude }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Helpful 토글 (P-196) — 4표면(피드·상세 프리뷰·전체 목록·내 리뷰) **유일 경유**.
 * 표면별 개별 배선 금지(이번 반려 = 표면별 상이 동작 사례) — 버튼·뮤테이션·게스트/
 * 본인 분기 전부 여기 한 곳. **본인(mine) = 카운트 표시 전용**(탭 무반응·비활성 톤,
 * 숨김 아님 — 자기 투표 왜곡·Helpful 알림 자가 트리거 차단, 예진 확정 8/13).
 * 게스트 = onGuest(게이트 시트, 미전달 표면은 무반응 — 401 송신 0).
 */
/**
 * 리뷰 확장 별점 3축 (P-202/KB-32 — 쿠팡이츠식 섹션, 디자이너 시안용 러프).
 * "How was the restaurant? (optional)" — Speed·Service 항상(속도 노출 조건은
 * 종한 답 대기 — 우선 항상, 조정 1줄 준비) · Getting there = 장소 태그 있을 때만.
 * 각 1~5 전부 선택 · **재탭 = 해제**. 보조 별 = 기존 Star 소형 변형(총점과 위계 구분).
 */
const EXTRA_AXES: { key: keyof ReviewExtras; labelKey: string; Icon: typeof IconZap; needsPlace?: boolean }[] = [
  { key: 'speed', labelKey: 'review.extrasSpeed', Icon: IconZap },
  { key: 'service', labelKey: 'review.extrasService', Icon: IconSmile },
  { key: 'access', labelKey: 'review.extrasAccess', Icon: IconMapPin, needsPlace: true },
];

export function ExtrasRater({
  extras,
  onChange,
  hasPlace,
  t,
}: {
  extras: ReviewExtras;
  onChange: (next: ReviewExtras) => void;
  /** 장소 태그 보유 — false면 찾아가기 행 미노출(값 소거는 호출측 setPlace 연동) */
  hasPlace: boolean;
  t: TFn;
}) {
  if (!FLAGS.reviewExtrasEnabled) return null;
  return (
    <View style={styles.extrasBox} testID="review-extras">
      <Text style={styles.extrasTitle}>{t('review.extrasTitle')}</Text>
      {EXTRA_AXES.filter((a) => !a.needsPlace || hasPlace).map(({ key, labelKey, Icon }) => (
        <View key={key} style={styles.extrasRow} testID={`extras-row-${key}`}>
          <View style={styles.extrasLabelWrap}>
            <Icon size={14} color={C.ink2} />
            <Text style={styles.extrasLabel}>{t(labelKey)}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                hitSlop={5}
                testID={`extras-${key}-${n}`}
                onPress={() => onChange({ ...extras, [key]: extras[key] === n ? null : n })} // 재탭 = 해제
              >
                <Star size={20} fillPct={(extras[key] ?? 0) >= n ? 100 : 0} fillColor={C.primary} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * 셀 축약 표시 (P-202) — 값 있는 축만 아이콘+숫자(SVG — 이모지 금지·헌법).
 * BE 미저장이라 **본인 작성 직후 로컬만 표시**(메모리 — 재시작 소실, 시안용 한계).
 */
export function ReviewExtrasLine({ review, mine }: { review: Review; mine: boolean }) {
  if (!FLAGS.reviewExtrasEnabled || !mine) return null;
  const extras = getLocalExtras(review.foodId);
  if (!extras || !hasAnyExtras(extras)) return null;
  return (
    <View style={styles.extrasLine} testID="extras-line">
      {EXTRA_AXES.filter((a) => extras[a.key] != null).map(({ key, Icon }) => (
        <View key={key} style={styles.extrasChip}>
          <Icon size={12} color={C.ink3} />
          <Text style={styles.extrasChipText}>{extras[key]}</Text>
        </View>
      ))}
    </View>
  );
}

export function HelpfulButton({
  review,
  mine,
  foodId,
  t,
  onGuest,
}: {
  review: Review;
  mine: boolean;
  /** 뮤테이션 캐시 키용 — 생략 시 review.foodId */
  foodId?: string;
  t: TFn;
  onGuest?: () => void;
}) {
  const toggle = useToggleReviewLike();
  const isGuest = useIsGuest();
  const surface = (useSegments() as string[]).join('/') || 'root'; // P-214: 표면 = 라우트 패턴(PII 0)
  const onPress = () => {
    if (mine) return; // 카운트 표시 전용
    if (isGuest) return onGuest?.();
    track(EVENTS.review_helpful_toggle, { on: !review.myLike, surface }); // P-214: 4표면 공용 한 곳
    toggle.mutate({ reviewId: review.id, foodId: foodId ?? review.foodId }); // 낙관 토글(멱등 — 가드 예외)
  };
  return (
    <Pressable hitSlop={8} onPress={onPress} disabled={mine} testID={`helpful-${review.id}`}>
      <Text style={[styles.helpful, review.myLike && styles.helpfulOn, mine && styles.helpfulMine]}>
        {t('reviews.helpful', { count: review.likes ?? 0 })}
      </Text>
    </Pressable>
  );
}

/** 본인 리뷰 수정 시트 — 구 디테일 editing(별점+본문, 사진은 buildReviewUpdate가 보존) 이식.
 *  P-201: 장소 행 추가 — 프리필·교체·해제(항상 명시 전송: 값 = 유지/교체, null = 해제). */
export function ReviewEditSheet({
  review,
  onClose,
  onSave,
  saving,
  t,
}: {
  review: Review | null;
  onClose: () => void;
  /** 호출측이 updateReview.mutate(buildReviewUpdate 경유) 배선 */
  onSave: (changes: { rating: number; body: string; place: Review['place'] }) => void;
  saving?: boolean;
  t: TFn;
}) {
  const [rating, setRating] = React.useState(0);
  const [body, setBody] = React.useState('');
  const [place, setPlace] = React.useState<Review['place']>(null);
  const [placeSheet, setPlaceSheet] = React.useState(false);
  // P-202: 3축 — 프리필 = 로컬 보관분(BE 미저장), 저장 시 로컬 갱신(전송은 계약 후)
  const [extras, setExtras] = React.useState<ReviewExtras>(EMPTY_EXTRAS);
  React.useEffect(() => {
    if (review) {
      setRating(review.rating);
      setBody(review.body ?? '');
      setPlace(review.place ?? null);
      setExtras(getLocalExtras(review.foodId) ?? EMPTY_EXTRAS);
    }
  }, [review]);
  // P-202: 장소 태그 해제 = 찾아가기 값 소거(발주 1)
  const clearPlace = () => {
    setPlace(null);
    setExtras((e) => ({ ...e, access: null }));
  };
  return (
    <Modal visible={review != null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.editBackdrop}>
        <View style={styles.editCard} testID="review-edit-sheet">
          <Text style={styles.editTitle}>{t('editReview.title')}</Text>
          <View style={styles.editStars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable key={i} onPress={() => setRating(i)} hitSlop={6} testID={`edit-star-${i}`}>
                <Star size={32} fillPct={i <= rating ? 100 : 0} fillColor={C.primary} />
              </Pressable>
            ))}
          </View>
          <Input
            value={body}
            onChangeText={setBody}
            multiline
            style={styles.editInput}
            textAlignVertical="top"
            placeholder={t('review.placeholder')}
            placeholderTextColor={C.ink3}
          />
          {/* P-201: 장소 행 — 작성 화면과 같은 문법(칩+해제 / 태그 행) */}
          {FLAGS.reviewPlaceEnabled &&
            (place?.name ? (
              <Pressable style={styles.editPlaceChip} onPress={() => setPlaceSheet(true)} testID="edit-place-chip">
                <IconMapPin size={13} color={C.ink2} />
                <Text style={styles.editPlaceText} numberOfLines={1}>{place.name}</Text>
                <Pressable hitSlop={8} onPress={clearPlace} testID="edit-place-clear">
                  <IconClose size={13} color={C.ink3} />
                </Pressable>
              </Pressable>
            ) : (
              <Pressable style={styles.editPlaceRow} onPress={() => setPlaceSheet(true)} hitSlop={4} testID="edit-place-add">
                <IconMapPin size={15} color={C.ink2} />
                <Text style={styles.editPlaceAdd}>{t('review.placeRow')}</Text>
              </Pressable>
            ))}
          {/* P-202: 3축 섹션(수정) — 찾아가기 = 장소 태그 연동 */}
          <ExtrasRater extras={extras} onChange={setExtras} hasPlace={place?.name != null} t={t} />
          <View style={{ gap: 9, marginTop: 4 }}>
            <Btn
              busy={saving}
              onPress={() => {
                if (review) saveLocalExtras(review.foodId, extras); // 로컬 프리뷰 갱신(전송은 계약 후)
                onSave({ rating, body, place });
              }}
              testID="edit-save"
            >
              {t('common.save')}
            </Btn>
            <Btn variant="ghost" onPress={onClose}>{t('common.cancel')}</Btn>
          </View>
        </View>
      </View>
      {/* 열렸을 때만 마운트 — 픽커의 useQuery가 닫힌 시트에서 QueryClient를 요구하지 않게 */}
      {placeSheet && (
        <PlacePickerSheet
          open
          onClose={() => setPlaceSheet(false)}
          onPick={(p) => {
            setPlace(p);
            setPlaceSheet(false);
          }}
          t={t}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19 },
  toggle: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primaryText },
  // P-202: 3축 섹션(작성·수정 공용) + 셀 축약 — 기본 스타일(디자이너 폴리시 전)
  extrasBox: { gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 14 },
  extrasTitle: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink },
  extrasRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  extrasLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  extrasLabel: { fontFamily: font.body, fontSize: 13, color: C.ink2 },
  extrasLine: { flexDirection: 'row', gap: 8, alignSelf: 'flex-start' },
  extrasChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  extrasChipText: { fontFamily: font.bodyBold, fontSize: 11.5, color: C.ink3 },
  // P-201: 장소 줄 — 핀+이름 한 줄(조용한 톤), 탭 = 지도 시트
  // P-196: Helpful — 상태별 색만 전환(프레임 불변): 기본 ink2 · 내 토글 primary · 본인 ink3
  helpful: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  helpfulOn: { color: C.primaryText },
  helpfulMine: { color: C.ink3 },
  strip: { flexDirection: 'row', gap: 6 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 54, right: 18 },
  dots: { position: 'absolute', bottom: 42, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { backgroundColor: '#fff' },
  editBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  editCard: { backgroundColor: C.card, borderRadius: 26, padding: 20, gap: 12, ...shadow.shPop },
  editTitle: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  editStars: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  editInput: { minHeight: 110, maxHeight: 220, backgroundColor: C.surface2, borderRadius: radius.sm, padding: 12, fontFamily: font.body, fontSize: 14, color: C.ink, lineHeight: 20 },
  // P-201: 수정 시트 장소 행/칩 — 작성 화면 문법 축약
  editPlaceChip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.surface2, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
  editPlaceText: { flex: 1, fontFamily: font.bodyBold, fontSize: 13, color: C.ink },
  editPlaceRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 2 },
  editPlaceAdd: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  // P-201: 장소 픽커 시트 (review.tsx P-095 스타일 이식 — 작성·수정 공용화로 이동)
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet: { height: '92%', backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, gap: 12, ...shadow.sh2 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerTitle: { fontFamily: font.display, fontSize: 17, color: C.ink },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, paddingHorizontal: 13 },
  searchInput: { flex: 1, paddingVertical: 11, fontFamily: font.body, fontSize: 14.5, color: C.ink },
  recentLbl: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 0.6, color: C.ink3, textTransform: 'uppercase' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  resultText: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  resultSub: { fontFamily: font.body, fontSize: 11.5, color: C.ink3, marginTop: 1 },
  noResults: { fontFamily: font.body, fontSize: 13, color: C.ink3, textAlign: 'center', paddingVertical: 26 },
  skipRow: { alignItems: 'center', paddingVertical: 12 },
  skipText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink2 },
});

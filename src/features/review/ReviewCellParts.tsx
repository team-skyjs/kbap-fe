/**
 * ReviewCellParts (P-182/KB-307) — 리뷰 2depth 셀 확장 공통 문법.
 * 개별 디테일(review/[id]) 소멸 — 목록 ReviewResponse가 풀 필드(전문·사진·likedByMe)라
 * 셀 안에서 전부 소비(쿠팡식). 전 표면(상세 프리뷰·전체 목록·커뮤니티 피드·내 리뷰) 공용:
 *   - ExpandableBody: 3줄 클램프 + See more/less 셀 내 펼침
 *   - ReviewPhotoStrip: 가로 스트립 + 탭 = 풀스크린 뷰어(페이징·닫기 — 기존 뷰어 부재로 표준 신설)
 */
import * as React from 'react';
import { RemoteImage } from '@/components/RemoteImage';
import { PhotoViewer } from '@/components/PhotoViewer';
import { ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { Btn, CardPhoto, IconClose, IconMapPin, IconSmile, IconThumbsUp, IconZap, Star } from '@/components';
import Animated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSheetSwipeDismiss } from '@/components/useSheetSwipeDismiss';
import { EMPTY_EXTRAS, extrasFromReview, hasAnyExtras, type ReviewExtras } from '@/lib/review/reviewExtras';
import { PlaceTagSheet } from '@/features/community/placeMap';
import { TagChip } from '@/features/community/parts';
import { useSegments } from 'expo-router';
import { EVENTS, track } from '@/lib/analytics';
import { showTopToast } from '@/components/topToastStore';
import { useQuery } from '@tanstack/react-query';
import { fetchNearbyPlaces, fetchSearchPlaces, type ReviewPlace } from '@/lib/api/places';
import { IconPlus, IconSearch } from '@/components';
import { KeyboardDismissBar } from '@/components/KeyboardDismissBar';
import { useBottomInset } from '@/lib/useBottomInset';
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
export function ReviewPhotoStrip({ photos, size = 72, radius = 10 }: { photos: string[]; size?: number; radius?: number }) {
  const [openAt, setOpenAt] = React.useState<number | null>(null);
  const { width } = useWindowDimensions();
  const [page, setPage] = React.useState(0);
  if (!photos.length) return null;
  return (
    <>
      <View style={styles.strip}>
        {photos.slice(0, 3).map((uri, i) => (
          <Pressable key={uri} hitSlop={4} onPress={() => { setPage(i); setOpenAt(i); }} testID={`photo-${i}`}>
            <RemoteImage uri={uri} style={{ width: size, height: size, borderRadius: radius, backgroundColor: C.surface2 }} />
          </Pressable>
        ))}
      </View>
      {/* P-348 ⑥(KB-511): 공용 PhotoViewer — 세로 스와이프 닫기 포함 */}
      {openAt != null && <PhotoViewer uris={photos} index={openAt} onClose={() => setOpenAt(null)} />}
    </>
  );
}

/** P-201: 리뷰 장소 태그 — MANUAL(직접 입력)은 좌표·주소 null. */
export type ReviewPlaceTag = { name: string; roadAddress: string | null; latitude?: number | null; longitude?: number | null; placeId?: string | null };
const toTag = (p: ReviewPlace): ReviewPlaceTag => ({ name: p.name, roadAddress: p.address, latitude: p.latitude, longitude: p.longitude, placeId: p.placeId }); // P-240: placeId 관통

/**
 * 예진 실기 프리즈(9/5, 리뷰 제출 직후 행): iOS에서 **포커스 TextInput을 품은
 * Modal을 키보드 해제와 같은 프레임에 unmount**하면 메인 스레드 행 계열 —
 * persistTaps 리스트의 수동 확정 행이 키보드 올라온 채 탭 관통되는 게 전제조건
 * (검색 결과 행은 보통 스크롤(on-drag dismiss) 뒤 탭이라 평소엔 안 굳음).
 * 시트를 닫는 **모든 경로**(확정·결과 선택·X·Skip·백버튼)가 이 헬퍼 경유 —
 * 키보드를 먼저 내리고(didHide 대기, 400ms 안전망) 닫는다. 미표시면 즉시.
 */
export function runAfterKeyboardHidden(fn: () => void): Promise<void> {
  // Codex #24 P1: 실행 완료를 resolve하는 Promise — 호출부(제출 등)가 await해
  // 지연 창(didHide/400ms) 동안 busy 가드(P-173 useSubmitGuard)가 풀리지 않게 한다.
  return new Promise((resolve) => {
    const run = () => {
      fn();
      resolve();
    };
    if (!Keyboard.isVisible()) {
      run();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      sub.remove();
      run();
    };
    const sub = Keyboard.addListener('keyboardDidHide', finish);
    Keyboard.dismiss();
    setTimeout(finish, 400); // didHide 유실(드물게) 안전망 — 중복은 done 가드
  });
}

/**
 * 장소 픽커 시트 (P-095 목 → P-201 실연결) — 작성·수정 공용:
 * 열림 = nearby(고정 좌표 — 강남역) 탑10 프리로드 · 입력 = search 실호출 ·
 * 직접 입력(MANUAL) = 결과 미선택 채로 이름만 태그. Recent·typeahead·Skip 푸터.
 */
/** P-355(KB-517): 주문 상세 "Write a review" 음식 선택 — 네이티브 Alert 목록 대체.
 *  시트 크롬 = PlacePickerSheet 계열(A-RW-11: 제목 18/600 중앙) + 드래그 핸들 +
 *  useSheetSwipeDismiss(아래 스와이프)·배경 탭 닫힘·안드 자체 RootView(P-337 문법). */
export interface OrderDishPick {
  foodId: string;
  menuName: string;
  imageUrl: string | null;
}

export function OrderDishPickerSheet({
  open,
  onClose,
  onPick,
  items,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: OrderDishPick) => void;
  items: OrderDishPick[];
  t: TFn;
}) {
  const swipe = useSheetSwipeDismiss(onClose, open);
  const bottomInset = useBottomInset();
  if (!open) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* P-337: 안드에서 Modal = 별도 네이티브 루트 — 자체 RootView 필수 */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.pickerBackdrop} testID="order-dish-sheet">
          <Animated.View style={[StyleSheet.absoluteFill, styles.dishDim, swipe.dimStyle]} pointerEvents="none" />
          {/* 배경 탭 = 닫힘(시트 위 영역) */}
          <Pressable style={{ flex: 1 }} onPress={onClose} testID="order-dish-backdrop" />
          <Animated.View style={[styles.dishSheet, swipe.sheetStyle]} onLayout={swipe.onSheetLayout}>
            <GestureDetector gesture={swipe.gesture}>
              <View>{/* 제스처 영역 = 핸들 + 제목(리스트 스크롤 우선) */}
                <View style={styles.dishGrab} testID="order-dish-grab" />
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>{t('reviews.writeReview')}</Text>
                </View>
              </View>
            </GestureDetector>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 12 + bottomInset }} showsVerticalScrollIndicator={false}>
              {items.map((it) => (
                <Pressable key={it.foodId} style={styles.dishRow} onPress={() => onPick(it)} testID={`order-dish-${it.foodId}`}>
                  <View style={styles.dishThumb}>
                    <CardPhoto uri={it.imageUrl} borderRadius={4} />
                  </View>
                  <Text style={styles.dishName} numberOfLines={1}>{it.menuName}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

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
  const bottomInset = useBottomInset(); // Codex #31: 푸터 하단 인셋
  const nearby = useQuery({ queryKey: ['places', 'nearby'], queryFn: fetchNearbyPlaces, enabled: open, staleTime: 60_000 });
  const search = useQuery({ queryKey: ['places', 'search', term], queryFn: () => fetchSearchPlaces(term), enabled: open && term.length > 0 });
  const active = term ? search : nearby;
  const results = active.data ?? [];
  // 프리즈 픽스: 닫힘·확정 전부 키보드 선해제 경유(위 runAfterKeyboardHidden 참조)
  const close = () => runAfterKeyboardHidden(onClose);
  const pick = (p: ReviewPlaceTag) => runAfterKeyboardHidden(() => onPick(p));
  if (!open) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={styles.pickerBackdrop}>
        <View style={styles.pickerSheet}>
          {/* A-RW-11(KB-486): 제목 중앙·X 없음(닫기 = 스크림 탭 현행 유지) */}
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{t('review.placeSheetTitle')}</Text>
          </View>
          <View style={styles.searchBox}>
            <Input
              value={q}
              onChangeText={setQ}
              placeholder={t('community.searchPlaces')}
              placeholderTextColor={C.ink3}
              style={styles.searchInput}
              autoCorrect={false}
            />
            <IconSearch size={20} color={'#D1D3D8'} />
          </View>
          {!term && <Text style={styles.recentLbl}>{t('review.placeNearby').toUpperCase()}</Text>}
          <ScrollView keyboardDismissMode="on-drag" style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {/* P-201: 직접 입력(MANUAL) — 결과 미선택 채로 이름만 태그(좌표·주소 없음) */}
            {!!term && (
              <Pressable style={styles.resultRow} onPress={() => pick({ name: term, roadAddress: null })} testID="place-manual">
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
                <Pressable key={`${p.name}-${p.latitude ?? ''}`} style={styles.resultRow} onPress={() => pick(toTag(p))} testID={`place-pick-${p.name}`}>
                  <IconMapPin size={12} color={C.ink3} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.resultText} numberOfLines={1}>{p.name}</Text>
                    {!!p.address && <Text style={styles.resultSub} numberOfLines={1}>{p.address}</Text>}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
          {/* KB-432 §2-10(4150:16737): FixedBottom — outline "장소 없이 게시" + primary "Done" */}
          <View style={[styles.sheetBottom, { paddingBottom: 8 + bottomInset }]} testID="place-sheet-bottom">
            <View style={styles.sheetBottomSkip}>
              <Btn variant="ghost" onPress={() => void close()} testID="place-skip">
                {t('review.placeSkip')}
              </Btn>
            </View>
            <View style={{ flex: 1 }}>
              <Btn onPress={() => void close()} testID="place-done">
                {t('community.done')}
              </Btn>
            </View>
          </View>
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
// P-236: 서버 정본 2축 — 'Getting there'는 서버 필드 부재로 제거(멘토 결정 반영)
const EXTRA_AXES: { key: keyof ReviewExtras; labelKey: string; Icon: typeof IconZap }[] = [
  { key: 'speed', labelKey: 'review.extrasSpeed', Icon: IconZap },
  { key: 'service', labelKey: 'review.extrasService', Icon: IconSmile },
];

/** Codex #31 P2: 세부 별 행 폭 적응 — 기본 32/16(=224pt)이 협폭(320 폰·편집 모달)에서
 *  넘침: 가용폭에 맞춰 gap 축소(최소 8) → 그래도 넘치면 별 스케일 다운(시안 비율 유지). */
export function fitExtrasStars(availW: number): { size: number; gap: number } {
  const BASE = { size: 32, gap: 16 };
  if (availW <= 0 || BASE.size * 5 + BASE.gap * 4 <= availW) return BASE;
  const gap = Math.max(8, Math.floor((availW - BASE.size * 5) / 4));
  if (BASE.size * 5 + gap * 4 <= availW) return { size: BASE.size, gap };
  return { size: Math.max(16, Math.floor((availW - 8 * 4) / 5)), gap: 8 };
}

export function ExtrasRater({
  extras,
  onChange,
  t,
}: {
  extras: ReviewExtras;
  onChange: (next: ReviewExtras) => void;
  t: TFn;
}) {
  const [starW, setStarW] = React.useState(0);
  if (!FLAGS.reviewExtrasEnabled) return null;
  // KB-432 §2-4(4150:16482): 2행 mx39 gap18 — 라벨 13/500 + 수치 13/600 / 별 32 gap 16(빈 stroke 2)
  const { size, gap } = fitExtrasStars(starW);
  return (
    <View style={styles.extrasBox} testID="review-extras">
      {EXTRA_AXES.map(({ key, labelKey }) => (
        <View key={key} style={styles.extrasRow} testID={`extras-row-${key}`}>
          <View style={styles.extrasLabelWrap}>
            <Text style={styles.extrasLabel} numberOfLines={1}>{t(labelKey)}</Text>
            {extras[key] != null && <Text style={styles.extrasValue}>{extras[key]}</Text>}
          </View>
          <View
            style={{ flexDirection: 'row', gap, flexShrink: 1 }}
            onLayout={(e) => setStarW((cur) => (cur === 0 ? e.nativeEvent.layout.width : cur))}
            testID={`extras-stars-${key}`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                hitSlop={5}
                testID={`extras-${key}-${n}`}
                onPress={() => onChange({ ...extras, [key]: extras[key] === n ? null : n })} // 재탭 = 해제
              >
                <Star size={size} fillPct={(extras[key] ?? 0) >= n ? 100 : 0} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * 셀 축약 표시 (P-202 → P-236) — **서버 값** 기반(전 리뷰 표시 — 로컬 프리뷰 폐기).
 * 값 있는 축만 아이콘+숫자(SVG — 이모지 금지·헌법). 0(미평가) = 그 축 비표시
 * (0점으로 그리면 오독), 둘 다 0(구 리뷰 전부) = 줄 자체 미렌더(빈 컨테이너 금지).
 */
export function ReviewExtrasLine({ review, mine: _mine }: { review: Review; mine: boolean }) {
  if (!FLAGS.reviewExtrasEnabled) return null;
  const extras = extrasFromReview(review);
  if (!hasAnyExtras(extras)) return null;
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
    if (mine) {
      // P-357(KB-520): 무동작 대신 안내 토스트(에러 변형 아님) — 뮤테이션·계측 0
      showTopToast(t('reviews.helpfulOwnToast'), { icon: 'alert' }); // P-366 ③: 안내 = 느낌표(에러 변형 아님)
      return;
    }
    if (isGuest) return onGuest?.();
    track(EVENTS.review_helpful_toggle, { on: !review.myLike, surface }); // P-214: 4표면 공용 한 곳
    // P-366 ④ → #131 P2: 토스트 = 성공 후 발화(실패 롤백 시 무토스트) — 켜는 방향은
    // 호출 시점 스냅샷(onSuccess 시점 myLike는 낙관 반영으로 이미 반전됨)
    const turningOn = !review.myLike;
    toggle.mutate(
      { reviewId: review.id, foodId: foodId ?? review.foodId }, // 낙관 토글(멱등 — 가드 예외)
      { onSuccess: () => { if (turningOn) showTopToast(t('reviews.helpfulMarkedToast')); } },
    );
  };
  return (
    /* KB-430(4150:13934): 버튼형 — h30 pad 7/13 line 1px r4, thumbs-up 16 + 12/500.
       로직·경유는 무변(전 표면 공용) — 스타일만 시안. */
    /* P-342 ①(KB-503, DS 2083:5620): 시안 helpful-row — thumbs-up 16 + 숫자만,
       61×30 고정(pad 7/13, gap 4, r4) — "Helpful (n)" 텍스트 폐기. 눌림 = #FF7134
       stroke·아이콘·숫자(색만 — P-151). 99+ 컴팩트(#100 P2) 유지, a11y = "Helpful, n". */
    <Pressable
      hitSlop={8}
      onPress={onPress}
      style={[styles.helpfulBtn, review.myLike && styles.helpfulBtnOn]}
      accessibilityRole="button"
      accessibilityLabel={t('reviews.helpful', { count: review.likes ?? 0 })} /* 기존 키 재사용 — 신규 0 */
      testID={`helpful-${review.id}`}
    >
      <IconThumbsUp size={16} color={mine ? C.ink3 : review.myLike ? C.primary : C.ink2} />
      <Text style={[styles.helpfulCount, review.myLike && styles.helpfulOn, mine && styles.helpfulMine]} numberOfLines={1}>
        {(review.likes ?? 0) > 99 ? '99+' : String(review.likes ?? 0)}
      </Text>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  body: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19 },
  toggle: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primaryText },
  // P-202: 3축 섹션(작성·수정 공용) + 셀 축약 — 기본 스타일(디자이너 폴리시 전)
  // KB-432 §2-4: 카드 박스 소멸 — mx 39 플랫 2행
  extrasBox: { gap: 18, marginHorizontal: 20 }, // P-348 ⑦: 39는 ko/id 라벨+별 5개 공존 불가(i18n 예외)
  extrasRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  extrasLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }, // A-RW-04 → P-348 ⑦: 라벨 고정(별 행이 축소)
  extrasLabel: { fontSize: 13, fontWeight: '500', color: C.ink2 },
  extrasValue: { fontSize: 13, fontWeight: '600', color: '#2F3137' },
  extrasLine: { flexDirection: 'row', gap: 8, alignSelf: 'flex-start' },
  extrasChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  extrasChipText: { fontFamily: font.bodyBold, fontSize: 11.5, color: C.ink3 },
  // P-201: 장소 줄 — 핀+이름 한 줄(조용한 톤), 탭 = 지도 시트
  // P-196: Helpful — 상태별 색만 전환(프레임 불변): 기본 ink2 · 내 토글 primary · 본인 ink3
  // 9/5 시안 실측(4123:3696): 흰 bg + border #EAEBEE 1px r4, h30 pad 7/13, gap 4, 12/500 #2F3137
  helpfulBtn: { minWidth: 61, height: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EAEBEE', borderRadius: 4, backgroundColor: '#FFFFFF' }, // P-342 ① 2R: 시안 61 = 보더 포함 — pad 12/6+border 1, 2자리 = 61·99+만 자연 확장
  helpfulBtnOn: { borderColor: C.primary }, // 눌림 = 스트로크 색만(프레임 불변)
  helpfulCount: { fontSize: 12, fontWeight: '700', color: '#2F3137', fontVariant: ['tabular-nums'] }, // P-342 ①
  helpful: { fontSize: 12, fontWeight: '500', color: '#2F3137' },
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
  // P-355(KB-517): 음식 선택 시트 — 드래그 페이드는 dim 레이어(compose P-337 문법)
  dishDim: { backgroundColor: 'transparent' },
  dishSheet: { maxHeight: '70%', backgroundColor: C.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 12, ...shadow.sh2 },
  dishGrab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 },
  dishRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 66, borderBottomWidth: 1, borderBottomColor: '#EAEBEE' }, // A-RW-11 값
  dishThumb: { width: 48, height: 48, borderRadius: 4, overflow: 'hidden', backgroundColor: C.surface2 },
  dishName: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '600', color: C.ink },
  pickerSheet: { height: '92%', backgroundColor: C.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 20, ...shadow.sh2 }, // A-RW-11
  pickerHeader: { alignItems: 'center' }, // A-RW-11(중앙)
  pickerTitle: { fontSize: 18, fontWeight: '600', color: C.ink }, // A-RW-11
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, borderRadius: 4, paddingLeft: 16, paddingRight: 14 }, // A-RW-11(Input/Search DS)
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15, fontWeight: '500', color: C.ink }, // A-RW-11(h48)
  // KB-432 §2-10: 라벨 12/500 · 행 h66(장소명 15/600 / 주소 13/500 #6A6F7C)
  recentLbl: { fontSize: 12, fontWeight: '500', color: C.ink3 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 66, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }, // A-RW-11(핀 인라인 gap 2)
  resultText: { fontSize: 15, fontWeight: '600', color: C.ink },
  resultSub: { fontSize: 13, fontWeight: '500', color: C.ink2, marginTop: 1 },
  noResults: { fontFamily: font.body, fontSize: 13, color: C.ink3, textAlign: 'center', paddingVertical: 26 },
  // §2-10 FixedBottom
  sheetBottom: { flexDirection: 'row', gap: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line }, // 하단 = 8 + bottomInset(인라인)
  sheetBottomSkip: { flexShrink: 0, minWidth: 119 },
});

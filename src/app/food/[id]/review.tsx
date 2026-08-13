/**
 * Review compose (mockup Screen H) — rate 1–5 + write a review for a dish.
 * Compose state → submitted confirmation (counts toward ranking).
 *
 * P-085(KB-73): 실연결 — 사진 presigned 업로드(purpose REVIEW) → POST /reviews,
 * 성공 시 서버 재조회(무효화)가 진실 (목 캐시 삽입 폐기). Rating required
 * (1–5 integer). No emoji; reader text i18n'd; risk colors fixed.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardDismissBar } from '@/components';
import { Txt as Text } from '@/components/Txt';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C, font, primaryTint, radius, shadow } from '@/lib/theme';
import { SubHeader, Btn, CardPhoto, Star, Stars, RiskMark, IconCheck, IconChevron, IconClose, IconMapPin, IconPlus, IconSearch, Input } from '@/components';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useCreateReview } from '@/lib/data/useReviewMutations';
import { useIsGuest } from '@/lib/auth/useSession';
import { Snackbar } from '@/components/Snackbar';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { EVENTS, track } from '@/lib/analytics';
import { addReviewPhotos, canPostReview, removeReviewPhoto, REVIEW_MAX_PHOTOS, uploadReviewImages } from '@/lib/review/reviewPhotos';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { cancelReviewReminder } from '@/lib/push/pushAdapter';
import { searchPlaces } from '@/lib/community/places';
import type { PlaceTagRef } from '@/lib/community/types';
import { Modal, TextInput as RNTextInput } from 'react-native';

const MAX = 1000; // P-085: 계약 확정값 (구 500)

export default function ReviewCompose() {
  // KB-148: 리뷰 MVP 제외 — 진입점이 없어도 딥링크/백스택으로 도달 가능하니 홈으로.
  // FLAGS는 컴파일 상수라 훅 순서에 영향 없음 (플래그 켜면 이 가드는 no-op)
  if (!FLAGS.reviewsEnabled) return <Redirect href="/" />;

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { data: food } = useFoodDetail(id ?? '');

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [postError, setPostError] = useState(false);
  // P-095: 장소 태그(선택) — 목 데이터(커뮤니티 places 재사용, 실검색은 KB-249)
  const [place, setPlace] = useState<PlaceTagRef | null>(null);
  const [placeSheet, setPlaceSheet] = useState(false);
  const isGuest = useIsGuest();
  const createReview = useCreateReview();

  const labels = (t('review.labels', { returnObjects: true }) as string[]) ?? [];
  // P-168 🚨 → P-173 공용화: isPending은 mutateAsync 구간만 커버 — 사진 업로드 선행
  // 구간 포함 전체를 useSubmitGuard(동기 ref+busy)가 단일 비행으로 보장.
  const { busy: posting, run: runPost } = useSubmitGuard();
  const canPost = canPostReview(rating) && !posting;

  // P-156: 갤러리 멀티 선택 — selectionLimit = 남은 슬롯(3 − 현재). 구형 안드 등
  // limit 미준수 산출물은 addReviewPhotos slice(3)가 방어 + 안내 토스트 1회.
  const [capNote, setCapNote] = useState(false);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [photoImporting, setPhotoImporting] = useState(false); // P-191: 픽커 복귀~원본 준비 표시
  const pickPhoto = async () => {
    const remaining = REVIEW_MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    setPhotoImporting(true);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (!res.canceled && res.assets?.length) {
      if (res.assets.length > remaining) {
        setCapNote(true);
        if (capTimer.current) clearTimeout(capTimer.current);
        capTimer.current = setTimeout(() => setCapNote(false), 4000);
      }
      setPhotos((cur) => addReviewPhotos(cur, res.assets.map((a) => a.uri)));
    }
    setPhotoImporting(false);
  };

  // P-085(KB-73): 사진 presigned 업로드(purpose REVIEW, 전송=path) → POST /reviews.
  // 성공 시 무효화(useCreateReview)가 목록·평점을 서버값으로 갱신. 실패는 화면 유지+표시.
  const post = () =>
    runPost(async () => {
      if (!canPostReview(rating)) return;
      setPostError(false);
      try {
        const imagePaths = await uploadReviewImages(photos);
        await createReview.mutateAsync({
          foodId: id ?? '',
          rating,
          content: body.trim() || undefined,
          imagePaths,
          place,
        });
        track(EVENTS.review_submit, { has_photos: photos.length > 0, photo_count: photos.length, rating }); // P-083→144 확장
        if (id) void cancelReviewReminder(id); // P-192: 리뷰 썼으면 유도 알림 예약 취소
        setSubmitted(true);
      } catch (e) {
        console.log('[review] post failed — staying on screen:', (e as Error)?.message);
        setPostError(true); // 실패 = 버튼 복구(가드 finally) + 기존 에러 표면
      }
    });

  // 라우트 자체 가드 — 작성은 회원 전용. 진입 버튼 게이트와 별개의 이중 방어
  // (딥링크/직접 라우트 포함, 실기기 반려분 #2와 동일 원칙).
  if (isGuest) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('review.title')} onBack={() => router.back()} />
        <AuthGateSheet context="writeReview" open onClose={() => router.back()} />
      </View>
    );
  }

  // P-150② → P-158① 재작업(실기 재반려): 접근 교체 —
  // ⓐ 키보드 높이 실측(Keyboard 이벤트) → 컨테이너 하단 패딩 = 키보드+여유
  //    (맨 아래 줄이 항상 키보드 위 공간에 존재)
  // ⓑ 입력 블록 하단 y(onLayout — 성장 시 재발화)를 커서 하단 프록시로,
  //    성장/셀렉션 변경마다 가시 영역(뷰포트−키보드) 하단 위로 스크롤.
  //    P-163: 단, 프록시가 유효한 "커서 = 문서 끝"일 때만(중간 편집 무개입).
  const scrollRef = useRef<ScrollView>(null);
  const bodyInputRef = useRef<TextInput>(null);
  const [kbH, setKbH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      kbHRef.current = e.endCoordinates?.height ?? 0;
      setKbH(kbHRef.current);
      // P-163: 포커스 시점엔 키보드 높이가 없어 스크롤이 못 뜀 — 실측 도착 시 1회(끝 커서만)
      if (atEnd.current) ensureCursorVisible();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbH(0));
    return () => {
      show.remove();
      hide.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const svH = useRef(0); // ScrollView 뷰포트 높이 실측
  const blockBottom = useRef(0); // 입력 블록 하단 y(스크롤 콘텐츠 좌표) — 커서 하단 프록시
  const kbHRef = useRef(0);
  kbHRef.current = kbH;
  // P-163: 블록 하단 프록시는 "커서 = 문서 끝"일 때만 유효 — 중간/상단 편집 시
  // 하단 추종이 화면을 뺏는 회귀(실기 스샷). 셀렉션으로 끝 여부를 추적해 게이트.
  const atEnd = useRef(true);
  const bodyLenRef = useRef(0);
  bodyLenRef.current = body.length;
  const ensureCursorVisible = () => {
    const visible = svH.current - kbHRef.current;
    if (visible <= 0 || !blockBottom.current) return;
    const target = blockBottom.current - visible + 16; // 커서 줄이 키보드 위 16pt
    if (target > 0) scrollRef.current?.scrollTo({ y: target, animated: true });
  };


  return (
    <View style={styles.root}>
      {/* P-168 ③: 헤더 Post 소멸 — 제출 진입점은 하단 "Post review" 단일화 */}
      <SubHeader title={t('review.title')} onBack={() => router.back()} />
      {capNote && <Snackbar icon={null} text={t('review.photoCapNote', { max: REVIEW_MAX_PHOTOS })} />}
      {/* P-158 ①: 키보드 실측 패딩(contentContainer) + 블록 하단 프록시 스크롤 —
          커서 추종은 위 ensureCursorVisible 참조 (P-150② 인셋 방식은 폐기됨) */}
      <ScrollView
        ref={scrollRef}
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.body, { paddingBottom: 28 + kbH }]}
        keyboardShouldPersistTaps="handled"
        onLayout={(e) => { svH.current = e.nativeEvent.layout.height; }}
      >
        {/* food chip */}
        <View style={styles.foodChip}>
          {/* P-170 A안: 썸네일 = 상세 캐시(useFoodDetail) 재사용 — 네트워크 0, 무사진 폴백 */}
          {food?.photoUrl ? (
            <View style={styles.foodPh}>
              <CardPhoto uri={food.photoUrl} borderRadius={12} />
            </View>
          ) : (
            <View style={styles.foodPh} testID="food-ph" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.foodName}>{food?.name ?? ''}</Text>
            {!!food?.nameKo && food.nameKo !== food.name && <Text style={styles.foodKo}>{food.nameKo}</Text>}
          </View>
        </View>

        {/* rating */}
        <View style={styles.block}>
          <Text style={styles.label}>{t('review.ratingLabel')}</Text>
          <View style={styles.starPick}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable key={i} onPress={() => setRating(i)} hitSlop={4}>
                <Star size={44} fillPct={i <= rating ? 100 : 0} fillColor={C.primary} />
              </Pressable>
            ))}
          </View>
          <Text style={[styles.starCap, !rating && styles.starCapEmpty]}>
            {rating ? t('review.ratingValue', { value: rating, label: labels[rating] ?? '' }) : t('review.tapToRate')}
          </Text>
        </View>

        {/* body — onLayout: 블록 하단 = 커서 하단 프록시(성장 시 재발화) */}
        <View
          style={styles.block}
          onLayout={(e) => { blockBottom.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height; }}
        >
          <Text style={styles.label}>{t('review.reviewLabel')}</Text>
          <Input
            ref={bodyInputRef}
            value={body}
            onChangeText={(v) => setBody(v.slice(0, MAX))}
            placeholder={t('review.placeholder')}
            placeholderTextColor={C.ink3}
            multiline
            style={styles.textarea}
            textAlignVertical="top"
            onContentSizeChange={() => {
              if (atEnd.current) ensureCursorVisible();
            }}
            onSelectionChange={(e) => {
              // P-163: 끝 커서만 추종, 중간/상단 편집은 무개입(OS 캐럿 처리에 위임)
              atEnd.current = (e?.nativeEvent?.selection?.end ?? 0) >= bodyLenRef.current;
              if (atEnd.current) ensureCursorVisible();
            }}
          />
          <View style={styles.metaRow}>
            <Text style={styles.tag}>{t('review.charCount', { count: body.length })}</Text>
          </View>
        </View>

        {/* photos — P-077: 최대 3장, 미리보기 + 개별 삭제. 선택 사항 */}
        <View style={styles.block}>
          <Text style={styles.label}>{t('review.photosLabel', { max: REVIEW_MAX_PHOTOS })}</Text>
          <View style={styles.photoRow}>
            {photos.map((uri) => (
              <View key={uri} style={styles.photoThumbWrap}>
                <Image source={{ uri }} style={styles.photoThumb} />
                <Pressable
                  accessibilityLabel={t('review.removePhoto')}
                  style={styles.photoDel}
                  hitSlop={8}
                  onPress={() => setPhotos((cur) => removeReviewPhoto(cur, uri))}
                >
                  <IconClose size={11} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photos.length < REVIEW_MAX_PHOTOS && (
              <Pressable accessibilityLabel={t('review.addPhoto')} style={styles.photoAdd} onPress={photoImporting ? undefined : pickPhoto} testID="photo-add">
                {/* P-191: 픽커 복귀~원본 준비(iCloud) — 타일 자리 스피너(프레임 불변) */}
                {photoImporting ? <ActivityIndicator size="small" color={C.ink3} /> : <IconPlus size={20} color={C.ink3} />}
              </Pressable>
            )}
          </View>
        </View>

        {/* P-095: 장소 필드 — 접힌 행 → 92% 검색 시트 → 이름 칩(×).
            P-116: KB-274 미배포 — placeTagsEnabled로 전면 숨김(코드 보존) */}
        {FLAGS.placeTagsEnabled && (
        <View style={styles.block}>
          {place ? (
            <View style={styles.placeChip}>
              <IconMapPin size={14} color={C.accent} />
              <Text style={styles.placeChipText} numberOfLines={1}>{place.name}</Text>
              <Pressable hitSlop={8} onPress={() => setPlace(null)}>
                <IconClose size={13} color={C.ink3} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.placeRow} onPress={() => setPlaceSheet(true)}>
              <IconMapPin size={17} color={C.ink2} />
              <Text style={styles.placeRowText}>{t('review.placeRow')}</Text>
              <Text style={styles.placeRowOpt}>{t('review.placeOptional')}</Text>
              <IconChevron size={15} color={C.ink3} />
            </Pressable>
          )}
        </View>
        )}

        {postError && (
          <View style={styles.postErr}>
            <RiskMark state="caution" size={16} />
            <Text style={styles.postErrText}>{t('review.postError')}</Text>
          </View>
        )}
        <View style={{ marginTop: 4 }}>
          {/* P-126: 별 아이콘 제거 — 라벨만 (8/4 예진). P-168: 제출 중 = 스피너(재탭 불가) */}
          {posting ? (
            <View style={styles.postingBtn} testID="posting">
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <Btn variant={canPost ? 'primary' : 'off'} onPress={post}>
              {t('review.postReview')}
            </Btn>
          )}
        </View>
      </ScrollView>

      {/* P-168 ②: 완료 = P-162 주문 완료 모달 문법(화면 전환 없이) — 확인 = 상세 복귀 */}
      <Modal visible={submitted} transparent animationType="fade" onRequestClose={() => router.back()}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard} testID="review-posted-confirm">
            <View style={styles.doneCheck}>
              <IconCheck size={26} color={C.primary} />
            </View>
            <Text style={styles.confirmTitle}>{t('review.postedTitle')}</Text>
            <Text style={styles.confirmBody}>{t('review.postedBody', { rating, name: food?.name ?? '' })}</Text>
            <View style={{ marginTop: 6 }}>
              <Btn onPress={() => router.back()}>{t('review.backToDish')}</Btn>
            </View>
          </View>
        </View>
      </Modal>

      <PlacePickerSheet
        open={FLAGS.placeTagsEnabled && placeSheet}
        onClose={() => setPlaceSheet(false)}
        onPick={(p) => {
          setPlace(p);
          setPlaceSheet(false);
        }}
        t={t}
      />
    </View>
  );
}

/* ---- P-095: 장소 검색 시트(92%) — Recent·typeahead·무결과·Skip 푸터.
        장소 데이터 = 커뮤니티 목 places 재사용 (실검색 KB-249 때 스왑). ---- */
type TFn2 = ReturnType<typeof useTranslation>['t'];
function PlacePickerSheet({ open, onClose, onPick, t }: { open: boolean; onClose: () => void; onPick: (p: PlaceTagRef) => void; t: TFn2 }) {
  const [q, setQ] = useState('');
  const results = searchPlaces(q);
  const isRecent = q.trim().length === 0;
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
            <RNTextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('community.searchPlaces')}
              placeholderTextColor={C.ink3}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
          {isRecent && <Text style={styles.recentLbl}>{t('review.placeRecent')}</Text>}
          <ScrollView keyboardDismissMode="on-drag" style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {results.length === 0 ? (
              <Text style={styles.noResults}>{t('review.placeNoResults')}</Text>
            ) : (
              results.map((p) => (
                <Pressable key={p.name} style={styles.resultRow} onPress={() => onPick(p)}>
                  <IconMapPin size={16} color={C.ink3} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.resultText} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.resultSub} numberOfLines={1}>{p.roadAddress}</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { padding: 18, gap: 20 },

  postLink: { fontFamily: font.bodyBold, fontSize: 14, color: C.primaryText, marginRight: 8 },
  postLinkOff: { color: C.ink3 },

  foodChip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 12, ...shadow.sh1 },
  foodPh: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.surface2, overflow: 'hidden' },
  foodName: { fontFamily: font.display, fontSize: 16, color: C.ink },
  foodKo: { fontFamily: font.ko, fontSize: 12, color: C.ink2 },

  block: { gap: 12 },
  label: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  starPick: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 4 },
  starCap: { fontFamily: font.bodyBold, fontSize: 14, color: C.primary, textAlign: 'center' },
  starCapEmpty: { color: C.ink3 },

  textarea: { minHeight: 120, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, padding: 14, fontFamily: font.body, fontSize: 14.5, color: C.ink, lineHeight: 21, ...shadow.sh1 },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoThumbWrap: { width: 76, height: 76 },
  photoThumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: C.surface2 },
  photoDel: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  photoAdd: { width: 76, height: 76, borderRadius: 12, borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tag: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },
  // P-085: 제출 실패 안내 (온보딩 submitErr 톤)
  postErr: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fdf3e7', borderWidth: 1, borderColor: '#f3ddc0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  postErrText: { flex: 1, fontFamily: font.body, fontSize: 12.5, color: C.ink, lineHeight: 17 },

  // P-095 장소 필드·시트
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, ...shadow.sh1 },
  placeRowText: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink },
  placeRowOpt: { flex: 1, fontFamily: font.body, fontSize: 12, color: C.ink3 },
  placeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  placeChipText: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink, flexShrink: 1 },
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

  // submitted
  // P-168 ②: 완료 모달 (P-162 confirm 문법과 동일 수치)
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  confirmCard: { alignSelf: 'stretch', backgroundColor: C.card, borderRadius: 26, padding: 22, gap: 8, ...shadow.shPop },
  confirmTitle: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  confirmBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19, textAlign: 'center' },
  doneCheck: { alignSelf: 'center', width: 52, height: 52, borderRadius: 26, backgroundColor: primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  // P-168 ①: 제출 중 로딩 — Btn primary와 같은 메트릭(높이 리플로 0)
  postingBtn: { backgroundColor: C.primary, borderRadius: 16, minHeight: 52, alignItems: 'center', justifyContent: 'center', opacity: 0.85 },
  okMeta: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
});

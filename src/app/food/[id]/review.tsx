/**
 * Review compose (mockup Screen H) — rate 1–5 + write a review for a dish.
 * Compose state → submitted confirmation (counts toward ranking).
 *
 * P-085(KB-73): 실연결 — 사진 presigned 업로드(purpose REVIEW) → POST /reviews,
 * 성공 시 서버 재조회(무효화)가 진실 (목 캐시 삽입 폐기). Rating required
 * (1–5 integer). No emoji; reader text i18n'd; risk colors fixed.
 */
// ⚠️ KB-602 래칫 기록(2026-09-21): 아래 `FLAGS.*` early return이 **훅 호출보다 위**에 있다 —
// `react-hooks/rules-of-hooks`가 이 파일에서 위반으로 잡는다(현재 warn으로 내려둔 상태).
// 지금 안전한 이유는 **FLAGS가 빌드 상수**라 한 빌드 안에서 분기가 고정된다는 것 하나뿐이다.
// 플래그가 런타임 값(원격 컨피그·A/B 등)이 되는 순간 훅 순서가 깨진다. 소진 발주(KB-603~)에서
// early return을 훅 아래로 내리거나 래퍼 컴포넌트로 분리할 것.
import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { Platform, ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Alert, Modal } from '@/lib/engagement/occlusionSurfaces';
import { launchCameraAsync, launchImageLibraryAsync } from '@/lib/engagement/occlusionPickers';
import { Pressable } from '@/components/Pressable';
import { KAV_BEHAVIOR } from '@/lib/keyboardAvoid';
import { TopToastHost } from '@/components/TopToast';
import { Txt as Text } from '@/components/Txt';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { LeaveConfirmModal, useLeaveConfirm } from '@/components/LeaveConfirmModal';
import * as ImagePicker from 'expo-image-picker';
import { choosePhotoSource } from '@/lib/data/profileImage';
import { foodSubtitle } from '@/lib/review/foodSubtitle';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C, font, primaryTint, radius, shadow } from '@/lib/theme';
import { SubHeader, Btn, CardPhoto, Star, RiskMark, IconCamera, IconCheck, IconClose, IconMapPin, IconRetry, Input } from '@/components';
import { useFoodDetail } from '@/lib/data/useFoods';
import { findCachedReview, reviewWriteClosed, useCreateProcessedReview, useCreateReview, useUpdateReview } from '@/lib/data/useReviewMutations';
import { useFoodReviews, useProcessedReviews } from '@/lib/data/useFoodReviews';
import { processedUnavailable, useProcessedDetail } from '@/lib/data/useProcessedFoods';
import { queryClient } from '@/lib/queryClient'; // 루트 프로바이더와 동일 인스턴스(_layout)
import { imageUrlToPath } from '@/lib/api/reviewAdapter';
import { ApiError, foodHiddenReason, type FoodHiddenReason } from '@/lib/api/client';
import { showTopToast } from '@/components/topToastStore';
import { Shimmer } from '@/components/Skeleton';
import { useIsGuest } from '@/lib/auth/useSession';
import { Snackbar } from '@/components/Snackbar';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { EVENTS, track } from '@/lib/analytics';
import { airbridge } from '@/lib/airbridge';
import { addReviewPhotos, canPostReview, removeReviewPhoto, reviewBodyLength, reviewPhotoKey, REVIEW_MAX_PHOTOS, REVIEW_MIN_BODY, uploadReviewImages, type ReviewPhoto } from '@/lib/review/reviewPhotos';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { useBottomInset } from '@/lib/useBottomInset';
import { pillBottomOf, pillCta } from '@/features/food/pillCta';
import { ExtrasRater, PACKAGED_TASTE_AXES, PlacePickerSheet, StarAxisRater, runAfterKeyboardHidden, type ReviewPlaceTag } from '@/features/review/ReviewCellParts';
import { EMPTY_EXTRAS, extrasFromReview, type ReviewExtras } from '@/lib/review/reviewExtras';
import { openAppSettings } from '@/lib/openExternal';
import { useUploadAbort } from '@/lib/useUploadAbort';
import { isUploadAborted } from '@/lib/api/uploadAbort';
import { useReviewPrompt } from '@/lib/useReviewPrompt';
import { useOneShotQueue } from '@/lib/oneShotQueue';
import { ReviewPromptSheet } from '@/components/ReviewPromptSheet';
import { PhotoConsentSheet } from '@/components/PhotoConsentSheet';
import { grantPackagedPhotoConsent, hasPackagedPhotoConsent } from '@/lib/review/packagedPhotoConsent';

const MAX = 1000; // P-085: 계약 확정값 (구 500)
// ponytail: 이모지·예측 바 전환(+44~53pt)만 줄어든 만큼 내린다 — 키보드가 통째로 다시 올라오는 큰 축소(앱 복귀 등 ~300pt)는
// 커서가 위쪽이면 화면 밖으로 밀리므로 무동작. 캐럿 좌표를 얻게 되면 이 상한 대신 그 줄로 맞출 것.
const SHRINK_FOLLOW_MAX = 120;

/** KB-708: 이탈 확인 비교용 — 화면이 들고 있는 작성 값 한 벌(별·본문·사진·장소·세부 별점·맵기/당도) */
function draftKey(rating: number, body: string, photos: unknown[], place: unknown, extras: unknown, taste: unknown): string {
  return JSON.stringify([rating, body, photos, place, extras, taste]);
}

/** KB-865 ④: 가공식품 맵기·당도(1~5 선택, null = 미입력) */
type PackagedTaste = { spiciness: number | null; sweetness: number | null };
const EMPTY_TASTE: PackagedTaste = { spiciness: null, sweetness: null };

export default function ReviewCompose() {
  // KB-148: 리뷰 MVP 제외 — 진입점이 없어도 딥링크/백스택으로 도달 가능하니 홈으로.
  // ⚠️ 가드는 **훅이 하나도 없는 바깥 컴포넌트**에 둔다(KB-620). 전엔 모든 훅 앞에 early return이
  // 있었다 — FLAGS가 컴파일 상수라 런타임 순서는 안 바뀌지만, 린터는 그걸 몰라 rules-of-hooks로
  // 잡고 React Compiler도 이 컴포넌트를 최적화하지 못한다. 분리하면 규칙이 구조적으로 선다.
  if (!FLAGS.reviewsEnabled) return <Redirect href="/" />;
  return <ReviewComposeScreen />;
}

/** KB-812 2차: packaged = 가공식품 리뷰(`/processed-foods/[id]/review`) — 같은 화면, 대상 카드 = 제품 · 식당 전용 입력(세부 별점·장소) 숨김 ·
 *  작성 = POST /api/processed-foods/{id}/reviews. 10자 규칙·사진·수정 모드는 음식과 동일. */
export function ReviewComposeScreen({ packaged = false }: { packaged?: boolean }) {
  const { id, reviewId } = useLocalSearchParams<{ id: string; reviewId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { data: food } = useFoodDetail(packaged ? '' : (id ?? ''));
  const { data: product } = useProcessedDetail(packaged ? id : undefined);
  // 대상 카드 한 벌 — 음식: 상세 캐시 사진·이름·"한글명 | n reviews" / 가공식품: 제품 사진·이름·제조사
  const targetName = (packaged ? product?.name : food?.name) ?? '';
  const targetPhoto = packaged ? product?.imageUrl : food?.photoUrl;

  // P-358(KB-521): 편집 모드 — ?reviewId= 진입. 리뷰는 params가 아니라 캐시에서 조회
  // (내리뷰 → 음식 리뷰 → 전역 피드), 캐시 미스면 목록 재조회 후 프리필(스켈레톤).
  const editing = !!reviewId;
  const cached = editing ? findCachedReview(queryClient, { reviewId: reviewId ?? '', foodId: id ?? '' }) : null;
  const refillFood = useFoodReviews(editing && !cached && !packaged ? (id ?? '') : ''); // 미스에만 재조회(enabled = foodId 유무)
  const refillPackaged = useProcessedReviews(editing && !cached && packaged ? (id ?? '') : '');
  const refill = packaged ? refillPackaged : refillFood;
  const editReviewData = cached ?? (editing ? (refill.data?.pages.flatMap((p) => p.items) ?? []).find((r) => r.id === reviewId) ?? null : null);

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<ReviewPhoto[]>([]);
  const [submitted, setSubmitted] = useState(false);
  /** 제출 실패 종류. ⚠️ 불리언 둘(에러·숨김)로 두면 "둘 다 참"이라는 **있을 수 없는 상태**가
   *  생긴다 — 셋 중 하나로 고정한다. `hidden` = 음식이 일시 숨김(KB-620): 에러가 아니다. */
  // KB-812 2차: 'closed' = 서버 가공식품 쓰기 플래그 OFF(403 PFOOD-005) — 실패가 아니라 "곧 열려요"
  const [postError, setPostError] = useState<'failed' | 'closed' | FoodHiddenReason | null>(null); // KB-650: 숨김은 사유별
  // P-095 목 → P-201 실연결: 장소 태그(선택·최대 1) — nearby/search 실 API, MANUAL 직접 입력
  const [place, setPlace] = useState<ReviewPlaceTag | null>(null);
  const [bodyFocused, setBodyFocused] = useState(false); // §2-6: focus = primary 보더
  const [placeSheet, setPlaceSheet] = useState(false);
  // P-202: 3축(속도·친절·찾아가기 — 선택) — 전송은 계약 후(buildReviewExtras), 우선 로컬 보관
  const [extras, setExtras] = useState<ReviewExtras>(EMPTY_EXTRAS);
  const [taste, setTaste] = useState<PackagedTaste>(EMPTY_TASTE);
  const isGuest = useIsGuest();
  const createReview = useCreateReview();
  const createProcessedReview = useCreateProcessedReview();
  const updateReview = useUpdateReview();
  const bottomInset = useBottomInset(); // Codex #31 P1: 안드 내비바 플로어 포함

  // P-358: 프리필 — 리뷰 도착 시 1회(별·본문·extras·place·사진 = 원격 슬롯)
  const prefilledRef = useRef(false);
  // KB-708: 이탈 확인의 기준 = 화면이 처음 가진 값(작성 = 빈 값, 수정 = 프리필 직후) — 지금 값과 다르면 "변경 있음"
  const [baseline, setBaseline] = useState(() => draftKey(0, '', [], null, EMPTY_EXTRAS, EMPTY_TASTE));
  useEffect(() => {
    if (!editing || !editReviewData || prefilledRef.current) return;
    prefilledRef.current = true;
    const pre = {
      rating: editReviewData.rating,
      body: editReviewData.body ?? '',
      extras: extrasFromReview(editReviewData),
      place: editReviewData.place ?? null,
      photos: (editReviewData.photos ?? []).map((url) => ({ kind: 'remote' as const, url })),
      taste: { spiciness: editReviewData.spiciness ?? null, sweetness: editReviewData.sweetness ?? null }, // null(미입력·구서버) = 빈 별
    };
    setRating(pre.rating);
    setBody(pre.body);
    setExtras(pre.extras);
    setPlace(pre.place);
    setPhotos(pre.photos);
    setTaste(pre.taste);
    setBaseline(draftKey(pre.rating, pre.body, pre.photos, pre.place, pre.extras, pre.taste));
  }, [editing, editReviewData]);
  // KB-708: 변경이 있을 때만 이탈 확인 — 뒤로 가기 버튼·스와이프 뒤로·Android 하드웨어 뒤로 전부(usePreventRemove = 네이티브 스택 제스처까지).
  // 등록 성공(완료 모달)·저장 성공(복귀) 뒤에는 막지 않는다.

  // P-168 🚨 → P-173 공용화: isPending은 mutateAsync 구간만 커버 — 사진 업로드 선행
  // 구간 포함 전체를 useSubmitGuard(동기 ref+busy)가 단일 비행으로 보장.
  const { busy: posting, run: runPost } = useSubmitGuard();
  const nextUploadSignal = useUploadAbort(); // KB-711: 올리는 중 화면을 떠나면 사진 업로드 취소
  const reviewPrompt = useReviewPrompt(); // KB-730: 등록 완료 모달 뒤 리뷰 유도
  const modalQueue = useOneShotQueue(); // KB-730: 화면 일회성 모달 큐(완료 모달이 완전히 닫힌 뒤 유도 시트)
  const [confirmClosed, setConfirmClosed] = useState(false); // 완료 모달 표시만 접는다 — submitted는 유지(이탈 확인 재무장·Post 재활성 방지)
  const runAfterPosted = () => modalQueue.add(reviewPrompt.step('review', { after: () => router.back() }));
  // #236 /review B: 막는 조건 ⊆ 확인 창이 렌더되는 조건 — 게스트(세션 만료)·수정 미도착 분기는 아래 early return이라 모달이 없다.
  // 거기서 막으면 뒤로·게이트 "둘러보기"가 전부 무반응 = 나갈 길이 로그인뿐. 폼이 보이는 분기에서만 막는다.
  const formShown = !isGuest && !(editing && !editReviewData);
  const leave = useLeaveConfirm(formShown && draftKey(rating, body, photos, place, extras, taste) !== baseline && !submitted, posting);
  // KB-828: 본문 10자 미만 = Post 비활성 + 안내. 비활성 버튼 탭·서버 REVIEW-005 = 같은 안내를 강조(색만 — 프레임 불변)
  const bodyLen = reviewBodyLength(body);
  const bodyShort = bodyLen < REVIEW_MIN_BODY;
  const [minLenStressed, setMinLenStressed] = useState(false);
  // Codex #304: 서버 REVIEW-005는 클라 기준을 통과한 본문에 온다 — 거부된 본문 그대로인 동안 안내를 띄우고 재제출을 막는다(고치면 풀림)
  const [rejectedBody, setRejectedBody] = useState<string | null>(null);
  const serverRejected = rejectedBody !== null && body === rejectedBody;
  const showMinLen = bodyShort || serverRejected;
  const canPost = canPostReview(rating, body) && !serverRejected && !posting && !submitted; // KB-730: 등록 뒤 Post 재활성 0(중복 리뷰 — P-168 류)

  // P-156: 갤러리 멀티 선택 — selectionLimit = 남은 슬롯(3 − 현재). 구형 안드 등
  // limit 미준수 산출물은 addReviewPhotos slice(3)가 방어 + 안내 토스트 1회.
  const [capNote, setCapNote] = useState(false);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [photoImporting, setPhotoImporting] = useState(false); // P-191: 픽커 복귀~원본 준비 표시
  // P-348 ④(KB-511): 슬롯 탭 = 촬영/갤러리 시트(choosePhotoSource — 프로필 사진과 동일
  // 문법·라벨 키 재사용, remove 없음). "파일 선택"은 expo-document-picker 네이티브
  // 의존 = 비범위(TODO — 다음 네이티브 빌드).
  // P-375(KB-539): 제목만 리뷰 전용 키 — photo.sheetTitle은 "프로필 사진"이라 오문구였다.
  // KB-814 F3: 가공식품 = 촬영 권장(촬영 행 강조) · 갤러리는 '직접 촬영한 사진만' 동의 1회 뒤에만(동의 전 갤러리 열림 0)
  const [consentOpen, setConsentOpen] = useState(false);
  const consentAgreedRef = useRef(false); // 동의 → 시트가 완전히 닫힌 뒤 갤러리(닫힘 직후 present = iOS 프리즈)
  const importPhotos = async (src: 'camera' | 'gallery') => {
    const remaining = REVIEW_MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    setPhotoImporting(true);
    try {
      if (src === 'camera') {
        // 권한 거부 = 스캔 문법(설정 유도 알럿 — scan.tsx 동일)
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t('scan.permissionTitle'), t('scan.permissionSettingsBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('photo.openSettings'), onPress: () => void openAppSettings() },
          ]);
          return;
        }
        const res = await launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
        if (!res.canceled && res.assets?.length) setPhotos((cur) => addReviewPhotos(cur, res.assets.map((a) => a.uri)));
        return;
      }
      const res = await launchImageLibraryAsync({
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
    } finally {
      setPhotoImporting(false);
    }
  };

  const pickPhoto = async () => {
    if (REVIEW_MAX_PHOTOS - photos.length <= 0) return;
    const src = await choosePhotoSource({
      title: t('review.photoSheetTitle'),
      camera: t('photo.take'),
      gallery: t('photo.gallery'),
      cancel: t('common.cancel'),
      ...(packaged ? { emphasizeCamera: true } : {}),
    });
    if (!src || src === 'remove') return; // 취소
    if (packaged && src === 'gallery' && !(await hasPackagedPhotoConsent())) {
      setConsentOpen(true);
      return;
    }
    await importPhotos(src);
  };
  const onConsentClosed = () => {
    if (!consentAgreedRef.current) return;
    consentAgreedRef.current = false;
    void importPhotos('gallery');
  };

  // P-085(KB-73): 사진 presigned 업로드(purpose REVIEW, 전송=path) → POST /reviews.
  // 성공 시 무효화(useCreateReview)가 목록·평점을 서버값으로 갱신. 실패는 화면 유지+표시.
  const post = () =>
    runPost(async () => {
      if (!canPostReview(rating, body) || serverRejected) return;
      setPostError(null);
      try {
        // P-358: 신규(local)만 업로드, 기존(remote)은 URL→path 역변환 — 슬롯 순서 보존
        const localUris = photos.filter((p) => p.kind === 'local').map((p) => p.uri);
        const signal = nextUploadSignal();
        const uploaded = await uploadReviewImages(localUris, signal);
        // KB-711: 본 요청 직전 이탈 확인 — 마지막 장 complete 도중(또는 사진 0장) 떠났으면 등록·저장하지 않는다
        // (throw가 아니라 return — try 안 throw는 컴파일러가 이 컴포넌트를 건너뛰는 사유를 하나 더 늘린다)
        if (signal.aborted) return;
        let li = 0;
        const imagePaths = photos.map((p) => (p.kind === 'remote' ? imageUrlToPath(p.url) : uploaded[li++]));
        if (editing && editReviewData) {
          await updateReview.mutateAsync({
            reviewId: reviewId ?? '',
            foodId: id ?? '',
            current: editReviewData,
            changes: { rating, body: body.trim() || null, place, extras, photos: imagePaths, ...(packaged ? taste : {}) }, // place 해제 = null 명시 · KB-865 ④ 맵기·당도 해제 = null(비움)
          });
          // 저장 성공 = 복귀 + 상단 토스트(완료 모달 아님 — P-358). KB-708: 이탈 확인 해제 뒤 복귀(저장한 변경을 "버릴까요?"로 묻지 않게)
          showTopToast(t('editReview.savedToast'));
          leave.release(() => router.back());
          return;
        }
        if (packaged) {
          await createProcessedReview.mutateAsync({ processedFoodId: id ?? '', rating, content: body.trim() || undefined, imagePaths, ...taste });
        } else {
          await createReview.mutateAsync({
            foodId: id ?? '',
            rating,
            content: body.trim() || undefined,
            imagePaths,
            place,
            extras, // P-236: servingSpeed·staffKindness(미평가 = 0)
          });
        }
        track(EVENTS.review_submit, { has_photos: photos.length > 0, photo_count: photos.length, rating, target_type: packaged ? 'packaged' : 'food' }); // P-083→144 확장 · KB-812 2차 대상
        // KB-783 ⑫ — 새 리뷰 등록만(수정은 위에서 return). 가공식품은 제외: 이 이벤트의 foodId 축은 음식 id(같은 숫자 공간이 아니다)
        if (!packaged) airbridge.rate({ foodId: id ?? '', rating, hasPhoto: photos.length > 0 });
        // P-236: extras는 mutateAsync 페이로드로 서버 전송(로컬 프리뷰 폐기)
        // 프리즈 방어(9/5, Codex #24): dismiss 직후 동기 present는 hide 애니메이션과
        // 겹침 — 시트와 동일 헬퍼로 통일(키보드 내려간 뒤 확인 Modal 표시)
        await runAfterKeyboardHidden(() => setSubmitted(true)); // await = 지연 창에도 posting 가드 유지(P-173)
      } catch (e) {
        if (isUploadAborted(e)) return; // KB-711: 화면을 떠나 업로드를 취소한 것 — 떠난 화면에 실패 표시 없음
        if (e instanceof ApiError && e.code === 'REVIEW-005') { setRejectedBody(body); return; } // KB-828: 서버 기준 미달 = 같은 안내(입력 보존·버튼 복구)
        if (reviewWriteClosed(e)) { setPostError('closed'); return; } // KB-812 2차: 서버 쓰기 OFF = 안내(입력 보존 — 열리면 그대로 다시 올린다)
        console.log('[review] post failed — staying on screen:', (e as Error)?.message);
        // KB-620(9/22 예진): 음식이 이미지 재생성으로 **일시 숨김**이면 에러 표면 대신 조용한 안내.
        // ⚠️ 화면을 닫지 않는다 — 리뷰엔 초안 저장소가 없어 닫는 순간 본문·사진이 사라진다.
        // 화면에 두면 사용자가 쓴 글이 남고, 음식이 돌아오면 그대로 다시 올릴 수 있다.
        // FOOD-001은 **신규 작성만** 받는다 — 서버 `createReview`는 `getReadyFood`를 타지만 `updateReview`는
        // 리뷰·이미지 소유권만 확인해서(음식 준비 상태 무관) 숨겨진 음식의 리뷰도 **수정은 성공**한다.
        // 수정 경로도 이 catch를 지나므로 서버가 준비 상태 검사를 추가하면 그대로 대비된다(KB-626 정정 —
        // KB-620 때 "신규·수정 모두 같은 FOOD-001"이라고 적었던 건 서버를 확인하지 않은 추론이었다).
        // KB-812 2차: 제품 404 PFOOD-001·410 PFOOD-002 = 음식 "없음"과 같은 중립 안내(재시도로 바뀌지 않는다)
        setPostError(foodHiddenReason(e) ?? (packaged && processedUnavailable(e) ? 'gone' : 'failed')); // 실패 = 버튼 복구(가드 finally)
      }
    });

  // P-150② → P-158① 재작업(실기 재반려): 접근 교체 —
  // ⓐ 키보드 높이 실측(Keyboard 이벤트) → 컨테이너 하단 패딩 = 키보드+여유
  //    (맨 아래 줄이 항상 키보드 위 공간에 존재)
  // ⓑ 입력 블록 하단 y(onLayout — 성장 시 재발화)를 커서 하단 프록시로,
  //    성장/셀렉션 변경마다 가시 영역(뷰포트−키보드) 하단 위로 스크롤.
  //    P-163: 단, 프록시가 유효한 "커서 = 문서 끝"일 때만(중간 편집 무개입).
  const scrollRef = useRef<ScrollView>(null);
  const bodyInputRef = useRef<TextInput>(null);
  const [kbH, setKbH] = useState(0);
  const svH = useRef(0); // ScrollView 뷰포트 높이 실측
  const blockBottom = useRef(0); // 입력 블록 하단 y(스크롤 콘텐츠 좌표) — 커서 하단 프록시
  // KB-700(#228 공부): 문서 중간을 탭하면(atEnd false) 키보드가 올라와 뷰포트가 줄 때 그 줄이 뷰포트 밖으로 밀릴 수 있다 —
  // 예전엔 시스템 키보드 인셋(automaticallyAdjustKeyboardInsets)이 커서를 보이게 했는데 KAV로 바꾸며 빠졌다. RN은 캐럿 좌표를 안 주므로
  // **탭한 위치(onPressIn locationY)** 를 캐럿 줄의 대용으로 쓴다.
  const blockTop = useRef(0);
  const inputTopInBlock = useRef(0);
  const touchY = useRef<number | null>(null);
  const scrollY = useRef(0);
  const kbHRef = useRef(0);
  // KB-891: 하단 알약은 ScrollView 위에 떠 있다 — 알약 줄 실높이(큰 글씨면 커짐) + 바닥 여백만큼 콘텐츠 하단 여백(측정 전 폴백 48, 음식 상세 barH와 같음).
  // 커서 추종의 가시 높이에서도 이만큼 뺀다(뷰포트가 알약 밑까지 이어지므로 — 키보드는 KAV가 이미 뺐다).
  const [barH, setBarH] = useState(0);
  const pillBottom = pillBottomOf(bottomInset);
  const pillCover = useRef(48 + pillBottom);
  useLayoutEffect(() => {
    pillCover.current = (barH || 48) + pillBottom;
  });
  // KB-657: 최신값 ref는 렌더 중이 아니라 커밋(layout effect)에서 동기화 — 리더는 전부 이벤트·리스너·passive effect(layout 뒤)
  useLayoutEffect(() => {
    kbHRef.current = kbH;
  });
  // P-163: 블록 하단 프록시는 "커서 = 문서 끝"일 때만 유효 — 중간/상단 편집 시
  // 하단 추종이 화면을 뺏는 회귀(실기 스샷). 셀렉션으로 끝 여부를 추적해 게이트.
  const atEnd = useRef(true);
  // KB-700 ①(QA 진단 로그로 확정): 마운트 직후 본문 Input의 첫 onContentSizeChange/onSelectionChange가 atEnd 초기값 true로
  // 커서 추종을 불러, 포커스도 입력도 없는데 본문 블록 끝이 보이게 53.7pt 스크롤했다(카드 윗줄이 헤더 밑으로).
  // → 추종은 **본문이 포커스된 동안에만**(호출부 셋 — 크기 변화·선택 변화·키보드 표시 — 이 모두 여기를 지난다).
  const bodyFocusedRef = useRef(false);
  const followedBy = useRef(0); // KB-708 D: 이모지 키보드로 따라 내린 누적량(되돌릴 몫)
  const followedAt = useRef(0); // 마지막으로 따라 내린(또는 되돌린) 목표 y — scrollY가 여기 그대로일 때만 되돌림
  const bodyLenRef = useRef(0);
  useLayoutEffect(() => {
    bodyLenRef.current = body.length;
  });
  const ensureCursorVisible = () => {
    if (!bodyFocusedRef.current) return;
    // KB-700 → KB-768: 두 플랫폼 모두 KeyboardAvoidingView(padding)라 ScrollView 자체가 키보드 위로 줄어든다(svH = 이미 키보드 제외 높이) —
    // 키보드를 또 빼면 이중 차감(예전 Android 차감은 adjustResize 전제였고 edge-to-edge로 깨졌다).
    const visible = svH.current - pillCover.current;
    if (visible <= 0 || !blockBottom.current) return;
    const target = blockBottom.current - visible + 16; // 커서 줄이 키보드 위 16pt
    if (target > 0) scrollRef.current?.scrollTo({ y: target, animated: true });
  };
  const ensureTappedLineVisible = () => {
    if (!bodyFocusedRef.current || touchY.current == null) return;
    const visible = svH.current - pillCover.current; // KB-768: 위와 같은 이유로 두 플랫폼 동일
    if (visible <= 0) return;
    const lineTop = blockTop.current + inputTopInBlock.current + touchY.current - 12;
    const lineBottom = lineTop + 32; // 탭한 줄(본문 줄 높이 + 여유)
    if (lineBottom > scrollY.current + visible) scrollRef.current?.scrollTo({ y: lineBottom - visible + 16, animated: true });
    else if (lineTop < scrollY.current) scrollRef.current?.scrollTo({ y: Math.max(0, lineTop - 16), animated: true });
  };
  /** 키보드 표시·뷰포트 축소 때 한 번: 끝 커서면 블록 끝, 아니면 탭한 줄 */
  const followOnViewportChange = (shrinkBy = 0) => {
    if (atEnd.current) ensureCursorVisible();
    else if (touchY.current != null) ensureTappedLineVisible();
    // KB-708(5): 중간을 고치는 중(탭 대용값은 입력 시작에 지워짐) 키보드가 더 커지면(이모지 키보드 +53) 캐럿 좌표가 없으니
    // 줄어든 만큼 그대로 내려 아래 끝에 있던 내용(편집 중인 줄)을 계속 보이게. 포커스 없으면 무동작(#228 진입 직후 스크롤 금지 유지).
    else if (bodyFocusedRef.current && shrinkBy > 0 && shrinkBy <= SHRINK_FOLLOW_MAX) {
      const target = scrollY.current + shrinkBy;
      scrollRef.current?.scrollTo({ y: target, animated: true });
      followedBy.current += shrinkBy; // #236 /review D: 되돌림 후보(켤 때마다 53씩 쌓이던 것) — 실제 되돌림 조건은 아래 unfollow
      followedAt.current = target; // 되돌림은 이 위치 그대로일 때만(그 사이 사용자가 스크롤했으면 무효)
    }
  };
  // 뷰포트가 다시 늘면(이모지 키보드 끔) 따라 내린 양만큼 되돌리려 하지만, 위치가 그대로일 때만이라 실기에선 대개 제자리에 머문다
  // (QA 10/3: 끈 뒤 처음 위치로 돌아오지 않음 — 가림은 없어 유지 판정). 포커스 중 · 상한 이내만, 내린 적 없으면 무동작
  const unfollowOnViewportGrow = (growBy: number) => {
    // 큰 증가(키보드만 내려감 — Android 뒤로 등) 또는 따라 내린 뒤 사용자가 스크롤함 = 되돌릴 몫 폐기(이유 없이 53pt 튀던 것)
    if (growBy > SHRINK_FOLLOW_MAX || Math.abs(scrollY.current - followedAt.current) > 1) followedBy.current = 0;
    if (!bodyFocusedRef.current || followedBy.current <= 0) return;
    const back = Math.min(growBy, followedBy.current);
    followedBy.current -= back;
    followedAt.current = Math.max(0, scrollY.current - back);
    scrollRef.current?.scrollTo({ y: followedAt.current, animated: true });
  };
  // 마운트 1회 등록한 키보드 리스너가 최신 함수를 부르게(최신 콜백 ref — CountdownBadge endRef와 같은 방식)
  const followRef = useRef(followOnViewportChange);
  useLayoutEffect(() => {
    followRef.current = followOnViewportChange;
  });
  // KB-657: 이 effect는 위 ref·ensureCursorVisible을 읽으므로 그 **선언 뒤**에 둔다(컴파일러 "선언 전 접근" — 마운트 1회
  // 등록이라 실행 순서는 무변: 사이에 다른 effect 없음).
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      kbHRef.current = e.endCoordinates?.height ?? 0;
      setKbH(kbHRef.current);
      // P-163: 포커스 시점엔 키보드 높이가 없어 스크롤이 못 뜀 — 실측 도착 시 1회(끝 커서 = 블록 끝 · 중간 = 탭한 줄)
      followRef.current();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKbH(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);


  // ⚠️ 가드는 전 훅 선언 뒤(P-358: 편집 로딩→로드 전환 시 훅 수 불변)
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

  // P-358: 편집 진입인데 리뷰 미도착(캐시 미스 + 재조회 중) = 스켈레톤.
  // 재조회 종료 후에도 부재 = 안내 후 복귀 경로(editReview.notFound).
  if (editing && !editReviewData) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('editReview.title')} onBack={() => router.back()} />
        {refill.isLoading || refill.isFetching ? (
          <View style={{ padding: 20, gap: 16 }} testID="edit-loading">
            <Shimmer style={{ height: 64, borderRadius: 8 }} />
            <Shimmer style={{ height: 120, borderRadius: 8 }} />
            <Shimmer style={{ height: 156, borderRadius: 8 }} />
          </View>
        ) : (
          <View style={{ padding: 20 }} testID="edit-not-found">
            <Text style={styles.foodKo}>{t('editReview.notFound')}</Text>
          </View>
        )}
      </View>
    );
  }


  return (
    // KB-700 → KB-768: KeyboardAvoidingView(padding, 두 플랫폼) — 하단 고정 "Post review" 바가 키보드 위로 따라 올라온다.
    // Android도 edge-to-edge(Expo 57)라 adjustResize가 창을 줄이지 않는다 — lib/keyboardAvoid 참조.
    <KeyboardAvoidingView style={styles.root} behavior={KAV_BEHAVIOR} testID="review-kav">
      {/* P-168 ③: 헤더 Post 소멸 — 제출 진입점은 하단 "Post review" 단일화 */}
      <SubHeader title={t(editing ? 'editReview.title' : 'review.title')} onBack={() => router.back()} />
      {capNote && <Snackbar icon={null} text={t('review.photoCapNote', { max: REVIEW_MAX_PHOTOS })} />}
      {/* P-158 ①: 키보드 실측 패딩(contentContainer) + 블록 하단 프록시 스크롤 —
          커서 추종은 위 ensureCursorVisible 참조 (P-150② 인셋 방식은 폐기됨) */}
      {/* KB-891: 알약을 띄우는 무대 — KAV(padding)가 줄이는 쪽은 이 View, 알약 absolute 기준도 여기(KAV 자체 padding과 섞이지 않게) */}
      <View style={styles.stage}>
      <ScrollView
        ref={scrollRef}
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.body, { paddingBottom: (barH || 48) + pillBottom + 16 }]}
        // KB-700: automaticallyAdjustKeyboardInsets 제거 — 바깥 KAV가 ScrollView를 키보드 위로 줄이므로 인셋까지 더하면 이중(P-348 ⑤의 "수동 패딩 공백"과 같은 문제)
        scrollEventThrottle={16}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        keyboardShouldPersistTaps="handled"
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          const prevH = svH.current;
          const shrank = prevH > 0 && h < prevH;
          svH.current = h;
          // KAV 레이아웃과 keyboardDidShow의 순서에 기대지 않게 — 포커스 중 뷰포트가 줄면 한 번 더(가드·식은 같음)
          if (shrank) followOnViewportChange(prevH - h);
          else if (prevH > 0 && h > prevH) unfollowOnViewportGrow(h - prevH);
        }}
      >
        {/* KB-432 §2-2: 대상 카드(4150:16477) — 이미지 48 r4 + 이름 14/600 + "ko n reviews" */}
        <View style={styles.foodChip}>
          {/* P-170 A안: 썸네일 = 상세 캐시(useFoodDetail) 재사용 — 네트워크 0, 무사진 폴백 */}
          {targetPhoto ? (
            <View style={styles.foodPh}>
              <CardPhoto uri={targetPhoto} borderRadius={4} />
            </View>
          ) : (
            <View style={styles.foodPh} testID="food-ph" />
          )}
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>{/* A-RW-02 */}
            <Text style={styles.foodName} numberOfLines={1}>{targetName}</Text>
            {/* P-352(KB-514): count 0 = 리뷰 수 숨김(한글명 없으면 줄 생략),
                n≥1 = "한글명 | n reviews"(" | " 구분 — 예진 결정, 구 P-196 공백 구분 대체) */}
            {(() => {
              const sub = packaged ? product?.maker ?? null : foodSubtitle(food, t);
              return sub == null ? null : (
                <Text style={styles.foodKo} numberOfLines={1}>
                  {sub}
                </Text>
              );
            })()}
          </View>
        </View>

        {/* rating */}
        <View style={styles.block}>
          <Text style={styles.label}>{t('review.ratingLabel')}</Text>
          {/* §2-3(4150:16468): 별 48 gap 11, stroke 3 — 채움/빈 색은 시안(D-1 Stars 토큰) */}
          <View style={styles.starPick}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable key={i} onPress={() => setRating(i)} hitSlop={4} testID={`review-star-${i}`}>
                <Star size={48} fillPct={i <= rating ? 100 : 0} />
              </Pressable>
            ))}
          </View>
          {/* P-348 ②: 시안(2200:21567) = 숫자만 — labels/ratingValue 소멸, 빈 상태 힌트 유지 */}
          <Text style={[styles.starCap, !rating && styles.starCapEmpty]}>
            {rating ? String(rating) : t('review.tapToRate')}
          </Text>
        </View>

        {/* P-202: 확장 별점 3축 — 쿠팡이츠식 별도 섹션(선택), 찾아가기 = 장소 태그 연동 */}
        {/* KB-812 2차: 가공식품 = 식당 축(서빙 속도·직원 친절) 없음 — 서버도 0으로 저장 */}
        {!packaged && <ExtrasRater extras={extras} onChange={setExtras} t={t} />}
        {/* KB-865 ④(시안 32): 가공식품 = 맵기·당도 작은 별 2행(선택, 재탭 = 해제) + 선택 안내 1줄 */}
        {packaged && (
          <View style={styles.tasteBlock}>
            <StarAxisRater packaged axes={PACKAGED_TASTE_AXES} values={taste} onChange={setTaste} t={t} />
            <Text style={styles.tasteNote} testID="review-taste-optional">{t('review.tasteOptional')}</Text>
          </View>
        )}

        {/* body — onLayout: 블록 하단 = 커서 하단 프록시(성장 시 재발화) */}
        {/* A-RW-03(KB-486): 사진 블록 = 텍스트 영역 위 */}
        {/* photos — P-077: 최대 3장, 미리보기 + 개별 삭제. 선택 사항 */}
        <View style={styles.block}>
          {/* §2-5(4150:16463 @y428): 슬롯 100 r8, 빈 = #F4F6F6 50% + #DCDEE3, 카메라 24 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {photos.map((p) => {
              const key = reviewPhotoKey(p); // P-358: remote(기존 URL) | local(신규 URI) 혼합
              return (
                <View key={key} style={styles.photoThumbWrap}>
                  <Image source={{ uri: key }} style={styles.photoThumb} />
                  <Pressable testID="review-photo-remove"
                    accessibilityLabel={t('review.removePhoto')}
                    style={styles.photoDelHit}
                    onPress={() => setPhotos((cur) => removeReviewPhoto(cur, key))}
                  >
                    <View style={styles.photoDel}>
                      <IconClose size={10} color="#fff" />
                    </View>
                  </Pressable>
                </View>
              );
            })}
            {photos.length < REVIEW_MAX_PHOTOS && (
              <Pressable accessibilityLabel={t('review.addPhoto')} style={styles.photoAdd} onPress={photoImporting ? undefined : pickPhoto} testID="photo-add">
                {/* P-191: 픽커 복귀~원본 준비(iCloud) — 타일 자리 스피너(프레임 불변) */}
                {/* P-348 ③(예진 결정 — A-RW-05 대체): 캡션 없이 카메라 아이콘 24만 */}
                {photoImporting ? <ActivityIndicator size="small" color={C.ink3} /> : <IconCamera size={24} color={C.ink3} />}
              </Pressable>
            )}
          </ScrollView>
        </View>

        <View
          style={styles.block}
          testID="body-block"
          onLayout={(e) => {
            blockTop.current = e.nativeEvent.layout.y;
            blockBottom.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
          }}
        >
          <Text style={styles.label}>{t('review.reviewLabel')}</Text>
          <Input
            ref={bodyInputRef}
            value={body}
            onChangeText={(v) => {
              touchY.current = null; // 입력이 시작되면 캐럿이 탭한 줄을 떠난다 — 뒤의 뷰포트 축소가 옛 탭 줄로 되돌리지 않게(#228 공부)
              setBody(v.slice(0, MAX));
            }}
            placeholder={t('review.placeholder')}
            placeholderTextColor={C.inkDisabled}
            multiline
            style={[styles.textarea, bodyFocused && styles.textareaFocus]}
            onFocus={() => {
              bodyFocusedRef.current = true;
              setBodyFocused(true);
            }}
            onBlur={() => {
              bodyFocusedRef.current = false;
              followedBy.current = 0; // 포커스가 끝나면 되돌릴 양도 잊는다(키보드가 내려가며 늘어나는 뷰포트는 되돌림 대상 아님)
              touchY.current = null;
              setBodyFocused(false);
            }}
            onPressIn={(e) => { touchY.current = e.nativeEvent.locationY; }}
            onLayout={(e) => { inputTopInBlock.current = e.nativeEvent.layout.y; }}
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
            {showMinLen && (
              <Text style={[styles.minLenHint, (minLenStressed || serverRejected) && styles.minLenStressed]} testID="review-min-length">{t('review.minLength')}</Text>
            )}
            {bodyShort ? (
              <Text style={[styles.tag, minLenStressed && styles.minLenStressed]} testID="review-min-count">{t('review.minLengthCount', { count: bodyLen })}</Text>
            ) : (
              <Text style={styles.tag}>{t('review.charCount', { count: body.length })}</Text>
            )}
          </View>
          {/* §2-7(4150:16511): 장소 필 — 좌하단 pill h38(선택 = 장소명 + Clear) */}
          {FLAGS.reviewPlaceEnabled && !packaged && ( // KB-812 2차: 가공식품 = 식당 위치 없음
            place ? (
              <View style={styles.placePill} testID="place-pill-selected">
                <IconMapPin size={12} color={C.ink} />
                <Text style={styles.placePillText} numberOfLines={1}>{place.name}</Text>
                <Pressable style={styles.pillClear} hitSlop={8} onPress={() => setPlace(null)} testID="place-clear">
                  <IconClose size={10} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.placePill} onPress={() => setPlaceSheet(true)} testID="place-pill">
                <IconMapPin size={12} color={C.ink} />
                <Text style={styles.placePillText}>{t('review.placeRow')}</Text>
              </Pressable>
            )
          )}
        </View>



        {postError === 'failed' && (
          <View style={styles.postErr}>
            <RiskMark state="caution" size={16} />
            <Text style={styles.postErrText}>{t('review.postError')}</Text>
          </View>
        )}
        {/* KB-620: 숨김 안내는 **중립**이다 — RiskMark(안전 판정 아이콘)·주황 경고 틴트를 쓰지 않는다.
            "이 음식을 잠시 못 쓴다" 옆에 판정 아이콘이 붙으면 음식 자체에 대한 판정으로 읽힌다(헌법 III).
            틀(패딩·보더·라운딩)은 postErr와 같고 색만 다르다. */}
        {/* KB-650: 018(재생성 중) = 회복 문구 + IconRetry("돌아온다") · 001(없음·삭제) = 중립 문구, 텍스트만
            (되돌아온다는 암시 금지 — KB-620 가드). 틀은 같고 아이콘 슬롯만 다르다. */}
        {postError === 'updating' && (
          <View style={styles.hiddenNote} testID="review-food-updating">
            <IconRetry size={16} color={C.inkInfo} />
            <Text style={styles.hiddenNoteText}>{t('review.foodUpdating')}</Text>
          </View>
        )}
        {/* KB-812 2차: 가공식품 쓰기 아직 닫힘(403 PFOOD-005) — 중립 안내, 쓴 글은 화면에 그대로 */}
        {postError === 'closed' && (
          <View style={styles.hiddenNote} testID="review-write-soon">
            <Text style={styles.hiddenNoteText}>{t('review.writeSoon')}</Text>
          </View>
        )}
        {postError === 'gone' && (
          <View style={styles.hiddenNote} testID="review-food-hidden">
            <Text style={styles.hiddenNoteText}>{t('review.foodHidden')}</Text>
          </View>
        )}
      </ScrollView>

      {/* §2-8 → KB-891: 하단 "Post review" = 음식 상세와 같은 가로 전체 알약(흰 바·상단 선 없음, 항상 표시). P-173 가드 = useSubmitGuard +
          Btn busy(공용 문법 — 메트릭 불변 스피너). 비활성 = off 색 그대로(알약은 틀·글자 크기만) */}
      <View
        style={[pillCta.pillRow, { bottom: pillBottom }]}
        pointerEvents="box-none"
        onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
        testID="review-bottom-bar"
      >
        {/* KB-828: 비활성 Btn은 터치를 받지 않아 바깥 래퍼가 받는다 → 토스트 없이 안내 강조. 스크린리더는 Btn(비활성 + 사유 힌트) */}
        <Pressable onPress={showMinLen ? () => setMinLenStressed(true) : undefined} accessible={false} testID="post-review-blocked">
          <Btn
            variant={canPost || posting ? 'primary' : 'off'}
            busy={posting}
            onPress={post}
            accessibilityHint={showMinLen ? t('review.minLength') : undefined}
            style={pillCta.pillShape}
            labelStyle={pillCta.pillLabel}
            testID="post-review"
          >
            {t(editing ? 'editReview.save' : 'review.postReview')}
          </Btn>
        </Pressable>
      </View>
      </View>

      {/* P-168 ②: 완료 = P-162 주문 완료 모달 문법(화면 전환 없이) — 확인 = 상세 복귀 */}
      {/* KB-708: 작성 중 이탈 확인(커뮤니티 글쓰기와 같은 컴포넌트·문구) */}
      <LeaveConfirmModal {...leave.modal} />
      {packaged && (
        <PhotoConsentSheet
          open={consentOpen}
          onAnswer={(agreed) => {
            if (agreed) {
              consentAgreedRef.current = true;
              void grantPackagedPhotoConsent();
            }
            setConsentOpen(false); // 취소 = 시트만 닫힘(사진 없이 작성 계속)
          }}
          onClosed={onConsentClosed}
        />
      )}
      <ReviewPromptSheet open={reviewPrompt.open} onAnswer={reviewPrompt.respond} onShow={reviewPrompt.onShow} onClosed={reviewPrompt.onClosed} disabled={reviewPrompt.answered} />
      {/* KB-730: Done = 모달 표시만 접고(submitted 유지) iOS는 onDismiss(완전히 닫힌 뒤)에서 유도 시트 큐 — dismiss 직후 present = 프리즈(#236 2R) */}
      <Modal
        visible={submitted && !confirmClosed}
        transparent
        animationType="fade"
        onRequestClose={() => router.back()}
        onDismiss={Platform.OS === 'ios' ? () => { if (confirmClosed) runAfterPosted(); } : undefined}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard} testID="review-posted-confirm">
            <View style={styles.doneCheck}>
              <IconCheck size={26} color={C.primary} />
            </View>
            <Text style={styles.confirmTitle}>{t('review.postedTitle')}</Text>
            <Text style={styles.confirmBody}>{t('review.postedBody', { rating, name: targetName })}</Text>
            <View style={{ marginTop: 6 }}>
              {/* P-211 ①: 진입점 무관 "Done" 단일 문구 — 피드 발 작성은 목적지가 상세가 아님 */}
              {/* KB-730: 완료 모달을 닫은 **뒤** 리뷰 유도 시트(겹침 0) — 조건 미달이면 바로 복귀 */}
              <Btn
                onPress={() => {
                  setConfirmClosed(true);
                  if (Platform.OS !== 'ios') runAfterPosted(); // Android: onDismiss 미지원
                }}
                testID="review-posted-done"
              >
                {t('review.done')}
              </Btn>
            </View>
          </View>
        </View>
      </Modal>

      {FLAGS.reviewPlaceEnabled && placeSheet && (
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
      {/* P-370(KB-533): 모달 컨텍스트 토스트 호스트(스택 top — 언마운트 시 루트 복원) */}
      <TopToastHost />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { padding: 20, gap: 20 }, // A-RW-01(KB-486)

  postLink: { fontFamily: font.bodyBold, fontSize: 14, color: C.primaryText, marginRight: 8 },
  postLinkOff: { color: C.ink3 },

  // KB-432 §2-2: 대상 카드(4150:16477) — #DCDEE3 1px r8 pad 8 gap 13
  foodChip: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: C.line2, borderRadius: radius.sm, padding: 8 },
  foodPh: { width: 48, height: 48, borderRadius: 4, backgroundColor: C.surface2, overflow: 'hidden' },
  foodName: { fontSize: 14, fontWeight: '600', color: C.ink },
  foodKo: { fontSize: 13, fontWeight: '400', color: C.ink3 },

  block: { gap: 12 },
  tasteBlock: { gap: 16 }, // KB-865 ④ 시안 32: 당도 행 → 안내 1줄
  tasteNote: { fontSize: 13, fontWeight: '500', color: C.ink2 },
  label: { fontSize: 13, fontWeight: '600', color: '#778088' }, // A-RW-07
  // §2-3: 별 48 gap 11 + 수치 18/600 #4B4F58
  starPick: { flexDirection: 'row', gap: 11, justifyContent: 'center', marginTop: 4 },
  starCap: { fontSize: 18, fontWeight: '600', color: '#4B4F58', textAlign: 'center' },
  starCapEmpty: { color: C.ink3 },

  // §2-6(4150:16505): h156 흰 bg line 1px r8 pad 14/16, focus = primary
  textarea: { minHeight: 132, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCDEE3', borderRadius: radius.sm, paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, fontWeight: '500', color: C.ink, lineHeight: 21, marginTop: -8 }, // A-RW-07(라벨→필드 4 = block gap 12 - 8)
  textareaFocus: { borderColor: C.primary },
  // §2-5: 사진 슬롯 100 r8
  photoRow: { flexDirection: 'row', gap: 8 },
  photoThumbWrap: { width: 100, height: 100 },
  photoThumb: { width: 100, height: 100, borderRadius: radius.sm, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.inkDisabled },
  // KB-777 A2-9: 터치 = 썸네일 안쪽 모서리 44×44 상자(부모 100 안 — hitSlop은 부모 밖에서 잘린다), 보이는 원은 시안 그대로 16 @ top6·right6
  photoDelHit: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, padding: 6, alignItems: 'flex-end' },
  photoDel: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#D9D9D9', alignItems: 'center', justifyContent: 'center' }, // A-RW-06
  photoAdd: { width: 100, height: 100, borderRadius: radius.sm, borderWidth: 1, borderColor: C.line2, backgroundColor: 'rgba(244,246,246,0.5)', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  tag: { fontSize: 13, fontWeight: '500', color: C.ink3 },
  minLenHint: { flex: 1, fontSize: 13, fontWeight: '500', color: C.ink3 }, // KB-828: tag와 같은 메트릭 — 강조는 색만
  minLenStressed: { color: C.primaryText },
  // §2-7: 장소 필 h38 border #DCDEE3 r24 pad 8/12
  placePill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 38, borderWidth: 1, borderColor: C.line2, borderRadius: 24, paddingVertical: 8, paddingHorizontal: 12, maxWidth: '100%' }, // A-RW-09
  placePillText: { flexShrink: 1, fontSize: 13, fontWeight: '500', color: C.ink },
  pillClear: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.inkMute, alignItems: 'center', justifyContent: 'center' },
  // §2-8: FixedBottom
  // Codex #31 P1: 하단 = 10 + useBottomInset(인라인)
  stage: { flex: 1 },
  // P-085: 제출 실패 안내 (온보딩 submitErr 톤)
  postErr: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fdf3e7', borderWidth: 1, borderColor: '#f3ddc0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  postErrText: { flex: 1, fontFamily: font.body, fontSize: 12.5, color: C.ink, lineHeight: 17 },
  // KB-620: postErr와 **같은 틀**, 중립 색(risk*·주황 계열 금지)
  hiddenNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  hiddenNoteText: { flex: 1, fontFamily: font.body, fontSize: 12.5, color: C.inkInfo, lineHeight: 17 },

  // submitted
  // P-168 ②: 완료 모달 (P-162 confirm 문법과 동일 수치)
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  confirmCard: { alignSelf: 'stretch', backgroundColor: C.card, borderRadius: 26, padding: 22, gap: 8, ...shadow.shPop },
  confirmTitle: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  confirmBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19, textAlign: 'center' },
  doneCheck: { alignSelf: 'center', width: 52, height: 52, borderRadius: 26, backgroundColor: primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  okMeta: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
});

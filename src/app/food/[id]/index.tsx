/**
 * Food detail — KB-431(P-276) 디자인 4차 D-3 (Figma 4150:16891 · 4150:16974).
 * 히어로 정방 + 하단 그라데이션 · 위험 요약 행(히어로 직하, riskTone 틴트 —
 * danger=붉은/caution=노란, 커맨드 센터 판정) · 헤더 블록(맵기 칩+SVG 고추·
 * 제목·설명·별점 행·북마크 36) · 8px 섹션 디바이더 · What's inside 칩 필터 +
 * 재료 타일 3열 그리드 + 재료 바텀시트 · 리뷰 섹션(D-2 카드 ×3) · FixedBottom.
 *
 * ⚠️ 시안 이식 금지 준수(P-139 유지): 맵기 = 현행 5단계 foodSpiceText,
 * verdict 이유 = 성분 기준 조립만, caution 사유 = 중립 조립(ingBasis).
 * 게스트: 판정 미노출(잠금 슬롯) — 재료는 공개하되 마크·칩 미렌더(P-206/P-235).
 * Unregistered = "Unable to assess" 유지 — never assumed safe (FR-033).
 * personalRisk·재료 데이터·리뷰 훅·저장 토글·지도 딥링크 무변.
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C, font, riskTone, shadow, type RiskState } from '@/lib/theme';
import { ingredientLabel, isCatalogIngredient } from '@/lib/mocks/ingredients';
import { RiskMark, RiskBadge, CardPhoto, Chip, NewBadge, Star, BookmarkStar, Btn, IconChevron, IconSpeech, IconArrowLeft } from '@/components';
import { TopToastHost } from '@/components/TopToast';
import { EmptyBlock,QueryErrorBlock  } from '@/components/StateBlock';
import { SkeletonFoodDetail } from '@/components/Skeleton';
import { RemoteImage } from '@/components/RemoteImage';
import { HeroGallery } from '@/features/food/HeroGallery';
import { PILL_FADE_MS, useScrollAwarePill } from '@/features/food/scrollAwarePill';
import { IDOL_CARD_BOTTOM_PAD, IdolVideoCard } from '@/features/food/IdolVideoCard';
import { useIdolPickVideo } from '@/lib/data/useIdolPicks';
import { useIsNewFood } from '@/lib/newFood';
import { useIngredientImageChain } from '@/components/AvoidTile';
import { ScanCoachMark } from '@/features/scan/ScanCoachMark';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useFoodReviews } from '@/lib/data/useFoodReviews';
import { useDeleteReview } from '@/lib/data/useReviewMutations';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import { FeedCard } from '@/features/review/FeedCard';
import { RatingSummaryBox, serverAxes } from '@/features/review/RatingSummaryBox';
import { FeedAd } from '@/features/ads/FeedAd';
import { withFeedAds } from '@/lib/ads/feedSlots';
import { useToggleBookmark } from '@/lib/data/bookmarks';
import { useIngredientCatalog } from '@/lib/data/useIngredientCatalog';
import { IconEdit, IconFood, IconLock } from '@/components/icons';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import { EVENTS, track } from '@/lib/analytics';
import { airbridge } from '@/lib/airbridge';
import { foodSpiceText, spiceRank } from '@/lib/spice';
import { SpicePeppers } from '@/components/SpicePeppers';
import { formatKrw, parseScanPrice } from '@/lib/scan/segmentMenu';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import type { FoodDetail, IngredientRisk } from '@/lib/api/types';
import { useFoodHiddenReason } from '@/lib/data/hiddenFoods';

const RISK_ORDER: Record<RiskState, number> = { danger: 0, caution: 1, unable: 2, safe: 3 };
/** 시안 노트 03 — 히어로를 이만큼 지나면 헤더 솔리드+타이틀 페이드인 */
const HEADER_SOLID_Y = 210;
const INK_TITLE = '#2F3137';
const REVIEW_PREVIEW_N = 3; // 발주 §1-7: 카드 ×3

/** P-303(KB-457): 재료 타일·시트 이미지 = AvoidTile과 같은 3단 체인(서버 imageUrl →
 *  CDN 조립 → 폴백) — 상세만 서버 imageUrl 단독이라 사진이 안 뜨던 결함 해소.
 *  체인 소진 시 현 폴백(IconFood) 유지, 타일 크기 48/56 무변(시안 §3). */
function IngChainImage({ code, imageUrl, size, iconSize }: { code: string; imageUrl?: string | null; size: number; iconSize: number }) {
  const { uri, isCutout, nextSource } = useIngredientImageChain(code, imageUrl);
  if (!uri) return <IconFood size={iconSize} color={C.ink3} />;
  // key = 소스별 리마운트(RemoteImage settle 리셋 — AvoidTile 문법 동일)
  // P-341(KB-502): 누끼본 = contain(여백은 크기 축소로 근사 — 타일 pad 유지)
  // Codex #102 P2: 누끼 상태 = 흰 바닥(AvoidTile 동일 규칙) — 부모 surface2는 실패 폴백만
  return (
    <>
      {isCutout && <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }]} testID={`ing-cut-bg-${code}`} />}
      <RemoteImage
        key={uri}
        uri={uri}
        onError={nextSource}
        contentFit={isCutout ? 'contain' : undefined}
        style={isCutout ? { width: size * 0.74, height: size * 0.74 } : { width: size, height: size, borderRadius: 8 }} // P-344: 74% 공통
      />
    </>
  );
}

export default function FoodDetailScreen() {
  // P-012(KB-179): price는 스캔 결과 진입에만 실리는 표시 전용 param — 조작 방어 파싱
  const { id, price, src } = useLocalSearchParams<{ id: string; price?: string; src?: string }>();
  // P-083: 상세 진입 계측 — 진입 경로 1회
  useEffect(() => {
    const source = src && ['scan', 'list', 'search', 'home', 'saved', 'my_reviews', 'feed', 'tag_sheet', 'idol_pick'].includes(src) ? src : 'other'; // KB-847: review_detail 제거(#288 되돌림) · idol_pick 유지(#313)
    track(EVENTS.food_detail_view, { source, food_id: id ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const scanPrice = parseScanPrice(price);
  const isGuest = useIsGuest();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const { data: fetched, isLoading, error, refetch } = useFoodDetail(id ?? '');
  // KB-620→626: 서버가 이 음식을 **지금** 거부했으면(FOOD-001 — 상세·리뷰 목록·북마크 어느 원천이든) 캐시보다
  // 우선한다. TanStack은 재조회가 실패해도 이전 `data`를 유지하므로 그대로 쓰면 옛 판정(SAFE일 수 있음)과
  // 액션 바가 남는다 — false-safe(헌법 III). 판정은 **이 한 줄**에서만 한다(hiddenFoods 신호). `food`를
  // 비우면 판정 본문·액션 바·헤더 제목·리뷰 영역·CTA가 전부 따라 사라진다(`Registered` 언마운트).
  // ⚠️ 상세 쿼리는 숨김 중에도 계속 돈다(`enabled`를 이 신호에 묶지 않는다) — 성공 응답이 신호를 푸는
  // 유일한 경로라, 쿼리를 끄면 음식이 돌아와도 영영 숨김이 된다.
  const hiddenReason = useFoodHiddenReason(id ?? ''); // KB-650: 'updating'(018) | 'gone'(001) | null
  const hidden = hiddenReason !== null;
  const food = hidden ? undefined : fetched;
  // KB-783 ⑧: 음식 상세 — 판정이 보일 때(food 확정)만, 음식마다 1회. 숨김(false-safe 비움) 중엔 보내지 않는다
  const abViewed = useRef<string | null>(null);
  useEffect(() => {
    if (!food || abViewed.current === food.foodId) return;
    abViewed.current = food.foodId;
    airbridge.productView({ id: food.foodId, name: food.nameKo });
  }, [food]);
  const { data: me } = useMe();
  // §1-8 FixedBottom의 리뷰 자격 게이트 — 화면 루트 소유(바가 루트 소유라 함께)

  // P-139: 플로팅 헤더 — 스크롤 임계 통과 시 솔리드+타이틀 페이드인
  const [solid, setSolid] = useState(false);
  // KB-851 → KB-871: 하단 리뷰 버튼 영역 — 아래로 스크롤 = 숨김 · 위로·제스처 끝 멈춤·맨 위/아래 = 표시 · 한 제스처 안 전환 1회 · K-pop 카드는 버튼 자리와 겹칠 때만 숨김
  // KB-871 QA AP: 겹침 대상(K-pop 카드 캐시 · 리뷰 0 본문 상자)이 있으면 측정 전까지 버튼을 애니메이션 없이 숨겨 둔다(진입 번쩍임 0)
  const idolExpected = !!useIdolPickVideo(id ?? '');
  const emptyCtaExpected = !!food && food.isRegistered && FLAGS.reviewsEnabled && !isGuest && !food.reviewSummaryMissing && food.overall.count === 0;
  const pill = useScrollAwarePill({ card: idolExpected, emptyCta: emptyCtaExpected });
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setSolid(e.nativeEvent.contentOffset.y > HEADER_SOLID_Y);
    pill.onScroll(e);
  };
  const solidFade = useAnimatedStyle(() => ({ opacity: withTiming(solid ? 1 : 0, { duration: 180 }) }));

  // 북마크 — 게스트=게이트 시트, 회원=BE 토글 (KB-142: 낙관적+실패 롤백, 무변)
  const saved = food?.bookmarked ?? false;
  const toggleBm = useToggleBookmark();
  const [saveGateOpen, setSaveGateOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false); // P-134: 마크 탭 재열람
  const onBookmark = () => {
    if (isGuest) {
      setSaveGateOpen(true);
      return;
    }
    if (!food) return;
    const adding = !saved;
    track(EVENTS.food_bookmark_toggle, { on: adding }); // P-144
    // P-339 ⑤: 성공/실패 토스트 = 공용 상단 토스트(useToggleBookmark 한 곳) — 로컬 스낵바 소멸
    toggleBm.mutate({
      snap: { foodId: food.foodId, name: food.name, nameKo: food.nameKo, risk: food.risk, photoUrl: food.photoUrl },
      add: adding,
      fromDetail: true, // KB-626: 숨김이면 상세 안내가 설명한다 — 토스트 중복 금지
    });
  };

  // KB-431 §1-8 → KB-851 떠 있는 알약 — 등록 음식만(미등록은 본문 CTA 현행 유지)
  const showBottomBar = !!food && food.isRegistered;
  // Codex #97 3R P2 → KB-851: 알약 줄 실높이(큰 글씨·긴 번역이면 커짐) + 바닥 여백만큼 콘텐츠 하단 여백 — 마지막 리뷰를 가리지 않게(측정 전 폴백 48)
  const [barH, setBarH] = useState(0);
  const pillBottom = Math.max(insets.bottom, 12);

  return (
    <View style={styles.root}>
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={pill.onScrollBeginDrag}
        onScrollEndDrag={pill.onScrollEndDrag}
        onMomentumScrollBegin={pill.onMomentumScrollBegin}
        onMomentumScrollEnd={pill.onMomentumScrollEnd}
        onLayout={(e) => pill.onViewLayout(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => pill.onContentSize(h)}
        contentContainerStyle={[{ paddingBottom: showBottomBar ? (barH || 48) + pillBottom + 16 : 40 }, (error || hidden) && !food ? { flexGrow: 1 } : null]}
        testID="detail-scroll"
      >
        {/* KB-620(9/22 예진): 음식이 이미지 재생성으로 **일시 숨김**(FOOD-001)이면 에러 블록 대신 조용한 안내.
            QueryErrorBlock을 쓰면 안 되는 이유 셋 — ① 재시도가 **영원히 실패**해 버튼이 함정이 된다
            ② 안전 판정 글리프(RiskGlyph caution)가 붙어 음식 자체에 대한 판정처럼 읽힌다(헌법 III)
            ③ error_state_view 계측이 나가 에러 지표(P-213)가 오염된다. EmptyBlock은 셋 다 없다.
            뒤로는 상단 플로팅 버튼(항상 렌더)이 맡는다. 다른 에러는 기존 블록 그대로. */}
        {hidden ? (
          <View style={styles.hiddenFill}>
            {/* KB-650: 018(재생성 중 — 돌아온다) = 회복 문구 · 001(없음·삭제) = 중립 문구. 블록은 같다(레이아웃 불변). */}
            <EmptyBlock label={t(hiddenReason === 'updating' ? 'detail.foodUpdating' : 'detail.foodHidden')} testID="detail-food-hidden" />
          </View>
        ) : error && !food ? (
          <QueryErrorBlock error={error} onRetry={() => void refetch()} onGoBack={() => router.back()} />
        ) : null}
        {/* P-287(4003:13466): 첫 로드 = 상세 스켈레톤(공백 금지) */}
        {isLoading && !food && !error && !hidden && <SkeletonFoodDetail />}

        {!isLoading && food && (
          <>
            {/* §1-1: 히어로 정방(375×375) + 하단 어두운 선형 그라데이션(4150:16892)
                P-383(KB-566): 이미지 2장 이상 = 캐러셀(2초 자동·도트), 0·1장·부재 = 현행 정적 */}
            {(food.images?.length ?? 0) >= 2 ? (
              <View style={styles.hero} testID="detail-hero">
                {/* 그라데이션은 사진 위·도트 아래에 깔려야 해서 overlay로 넘긴다 */}
                <HeroGallery
                  urls={food.images!}
                  overlay={<LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']} style={styles.heroGrad} pointerEvents="none" />}
                />
              </View>
            ) : food.photoUrl ? (
              <View style={styles.hero} testID="detail-hero">
                <CardPhoto uri={food.photoUrl} transition={200} borderRadius={0} />
                <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']} style={styles.heroGrad} pointerEvents="none" />
              </View>
            ) : (
              <View style={[styles.heroFallback, { height: 96 + insets.top }]} testID="detail-hero-fallback" />
            )}

            {food.isRegistered ? (
              <Registered
                guest={isGuest}
                setCoachOpen={setCoachOpen}
                scanPrice={scanPrice}
                food={food}
                saved={saved}
                onBookmark={onBookmark}
                myId={me?.id}
                nationality={me?.nationality ?? null} /* P-323: 'US' 폴백 폐기 — null = 토글 미렌더 */
                hasRestrictions={(me?.restrictions.length ?? 0) > 0}
                t={t}
                router={router}
                id={id ?? ''}
                onIdolLayout={pill.onCardLayout}
                onEmptyCtaLayout={pill.onEmptyCtaLayout}
              />
            ) : (
              <View style={styles.body}>
                <Unregistered food={food} t={t} onAsk={() => { track(EVENTS.owner_ask_open, { source: 'unregistered', food_id: id ?? '' }); router.push(`/food/${id}/owner` as Href); }} />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* §1-8 → KB-851 → KB-871(예진 10/22): 하단 고정 · 가로 전체(좌우 화면 여백 20) — 위 = primary Write(흰 글자·흰 file-pen),
          회원은 아래에 테두리 Ask 한 줄 더 · 스캔 진입(Ask 단독) = primary 한 줄. 표시 규칙 = useScrollAwarePill(영역 전체) */}
      {showBottomBar && (
        <RegisteredBottomBar
          shown={pill.shown}
          ready={pill.ready}
          bottom={pillBottom}
          guest={isGuest}
          scanEntry={src === 'scan'}
          onHeight={(h) => { setBarH(h); pill.onBand(h + pillBottom + 8); }}
          t={t}
          onWrite={() => {
            // P-392(KB-584): 자격 게이트 폐기 — 회원이면 스캔 여부 무관(BE #274: reviewEligible 항상 true)
            track(EVENTS.review_write_tap, { source: 'detail' });
            router.push(`/food/${id}/review` as Href);
          }}
          onAsk={
            isGuest
              ? undefined
              : () => { track(EVENTS.owner_ask_open, { source: 'cta', food_id: id ?? '' }); router.push(`/food/${id}/owner` as Href); }
          }
        />
      )}

      {/* P-139 ②: 플로팅 헤더 — 사진 위 반투명 원 back(제목 없음) → 솔리드+타이틀 */}
      <View style={[styles.fhead, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, styles.fheadBg, solidFade]} pointerEvents="none" testID="fhead-bg" />
        {/* KB-696: 상태 표시줄 영역은 스크롤 뒤(solid) **불투명** — 헤더 바 배경(FHEAD_BAR_BG)이 반투명이라 그 위로 글자·재료 그림이 비쳤다.
            히어로 위(맨 위)에선 헤더처럼 투명(solidFade). */}
        <Animated.View style={[styles.fheadStatusShield, { height: insets.top }, solidFade]} pointerEvents="none" testID="fhead-status-shield" />
        <Pressable style={[styles.fBtn, solid && styles.fBtnSolid]} onPress={() => router.back()} hitSlop={8} testID="detail-back">
          <IconArrowLeft size={18} color={solid ? C.ink : '#fff'} />
        </Pressable>
        <Animated.View style={[{ flex: 1, minWidth: 0 }, solidFade]}>
          <Text style={styles.fTitle} numberOfLines={1}>
            {food?.name ?? ''}
          </Text>
        </Animated.View>
        <View style={{ width: 36 }} />
      </View>

      <AuthGateSheet context="save" open={saveGateOpen} onClose={() => setSaveGateOpen(false)} />
      {/* P-370(KB-533): 모달 컨텍스트 토스트 호스트(스택 top — 언마운트 시 루트 복원) */}
      <TopToastHost />
      <ScanCoachMark open={coachOpen} onClose={() => setCoachOpen(false)} t={t} />
    </View>
  );
}

type TFn = ReturnType<typeof useTranslation>['t'];
type Router = ReturnType<typeof useRouter>;

const VERDICT: Record<RiskState, string> = {
  safe: 'detail.verdictSafe',
  caution: 'detail.verdictCaution',
  danger: 'detail.verdictDanger',
  unable: 'detail.verdictUnable',
};

/** 재료 필터 칩(§1-5) — D-2 홈과 동일 문법. */
type IngChip = 'all' | 'safe' | 'danger' | 'caution';
const ING_CHIPS: IngChip[] = ['all', 'safe', 'danger', 'caution'];

function RegisteredBottomBar({
  shown,
  ready = true,
  bottom,
  t,
  onWrite,
  onAsk,
  scanEntry = false,
  onHeight,
}: {
  /** 표시 여부(useScrollAwarePill) — 숨김 = 아래로 미끄러지며 투명(스크린리더 포커스는 유지) */
  shown: boolean;
  /** 첫 측정 전 = 애니메이션 없이 숨김(KB-871 QA AP — 진입 때 카드 위로 번쩍 보였다 사라짐) */
  ready?: boolean;
  /** 화면 바닥에서 알약까지(안전 영역, 최소 12) */
  bottom: number;
  guest: boolean;
  t: TFn;
  onWrite: () => void;
  onAsk?: () => void;
  /** P-353 ②(KB-515): 스캔 진입 = Write 미렌더·Ask 단독(스캔한 음식이라 리뷰 유도 대신 문의 단독) */
  scanEntry?: boolean;
  /** 알약 줄 실높이 보고 — 스크롤 하단 여백 파생(큰 글씨·긴 번역 대응) */
  onHeight?: (h: number) => void;
}) {
  const reduced = useReducedMotion();
  const [rowH, setRowH] = useState(48);
  const hideY = rowH + bottom + 8; // 화면 밖까지
  // 표시·숨김 = 200ms 슬라이드 + 페이드(감속 곡선) · 모션 줄이기 = 슬라이드 없이 짧은 페이드만
  const anim = useAnimatedStyle(() => ({
    opacity: !ready ? 0 : withTiming(shown ? 1 : 0, { duration: reduced ? 120 : PILL_FADE_MS, easing: Easing.out(Easing.cubic) }),
    transform: [{ translateY: reduced ? 0 : !ready ? hideY : withTiming(shown ? 0 : hideY, { duration: PILL_FADE_MS, easing: Easing.out(Easing.cubic) }) }],
  }));
  const write = FLAGS.reviewsEnabled && !(scanEntry && onAsk);
  if (!write && !onAsk) return null;
  return (
    <Animated.View
      style={[styles.pillRow, { bottom }, anim]}
      pointerEvents={shown ? 'box-none' : 'none'}
      onLayout={(e) => { const h = e.nativeEvent.layout.height; setRowH(h); onHeight?.(h); }}
      testID="detail-bottom-bar"
    >
      {write && (
        <Pressable style={styles.pillPrimary} onPress={onWrite} accessibilityRole="button" testID="bottom-write">
          <IconEdit size={20} color="#FFFFFF" />
          <Text style={styles.pillPrimaryText}>{t('reviews.writeReview')}</Text>
        </Pressable>
      )}
      {onAsk && (
        // 회원 = Write 아래 테두리 한 줄 · 스캔 진입(Write 없음) = primary 한 줄(P-353)
        <Pressable style={write ? styles.pillOutline : styles.pillPrimary} onPress={onAsk} accessibilityRole="button" testID="bottom-ask">
          <Text style={write ? styles.pillOutlineText : styles.pillPrimaryText}>{t('detail.askOwner')}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

function Registered({
  food,
  saved,
  onBookmark,
  myId,
  nationality,
  hasRestrictions,
  guest,
  scanPrice,
  t,
  router,
  id,
  setCoachOpen,
  onIdolLayout,
  onEmptyCtaLayout,
}: {
  /** KB-871 QA ③: 리뷰 0 본문 "Write a review" 상자의 콘텐츠 y·높이(보이는 동안 하단 버튼 숨김) */
  onEmptyCtaLayout?: (y: number, h: number) => void;
  /** KB-851: K-pop 카드의 콘텐츠 y·높이 보고(리뷰 알약 숨김 판정) */
  onIdolLayout?: (y: number, h: number) => void;
  setCoachOpen: (v: boolean) => void;
  guest: boolean;
  food: FoodDetail;
  saved: boolean;
  onBookmark: () => void;
  myId?: string;
  nationality: string | null;
  hasRestrictions: boolean;
  scanPrice: number | null;
  t: TFn;
  router: Router;
  id: string;
}) {
  const isNew = useIsNewFood(food.publishedAt);
  // 리뷰 0 본문 상자 — 첫 리뷰를 쓰고 돌아오면 같은 화면에서 사라진다: 높이 0을 보고해 하단 버튼이 옛 자리 기준으로 숨어 있지 않게(Codex #337)
  const emptyCta = FLAGS.reviewsEnabled && !guest && !food.reviewSummaryMissing && food.overall.count === 0;
  useEffect(() => {
    if (!emptyCta) onEmptyCtaLayout?.(0, 0);
  }, [emptyCta, onEmptyCtaLayout]);
  const idolVideo = useIdolPickVideo(id); // KB-836 D3: 목록 쿼리 캐시만 — 상세 진입으로 목록 API 를 부르지 않는다
  // Codex #328: 카드가 사라지면(캐시 갱신·언어 전환·라우트 변경) 저장된 카드 위치를 비운다 — 빈 자리에서 알약이 계속 숨지 않게(높이 0 = 화면에 없음)
  useEffect(() => {
    if (!idolVideo) onIdolLayout?.(0, 0);
  }, [idolVideo, onIdolLayout]);
  const writeReview = (source: 'detail') => {
    // P-392(KB-584): 자격 게이트 폐기 — 게스트 게이트(AuthGateSheet)는 그대로
    track(EVENTS.review_write_tap, { source });
    router.push(`/food/${id}/review` as Href);
  };

  const [gateOpen, setGateOpen] = useState(false); // 게이트 시트 (KB-77)
  // false-safe guard (Constitution III · SC-003): empty profile never shows safe
  const dishRisk = personalRisk(food.risk, hasRestrictions);
  const ingredients = [...food.ingredients].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
  const [ingChip, setIngChip] = useState<IngChip>('all');
  const [ingSheet, setIngSheet] = useState<IngredientRisk | null>(null);
  const cat = useIngredientCatalog();
  const shownIngredients = guest || ingChip === 'all'
    ? ingredients
    : ingredients.filter((i) => personalRisk(i.risk, hasRestrictions) === ingChip);

  // P-139 ⑥ → P-239: 리뷰 프리뷰 — 신스키마 recentReviews 인라인 우선, 부재 시 호출 폴백
  const hasInline = food.recentReviews !== undefined;
  const reviewsQ = useFoodReviews(FLAGS.reviewsEnabled && !hasInline ? id : '');
  const previewSource = hasInline ? food.recentReviews! : (reviewsQ.data?.pages[0]?.items ?? []);
  const [natOnly, setNatOnly] = useState(false);
  // P-323(KB-448): 토글 on = 서버 countryCode 필터 쿼리(전체 리뷰 화면과 동일 훅·별도
  // 쿼리 키) — 구 클라 필터는 "로드된 3장 안 교집합"이라 서버엔 있는데 0장이 떴다.
  const natQ = useFoodReviews(FLAGS.reviewsEnabled && natOnly && nationality ? id : '', nationality ?? undefined);
  const natLoading = natOnly && natQ.isLoading;
  // KB-626: 리뷰 목록이 FOOD-001을 받으면 리뷰 fetch가 숨김 신호를 세우고(hiddenFoods), 부모가 그 신호
  // 하나로 이 컴포넌트 전체를 내린다 — 여기서 따로 비우거나 막지 않는다(두면 대역이다).
  const activePreviews = natOnly ? (natQ.data?.pages[0]?.items ?? []) : previewSource;
  const shownPreviews = activePreviews.slice(0, REVIEW_PREVIEW_N);
  const deleteReview = useDeleteReview();
  const [mod, setMod] = useState<ModTarget | null>(null);

  // P-139 ④ 유지: verdict 이유 = **성분 기준 조립만**(맵기 문자열 0)
  const flagged = ingredients.filter((i) => i.risk === 'danger' || i.risk === 'caution');
  const verdictReason =
    dishRisk === 'unable'
      ? t('detail.basisUnable')
      : dishRisk === 'safe'
        ? t('detail.basisSafe')
        : flagged.length > 0
          ? t('detail.verdictContains', { list: flagged.map((i) => i.name).join(', ') })
          : t('detail.basisFlagged');

  // 재료별 사유 — 기존 중립 조립 유지(FE 템플릿, "알레르기" 단정 금지)
  const ingBasis = (ing: IngredientRisk, dRisk: RiskState): string => {
    if (dRisk === 'unable') return t('detail.ingBasisUnable', { ingredient: ing.name });
    const band = dRisk === 'safe' ? 'Safe' : dRisk === 'caution' ? 'Caution' : 'Danger';
    return ing.percentage != null
      ? t(`detail.ingBasis${band}`, { ingredient: ing.name, percent: Math.round(ing.percentage) })
      : t(`detail.ingBasis${band}NoPct`, { ingredient: ing.name });
  };
  // P-282(9/5 예진 확정): "hotter than your taste" 비교 경고 제거 — 시안 = 맵기 칩+고추만

  return (
    <>
      {/* §1-3: 위험 요약 행 — 히어로 직하 full-width, riskTone 틴트(마크 색 기준
          매핑: danger=붉은 #FFF3EF / caution=노란 #FFFDEF — 시안 인스턴스 뒤바뀜은
          커맨드 센터 판정으로 통일). 탭 = 코치마크 재열람(P-134). */}
      {guest ? (
        <Pressable style={styles.lockSlot} onPress={() => setGateOpen(true)} testID="verdict-lock">
          <IconLock size={16} color={C.ink2} />
          <Text style={styles.lockSlotText}>{t('detail.lockVerdict')}</Text>
          <Text style={styles.lockSlotCta}>{t('intro.signUp')}</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.riskRow, { backgroundColor: riskTone[dishRisk].bg }]}
          onPress={() => setCoachOpen(true)}
          testID="detail-verdict"
        >
          <RiskBadge state={dishRisk} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={styles.riskRowTitle}>{t(VERDICT[dishRisk])}</Text>
            <Text style={styles.riskRowSub}>{verdictReason}</Text>
          </View>
        </Pressable>
      )}

      {/* §1-2: 헤더 블록 — 좌 컬럼 + 우 북마크 36(4129:10698) */}
      <View style={styles.headBlock}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>{/* A-FD-05 */}
          {food.spiceLevel != null && (
            <View style={styles.spiceRow}>
              {/* ⚠️ 맵기 = 현행 5단계 foodSpiceText — 시안 "6/10" 이식 금지 유지 */}
              <View style={styles.spiceChip}>
                <Text style={styles.spiceChipText}>{foodSpiceText(food.spiceLevel, t)}</Text>
              </View>
              <SpicePeppers rank={spiceRank(food.spiceLevel)} size={16} />
            </View>
          )}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{food.name}</Text>
            {/* P-385(KB-363): NEW = 서버 공개 시각 24시간 이내만(9/15 예진 — 9/5 '항상 표시' 폐기) */}
            {isNew && <NewBadge testID="detail-new-badge" />}
          </View>
          {food.nameKo !== food.name && <Text style={styles.ko}>{food.nameKo}</Text>}
          {!!food.description && <Text style={styles.desc}>{food.description}</Text>}
          {/* P-012(KB-179): 스캔한 메뉴판의 가격 — 스캔 진입 param에만 존재 */}
          {scanPrice != null && (
            <Text style={styles.scanPrice}>
              {formatKrw(scanPrice)} <Text style={styles.scanPriceNote}>{t('detail.scannedPrice')}</Text>
            </Text>
          )}
          {/* §1-2 별점 행 → 리뷰 화면 */}
          {FLAGS.reviewsEnabled && !food.reviewSummaryMissing && food.overall.count > 0 && (
            <Pressable style={styles.ratingRow} onPress={() => router.push(`/food/${id}/reviews` as Href)} hitSlop={6} testID="head-rating-row">
              <Star size={16} fillPct={100} />
              <Text style={styles.ratingRowText}>
                {food.overall.average?.toFixed(1) ?? '—'} ({food.overall.count})
              </Text>
              <IconChevron size={16} color={C.ink3} />
            </Pressable>
          )}
        </View>
        <Pressable style={[styles.bmBtn, saved && styles.bmBtnSaved]} onPress={onBookmark} hitSlop={6} testID="detail-save">
          {/* 9/5 판정: 북마크 별(4129:10698/10701) — 저장됨 = #FFE812/#E5D64D */}
          <BookmarkStar saved={saved} size={16} />
        </Pressable>
      </View>

      {!guest && !hasRestrictions && <Text style={styles.profileHint}>{t('detail.addProfileHint')}</Text>}

      {/* KB-836 V1: 대표 아이돌 영상 티저 — 목록 캐시에 이 음식이 있을 때만(없으면 래퍼·여백 0). 위험 요약·헤더 아래(안전 정보 위계 유지) */}
      {idolVideo && (
        /* KB-851: 카드 위치(스크롤 콘텐츠 기준) — 카드가 보이는 동안 리뷰 알약을 숨긴다. 래퍼는 스타일 없음(배치 무변) */
        <View onLayout={(e) => onIdolLayout?.(e.nativeEvent.layout.y, Math.max(0, e.nativeEvent.layout.height - IDOL_CARD_BOTTOM_PAD))} testID="detail-idol-wrap">
          {/* KB-855 E안: 배경 = 이 음식 사진(상단 히어로와 같은 이미지) · 높이 = 카드 아래 여백 뺀 카드 자체(KB-851 QA: 여백까지 세면 헤더 뒤로 숨은 뒤에도 "보임") */}
          <IdolVideoCard foodId={id} video={idolVideo} photoUrl={food.photoUrl} />
        </View>
      )}

      {/* §1-4: 섹션 디바이더 — 8px 회색 띠(4095:1793) */}
      {ingredients.length > 0 && (
        <>
          <View style={styles.thickDivider} />
          {/* §1-5: What's inside — 칩 필터(회원만 — 게스트는 판정 미노출) + 3열 타일 */}
          <View style={styles.insideSec}>
            <Text style={styles.insideTitle}>{t('detail.insideTitle')}</Text>
            {!guest && (
              <View style={styles.ingChipRow}>
                {ING_CHIPS.map((c) => (
                  <Chip
                    key={c}
                    label={c === 'all' ? t('home.filterAll') : t(`risk.${c}`)}
                    selected={ingChip === c}
                    onPress={() => setIngChip(c)}
                    testID={`ing-chip-${c}`}
                  />
                ))}
              </View>
            )}
            {/* §3 태그 줄바꿈 규칙: 타일 단위로만 줄바꿈 — flexWrap + flexShrink:0 + 이름 1줄 */}
            <View style={styles.ingGrid}>
              {shownIngredients.map((ing) => {
                const dRisk = personalRisk(ing.risk, hasRestrictions);
                return (
                  <Pressable key={ing.code} style={[styles.ingTile, !guest && dRisk === 'caution' && styles.ingTileWithFoot]} onPress={() => setIngSheet(ing)} testID={`ing-${ing.code}`}>
                    {!guest && (
                      <View style={styles.ingTileMark}>
                        <RiskMark state={dRisk} size={18} />
                      </View>
                    )}
                    <View style={styles.ingTileImg}>
                      <IngChainImage code={ing.code} imageUrl={cat.imageUrl(ing.code)} size={48} iconSize={28} />
                    </View>
                    <Text style={styles.ingTileName} numberOfLines={1}>{ing.name}</Text>
                    {/* KB-599: 함의 매치 근거(새우 회피 → 새우젓) — 회원·카탈로그 code일 때만, 2줄 클램프. 뒤에 % 줄이 오면 하단 여백은 그 줄이 맡는다 */}
                    {!guest && ing.impliedBy && isCatalogIngredient(ing.impliedBy) && (
                      <Text style={ing.percentage != null ? [styles.ingTileSub, { marginBottom: 0 }] : styles.ingTileSub} numberOfLines={2} testID={`ing-implied-${ing.code}`}>
                        {t('detail.avoidImplied', { ingredient: ingredientLabel(ing.impliedBy) })}
                      </Text>
                    )}
                    {ing.percentage != null && (
                      // KB-710(3): 두 줄까지 — SE 큰 글자에서 "~98% of sho…" 잘림. 기본 크기는 한 줄 그대로, 같은 줄 타일은 줄바꿈 격자가 높이를 맞춘다
                      <Text style={styles.ingTileSub} numberOfLines={2} testID={`ing-shops-${ing.code}`}>{t('detail.ofShops', { pct: Math.round(ing.percentage) })}</Text>
                    )}
                    {/* caution 변형: "Ask the owner" 풋터(h30 primaryTint) → 사장님 카드(기존 진입점) */}
                    {!guest && dRisk === 'caution' && (
                      <Pressable
                        style={styles.ingTileFoot}
                        onPress={() => { track(EVENTS.owner_ask_open, { source: 'ingredient', food_id: id }); router.push(`/food/${id}/owner?ingredient=${encodeURIComponent(ing.code)}` as Href); }}
                        hitSlop={4}
                        testID={`ask-${ing.code}`}
                      >
                        <Text style={styles.ingTileFootText} numberOfLines={1}>{t('detail.askOwner')}</Text>
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </View>
            {/* 재료 면책 — 재료가 있을 때만(P-210 규칙 유지) */}
            <Text style={styles.disc}>{t('detail.dataDisclaimer')}</Text>
          </View>
        </>
      )}

      {/* §1-7: 리뷰 섹션(4150:16940) — 디바이더 + 헤더 행 + D-2 카드 ×3 + More */}
      {emptyCta && (
        <View style={styles.reviewSec} testID="review-empty-cta" onLayout={(e) => onEmptyCtaLayout?.(e.nativeEvent.layout.y, e.nativeEvent.layout.height)}>
          <View style={styles.thickDivider} />
          <Text style={styles.rvBeFirst}>{t('detail.beFirstReview')}</Text>
          <View style={{ paddingHorizontal: 20 }}>
            <Btn testID="detail-write-review" variant="ghost" onPress={() => writeReview('detail')}>
              {t('reviews.writeReview')}
            </Btn>
          </View>
        </View>
      )}
      {FLAGS.reviewsEnabled && !food.reviewSummaryMissing && food.overall.count > 0 && (
        <View testID="review-brief">
          <View style={styles.thickDivider} />
          {/* KB-848: 섹션 머리 = KR only 토글만(오른쪽) — 별·점수는 아래 요약 박스가 맡는다(중복 제거).
              9/5 예진 판정(Q12) → P-323: "{국가} only" 토글 = 서버 countryCode 필터. 게스트·국적 null(구계정) = 머리 행 없음 */}
          {!guest && nationality ? (
            <View style={styles.rvHead}>
              <Pressable style={styles.natToggleRow} onPress={() => setNatOnly((v) => !v)} testID="detail-nat-toggle">
                <View style={[styles.sw, natOnly && styles.swOn]}>
                  <View style={[styles.knob, natOnly && styles.knobOn]} />
                </View>
                <Text style={styles.natToggleLabel}>{t('reviews.countryOnly', { code: nationality })}</Text>
              </Pressable>
            </View>
          ) : null}
          {/* KB-848: 평점 요약 박스(리뷰 전체 목록과 공용) — P-360: KR only ON = 같은 국적 집계 · 같은 국적 0건 = 박스 없음. 탭 = 리뷰 전체 목록 */}
          {(() => {
            const agg = natOnly ? food.sameNationality : food.overall;
            if (natOnly && agg.count === 0) return null;
            return (
              <Pressable
                style={[styles.rvSummary, !(!guest && nationality) && styles.rvSummaryTop]}
                onPress={() => router.push(`/food/${id}/reviews` as Href)}
                accessibilityRole="button"
                accessibilityHint={t('detail.readAll')}
                testID="detail-rating-summary"
              >
                <RatingSummaryBox overall={agg} sameNat={natOnly} axes={serverAxes(agg)} t={t} />
              </Pressable>
            );
          })()}
          {/* 9/5 예진 판정(Q10): 같은 국적 병기 줄 제거(시안 부재) */}

          {/* P-323: 토글 쿼리 로딩 = 스켈레톤(공백 금지) · 실패 = 에러 표면(P-007 false-empty
              금지 — emptySameNat는 성공+0장일 때만) · 서버 필터 0장 = 전용 문구 */}
          {natLoading && (
            <View style={styles.natSkel} testID="detail-nat-skel">
              {[0, 1].map((i) => (
                <View key={i} style={styles.natSkelCard} />
              ))}
            </View>
          )}
          {natOnly && !natLoading && natQ.isError && (
            <View testID="detail-nat-error">
              <QueryErrorBlock error={natQ.error} onRetry={() => void natQ.refetch()} />
            </View>
          )}
          {natOnly && !natLoading && !natQ.isError && shownPreviews.length === 0 && (
            /* P-359(KB-522): 폭 초과 Text → 공용 EmptyBlock(섹션 본문 폭 안) */
            <View style={{ paddingVertical: 24 }} testID="detail-nat-empty">
              <EmptyBlock label={t('reviews.emptySameNat')} />
            </View>
          )}
          {/* KB-739 ④-③: 리뷰 3개마다 네이티브 광고 1개(실패 시 인라인 배너, 미수신 = 높이 0) — 리뷰 카드와 같은 폭·여백 */}
          {!natLoading && !(natOnly && natQ.isError) && withFeedAds(shownPreviews, (x) => x.id).map((row) => row.kind === 'ad' ? (
            <FeedAd key={row.key} testID={`ad-feed-${row.slot}`} />
          ) : (
            <FeedCard
              key={row.key}
              review={row.item}
              t={t}
              photoVariant="peek" /* KB-848: 리뷰 탭과 같은 카드 */
              mine={row.item.memberId != null && row.item.memberId === myId}
              showFood={false} /* 자기 자신 음식 칩 무의미 */
              /* P-339 ② 2R: 탈퇴 리뷰도 ⋯(신고만) — showMore 게이트 잔존 제거 */
              onOpenFood={() => {}}
              onGuestHelpful={() => setGateOpen(true)}
              onMore={() =>
                setMod({
                  type: 'review',
                  id: row.item.id,
                  author: { id: row.item.author?.memberId ?? row.item.memberId ?? `rv-${row.item.id}`, nickname: row.item.author?.nickname ?? null, nationality: row.item.authorNationality },
                  mine: row.item.memberId != null && row.item.memberId === myId,
                  anonymized: row.item.anonymized === true,
                })
              }
            />
          ))}

          <View style={styles.rvMore}>
            <Btn testID="detail-read-all-reviews" variant="ghost" iconEnd={<IconChevron size={16} color={INK_TITLE} />} onPress={() => router.push(`/food/${id}/reviews` as Href)}>{/* P-334: 시안 chevron 16 */}
              {t('detail.readAll')}
            </Btn>
          </View>
        </View>
      )}

      {/* P-169: 프리뷰 신고 — 목록 화면과 동일 기존 플로우 재사용 */}
      <ModerationFlow
        target={mod}
        onClose={() => setMod(null)}
        onEdit={(m) => router.push(`/food/${id}/review?reviewId=${m.id}` as Href)} /* P-358: 편집 = 작성 화면 편집 모드 */
        onDelete={(m) => deleteReview.mutate({ reviewId: m.id, foodId: id })}
        onBlocked={() => {
          // P-323(Codex #87 P2): 차단 갱신 — 활성 국가 필터 쿼리도 함께(뮤테이션 무효화는
          // ['food', id] prefix라 natQ 자동 커버 — 이 즉시 refetch 경로만 갭이었음)
          void reviewsQ.refetch();
          if (natOnly) void natQ.refetch();
        }}
      />

      <AuthGateSheet context="risk" open={gateOpen} onClose={() => setGateOpen(false)} />

      {/* §1-6: 재료 상세 바텀시트(4150:17055) */}
      <Modal visible={ingSheet != null} transparent animationType="fade" onRequestClose={() => setIngSheet(null)}>
        <Pressable testID="ing-sheet-backdrop" style={styles.sheetScrim} onPress={() => setIngSheet(null)}>
          <Pressable style={styles.ingSheet} noTrack onPress={() => {}} testID="ing-sheet">
            {ingSheet && (
              <>
                <View style={styles.ingSheetTop}>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {!guest && <RiskMark state={personalRisk(ingSheet.risk, hasRestrictions)} size={18} />}
                      <Text style={styles.ingSheetName} numberOfLines={1}>{ingSheet.name}</Text>
                    </View>
                    {ingSheet.percentage != null && (
                      /* P-306: 시트 빈도 = 좌측 정렬(타일용 center 스타일 재사용 폐기) */
                      <Text style={styles.ingSheetSub}>{t('detail.ofShops', { pct: Math.round(ingSheet.percentage) })}</Text>
                    )}
                  </View>
                  <View style={styles.ingSheetImg}>
                    <IngChainImage code={ingSheet.code} imageUrl={cat.imageUrl(ingSheet.code)} size={56} iconSize={32} />
                  </View>
                </View>
                {/* P-306: 게스트 본문 = 빈도 문장 + 식당별 편차 안내(회피 언급 0) · 회원 = 현행 조립 */}
                <Text style={styles.ingSheetBody}>
                  {guest
                    ? t(ingSheet.percentage != null ? 'detail.ingGuestBody' : 'detail.ingGuestBodyNoPct', {
                        ingredient: ingSheet.name,
                        percent: Math.round(ingSheet.percentage ?? 0),
                      })
                    : ingBasis(ingSheet, personalRisk(ingSheet.risk, hasRestrictions)) + (ingSheet.note ? ` (${ingSheet.note})` : '')}
                </Text>
                {/* P-306: Close 제거(스크림 탭·뒤로가기 닫힘 유지) → Ask the owner(상세 하단 버튼 문법) */}
                <Btn
                  icon={<IconSpeech size={20} color="#fff" />}
                  onPress={() => {
                    const code = ingSheet.code;
                    // Codex #67 P1: 회원+회피 판정(danger/caution)만 알레르기 설명 — 게스트·safe = 중립
                    const avoid = !guest && ['danger', 'caution'].includes(personalRisk(ingSheet.risk, hasRestrictions));
                    setIngSheet(null);
                    track(EVENTS.owner_ask_open, { source: 'ingredient_sheet', food_id: id ?? '' });
                    // 4R: 라벨 미전달 — 사장님 카드 한국어명은 owner 쪽 resolveIngredientKo 단일 경로
                    // (reader 언어 문자열 전달 금지 — 헌법 I·P-052). 미해석 = 중립 질문.
                    router.push(`/food/${id}/owner?ingredient=${encodeURIComponent(code)}&reason=${avoid ? 'avoid' : 'neutral'}` as Href);
                  }}
                  testID="ing-sheet-ask"
                >
                  {t('detail.askOwner')}
                </Btn>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Unregistered({ food, t, onAsk }: { food: FoodDetail; t: TFn; onAsk: () => void }) {
  return (
    <>
      <View style={styles.titleBlock}>
        <Text style={styles.name}>{food.name}</Text>
        {food.nameKo !== food.name && <Text style={styles.ko}>{food.nameKo}</Text>}
      </View>

      <View style={styles.unreg}>
        <RiskMark state="unable" size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.unregTitle}>{t('detail.unableTitle')}</Text>
          <Text style={styles.unregBody}>{t('detail.unableBody')}</Text>
        </View>
      </View>

      <Btn testID="detail-ask-owner" icon={<IconSpeech size={20} color="#fff" />} onPress={onAsk}>
        {t('detail.askOwner')}
      </Btn>

      <View style={{ gap: 8 }}>
        <Text style={styles.insideTitle}>{t('detail.insideTitle')}</Text>
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyBlockText}>{t('detail.noIngredientBody')}</Text>
        </View>
      </View>
    </>
  );
}

/** 상세 헤더 바 배경 — KB-696: **예진 10/2 결정으로 시안 96% 흰색(4% 투명) → 불투명**(화면 배경 토큰).
 *  블러 없는 4% 투명은 스크롤 시 뒤 글자·재료 그림이 비치기만 했다. */
const FHEAD_BAR_BG = C.surface;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  // KB-620: 숨김 안내를 잔여 높이 중앙에(상단 플로팅 헤더와 겹치지 않게)
  hiddenFill: { flex: 1, justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 18 },

  // §1-1: 히어로 정방 + 그라데이션
  hero: { width: '100%', aspectRatio: 1, backgroundColor: C.surface2 },
  heroGrad: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 96 },
  heroFallback: { width: '100%', backgroundColor: C.surface2 },

  // 플로팅 헤더(P-139 유지)
  fhead: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 8 },
  fheadBg: { backgroundColor: FHEAD_BAR_BG, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  fheadStatusShield: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: C.surface }, // KB-696
  fBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(20,24,31,0.38)', alignItems: 'center', justifyContent: 'center' },
  fBtnSolid: { backgroundColor: 'transparent' },
  fTitle: { fontFamily: font.bodySemi, fontSize: 16, color: C.ink, textAlign: 'center' },

  // §1-3: 위험 요약 행(4129:11366) — 틴트 + 하단 헤어라인
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 12, paddingHorizontal: 20, minHeight: 63, borderBottomWidth: 0.5, borderBottomColor: '#D5DFE7' },
  riskRowTitle: { fontSize: 14, fontWeight: '600', color: C.ink },
  riskRowSub: { fontSize: 13, fontWeight: '500', color: C.ink2, lineHeight: 18 },
  lockSlot: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 20, paddingVertical: 13, backgroundColor: C.surface2, borderBottomWidth: 0.5, borderBottomColor: '#D5DFE7' },
  lockSlotText: { flex: 1, fontSize: 13, fontWeight: '400', color: C.ink2 },
  lockSlotCta: { fontSize: 13, fontWeight: '700', color: C.primaryText },

  // §1-2: 헤더 블록
  headBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 27 }, // A-FD-01/02(KB-486)
  spiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, // A-FD-03
  spiceChip: { backgroundColor: '#F2F3F6', borderRadius: 4, paddingVertical: 1, paddingHorizontal: 5 },
  spiceChipText: { fontSize: 14, fontWeight: '500', color: C.ink2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, // A-FD-04
  name: { flexShrink: 1, fontSize: 24, fontWeight: '700', color: C.ink, lineHeight: 32 },
  // NEW 배지(시안 — primary pill h18 pad 1/5, 10/600 흰)
  ko: { fontSize: 14, fontWeight: '400', color: INK_TITLE },
  desc: { fontSize: 15, fontWeight: '400', color: '#4B4F58', lineHeight: 22 },
  scanPrice: { fontSize: 14, fontWeight: '700', color: C.ink },
  scanPriceNote: { fontSize: 12.5, fontWeight: '400', color: C.ink2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' }, // A-FD-06
  ratingRowText: { fontSize: 13, fontWeight: '600', color: '#2F3137' }, // A-FD-06
  // 북마크 36(4129:10698 — 홈 그리드와 동일 문법)
  // A-DS-02(KB-486): 기본 흰+sh1(보더 투명 자리 유지 — P-151), 저장만 #EAEBEE 1
  bmBtn: { width: 36, height: 36, borderRadius: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  bmBtnSaved: { borderColor: '#EAEBEE' },

  profileHint: { fontSize: 13, fontWeight: '400', color: C.ink2, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 12 },

  // §1-4: 8px 섹션 디바이더
  thickDivider: { height: 8, backgroundColor: '#F5F5F5' },

  // §1-5: What's inside
  insideSec: { paddingVertical: 20, gap: 10 }, // A-FD-07
  insideTitle: { fontSize: 16, fontWeight: '500', color: C.ink, paddingHorizontal: 20 },
  ingChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20 },
  // §3: 타일 단위 줄바꿈 — flexWrap + 타일 flexShrink 0
  ingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  ingTile: { width: '31%', flexGrow: 1, maxWidth: '32%', flexShrink: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEDF0', borderRadius: 4, paddingTop: 26, alignItems: 'center', gap: 2, overflow: 'hidden' }, // A-FD-08
  ingTileMark: { position: 'absolute', top: 6, left: 6 },
  ingTileImg: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  ingTileName: { fontSize: 12, fontWeight: '500', color: INK_TITLE, textAlign: 'center', paddingHorizontal: 6 },
  ingTileSub: { fontSize: 11, fontWeight: '400', color: '#5A636A', textAlign: 'center', paddingHorizontal: 4, marginBottom: 10 },
  ingTileWithFoot: { paddingTop: 8 }, // A-FD-08 푸터 변형
  ingTileFoot: { alignSelf: 'stretch', minHeight: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,113,52,0.05)', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  ingTileFootText: { fontSize: 12, fontWeight: '500', color: C.primary }, // A-FD-09(색·굵기는 C-62)

  // §1-6: 재료 바텀시트
  sheetScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  ingSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingVertical: 28, gap: 16 },
  ingSheetTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ingSheetName: { flexShrink: 1, fontSize: 16, fontWeight: '500', color: C.ink },
  // P-306: 시트 전용 빈도 줄 — 좌측 정렬(마크·이름 아래), 타일용 ingTileSub(center)와 분리
  ingSheetSub: { fontSize: 11, fontWeight: '400', color: '#5A636A' },
  ingSheetImg: { width: 56, height: 56, borderRadius: 8, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ingSheetBody: { fontSize: 15, fontWeight: '400', color: '#4B4F58', lineHeight: 22 },

  // §1-7: 리뷰 섹션
  reviewSec: { gap: 14, paddingBottom: 8 },
  rvHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 20 }, // KB-848: 토글만 — 오른쪽 정렬
  rvSummary: { paddingHorizontal: 20, paddingTop: 12 }, // KB-848: 요약 박스(토글 아래)
  rvSummaryTop: { paddingTop: 20 }, // 토글 없는 경우(게스트·국적 미상) = 디바이더 아래 20
  // Q12: "{국가} only" 토글(시안 Button/Toggle md 44×24)
  natToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 0 }, // A-FD-10
  natToggleLabel: { fontSize: 14, fontWeight: '500', color: C.ink },
  // P-323 토글 쿼리 상태(스켈레톤·빈 문구) — 홈 피드 스켈레톤 문법
  natSkel: { gap: 12, paddingTop: 12 },
  natSkelCard: { height: 150, borderRadius: 8, backgroundColor: '#F2F3F6' },
  sw: { width: 44, height: 24, borderRadius: 12, backgroundColor: C.inkDisabled, padding: 2, justifyContent: 'center' },
  swOn: { backgroundColor: C.primary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 2, height: 2 }, elevation: 2 },
  knobOn: { alignSelf: 'flex-end' },
  rvBeFirst: { fontSize: 14, fontWeight: '600', color: C.ink2, textAlign: 'center', paddingTop: 16 },
  rvMore: { paddingHorizontal: 20, paddingTop: 16 },

  // 면책
  disc: { fontSize: 12, fontWeight: '400', color: C.ink3, lineHeight: 17, paddingHorizontal: 20 },

  // §1-8: FixedBottom
  // KB-871(예진 10/22): 하단 고정 · 좌우 = 화면 여백 20 · 가로 전체 알약(높이 48 radius full) 세로 간격 8 — primary(흰 글자·흰 file-pen) / 테두리(gray-300)
  pillRow: { position: 'absolute', left: 20, right: 20, gap: 8 },
  pillPrimary: { alignSelf: 'stretch', minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: C.primary },
  pillPrimaryText: { flexShrink: 1, fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22, color: '#FFFFFF', textAlign: 'center' },
  pillOutline: { alignSelf: 'stretch', minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: C.line2, backgroundColor: C.surface },
  pillOutlineText: { flexShrink: 1, fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22, color: C.ink, textAlign: 'center' },

  // Unregistered(현행 유지 — 토큰만)
  titleBlock: { gap: 5 },
  unreg: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 10, padding: 16, backgroundColor: '#ECECEC', borderWidth: 1, borderColor: '#D5DFE7' },
  unregTitle: { fontFamily: font.display, fontSize: 19, color: C.riskUnable },
  unregBody: { fontSize: 13, fontWeight: '400', color: C.ink2, lineHeight: 19, marginTop: 3 },
  emptyBlock: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', borderRadius: 8, padding: 18 },
  emptyBlockText: { fontSize: 13, fontWeight: '400', color: C.ink2, lineHeight: 19 },
});

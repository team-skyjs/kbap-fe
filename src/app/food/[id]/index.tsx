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
 * personalRisk·재료 데이터·리뷰 훅·저장 토글·지도 딥링크·EligibilityGate 로직 무변.
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C, font, riskTone, type RiskState } from '@/lib/theme';
import { RiskMark, RiskBadge, CardPhoto, Chip, Star, Stars, BookmarkStar, Btn, IconChevron, IconSpeech } from '@/components';
import { QueryErrorBlock } from '@/components/StateBlock';
import { RemoteImage } from '@/components/RemoteImage';
import { ScanCoachMark } from '@/features/scan/ScanCoachMark';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useFoodReviews } from '@/lib/data/useFoodReviews';
import { useDeleteReview, useUpdateReview } from '@/lib/data/useReviewMutations';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import { ReviewEditSheet } from '@/features/review/ReviewCellParts';
import { FeedCard } from '@/features/review/FeedCard';
import { useToggleBookmark } from '@/lib/data/bookmarks';
import { useIngredientCatalog } from '@/lib/data/useIngredientCatalog';
import { Snackbar } from '@/components/Snackbar';
import { IconFood, IconLock, IconStar } from '@/components/icons';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import { EVENTS, track } from '@/lib/analytics';
import { EligibilityGate } from '@/features/review/EligibilityGate';
import { foodSpiceText, spiceRank, spicierThanUser, type SpiceChoice } from '@/lib/spice';
import { SpicePeppers } from '@/components/SpicePeppers';
import { formatKrw, parseScanPrice } from '@/lib/scan/segmentMenu';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import type { FoodDetail, IngredientRisk, Review } from '@/lib/api/types';

const RISK_ORDER: Record<RiskState, number> = { danger: 0, caution: 1, unable: 2, safe: 3 };
/** 시안 노트 03 — 히어로를 이만큼 지나면 헤더 솔리드+타이틀 페이드인 */
const HEADER_SOLID_Y = 210;
const INK_TITLE = '#2F3137';
const REVIEW_PREVIEW_N = 3; // 발주 §1-7: 카드 ×3

export default function FoodDetailScreen() {
  // P-012(KB-179): price는 스캔 결과 진입에만 실리는 표시 전용 param — 조작 방어 파싱
  const { id, price, src } = useLocalSearchParams<{ id: string; price?: string; src?: string }>();
  // P-083: 상세 진입 계측 — 진입 경로 1회
  useEffect(() => {
    const source = src && ['scan', 'list', 'search', 'home', 'saved', 'my_reviews', 'feed', 'tag_sheet'].includes(src) ? src : 'other';
    track(EVENTS.food_detail_view, { source, food_id: id ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const scanPrice = parseScanPrice(price);
  const isGuest = useIsGuest();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const { data: food, isLoading, error, refetch } = useFoodDetail(id ?? '');
  const { data: me } = useMe();
  // §1-8 FixedBottom의 리뷰 자격 게이트 — 화면 루트 소유(바가 루트 소유라 함께)
  const [eligGateRoot, setEligGateRoot] = useState(false);

  // P-139: 플로팅 헤더 — 스크롤 임계 통과 시 솔리드+타이틀 페이드인
  const [solid, setSolid] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setSolid(e.nativeEvent.contentOffset.y > HEADER_SOLID_Y);
  const solidFade = useAnimatedStyle(() => ({ opacity: withTiming(solid ? 1 : 0, { duration: 180 }) }));

  // 북마크 — 게스트=게이트 시트, 회원=BE 토글 (KB-142: 낙관적+실패 롤백, 무변)
  const saved = food?.bookmarked ?? false;
  const toggleBm = useToggleBookmark();
  const [saveGateOpen, setSaveGateOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false); // P-134: 마크 탭 재열람
  const [saveError, setSaveError] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBookmark = () => {
    if (isGuest) {
      setSaveGateOpen(true);
      return;
    }
    if (!food) return;
    const adding = !saved;
    track(EVENTS.food_bookmark_toggle, { on: adding }); // P-144
    setSaveError(false);
    toggleBm.mutate(
      {
        snap: { foodId: food.foodId, name: food.name, nameKo: food.nameKo, risk: food.risk, photoUrl: food.photoUrl },
        add: adding,
      },
      {
        onError: () => {
          setSaveError(true);
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setSaveError(false), 4000);
        },
      },
    );
  };

  // KB-431 §1-8 FixedBottom — 등록 음식만(미등록은 본문 CTA 현행 유지)
  const showBottomBar = !!food && food.isRegistered;

  return (
    <View style={styles.root}>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={[{ paddingBottom: showBottomBar ? 107 : 40 }, error && !food ? { flexGrow: 1 } : null]}>
        {error && !food && <QueryErrorBlock error={error} onRetry={() => void refetch()} onGoBack={() => router.back()} />}

        {!isLoading && food && (
          <>
            {/* §1-1: 히어로 정방(375×375) + 하단 어두운 선형 그라데이션(4150:16892) */}
            {food.photoUrl ? (
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
                nationality={me?.nationality ?? 'US'}
                spiceTolerance={me?.spiceTolerance ?? 'SKIP'}
                hasRestrictions={(me?.restrictions.length ?? 0) > 0}
                t={t}
                router={router}
                id={id ?? ''}
              />
            ) : (
              <View style={styles.body}>
                <Unregistered food={food} t={t} onAsk={() => { track(EVENTS.owner_ask_open, { source: 'unregistered', food_id: id ?? '' }); router.push(`/food/${id}/owner` as Href); }} />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* §1-8: FixedBottom(4150:16963) — 아웃라인 Write + primary Ask(회원) /
          게스트·Ask 부재 시 Write primary 단독. EligibilityGate 로직 무변. */}
      {showBottomBar && (
        <RegisteredBottomBar
          guest={isGuest}
          insetsBottom={insets.bottom}
          t={t}
          onWrite={() => {
            // Registered 내부 writeReview와 동일 게이트 — 이 바는 화면 루트 소유라 재조립
            if (!isGuest && food?.reviewEligible === false) {
              setEligGateRoot(true);
              return;
            }
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
        <Pressable style={[styles.fBtn, solid && styles.fBtnSolid]} onPress={() => router.back()} hitSlop={8} testID="detail-back">
          <IconChevron size={18} color={solid ? C.ink : '#fff'} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <Animated.View style={[{ flex: 1, minWidth: 0 }, solidFade]}>
          <Text style={styles.fTitle} numberOfLines={1}>
            {food?.name ?? ''}
          </Text>
        </Animated.View>
        <View style={{ width: 36 }} />
      </View>

      <AuthGateSheet context="save" open={saveGateOpen} onClose={() => setSaveGateOpen(false)} />
      <ScanCoachMark open={coachOpen} onClose={() => setCoachOpen(false)} t={t} />
      <EligibilityGate open={eligGateRoot} onClose={() => setEligGateRoot(false)} />
      {saveError && <Snackbar icon={<IconStar size={15} color="#fff" />} text={t('saved.error')} />}
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
  guest,
  insetsBottom,
  t,
  onWrite,
  onAsk,
}: {
  guest: boolean;
  insetsBottom: number;
  t: TFn;
  onWrite: () => void;
  onAsk?: () => void;
}) {
  return (
    <View style={[styles.bottomBar, { paddingBottom: insetsBottom + 10 }]} testID="detail-bottom-bar">
      {FLAGS.reviewsEnabled && (
        <View style={onAsk ? styles.bottomWrite : { flex: 1 }}>
          <Btn variant={onAsk ? 'ghost' : 'primary'} onPress={onWrite} testID="bottom-write">
            {t('reviews.writeReview')}
          </Btn>
        </View>
      )}
      {onAsk && (
        <View style={{ flex: 1 }}>
          <Btn icon={<IconSpeech size={20} color="#fff" />} onPress={onAsk} testID="bottom-ask">
            {t('detail.askOwner')}
          </Btn>
        </View>
      )}
      {/* reviewsEnabled off + guest(Ask 없음) = 빈 바 방지 — 둘 다 없으면 렌더 안 함 */}
      {!FLAGS.reviewsEnabled && !onAsk && <View />}
    </View>
  );
}

function Registered({
  food,
  saved,
  onBookmark,
  myId,
  nationality,
  spiceTolerance,
  hasRestrictions,
  guest,
  scanPrice,
  t,
  router,
  id,
  setCoachOpen,
}: {
  setCoachOpen: (v: boolean) => void;
  guest: boolean;
  food: FoodDetail;
  saved: boolean;
  onBookmark: () => void;
  myId?: string;
  nationality: string;
  spiceTolerance: SpiceChoice;
  hasRestrictions: boolean;
  scanPrice: number | null;
  t: TFn;
  router: Router;
  id: string;
}) {
  // P-251(BE #185): 리뷰 자격 게이트 — 회원 && reviewEligible === false(서버 정본)만.
  const [eligGate, setEligGate] = useState(false);
  const writeReview = (source: 'detail') => {
    if (!guest && food.reviewEligible === false) {
      setEligGate(true);
      return;
    }
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
  // Q12: "{국가} only" 클라 필터 — 프리뷰 소스엔 서버 파라미터가 없어 작성자 국적으로
  // 필터. Codex #30 P2: 필터를 slice **앞에**(필터 후 3개 — 뒤에 걸면 상위 3개 중 교집합만 남음)
  const [natOnly, setNatOnly] = useState(false);
  const shownPreviews = (natOnly ? previewSource.filter((r) => r.authorNationality === nationality) : previewSource).slice(0, REVIEW_PREVIEW_N);
  const deleteReview = useDeleteReview();
  const updateReview = useUpdateReview();
  const [mod, setMod] = useState<ModTarget | null>(null);
  const [editTarget, setEditTarget] = useState<Review | null>(null);

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
  // P-080→P-081(KB-261): 경고 = enum 순서 비교
  const spicyForYou = food.spiceLevel != null && spicierThanUser(food.spiceLevel, spiceTolerance);

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
        <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
          {food.spiceLevel != null && (
            <View style={styles.spiceRow}>
              {/* ⚠️ 맵기 = 현행 5단계 foodSpiceText — 시안 "6/10" 이식 금지 유지 */}
              <View style={styles.spiceChip}>
                <Text style={styles.spiceChipText}>{foodSpiceText(food.spiceLevel, t)}</Text>
              </View>
              <SpicePeppers rank={spiceRank(food.spiceLevel)} size={16} />
              {spicyForYou && <Text style={styles.spiceWarn}>{t('detail.spiceAboveYou')}</Text>}
            </View>
          )}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{food.name}</Text>
            {/* 9/5 예진 판정(Q4): NEW 배지 항상 표시 — 신규 등록 판별 데이터는 BE TODO */}
            <View style={styles.newBadge} testID="detail-new-badge">
              <Text style={styles.newBadgeText}>{t('inbox.newBadge')}</Text>
            </View>
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
        <Pressable style={styles.bmBtn} onPress={onBookmark} hitSlop={6} testID="detail-save">
          {/* 9/5 판정: 북마크 별(4129:10698/10701) — 저장됨 = #FFE812/#E5D64D */}
          <BookmarkStar saved={saved} size={16} />
        </Pressable>
      </View>

      {!guest && !hasRestrictions && <Text style={styles.profileHint}>{t('detail.addProfileHint')}</Text>}

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
                const img = cat.imageUrl(ing.code);
                return (
                  <Pressable key={ing.code} style={styles.ingTile} onPress={() => setIngSheet(ing)} testID={`ing-${ing.code}`}>
                    {!guest && (
                      <View style={styles.ingTileMark}>
                        <RiskMark state={dRisk} size={18} />
                      </View>
                    )}
                    <View style={styles.ingTileImg}>
                      {img ? (
                        <RemoteImage uri={img} style={{ width: 48, height: 48, borderRadius: 8 }} />
                      ) : (
                        <IconFood size={28} color={C.ink3} />
                      )}
                    </View>
                    <Text style={styles.ingTileName} numberOfLines={1}>{ing.name}</Text>
                    {ing.percentage != null && (
                      <Text style={styles.ingTileSub} numberOfLines={1}>{t('detail.ofShops', { pct: Math.round(ing.percentage) })}</Text>
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
      {FLAGS.reviewsEnabled && !guest && !food.reviewSummaryMissing && food.overall.count === 0 && (
        <View style={styles.reviewSec} testID="review-empty-cta">
          <View style={styles.thickDivider} />
          <Text style={styles.rvBeFirst}>{t('detail.beFirstReview')}</Text>
          <View style={{ paddingHorizontal: 20 }}>
            <Btn variant="ghost" onPress={() => writeReview('detail')}>
              {t('reviews.writeReview')}
            </Btn>
          </View>
        </View>
      )}
      <EligibilityGate open={eligGate} onClose={() => setEligGate(false)} />
      {FLAGS.reviewsEnabled && !food.reviewSummaryMissing && food.overall.count > 0 && (
        <View testID="review-brief">
          <View style={styles.thickDivider} />
          <View style={styles.rvHead}>
            <Stars value={food.overall.average ?? 0} size={16} />
            <Text style={[styles.rvHeadScore, { flex: 1 }]}>
              {food.overall.average?.toFixed(1) ?? '—'} ({food.overall.count})
            </Text>
            {/* 9/5 예진 판정(Q12): "{국가} only" 토글 — 프리뷰는 클라 필터(작성자 국적 =
                뷰어 국적). 게스트 = 국적 미상이라 미노출(P-235 컨벤션). */}
            {!guest && (
              <Pressable style={styles.natToggleRow} onPress={() => setNatOnly((v) => !v)} testID="detail-nat-toggle">
                <View style={[styles.sw, natOnly && styles.swOn]}>
                  <View style={[styles.knob, natOnly && styles.knobOn]} />
                </View>
                <Text style={styles.natToggleLabel}>{t('reviews.countryOnly', { code: nationality })}</Text>
              </Pressable>
            )}
          </View>
          {/* 9/5 예진 판정(Q10): 같은 국적 병기 줄 제거(시안 부재) */}

          {shownPreviews.map((r) => (
            <FeedCard
              key={r.id}
              review={r}
              t={t}
              mine={r.memberId != null && r.memberId === myId}
              showFood={false} /* 자기 자신 음식 칩 무의미 */
              showMore={!r.anonymized}
              onOpenFood={() => {}}
              onGuestHelpful={() => setGateOpen(true)}
              onMore={() =>
                setMod({
                  type: 'review',
                  id: r.id,
                  author: { id: r.author?.memberId ?? r.memberId ?? `rv-${r.id}`, nickname: r.author?.nickname ?? null, nationality: r.authorNationality },
                  mine: r.memberId != null && r.memberId === myId,
                })
              }
            />
          ))}

          <View style={styles.rvMore}>
            <Btn variant="ghost" onPress={() => router.push(`/food/${id}/reviews` as Href)}>
              {t('detail.readAll')}
            </Btn>
          </View>
        </View>
      )}

      {/* P-169: 프리뷰 신고 — 목록 화면과 동일 기존 플로우 재사용 */}
      <ModerationFlow
        target={mod}
        onClose={() => setMod(null)}
        onEdit={(m) => setEditTarget(previewSource.find((r) => r.id === m.id) ?? null)}
        onDelete={(m) => deleteReview.mutate({ reviewId: m.id, foodId: id })}
        onBlocked={() => void reviewsQ.refetch()}
      />
      <ReviewEditSheet
        review={editTarget}
        onClose={() => setEditTarget(null)}
        saving={updateReview.isPending}
        onSave={({ rating, body }) => {
          if (!editTarget) return;
          updateReview.mutate(
            { reviewId: editTarget.id, foodId: id, current: editTarget, changes: { rating, body } },
            { onSettled: () => setEditTarget(null) },
          );
        }}
        t={t}
      />

      <AuthGateSheet context="risk" open={gateOpen} onClose={() => setGateOpen(false)} />

      {/* §1-6: 재료 상세 바텀시트(4150:17055) */}
      <Modal visible={ingSheet != null} transparent animationType="fade" onRequestClose={() => setIngSheet(null)}>
        <Pressable style={styles.sheetScrim} onPress={() => setIngSheet(null)}>
          <Pressable style={styles.ingSheet} onPress={() => {}} testID="ing-sheet">
            {ingSheet && (
              <>
                <View style={styles.ingSheetTop}>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {!guest && <RiskMark state={personalRisk(ingSheet.risk, hasRestrictions)} size={18} />}
                      <Text style={styles.ingSheetName} numberOfLines={1}>{ingSheet.name}</Text>
                    </View>
                    {ingSheet.percentage != null && (
                      <Text style={styles.ingTileSub}>{t('detail.ofShops', { pct: Math.round(ingSheet.percentage) })}</Text>
                    )}
                  </View>
                  <View style={styles.ingSheetImg}>
                    {cat.imageUrl(ingSheet.code) ? (
                      <RemoteImage uri={cat.imageUrl(ingSheet.code)!} style={{ width: 56, height: 56, borderRadius: 8 }} />
                    ) : (
                      <IconFood size={32} color={C.ink3} />
                    )}
                  </View>
                </View>
                {/* 본문 = 기존 중립 조립 사유(guest = 판정 미노출이라 note/빈도만) */}
                <Text style={styles.ingSheetBody}>
                  {guest ? (ingSheet.note ?? '') : ingBasis(ingSheet, personalRisk(ingSheet.risk, hasRestrictions))}
                  {!guest && ingSheet.note ? ` (${ingSheet.note})` : ''}
                </Text>
                <Btn variant="ghost" onPress={() => setIngSheet(null)} testID="ing-sheet-close">
                  {t('common.close')}
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

      <Btn icon={<IconSpeech size={20} color="#fff" />} onPress={onAsk}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 18 },

  // §1-1: 히어로 정방 + 그라데이션
  hero: { width: '100%', aspectRatio: 1, backgroundColor: C.surface2 },
  heroGrad: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 96 },
  heroFallback: { width: '100%', backgroundColor: C.surface2 },

  // 플로팅 헤더(P-139 유지)
  fhead: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 8 },
  fheadBg: { backgroundColor: 'rgba(255,255,255,0.96)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
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
  headBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingVertical: 20 },
  spiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spiceChip: { backgroundColor: '#F2F3F6', borderRadius: 4, paddingVertical: 1, paddingHorizontal: 5 },
  spiceChipText: { fontSize: 14, fontWeight: '500', color: C.ink2 },
  spiceWarn: { fontSize: 13, fontWeight: '700', color: C.primaryText },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontSize: 24, fontWeight: '700', color: C.ink, lineHeight: 32 },
  // NEW 배지(시안 — primary pill h18 pad 1/5, 10/600 흰)
  newBadge: { height: 18, borderRadius: 9, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  newBadgeText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  ko: { fontSize: 14, fontWeight: '400', color: INK_TITLE },
  desc: { fontSize: 15, fontWeight: '400', color: '#4B4F58', lineHeight: 22 },
  scanPrice: { fontSize: 14, fontWeight: '700', color: C.ink },
  scanPriceNote: { fontSize: 12.5, fontWeight: '400', color: C.ink2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  ratingRowText: { fontSize: 13, fontWeight: '600', color: C.ink },
  // 북마크 36(4129:10698 — 홈 그리드와 동일 문법)
  bmBtn: { width: 36, height: 36, borderRadius: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },

  profileHint: { fontSize: 13, fontWeight: '400', color: C.ink2, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 12 },

  // §1-4: 8px 섹션 디바이더
  thickDivider: { height: 8, backgroundColor: '#F5F5F5' },

  // §1-5: What's inside
  insideSec: { paddingVertical: 20, gap: 14 },
  insideTitle: { fontSize: 16, fontWeight: '500', color: C.ink, paddingHorizontal: 20 },
  ingChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20 },
  // §3: 타일 단위 줄바꿈 — flexWrap + 타일 flexShrink 0
  ingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  ingTile: { width: '31%', flexGrow: 1, maxWidth: '32%', flexShrink: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEDF0', borderRadius: 4, paddingTop: 14, alignItems: 'center', gap: 4, overflow: 'hidden' },
  ingTileMark: { position: 'absolute', top: 6, left: 6 },
  ingTileImg: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  ingTileName: { fontSize: 12, fontWeight: '500', color: INK_TITLE, textAlign: 'center', paddingHorizontal: 6 },
  ingTileSub: { fontSize: 11, fontWeight: '400', color: '#5A636A', textAlign: 'center', paddingHorizontal: 4, marginBottom: 10 },
  ingTileFoot: { alignSelf: 'stretch', minHeight: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,113,52,0.05)', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  ingTileFootText: { fontSize: 11, fontWeight: '500', color: C.primary },

  // §1-6: 재료 바텀시트
  sheetScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  ingSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingVertical: 28, gap: 16 },
  ingSheetTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ingSheetName: { flexShrink: 1, fontSize: 16, fontWeight: '500', color: C.ink },
  ingSheetImg: { width: 56, height: 56, borderRadius: 8, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ingSheetBody: { fontSize: 15, fontWeight: '400', color: '#4B4F58', lineHeight: 22 },

  // §1-7: 리뷰 섹션
  reviewSec: { gap: 14, paddingBottom: 8 },
  rvHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 20 },
  rvHeadScore: { fontSize: 13, fontWeight: '600', color: C.ink },
  // Q12: "{국가} only" 토글(시안 Button/Toggle md 44×24)
  natToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  natToggleLabel: { fontSize: 14, fontWeight: '500', color: C.ink },
  sw: { width: 44, height: 24, borderRadius: 12, backgroundColor: C.inkDisabled, padding: 2, justifyContent: 'center' },
  swOn: { backgroundColor: C.primary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 2, height: 2 }, elevation: 2 },
  knobOn: { alignSelf: 'flex-end' },
  rvBeFirst: { fontSize: 14, fontWeight: '600', color: C.ink2, textAlign: 'center', paddingTop: 16 },
  rvMore: { paddingHorizontal: 20, paddingTop: 16 },

  // 면책
  disc: { fontSize: 12, fontWeight: '400', color: C.ink3, lineHeight: 17, paddingHorizontal: 20 },

  // §1-8: FixedBottom
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 16, paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: C.line },
  bottomWrite: { width: 119 },

  // Unregistered(현행 유지 — 토큰만)
  titleBlock: { gap: 5 },
  unreg: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 10, padding: 16, backgroundColor: '#ECECEC', borderWidth: 1, borderColor: '#D5DFE7' },
  unregTitle: { fontFamily: font.display, fontSize: 19, color: C.riskUnable },
  unregBody: { fontSize: 13, fontWeight: '400', color: C.ink2, lineHeight: 19, marginTop: 3 },
  emptyBlock: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', borderRadius: 8, padding: 18 },
  emptyBlockText: { fontSize: 13, fontWeight: '400', color: C.ink2, lineHeight: 19 },
});

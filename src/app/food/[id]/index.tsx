/**
 * Food detail v2 (P-139, D-17 시안 정합) — 히어로 4:3 풀블리드 + 플로팅 헤더
 * (스크롤 210 지나면 크림 글래스 솔리드+음식명 페이드인) + verdict(성분 조립
 * 이유) + 헤어라인 재료 행(전부 오픈 — 접힘 0) + 평점 2열 + 리뷰 프리뷰 2.
 *
 * ⚠️ 시안 이식 금지 3곳 준수: 맵기 = 현행 5단계 foodSpiceText(6/10 금지),
 * verdict 이유 = 성분 기준 조립만(맵기-위험도 결합 허위 — 맵기 문자열 0),
 * caution 사유 = 기존 중립 조립(ingBasis, 조리법 상세 설명 금지).
 *
 * 게스트(시안 fd3·fd4): verdict = 조용한 잠금 슬롯, 재료 = 고스트 5행+잠금 줄
 * (섹션 내 유일 CTA). 평점·설명·사진·리뷰 프리뷰는 풀 오픈. 현행도 게스트에
 * 판정 마크 미노출(중립 락카드)이라 정책 무회귀.
 *
 * Unregistered(미등록)는 "Unable to assess" 상태 유지 — never assumed safe
 * (FR-033). false-safe 가드(personalRisk)·저장 토글·계측 무변.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, riskTone, type RiskState } from '@/lib/theme';
import { RiskMark, RiskPill, CardPhoto, Star, Stars, Flag, Btn, IconChevron, IconSpeech } from '@/components';
import { QueryErrorBlock } from '@/components/StateBlock';
import { ScanCoachMark } from '@/features/scan/ScanCoachMark';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useFoodReviews } from '@/lib/data/useFoodReviews';
import { useDeleteReview } from '@/lib/data/useReviewMutations';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import { ExpandableBody, HelpfulButton, ReviewEditSheet, ReviewPhotoStrip, ReviewExtrasLine, ReviewPlaceLine } from '@/features/review/ReviewCellParts';
import { useUpdateReview } from '@/lib/data/useReviewMutations';
import { buildReviewUpdate } from '@/lib/api/reviewAdapter';
import { useToggleBookmark } from '@/lib/data/bookmarks';
import { Snackbar } from '@/components/Snackbar';
import { IconLock, IconMore, IconStar } from '@/components/icons';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import { EVENTS, track } from '@/lib/analytics';
import { foodSpiceText, spicierThanUser, type SpiceChoice } from '@/lib/spice';
import { formatKrw, parseScanPrice } from '@/lib/scan/segmentMenu';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import type { FoodDetail, IngredientRisk, Review } from '@/lib/api/types';

const RISK_ORDER: Record<RiskState, number> = { danger: 0, caution: 1, unable: 2, safe: 3 };
/** 시안 노트 03 — 히어로를 이만큼 지나면 헤더 솔리드+타이틀 페이드인 */
const HEADER_SOLID_Y = 210;

export default function FoodDetailScreen() {
  // P-012(KB-179): price는 스캔 결과 진입에만 실리는 표시 전용 param — 조작 방어 파싱
  const { id, price, src } = useLocalSearchParams<{ id: string; price?: string; src?: string }>();
  // P-083: 상세 진입 계측 — 진입 경로(스캔/목록/검색/홈, 그 외 other) 1회
  useEffect(() => {
    const source = src && ['scan', 'list', 'search', 'home'].includes(src) ? src : 'other';
    track(EVENTS.food_detail_view, { source, food_id: id ?? '' }); // P-144: food_id 추가
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const scanPrice = parseScanPrice(price);
  const isGuest = useIsGuest();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const { data: food, isLoading, error, refetch } = useFoodDetail(id ?? '');
  const { data: me } = useMe();

  // P-139: 플로팅 헤더 — 스크롤 임계 통과 시 크림 글래스 솔리드+타이틀 페이드인
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
    track(EVENTS.bookmark_toggle, { on: adding }); // P-144
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
    // P-162: 저장 성공 스낵바 제거 — 별 토글 상태 변화만으로 충분 (실패 스낵바만 유지)
  };

  return (
    <View style={styles.root}>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={[{ paddingBottom: 40 }, error && !food ? { flexGrow: 1 } : null]}>
        {/* P-184(Q-34③ 반려): 수동 paddingTop 배치 소멸 — 정중앙은 블록 소유 */}
        {error && !food && <QueryErrorBlock error={error} onRetry={() => void refetch()} onGoBack={() => router.back()} />}

        {!isLoading && food && (
          <>
            {/* P-139 ①: 히어로 — 사진 4:3 풀블리드(오버레이 금지 — 타이틀은 아래 크림 바닥).
                무사진 폴백 = 낮은 크림 블록(재량 보고: 현행 200 카드 → 120 플랫) */}
            {food.photoUrl ? (
              <View style={styles.hero} testID="detail-hero">
                <CardPhoto uri={food.photoUrl} transition={200} borderRadius={0} />
              </View>
            ) : (
              <View style={[styles.heroFallback, { height: 96 + insets.top }]} testID="detail-hero-fallback" />
            )}

            <View style={styles.body}>
              {food.isRegistered ? (
                <Registered
                  guest={isGuest}
                  setCoachOpen={setCoachOpen}
                  scanPrice={scanPrice}
                  food={food}
                  myId={me?.id}
                  nationality={me?.nationality ?? 'US'}
                  spiceTolerance={me?.spiceTolerance ?? 'SKIP'}
                  hasRestrictions={(me?.restrictions.length ?? 0) > 0}
                  t={t}
                  router={router}
                  id={id ?? ''}
                />
              ) : (
                <Unregistered food={food} t={t} onAsk={() => router.push(`/food/${id}/owner` as Href)} />
              )}

              {/* P-139 ⑦ → P-210 ②(재량): 재료 면책 고지는 재료가 있을 때만 —
                  재료 없는데 재료 면책은 무의미(미등록 상세도 같은 규칙) */}
              {food.ingredients.length > 0 && (
                <View style={styles.disc}>
                  <RiskMark state="caution" size={15} variant="outline" />
                  <Text style={styles.discText}>{t('detail.dataDisclaimer')}</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* P-139 ②: 플로팅 헤더 — 사진 위 반투명 다크 원 → 솔리드 크림+타이틀 */}
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
        {/* P-184 ③: 음식 데이터 없으면 저장 대상 없음 — 별 숨김(뒤로가기만) */}
        {!!food && (
          <Pressable style={[styles.fBtn, solid && styles.fBtnSolid]} onPress={onBookmark} hitSlop={8} testID="detail-save">
            <IconStar size={18} color={saved ? C.primary : solid ? C.ink : '#fff'} fill={saved ? C.primary : 'none'} />
          </Pressable>
        )}
      </View>

      <AuthGateSheet context="save" open={saveGateOpen} onClose={() => setSaveGateOpen(false)} />
      <ScanCoachMark open={coachOpen} onClose={() => setCoachOpen(false)} t={t} />
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

function Registered({
  food,
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
  /** P-169: 프리뷰 신고 내 글 판별 — 게스트/미로그인 undefined */
  myId?: string;
  nationality: string;
  spiceTolerance: SpiceChoice;
  hasRestrictions: boolean;
  scanPrice: number | null;
  t: TFn;
  router: Router;
  id: string;
}) {
  const [gateOpen, setGateOpen] = useState(false); // 게이트 시트 (KB-77)
  // false-safe guard (Constitution III · SC-003): empty profile never shows safe
  const dishRisk = personalRisk(food.risk, hasRestrictions);
  const ingredients = [...food.ingredients].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
  // P-139 ⑥ → P-169: 리뷰 프리뷰 5(쿠팡 브리프) — 게스트 풀 오픈(시안 노트 08). 채널 플래그는 유지.
  const reviewsQ = useFoodReviews(FLAGS.reviewsEnabled ? id : '');
  const previewReviews = (reviewsQ.data?.pages[0]?.items ?? []).slice(0, 5);
  // P-169: Helpful(기존 좋아요 API — 표현만 교체) + 신고(기존 ModerationFlow 재사용)
  const deleteReview = useDeleteReview();
  const updateReview = useUpdateReview();
  const [mod, setMod] = useState<ModTarget | null>(null);
  // P-182: 개별 디테일 소멸 — 본인 셀 ⋯ 수정은 공용 수정 시트로
  const [editTarget, setEditTarget] = useState<Review | null>(null);

  // P-139 ④: verdict 이유 = **성분 기준 조립만** — 회피 매칭(danger/caution)
  // 재료명 나열. 맵기-위험도 결합(시안 카피)은 허위라 금지 — 맵기 문자열 0.
  const flagged = ingredients.filter((i) => i.risk === 'danger' || i.risk === 'caution');
  const verdictReason =
    dishRisk === 'unable'
      ? t('detail.basisUnable')
      : dishRisk === 'safe'
        ? t('detail.basisSafe')
        : flagged.length > 0
          ? t('detail.verdictContains', { list: flagged.map((i) => i.name).join(', ') })
          : t('detail.basisFlagged');

  // 재료별 사유 — 기존 중립 조립 유지(2026-07-08 회의: FE 템플릿, "알레르기" 단정 금지)
  const ingBasis = (ing: IngredientRisk, dRisk: RiskState): string => {
    if (dRisk === 'unable') return t('detail.ingBasisUnable', { ingredient: ing.name });
    const band = dRisk === 'safe' ? 'Safe' : dRisk === 'caution' ? 'Caution' : 'Danger';
    return ing.percentage != null
      ? t(`detail.ingBasis${band}`, { ingredient: ing.name, percent: Math.round(ing.percentage) })
      : t(`detail.ingBasis${band}NoPct`, { ingredient: ing.name });
  };
  // P-080→P-081(KB-261): 경고 = enum 순서 비교 — 맵기끼리의 비교(위험도 무관)
  const spicyForYou = food.spiceLevel != null && spicierThanUser(food.spiceLevel, spiceTolerance);

  return (
    <>
      {/* P-139 ③: 타이틀 블록 — 크림 바닥(사진 오버레이 금지) */}
      <View style={styles.titleBlock}>
        <Text style={styles.name}>{food.name}</Text>
        {food.nameKo !== food.name && <Text style={styles.ko}>{food.nameKo}</Text>}
        <View style={styles.metaRow}>
          <View style={styles.transPill}>
            <Text style={styles.transPillText}>{t('detail.translatedPill')}</Text>
          </View>
          {food.spiceLevel != null && (
            <View style={styles.spiceMeta}>
              {/* 현행 5단계 foodSpiceText — 시안 "6/10 · hot" 이식 금지 */}
              <Text style={styles.spiceText}>{foodSpiceText(food.spiceLevel, t)}</Text>
              {spicyForYou && <Text style={styles.spiceWarn}>{t('detail.spiceAboveYou')}</Text>}
            </View>
          )}
        </View>
        {/* P-012(KB-179): 스캔한 메뉴판의 가격 — 스캔 진입 param에만 존재 */}
        {scanPrice != null && (
          <Text style={styles.scanPrice}>
            {formatKrw(scanPrice)} <Text style={styles.scanPriceNote}>{t('detail.scannedPrice')}</Text>
          </Text>
        )}
      </View>

      {guest ? (
        /* P-139 ⑩: verdict 자리 = 조용한 잠금 슬롯 — 현행도 게스트에 판정 미노출(무회귀) */
        <Pressable style={styles.lockSlot} onPress={() => setGateOpen(true)} testID="verdict-lock">
          <IconLock size={16} color={C.ink2} />
          <Text style={styles.lockSlotText}>{t('detail.lockVerdict')}</Text>
          <Text style={styles.lockSlotCta}>{t('intro.signUp')}</Text>
        </Pressable>
      ) : (
        /* P-139 ④: verdict — 마크 26+라벨+성분 조립 이유, 4상태 틴트 유지.
           마크 탭 = 코치마크 재열람(P-134) */
        <Pressable
          style={[styles.verdict, { backgroundColor: riskTone[dishRisk].bg, borderColor: riskTone[dishRisk].line }]}
          onPress={() => setCoachOpen(true)}
          testID="detail-verdict"
        >
          <RiskMark state={dishRisk} size={26} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.verdictLabel, { color: riskTone[dishRisk].fg }]}>{t(VERDICT[dishRisk])}</Text>
            <Text style={styles.verdictReason}>{verdictReason}</Text>
          </View>
        </Pressable>
      )}

      {!guest && !hasRestrictions && <Text style={styles.profileHint}>{t('detail.addProfileHint')}</Text>}

      {/* P-139 ⑥: 설명 — 카드 폐지, 플랫 "About this dish" */}
      <View style={styles.sec}>
        <Text style={styles.secTitle}>{t('detail.aboutTitle')}</Text>
        <Text style={styles.desc}>{food.description}</Text>
      </View>

      {/* P-139 ⑤: 재료 — 헤어라인 행(카드·그림자 폐지), 전부 오픈(접힘 0).
          P-210: 빈 배열/부재 = 섹션(제목 포함) 전체 미노출 — 회원·게스트 공통.
          서버가 현재 회피 겹침만 필터해 safe 음식 = 빈 배열(제목만 덩그러니 방지).
          BE "전 재료+riskStatus" 개편 배포 시 자연 복귀(코드 무변). 구 게스트
          ghost(P-206 빈 배열 자리)는 이 규칙으로 도달 불가 — 소멸. */}
      {ingredients.length > 0 && (
      <View style={styles.sec}>
        <Text style={styles.secTitle}>{t('detail.insideTitle')}</Text>
        {/* P-206: 재료 자체는 게스트 공개(정책 개정) — 위험 판정(마크·필·사유)만 잠금. */}
        {guest ? (
          <View testID="ing-guest-open">
            {ingredients.map((ing) => (
              <View key={ing.code} style={styles.ingRow} testID={`ing-${ing.code}`}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.ingName}>{ing.name}</Text>
                  {ing.percentage != null && (
                    <Text style={styles.ingPct}>{t('detail.ofShops', { pct: Math.round(ing.percentage) })}</Text>
                  )}
                </View>
                {/* 위험 마크·필 미표시 — 개인화 판정 노출 금지(false-safe: 근거 없는 safe 인상 금지) */}
              </View>
            ))}
          </View>
        ) : (
          <View>
            {ingredients.map((ing) => {
              const dRisk = personalRisk(ing.risk, hasRestrictions);
              const freq =
                ing.percentage != null
                  ? t('detail.ofShops', { pct: Math.round(ing.percentage) }) + (ing.note ? ` (${ing.note})` : '')
                  : (ing.note ?? '');
              return (
                <View key={ing.code} style={styles.ingRow} testID={`ing-${ing.code}`}>
                  <RiskMark state={dRisk} size={22} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.ingName}>{ing.name}</Text>
                    {!!freq && <Text style={styles.ingPct}>{freq}</Text>}
                    {/* caution 행에만: 중립 조립 사유 + 사장님 확인(기존 흐름) */}
                    {dRisk === 'caution' && (
                      <>
                        <Text style={styles.ingReason}>{ingBasis(ing, dRisk)}</Text>
                        <Pressable
                          style={styles.askLink}
                          onPress={() => router.push(`/food/${id}/owner?ingredient=${encodeURIComponent(ing.code)}` as Href)}
                          hitSlop={6}
                          testID={`ask-${ing.code}`}
                        >
                          <IconSpeech size={15} color={C.primaryText} />
                          <Text style={styles.askLinkText}>{t('detail.askOwner')}</Text>
                          <IconChevron size={13} color={C.primaryText} />
                        </Pressable>
                      </>
                    )}
                  </View>
                  <RiskPill state={dRisk} size="sm" />
                </View>
              );
            })}
          </View>
        )}
      </View>
      )}

      {/* P-169: 리뷰 브리프(쿠팡 문법) — 2열 카드 소멸 → 헤더(큰 별+수치+리뷰 수,
          같은 국적 병기 보조 줄 = 차별점 유지) + 프리뷰 5 + 풀폭 전체보기.
          솔리드 CTA는 Ask the owner 하나만 — Write a review는 고스트 소형 강등. */}
      {/* P-182 ③ → P-206: be-first = **회원+마스킹 아님+실측 0건**만 — 게스트의
          요약 마스킹(blur, 0/0)을 "아직 리뷰가 없어요"로 오표시하던 혼동 교정 */}
      {FLAGS.reviewsEnabled && !guest && !food.reviewsMasked && food.overall.count === 0 && (
        <View style={styles.sec} testID="review-empty-cta">
          <Text style={styles.rvBeFirst}>{t('detail.beFirstReview')}</Text>
          <Btn variant="ghost" onPress={() => { track(EVENTS.review_write_tap, { source: 'detail' }); router.push(`/food/${id}/review` as Href); }}>
            {t('reviews.writeReview')}
          </Btn>
        </View>
      )}
      {/* P-206: 게스트/마스킹 = 잠금 게이트(기존 lock 키 재사용) — 쓰기는 가입 시트 경유 */}
      {FLAGS.reviewsEnabled && (guest || food.reviewsMasked) && (
        <View style={styles.sec} testID="review-guest-lock">
          <View style={styles.rvLockRow}>
            <IconLock size={16} color={C.ink2} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={styles.rvLockTitle}>{t('lock.reviewsLocked')}</Text>
              <Text style={styles.rvLockSub}>{t('gate.reviewsSub')}</Text>
            </View>
            <Btn sm onPress={() => setGateOpen(true)}>{t('intro.signUp')}</Btn>
          </View>
        </View>
      )}
      {FLAGS.reviewsEnabled && !guest && !food.reviewsMasked && food.overall.count > 0 && (
        <View style={styles.sec} testID="review-brief">
          <View style={styles.rvBriefHead}>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View style={styles.rvScoreRow}>
                <Stars value={food.overall.average ?? 0} size={19} />
                <Text style={styles.rvScoreNum}>{food.overall.average?.toFixed(1) ?? '—'}</Text>
                <Text style={styles.rvScoreCount}>{t('reviews.subtitle', { count: food.overall.count })}</Text>
              </View>
              {/* 같은 국적 병기 — 보조 줄(재량: 메인 아래, 탭 = 목록) */}
              <Pressable style={styles.rvSameNat} onPress={() => router.push(`/food/${id}/reviews` as Href)} hitSlop={6} testID="same-nat-line">
                <Flag code={nationality} size={13} />
                <Text style={styles.rvSameNatText}>{t('detail.sameNationality')}</Text>
                <Star size={12} fillPct={100} fillColor={C.primary} />
                <Text style={styles.rvSameNatText}>
                  {food.sameNationality.average?.toFixed(1) ?? '—'} ({food.sameNationality.count})
                </Text>
              </Pressable>
            </View>
            <Btn sm variant="ghost" onPress={() => { track(EVENTS.review_write_tap, { source: 'detail' }); router.push(`/food/${id}/review` as Href); }}>
              {t('reviews.writeReview')}
            </Btn>
          </View>

          {previewReviews.map((r) => (
            <ReviewPreviewRow
              key={r.id}
              review={r}
              t={t}
              mine={r.memberId != null && r.memberId === myId}
              anonymized={r.anonymized}
              foodId={id}
              onGuestHelpful={() => setGateOpen(true)}
              onMore={() =>
                setMod({
                  type: 'review',
                  id: r.id,
                  author: { id: r.author?.memberId ?? r.memberId ?? `rv-${r.id}`, nickname: r.author?.nickname ?? null, nationality: r.authorNationality },
                  // P-186: mine 실값 — 본인 = 수정/삭제 · 타인 = 신고/차단(ModerationFlow 기존 문법)
                  mine: r.memberId != null && r.memberId === myId,
                })
              }
            />
          ))}

          {/* P-169 ④: 전체보기 = 풀폭 아웃라인(고스트) — Read all 텍스트 링크 대체 */}
          <Btn variant="ghost" onPress={() => router.push(`/food/${id}/reviews` as Href)}>
            {t('detail.readAll')}
          </Btn>
        </View>
      )}

      {/* P-169: 프리뷰 신고 — 목록 화면과 동일 기존 플로우 재사용 */}
      <ModerationFlow
        target={mod}
        onClose={() => setMod(null)}
        onEdit={(m) => setEditTarget(previewReviews.find((r) => r.id === m.id) ?? null)} /* P-182: 디테일 소멸 — 공용 수정 시트 */
        onDelete={(m) => deleteReview.mutate({ reviewId: m.id, foodId: id })}
        onBlocked={() => void reviewsQ.refetch()}
      />
      {/* P-182: 본인 리뷰 수정 시트 — 구 디테일 editing 이식(buildReviewUpdate 풀 페이로드) */}
      <ReviewEditSheet
        review={editTarget}
        onClose={() => setEditTarget(null)}
        saving={updateReview.isPending}
        onSave={({ rating, body, place }) => {
          if (!editTarget) return;
          updateReview.mutate(
            { reviewId: editTarget.id, foodId: id, current: editTarget, changes: { rating, body } },
            { onSettled: () => setEditTarget(null) },
          );
        }}
        t={t}
      />

      <AuthGateSheet context="risk" open={gateOpen} onClose={() => setGateOpen(false)} />

      {/* P-162→P-167: 하단 CTA = 사장님 확인(재료 행 링크와 동일 목적지·라벨 통일) —
          확인 버튼은 위험할수록 필요하므로 **전 위험도 노출**(위험도 분기는 구 주문 CTA
          잔재로 제거, 예진 확정 8/11). 게스트만 제외 — 회피 프로필이 없어 질문 조립이
          무의미. 재료 파라미터 없음 = orderCard.ts 기존 조립(P-163 회피 나열, 0개=일반 질문). */}
      {!guest && (
        <View style={styles.sec}>
          <Btn icon={<IconSpeech size={20} color="#fff" />} onPress={() => router.push(`/food/${id}/owner` as Href)}>
            {t('detail.askOwner')}
          </Btn>
        </View>
      )}
    </>
  );
}

/** P-169: 상대 날짜 — 목록 화면 relativeDate와 동일 키(reviews.today/daysAgo/weeksAgo). */
function previewDate(iso: string, t: TFn): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return t('reviews.today');
  if (days < 7) return t('reviews.daysAgo', { count: days });
  return t('reviews.weeksAgo', { count: Math.floor(days / 7) });
}

function ReviewPreviewRow({
  review,
  t,
  mine,
  anonymized,
  foodId,
  onGuestHelpful,
  onMore,
}: {
  review: Review;
  t: TFn;
  mine: boolean;
  /** P-186: 익명(탈퇴) = ⋯ 없음 — 신고 대상 회원 부재 */
  anonymized: boolean;
  foodId: string;
  onGuestHelpful: () => void;
  onMore: () => void;
}) {
  const name = review.author?.nickname ?? t('reviews.anonymous');
  return (
    /* P-182 ②: 카드 전체 탭 제거 — 요소별 액션만(펼침·사진 뷰어·Helpful·⋯) */
    <View style={styles.rvRow} testID={`rv-preview-${review.id}`}>
      <View style={styles.rvHead}>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={12} fillPct={review.rating >= n ? 100 : 0} fillColor={C.primary} />
          ))}
        </View>
        <Text style={styles.rvName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rvWhen}>{previewDate(review.createdAt, t)}</Text>
        {/* P-186: ⋯ = 본인(수정/삭제)+타인(신고/차단), 익명(탈퇴)만 제외 */}
        {!anonymized && (
          <Pressable hitSlop={10} onPress={onMore} testID={`rv-more-${review.id}`}>
            <IconMore size={15} color={C.ink3} />
          </Pressable>
        )}
      </View>
      {!!review.body && <ExpandableBody body={review.body} t={t} />}
      <ReviewPhotoStrip photos={review.photos ?? []} size={64} />
      <ReviewPlaceLine place={review.place ?? null} />
      <ReviewExtrasLine review={review} mine={mine} />
      <View style={styles.rvFoot}>
        {/* P-196: Helpful = 공용 단일 경유(HelpfulButton) — 표면별 배선 금지 */}
        <HelpfulButton review={review} mine={mine} foodId={foodId} t={t} onGuest={onGuestHelpful} />
      </View>
    </View>
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

      <View style={styles.sec}>
        <Text style={styles.secTitle}>{t('detail.insideTitle')}</Text>
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyBlockText}>{t('detail.noIngredientBody')}</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 16, gap: 18 },

  // P-139 ①: 히어로 — 엣지-투-엣지 4:3 (오버레이 금지)
  hero: { width: '100%', aspectRatio: 4 / 3, backgroundColor: C.surface2 },
  heroFallback: { width: '100%', backgroundColor: C.surface2 },

  // P-139 ②: 플로팅 헤더
  fhead: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 8 },
  fheadBg: { backgroundColor: 'rgba(251,247,240,0.96)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  fBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(20,24,31,0.38)', alignItems: 'center', justifyContent: 'center' },
  fBtnSolid: { backgroundColor: 'transparent' },
  fTitle: { fontFamily: font.bodyBold, fontSize: 16, color: C.ink, textAlign: 'center' },

  titleBlock: { gap: 5 },
  name: { fontFamily: font.display, fontSize: 27, color: C.ink, letterSpacing: -0.6, lineHeight: 37, paddingTop: 2 },
  ko: { fontFamily: font.ko, fontSize: 15, color: C.ink2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 3 },
  transPill: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3.5 },
  transPillText: { fontFamily: font.bodyBold, fontSize: 10.5, color: C.ink2, letterSpacing: 0.3 },
  spiceMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spiceText: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink2 },
  spiceWarn: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },
  scanPrice: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink, marginTop: 3 },
  scanPriceNote: { fontFamily: font.body, fontSize: 12.5, color: C.ink2 },

  // P-139 ④: verdict 블록 — 4상태 틴트
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 15, paddingVertical: 13 },
  verdictLabel: { fontFamily: font.display, fontSize: 17 },
  verdictReason: { fontFamily: font.body, fontSize: 12.5, color: C.ink2, lineHeight: 17, marginTop: 2 },
  // P-139 ⑩: 게스트 잠금 슬롯 — 조용한 헤어라인 행
  lockSlot: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: C.surface2 },
  lockSlotText: { flex: 1, fontFamily: font.body, fontSize: 13, color: C.ink2 },
  lockSlotCta: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },

  profileHint: { fontFamily: font.body, fontSize: 13, color: C.ink2, marginTop: -6, lineHeight: 18 },

  sec: { gap: 8 },
  secTitle: { fontFamily: font.display, fontSize: 18, color: C.ink },
  desc: { fontFamily: font.body, fontSize: 14, color: C.ink, lineHeight: 21 },

  // P-139 ⑤: 재료 헤어라인 행
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  ingName: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  ingPct: { fontFamily: font.body, fontSize: 12, color: C.ink2 },
  ingReason: { fontFamily: font.body, fontSize: 12.5, color: C.ink, lineHeight: 18, marginTop: 3 },
  askLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, alignSelf: 'flex-start' },
  askLinkText: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },

  // 게스트 고스트(P-100 문법)

  // P-169 리뷰 브리프
  rvBriefHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rvScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rvScoreNum: { fontFamily: font.display, fontSize: 21, color: C.ink },
  rvScoreCount: { fontFamily: font.body, fontSize: 13, color: C.ink2 },
  rvSameNat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rvSameNatText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  rvWhen: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },
  // P-206: 게스트/마스킹 리뷰 잠금 행
  rvLockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: 14, padding: 14 },
  rvLockTitle: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink },
  rvLockSub: { fontFamily: font.body, fontSize: 12, color: C.ink3, lineHeight: 16 },
  rvBeFirst: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink2, textAlign: 'center', marginBottom: 4 },
  rvThumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: C.surface2, overflow: 'hidden' },
  rvFoot: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 2 },
  reportLink: { fontFamily: font.body, fontSize: 12.5, color: C.ink3 },
  rate2: { flexDirection: 'row', gap: 11 },
  rateMini: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 13, gap: 6 },
  rateBig: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateBigNum: { fontFamily: font.display, fontSize: 24, color: C.ink, lineHeight: 32 },
  rateLbl: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rateLblText: { flex: 1, fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },

  // 리뷰 프리뷰
  rvRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair, gap: 4 },
  rvHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rvName: { flex: 1, fontFamily: font.bodyBold, fontSize: 13, color: C.ink },
  rvBody: { fontFamily: font.body, fontSize: 13, color: C.ink2, lineHeight: 19 },
  reviewActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  readAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readAllText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.primaryText },

  unreg: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, padding: 16, backgroundColor: '#eef0f2', borderWidth: 1, borderColor: '#d8dde2' },
  unregTitle: { fontFamily: font.display, fontSize: 19, color: C.riskUnable },
  unregBody: { fontFamily: font.body, fontSize: 13, color: C.ink2, lineHeight: 19, marginTop: 3 },
  emptyBlock: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', borderRadius: radius.sm, padding: 18 },
  emptyBlockText: { fontFamily: font.body, fontSize: 13, color: C.ink2, lineHeight: 19 },

  disc: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair, paddingTop: 14 },
  discText: { flex: 1, fontFamily: font.body, fontSize: 12, color: C.ink2, lineHeight: 17 },

  errorState: { alignItems: 'center', gap: 12, paddingHorizontal: 28 },
});

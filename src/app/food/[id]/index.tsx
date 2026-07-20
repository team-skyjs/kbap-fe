/**
 * Food detail (mockup Screen E) — personalized risk verdict + ratings +
 * description + risk-ordered ingredient list (each row expands to its basis,
 * with an "Ask the owner" path for caution/danger items).
 *
 * Data via useFoodDetail(id) (MOCK_MODE). Unregistered dishes (isRegistered
 * false) render the "Unable to assess" state — never assumed safe (FR-033).
 * Scroll-aware back header (§6); no emoji; reader text i18n'd; risk colors fixed.
 */
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow, type RiskState } from '@/lib/theme';
import {
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  RiskMark,
  RiskPill,
  CardPhoto,
  Stars,
  Star,
  Flag,
  Btn,
  IconChevron,
  IconSpeech,
  IconFlame,
} from '@/components';
import { QueryErrorBlock } from '@/components/StateBlock';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useToggleBookmark } from '@/lib/data/bookmarks';
import { Snackbar } from '@/components/Snackbar';
import { IconBookmark } from '@/components/icons';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import { SPICE_SCALE } from '@/lib/onboarding/data';
import { formatKrw, parseScanPrice } from '@/lib/scan/segmentMenu';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { IconLock } from '@/components/icons';
import type { FoodDetail, IngredientRisk } from '@/lib/api/types';

const RISK_ORDER: Record<RiskState, number> = { danger: 0, caution: 1, unable: 2, safe: 3 };

export default function FoodDetailScreen() {
  // P-012(KB-179): price는 스캔 결과 진입에만 실리는 표시 전용 param — 조작 방어 파싱
  const { id, price } = useLocalSearchParams<{ id: string; price?: string }>();
  const scanPrice = parseScanPrice(price);
  const isGuest = useIsGuest();
  const router = useRouter();
  const { t } = useTranslation();
  const { onScroll, hidden } = useStickyScroll();
  const headerH = useHeaderHeight();

  const { data: food, isLoading, error, refetch } = useFoodDetail(id ?? '');
  const { data: me } = useMe();

  // 북마크 — 게스트=게이트 시트, 회원=BE 토글 (KB-142 실연결: POST/PATCH, 낙관적+실패 롤백)
  // saved는 상세 응답의 서버 필드(bookmarked) 기반 — 계약 갭 해소(2026-07-15 배포).
  // 낙관 토글이 이 캐시 값을 즉시 뒤집는다(useToggleBookmark onMutate).
  const saved = food?.bookmarked ?? false;
  const toggleBm = useToggleBookmark();
  const [saveGateOpen, setSaveGateOpen] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBookmark = () => {
    if (isGuest) {
      setSaveGateOpen(true);
      return;
    }
    if (!food) return;
    const adding = !saved;
    setSaveError(false);
    toggleBm.mutate(
      {
        snap: { foodId: food.foodId, name: food.name, nameKo: food.nameKo, risk: food.risk, photoUrl: food.photoUrl },
        add: adding,
      },
      {
        // 실패: 낙관적 반영은 훅이 롤백 — 여기선 에러 토스트만 (BE message 미노출, i18n)
        onError: () => {
          setSaveToast(false);
          setSaveError(true);
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setSaveError(false), 4000);
        },
      },
    );
    // 저장 시 매번 토스트 (예진 결정 7/14 — 디자인 spec의 1회 교육안 대신 상시 View 바로가기)
    if (adding) {
      setSaveToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setSaveToast(false), 5000);
    } else {
      setSaveToast(false);
    }
  };

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 40 }}
      >
        {error && !food && (
          /* P-007(KB-174): J3/J4 공용 렌더로 톤 통일 — 탭 루트가 아니라 Go back 포함 */
          <View style={styles.errorState}>
            <QueryErrorBlock error={error} onRetry={() => void refetch()} onGoBack={() => router.back()} />
          </View>
        )}

        {!isLoading && food && (
          <View style={styles.body}>
            {food.isRegistered ? (
              <Registered guest={isGuest}
                scanPrice={scanPrice}
                food={food}
                nationality={me?.nationality ?? 'US'}
                spiceTolerance={me?.spiceTolerance ?? null}
                hasRestrictions={(me?.restrictions.length ?? 0) > 0}
                t={t}
                router={router}
                id={id ?? ''}
              />
            ) : (
              <Unregistered food={food} t={t} onAsk={() => router.push(`/food/${id}/owner` as Href)} />
            )}

            <View style={styles.disc}>
              <RiskMark state="caution" size={15} variant="outline" />
              <Text style={styles.discText}>{t('detail.disclaimer')}</Text>
            </View>
          </View>
        )}
      </Animated.ScrollView>

      <StickyHeader hidden={hidden} mode="back" title={t('detail.headerTitle')} bookmark bookmarkSaved={saved} onBookmark={onBookmark} onBack={() => router.back()} />
      <AuthGateSheet context="save" open={saveGateOpen} onClose={() => setSaveGateOpen(false)} />
      {saveError && (
        <Snackbar icon={<IconBookmark size={15} color="#fff" />} text={t('saved.error')} />
      )}
      {saveToast && (
        <Snackbar
          icon={<IconBookmark size={15} color="#fff" fill="#fff" sw={0} />}
          text={t('saved.toast')}
          actionLabel={t('saved.view')}
          onAction={() => {
            setSaveToast(false);
            router.push('/profile/saved' as Href);
          }}
        />
      )}
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
  nationality,
  spiceTolerance,
  hasRestrictions,
  guest,
  scanPrice,
  t,
  router,
  id,
}: {
  guest: boolean;
  food: FoodDetail;
  nationality: string;
  spiceTolerance: number | null;
  hasRestrictions: boolean;
  scanPrice: number | null; // 스캔 진입 param (P-012) — 그 외 경로는 null
  t: TFn;
  router: Router;
  id: string;
}) {
  const [gateOpen, setGateOpen] = useState(false); // 게이트 시트 (KB-77)
  // false-safe guard (Constitution III · SC-003): empty profile never shows safe
  const dishRisk = personalRisk(food.risk, hasRestrictions);
  const ingredients = [...food.ingredients].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);

  // one-line basis under the verdict (why this state) — false-safe: unable says so.
  const verdictBasis =
    dishRisk === 'unable'
      ? t('detail.basisUnable')
      : dishRisk === 'safe'
        ? t('detail.basisSafe')
        : t('detail.basisFlagged');

  // Per-ingredient explanation is generated HERE, not by the BE (2026-07-08
  // 회의): the contract carries only inclusionPercent + riskStatus. Templates
  // are per risk band and NEUTRAL — the user registered "an ingredient they
  // avoid"; we never assume why (no "allergy"). Percent-less variants cover
  // rows without inclusion data.
  const ingBasis = (ing: IngredientRisk, dRisk: RiskState): string => {
    if (dRisk === 'unable') return t('detail.ingBasisUnable', { ingredient: ing.name });
    const band = dRisk === 'safe' ? 'Safe' : dRisk === 'caution' ? 'Caution' : 'Danger';
    return ing.percentage != null
      ? t(`detail.ingBasis${band}`, { ingredient: ing.name, percent: Math.round(ing.percentage) })
      : t(`detail.ingBasis${band}NoPct`, { ingredient: ing.name });
  };
  const spicyForYou = food.spiceLevel != null && spiceTolerance != null && food.spiceLevel > spiceTolerance;

  return (
    <>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{food.name}</Text>
          {food.nameKo !== food.name && <Text style={styles.ko}>{food.nameKo}</Text>}
        </View>
        <View style={styles.thumb}>
          {!!food.photoUrl && (
            <CardPhoto uri={food.photoUrl} borderRadius={16} />
          )}
        </View>
      </View>

      {guest ? (
        /* 게스트: 개인화 verdict 절대 미표시 — 중립 락카드(블러 고스트+CTA)
           → 게이트 시트 (guest-access-policy §0-2/§1) */
        <Pressable style={styles.lockCard} onPress={() => setGateOpen(true)}>
          <View style={styles.lockRow}>
            <View style={styles.lockIc}>
              <IconLock size={18} color={C.ink2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.lockTitle}>{t('lock.verdictTitle')}</Text>
              <Text style={styles.lockSub}>{t('lock.verdictSub')}</Text>
            </View>
            <View style={styles.lockTag}>
              <Text style={styles.lockTagText}>{t('lock.afterSignup')}</Text>
            </View>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.metaRow}>
        {!guest && <RiskPill state={dishRisk} size="lg" label={t(VERDICT[dishRisk])} />}
        {food.spiceLevel != null && (
          <View style={styles.spiceMeta}>
            <IconFlame size={16} color={C.primary} />
            <Text style={styles.spiceText}>
              {t('detail.spice', { level: food.spiceLevel, analogy: t(SPICE_SCALE[food.spiceLevel] ?? '') })}
            </Text>
            {spicyForYou && <Text style={styles.spiceWarn}>· {t('detail.spiceAboveYou')}</Text>}
          </View>
        )}
      </View>

      {/* P-012(KB-179): 스캔한 메뉴판의 가격 — 스캔 진입 param에만 존재, ₩ 포맷만 */}
      {scanPrice != null && (
        <Text style={styles.scanPrice}>
          {formatKrw(scanPrice)} <Text style={styles.scanPriceNote}>· {t('detail.scannedPrice')}</Text>
        </Text>
      )}

      {!guest && !!verdictBasis && <Text style={styles.verdictBasis}>{verdictBasis}</Text>}

      {!guest && !hasRestrictions && <Text style={styles.profileHint}>{t('detail.addProfileHint')}</Text>}

      <View style={styles.descCard}>
        <Text style={styles.desc}>{food.description}</Text>
      </View>

      {/* 평점 카드 2종(→ 리뷰 목록) — KB-148 MVP 제외(숨김) */}
      {FLAGS.reviewsEnabled && (
        <View style={styles.rate2}>
          <RatingMini
            value={food.overall.average}
            label={t('detail.allUsers', { count: food.overall.count })}
            onPress={() => router.push(`/food/${id}/reviews` as Href)}
          />
          <RatingMini
            value={food.sameNationality.average}
            label={t('detail.sameNationality')}
            left={<Flag code={nationality} size={15} />}
            onPress={() => router.push(`/food/${id}/reviews` as Href)}
          />
        </View>
      )}

      <View style={styles.photo}>
        {!!food.photoUrl && (
          <CardPhoto uri={food.photoUrl} transition={200} borderRadius={radius.lg} />
        )}
      </View>

      <AuthGateSheet context="risk" open={gateOpen} onClose={() => setGateOpen(false)} />

      <View style={styles.sec}>
        <Text style={styles.insideTitle}>{t('detail.insideTitle')}</Text>
        <Text style={styles.insideSub}>{t('detail.insideSub')}</Text>
        <View style={{ gap: 10 }}>
          {ingredients.map((ing) => {
            const dRisk = personalRisk(ing.risk, hasRestrictions);
            return (
              <IngredientRow
                key={ing.code}
                ing={ing}
                guest={guest}
                displayRisk={dRisk}
                reason={ingBasis(ing, dRisk)}
                ofShops={ing.percentage != null ? t('detail.ofShops', { pct: Math.round(ing.percentage) }) : ing.note ?? ''}
                askLabel={t('detail.askOwner')}
                onAsk={() => router.push(`/food/${id}/owner?ingredient=${encodeURIComponent(ing.code)}` as Href)}
              />
            );
          })}
        </View>
      </View>
    </>
  );
}

function RatingMini({ value, label, left, onPress }: { value: number | null; label: string; left?: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable style={styles.rateMini} onPress={onPress}>
      <View style={styles.rateBig}>
        <Star size={20} fillPct={100} fillColor={C.primary} />
        <Text style={styles.rateBigNum}>{value?.toFixed(1) ?? '—'}</Text>
      </View>
      <View style={styles.rateLbl}>
        {left}
        <Text style={styles.rateLblText} numberOfLines={1}>
          {label}
        </Text>
        <IconChevron size={13} color={C.ink3} />
      </View>
    </Pressable>
  );
}

function IngredientRow({
  ing,
  guest,
  displayRisk,
  reason,
  ofShops,
  askLabel,
  onAsk,
}: {
  ing: IngredientRisk;
  guest: boolean;
  displayRisk: RiskState;
  reason: string | null;
  ofShops: string;
  askLabel: string;
  onAsk: () => void;
}) {
  // 게스트: 성분명+포함%는 사실이라 공개, 개인화 위험 pill·문구는 잠금(미렌더,
  // 중립) — 확장/Ask 동선도 없음 (guest-access-policy §1)
  const [open, setOpen] = useState(!guest && displayRisk === 'caution');
  const canAsk = !guest && (displayRisk === 'caution' || displayRisk === 'danger');
  return (
    <View style={styles.ingRow}>
      <Pressable style={styles.ingMain} onPress={() => !guest && setOpen((o) => !o)}>
        <View style={styles.ingMeta}>
          <Text style={styles.ingName}>{ing.name}</Text>
          {!!ofShops && <Text style={styles.ingPct}>{ofShops}</Text>}
        </View>
        {!guest && <IconChevron size={16} color={C.ink3} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} />}
        {!guest && <RiskPill state={displayRisk} size="sm" />}
      </Pressable>
      {open && (
        <View style={styles.ingExpand}>
          {!!reason && <Text style={styles.ingReason}>{reason}</Text>}
          {canAsk && (
            <Pressable style={styles.askBtn} onPress={onAsk}>
              <IconSpeech size={18} color="#fff" />
              <Text style={styles.askBtnText}>{askLabel}</Text>
              <IconChevron size={16} color="#fff" />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function Unregistered({ food, t, onAsk }: { food: FoodDetail; t: TFn; onAsk: () => void }) {
  return (
    <>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{food.name}</Text>
          {food.nameKo !== food.name && <Text style={styles.ko}>{food.nameKo}</Text>}
        </View>
        <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center' }]}>
          <RiskMark state="unable" size={26} />
        </View>
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
        <Text style={styles.insideTitle}>{t('detail.insideTitle')}</Text>
        <Text style={styles.insideSub}>{t('detail.noIngredientData')}</Text>
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyBlockText}>{t('detail.noIngredientBody')}</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 4, gap: 20 },

  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  // lineHeight 38 + paddingTop: Korean glyphs (닭/볶…) have a taller ascent than
  // Latin in the display font — 36 clipped the first line's top on device.
  name: { fontFamily: font.display, fontSize: 28, color: C.ink, letterSpacing: -0.6, lineHeight: 38, paddingTop: 2 },
  ko: { fontFamily: font.ko, fontSize: 15, color: C.ink2, marginTop: 5 },
  thumb: { width: 60, height: 60, borderRadius: 16, backgroundColor: C.surface2, ...shadow.sh1 },

  // 게스트 verdict 락카드 (블러 고스트 + CTA)
  lockCard: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 14, overflow: 'hidden' },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  lockIc: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  lockTitle: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink },
  lockSub: { fontFamily: font.body, fontSize: 12, color: C.ink2, marginTop: 2, lineHeight: 16 },
  lockTag: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  lockTagText: { fontFamily: font.bodyBold, fontSize: 10, color: C.ink2, textTransform: 'uppercase', letterSpacing: 0.4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  verdictBasis: { fontFamily: font.body, fontSize: 13, color: C.ink2, lineHeight: 18, marginTop: -8 },
  // P-012 스캔 메뉴판 가격 — meta 구역 보조 라인 톤
  scanPrice: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink, marginTop: -6 },
  scanPriceNote: { fontFamily: font.body, fontSize: 12.5, color: C.ink2 },
  spiceMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spiceText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink2 },
  spiceWarn: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.primary },
  profileHint: { fontFamily: font.body, fontSize: 13, color: C.ink2, marginTop: -8, lineHeight: 18 },

  descCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 15, ...shadow.sh1 },
  desc: { fontFamily: font.body, fontSize: 14.5, color: C.ink, lineHeight: 22 },

  rate2: { flexDirection: 'row', gap: 11 },
  rateMini: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 14, gap: 6, ...shadow.sh1 },
  rateBig: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateBigNum: { fontFamily: font.display, fontSize: 26, color: C.ink, lineHeight: 34 },
  rateLbl: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rateLblText: { flex: 1, fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },

  photo: { height: 200, borderRadius: radius.lg, backgroundColor: C.surface2 },

  sec: { gap: 11 },
  insideTitle: { fontFamily: font.display, fontSize: 19, color: C.ink },
  insideSub: { fontFamily: font.body, fontSize: 13, color: C.ink2, marginTop: -6 },

  ingRow: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, overflow: 'hidden', ...shadow.sh1 },
  ingMain: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14, paddingVertical: 13 },
  ingMeta: { flex: 1, gap: 2 },
  ingName: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink },
  ingPct: { fontFamily: font.body, fontSize: 12, color: C.ink2 },
  ingExpand: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  ingReason: { fontFamily: font.body, fontSize: 13, color: C.ink, lineHeight: 19 },
  askBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, ...shadow.sh1 },
  askBtnText: { fontFamily: font.display, fontSize: 14.5, color: '#fff' },

  unreg: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, padding: 16, backgroundColor: '#eef0f2', borderWidth: 1, borderColor: '#d8dde2' },
  unregTitle: { fontFamily: font.display, fontSize: 19, color: C.riskUnable },
  unregBody: { fontFamily: font.body, fontSize: 13, color: C.ink2, lineHeight: 19, marginTop: 3 },
  emptyBlock: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', borderRadius: radius.sm, padding: 18 },
  emptyBlockText: { fontFamily: font.body, fontSize: 13, color: C.ink2, lineHeight: 19 },

  disc: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair, paddingTop: 14 },
  discText: { flex: 1, fontFamily: font.body, fontSize: 12, color: C.ink2, lineHeight: 17 },

  errorState: { alignItems: 'center', gap: 12, paddingHorizontal: 28, paddingTop: 48 },
});

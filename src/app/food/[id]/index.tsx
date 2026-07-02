/**
 * Food detail (mockup Screen E) — personalized risk verdict + ratings +
 * description + risk-ordered ingredient list (each row expands to its basis,
 * with an "Ask the owner" path for caution/danger items).
 *
 * Data via useFoodDetail(id) (MOCK_MODE). Unregistered dishes (isRegistered
 * false) render the "Unable to assess" state — never assumed safe (FR-033).
 * Scroll-aware back header (§6); no emoji; reader text i18n'd; risk colors fixed.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow, riskTone, type RiskState } from '@/lib/theme';
import {
  StickyHeader,
  useStickyScroll,
  RiskMark,
  Stars,
  Star,
  Flag,
  Btn,
  IconChevron,
  IconSpeech,
  IconFlame,
} from '@/components';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import { SPICE_SCALE } from '@/lib/onboarding/data';
import type { FoodDetail, IngredientRisk } from '@/lib/api/types';

const RISK_ORDER: Record<RiskState, number> = { danger: 0, caution: 1, unable: 2, safe: 3 };

export default function FoodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { scrollY, onScroll } = useStickyScroll();

  const { data: food, isLoading } = useFoodDetail(id ?? '');
  const { data: me } = useMe();

  return (
    <View style={styles.root}>
      <StickyHeader scrollY={scrollY} mode="back" title={t('detail.headerTitle')} bookmark onBack={() => router.back()} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {!isLoading && food && (
          <View style={styles.body}>
            {food.isRegistered ? (
              <Registered
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
  t,
  router,
  id,
}: {
  food: FoodDetail;
  nationality: string;
  spiceTolerance: number | null;
  hasRestrictions: boolean;
  t: TFn;
  router: Router;
  id: string;
}) {
  // false-safe guard (Constitution III · SC-003): empty profile never shows safe
  const dishRisk = personalRisk(food.risk, hasRestrictions);
  const tone = riskTone[dishRisk];
  const ingredients = [...food.ingredients].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
  const basisFor = (code: string) => food.riskBasis.find((b) => b.ingredientCode === code)?.reason ?? null;
  const spicyForYou = food.spiceLevel != null && spiceTolerance != null && food.spiceLevel > spiceTolerance;

  return (
    <>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{food.name}</Text>
          <Text style={styles.ko}>{food.nameKo}</Text>
        </View>
        <View style={styles.thumb} />
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.verdict, { backgroundColor: tone.bg, borderColor: tone.line }]}>
          <RiskMark state={dishRisk} size={20} />
          <Text style={[styles.verdictText, { color: tone.fg }]}>{t(VERDICT[dishRisk])}</Text>
        </View>
        {food.spiceLevel != null && (
          <View style={styles.spiceMeta}>
            <IconFlame size={16} color={C.primary} />
            <Text style={styles.spiceText}>
              {t('detail.spice', { level: food.spiceLevel, analogy: SPICE_SCALE[food.spiceLevel] ?? '' })}
            </Text>
            {spicyForYou && <Text style={styles.spiceWarn}>· {t('detail.spiceAboveYou')}</Text>}
          </View>
        )}
      </View>

      {!hasRestrictions && <Text style={styles.profileHint}>{t('detail.addProfileHint')}</Text>}

      <View style={styles.descCard}>
        <Text style={styles.desc}>{food.description}</Text>
      </View>

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

      <View style={styles.photo} />

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
                displayRisk={dRisk}
                reason={basisFor(ing.code)}
                riskLabel={t(`risk.${dRisk}`)}
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
  displayRisk,
  reason,
  riskLabel,
  ofShops,
  askLabel,
  onAsk,
}: {
  ing: IngredientRisk;
  displayRisk: RiskState;
  reason: string | null;
  riskLabel: string;
  ofShops: string;
  askLabel: string;
  onAsk: () => void;
}) {
  const [open, setOpen] = useState(displayRisk === 'caution');
  const tone = riskTone[displayRisk];
  const canAsk = displayRisk === 'caution' || displayRisk === 'danger';
  return (
    <View style={styles.ingRow}>
      <Pressable style={styles.ingMain} onPress={() => setOpen((o) => !o)}>
        <View style={[styles.ingIc, { backgroundColor: tone.bg }]}>
          <RiskMark state={displayRisk} size={18} />
        </View>
        <View style={styles.ingMeta}>
          <Text style={styles.ingName}>{ing.name}</Text>
          {!!ofShops && <Text style={styles.ingPct}>{ofShops}</Text>}
        </View>
        <IconChevron size={16} color={C.ink3} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} />
        <View style={[styles.rpill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.rpillText, { color: tone.fg }]}>{riskLabel}</Text>
        </View>
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
          <Text style={styles.ko}>{food.nameKo}</Text>
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
  name: { fontFamily: font.display, fontSize: 28, color: C.ink, letterSpacing: -0.6, lineHeight: 30 },
  ko: { fontFamily: font.ko, fontSize: 15, color: C.ink2, marginTop: 5 },
  thumb: { width: 60, height: 60, borderRadius: 16, backgroundColor: C.surface2, ...shadow.sh1 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  verdictText: { fontFamily: font.display, fontSize: 14.5 },
  spiceMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spiceText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink2 },
  spiceWarn: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.primary },
  profileHint: { fontFamily: font.body, fontSize: 13, color: C.ink2, marginTop: -8, lineHeight: 18 },

  descCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 15, ...shadow.sh1 },
  desc: { fontFamily: font.body, fontSize: 14.5, color: C.ink, lineHeight: 22 },

  rate2: { flexDirection: 'row', gap: 11 },
  rateMini: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 14, gap: 6, ...shadow.sh1 },
  rateBig: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateBigNum: { fontFamily: font.display, fontSize: 26, color: C.ink, lineHeight: 28 },
  rateLbl: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rateLblText: { flex: 1, fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },

  photo: { height: 200, borderRadius: radius.lg, backgroundColor: C.surface2 },

  sec: { gap: 11 },
  insideTitle: { fontFamily: font.display, fontSize: 19, color: C.ink },
  insideSub: { fontFamily: font.body, fontSize: 13, color: C.ink2, marginTop: -6 },

  ingRow: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, overflow: 'hidden', ...shadow.sh1 },
  ingMain: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14, paddingVertical: 13 },
  ingIc: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ingMeta: { flex: 1, gap: 2 },
  ingName: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink },
  ingPct: { fontFamily: font.body, fontSize: 12, color: C.ink2 },
  rpill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  rpillText: { fontFamily: font.bodyBold, fontSize: 12.5 },
  ingExpand: { paddingHorizontal: 14, paddingBottom: 14, paddingLeft: 65, gap: 10 },
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
});

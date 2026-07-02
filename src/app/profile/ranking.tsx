/**
 * Ranking detail (mockup "My Ranking", fe-handoff §15) — reached from the
 * profile ranking card. Confirmed design combo: department VIP plate hero +
 * medal emblem + bar gauge + path ladder (café/crown/ring/list variants ignored).
 *
 * Data via useRanking() (MOCK_MODE) — contract Ranking with breakdown. Tier
 * names are i18n'd by stable key (BE sends no translated name). No risk render.
 * All glyphs SVG (no emoji); hide-on-scroll header (§6).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import {
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  IconCheck,
  IconLock,
  IconSpeech,
  IconFood,
  IconScanLines,
  IconChevron,
} from '@/components';
import { useRanking } from '@/lib/data/useRanking';
import { TIERS, tierByKey, type Tier } from '@/lib/ranking';
import type { Ranking, RankingFactor } from '@/lib/api/types';

export default function RankingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { onScroll, hidden } = useStickyScroll();
  const headerH = useHeaderHeight();

  const { data: rk } = useRanking();

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 40 }}
      >
        {rk && <RankingBody rk={rk} onReview={() => router.push('/food' as Href)} onScan={() => router.push('/scan' as Href)} />}
      </Animated.ScrollView>

      <StickyHeader hidden={hidden} mode="back" title={t('ranking.headerTitle')} onBack={() => router.back()} />
    </View>
  );
}

function RankingBody({ rk, onReview, onScan }: { rk: Ranking; onReview: () => void; onScan: () => void }) {
  const { t } = useTranslation();
  const cur: Tier = tierByKey(rk.tier) ?? TIERS[0];
  const next = rk.nextTier ? tierByKey(rk.nextTier) : null;
  const bd = rk.breakdown;

  return (
    <View style={styles.body}>
      {/* 1. VIP plate hero */}
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{t('ranking.vipEyebrow')}</Text>
        <Medal dia={78} color={cur.color}>
          <Text style={[styles.medalNum, { color: cur.color }]}>{cur.level}</Text>
        </Medal>
        <Text style={styles.tierEn}>{t(`ranking.tier.${cur.key}`)}</Text>
        <View style={styles.tierSubRow}>
          <Text style={styles.tierKo}>{t(`ranking.tierKo.${cur.key}`)}</Text>
          <Text style={styles.dotSep}>·</Text>
          <Text style={styles.levelLbl}>{t('ranking.levelLabel', { level: cur.level })}</Text>
        </View>
        <View style={styles.heroDivider} />
        {bd && <Text style={styles.flavor}>{t('ranking.flavor', { count: bd.diversity.count })}</Text>}
        <Text style={styles.totalPts}>{t('ranking.totalPoints', { score: rk.score })}</Text>
      </View>

      {/* 2. bar gauge → next tier */}
      {next ? (
        <View style={styles.card}>
          <View style={styles.gaugeHead}>
            <Text style={styles.toNext}>
              <Text style={styles.toNextNum}>{rk.pointsToNext}</Text>{' '}
              {t('ranking.ptsTo', { tier: t(`ranking.tier.${next.key}`) })}
            </Text>
            <View style={styles.totalChip}>
              <Text style={styles.totalChipText}>{t('ranking.totalChip', { score: rk.score })}</Text>
            </View>
          </View>
          <Gauge score={rk.score} from={cur.at} to={next.at} color={cur.color} />
          <View style={styles.tickRow}>
            <Text style={styles.tick}>{t('ranking.entryPts', { at: cur.at })}</Text>
            <Text style={styles.tick}>{t('ranking.entryPts', { at: next.at })}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.card, styles.topCard]}>
          <Text style={styles.topTier}>{t('ranking.topTier')}</Text>
          <Text style={styles.topTierSub}>{t('ranking.topTierSub')}</Text>
        </View>
      )}

      {/* 3. score breakdown */}
      {bd && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('ranking.breakdownTitle')}</Text>
          <View style={{ gap: 12 }}>
            <BreakRow
              icon={<IconSpeech size={18} color={C.primary} />}
              label={t('ranking.reviewsLabel')}
              labelKo={t('ranking.reviewsLabelKo')}
              detail={t('ranking.reviewsDetail', { count: bd.reviews.count })}
              factor={bd.reviews}
            />
            <BreakRow
              icon={<IconFood size={18} color={C.primary} />}
              label={t('ranking.diversityLabel')}
              labelKo={t('ranking.diversityLabelKo')}
              detail={t('ranking.diversityDetail', { count: bd.diversity.count })}
              factor={bd.diversity}
            />
            <BreakRow
              icon={<IconScanLines size={18} color={C.primary} />}
              label={t('ranking.scansLabel')}
              labelKo={t('ranking.scansLabelKo')}
              detail={t('ranking.scansDetail', { count: bd.scans.count })}
              factor={bd.scans}
            />
          </View>
          <View style={styles.oneMore}>
            <Text style={styles.oneMoreText}>{t('ranking.oneMore')}</Text>
          </View>
        </View>
      )}

      {/* 4. path ladder */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('ranking.ladderTitle')}</Text>
        <View style={styles.path}>
          <View style={styles.pathLine} />
          {TIERS.slice().reverse().map((tier) => (
            <PathRow key={tier.key} tier={tier} curLevel={cur.level} />
          ))}
        </View>
      </View>

      {/* 5. CTAs */}
      <View style={styles.ctaRow}>
        <Cta onPress={onReview} label={t('ranking.ctaReview')} pts={t('ranking.ctaReviewPts')} filled />
        <Cta onPress={onScan} label={t('ranking.ctaScan')} pts={t('ranking.ctaScanPts')} />
      </View>
    </View>
  );
}

/* ---------- medal emblem / medallion (SVG) ---------- */
function scallopPoints(cx: number, cy: number, R: number, r: number, n = 12) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const ang = (Math.PI / n) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function Medal({ dia, color, dim, children }: { dia: number; color: string; dim?: boolean; children: React.ReactNode }) {
  const ribbon = dim ? C.line : color;
  return (
    <View style={{ width: dia, height: dia, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={dia} height={dia} viewBox="0 0 48 48" style={StyleSheet.absoluteFill}>
        {/* ribbon tails peeking below the disc */}
        <Path d="M17 32 L12 47 L19 43 L21 36 Z" fill={ribbon} opacity={0.85} />
        <Path d="M31 32 L36 47 L29 43 L27 36 Z" fill={ribbon} opacity={0.85} />
        {/* scalloped disc */}
        <Polygon points={scallopPoints(24, 23, 20, 16.5)} fill={color} stroke="rgba(0,0,0,0.12)" strokeWidth={1} strokeLinejoin="round" />
        {/* cream inner */}
        <Circle cx="24" cy="23" r="12.5" fill={C.surface} />
        <Circle cx="24" cy="23" r="12.5" fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth={1} />
      </Svg>
      <View style={styles.medalContent}>{children}</View>
    </View>
  );
}

/* ---------- bar gauge ---------- */
function Gauge({ score, from, to, color }: { score: number; from: number; to: number; color: string }) {
  const pct = to > from ? Math.max(0, Math.min(1, (score - from) / (to - from))) : 1;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      <View style={[styles.knob, { left: `${pct * 100}%`, borderColor: color }]} />
    </View>
  );
}

/* ---------- breakdown row ---------- */
function BreakRow({ icon, label, labelKo, detail, factor }: { icon: React.ReactNode; label: string; labelKo: string; detail: string; factor: RankingFactor }) {
  const { t } = useTranslation();
  return (
    <View style={styles.breakRow}>
      <View style={styles.breakIc}>{icon}</View>
      <View style={{ flex: 1 }}>
        <View style={styles.breakLabelRow}>
          <Text style={styles.breakLabel}>{label}</Text>
          <Text style={styles.breakLabelKo}>{labelKo}</Text>
        </View>
        <Text style={styles.breakDetail}>{detail}</Text>
      </View>
      <View style={styles.ptsChip}>
        <Text style={styles.ptsChipText}>{t('ranking.pointsChip', { points: factor.points })}</Text>
      </View>
    </View>
  );
}

/* ---------- path ladder row ---------- */
function PathRow({ tier, curLevel }: { tier: Tier; curLevel: number }) {
  const { t } = useTranslation();
  const state: 'past' | 'current' | 'future' = tier.level < curLevel ? 'past' : tier.level === curLevel ? 'current' : 'future';
  const dim = state === 'future';
  return (
    <View style={[styles.pathRow, state === 'current' && styles.pathRowCur]}>
      <Medal dia={44} color={dim ? C.ink3 : tier.color} dim={dim}>
        {state === 'past' ? (
          <IconCheck size={16} color={tier.color} />
        ) : state === 'current' ? (
          <Text style={[styles.pathNum, { color: tier.color }]}>{tier.level}</Text>
        ) : (
          <IconLock size={14} color={C.ink3} />
        )}
      </Medal>
      <View style={{ flex: 1 }}>
        <View style={styles.pathLabelRow}>
          <Text style={[styles.pathName, dim && styles.pathNameDim]}>{t(`ranking.tier.${tier.key}`)}</Text>
          <Text style={styles.pathNameKo}>{t(`ranking.tierKo.${tier.key}`)}</Text>
        </View>
        {state === 'current' ? (
          <Text style={styles.pathMetaCur}>{t('ranking.entryPts', { at: tier.at })}</Text>
        ) : state === 'future' ? (
          <Text style={styles.pathMeta}>{t('ranking.entryPts', { at: tier.at })}</Text>
        ) : null}
      </View>
      {state === 'current' && (
        <View style={styles.nowPill}>
          <Text style={styles.nowPillText}>{t('ranking.now')}</Text>
        </View>
      )}
    </View>
  );
}

/* ---------- CTA ---------- */
function Cta({ label, pts, filled, onPress }: { label: string; pts: string; filled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.ctaWrap, styles.cta, filled ? styles.ctaFilled : styles.ctaGhost, pressed && styles.ctaPressed]}
      onPress={onPress}
    >
      <Text style={[styles.ctaLabel, filled && styles.ctaLabelFilled]}>{label}</Text>
      <View style={[styles.ctaPts, filled ? styles.ctaPtsFilled : styles.ctaPtsGhost]}>
        <Text style={[styles.ctaPtsText, filled && styles.ctaPtsTextFilled]}>{pts}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 6, gap: 14 },

  // hero VIP plate
  hero: {
    backgroundColor: C.surface2,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: radius.lg,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
    ...shadow.sh1,
  },
  eyebrow: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 2, color: C.primary, marginBottom: 2 },
  medalNum: { fontFamily: font.displayBlack, fontSize: 26 },
  medalContent: { alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  tierEn: { fontFamily: font.displayBlack, fontSize: 27, color: C.ink, letterSpacing: -0.5, marginTop: 4 },
  tierSubRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tierKo: { fontFamily: font.koBold, fontSize: 14, color: C.ink2 },
  dotSep: { fontFamily: font.body, fontSize: 14, color: C.ink3 },
  levelLbl: { fontFamily: font.bodyBold, fontSize: 12, letterSpacing: 1.5, color: C.ink2 },
  heroDivider: { width: 46, height: 2, borderRadius: 1, backgroundColor: C.line, marginVertical: 8 },
  flavor: { fontFamily: font.body, fontSize: 14, color: C.ink2, textAlign: 'center' },
  totalPts: { fontFamily: font.display, fontSize: 15, color: C.primary },

  // cards
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 16, gap: 12, ...shadow.sh1 },
  cardTitle: { fontFamily: font.display, fontSize: 16, color: C.ink },

  // gauge
  gaugeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toNext: { flex: 1, fontFamily: font.body, fontSize: 15, color: C.ink },
  toNextNum: { fontFamily: font.displayBlack, fontSize: 18, color: C.primary },
  totalChip: { backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  totalChipText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  track: { height: 12, borderRadius: 6, backgroundColor: C.surface2, marginTop: 2, justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6 },
  knob: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', borderWidth: 3, marginLeft: -9, ...shadow.sh1 },
  tickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tick: { fontFamily: font.body, fontSize: 11, color: C.ink3 },

  topCard: { alignItems: 'center', gap: 4 },
  topTier: { fontFamily: font.displayBlack, fontSize: 18, color: C.primary },
  topTierSub: { fontFamily: font.body, fontSize: 13, color: C.ink2 },

  // breakdown
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  breakIc: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(226,88,12,0.08)', alignItems: 'center', justifyContent: 'center' },
  breakLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  breakLabel: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  breakLabelKo: { fontFamily: font.ko, fontSize: 12, color: C.ink3 },
  breakDetail: { fontFamily: font.body, fontSize: 12.5, color: C.ink2, marginTop: 1 },
  ptsChip: { backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  ptsChipText: { fontFamily: font.displayBlack, fontSize: 13, color: C.primary },
  oneMore: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: C.line, paddingTop: 11, alignItems: 'center' },
  oneMoreText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },

  // path ladder
  path: { position: 'relative', paddingVertical: 2 },
  pathLine: { position: 'absolute', left: 21, top: 30, bottom: 30, width: 2, backgroundColor: C.line, borderRadius: 1 },
  pathRow: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 56, paddingHorizontal: 4, borderRadius: 14 },
  pathRowCur: { backgroundColor: 'rgba(226,88,12,0.06)' },
  pathNum: { fontFamily: font.displayBlack, fontSize: 16 },
  pathLabelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  pathName: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink },
  pathNameDim: { color: C.ink3 },
  pathNameKo: { fontFamily: font.ko, fontSize: 12, color: C.ink3 },
  pathMeta: { fontFamily: font.body, fontSize: 12, color: C.ink3, marginTop: 1 },
  pathMetaCur: { fontFamily: font.bodyBold, fontSize: 12, color: C.primary, marginTop: 1 },
  nowPill: { backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  nowPillText: { fontFamily: font.displayBlack, fontSize: 11, letterSpacing: 1, color: '#fff' },

  // CTAs
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  ctaWrap: { flex: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12 },
  ctaPressed: { opacity: 0.85 },
  ctaFilled: { backgroundColor: C.primary, ...shadow.sh2 },
  ctaGhost: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, ...shadow.sh1 },
  ctaLabel: { fontFamily: font.display, fontSize: 15, color: C.ink },
  ctaLabelFilled: { color: '#fff' },
  ctaPts: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  ctaPtsFilled: { backgroundColor: 'rgba(255,255,255,0.22)' },
  ctaPtsGhost: { backgroundColor: C.surface2 },
  ctaPtsText: { fontFamily: font.displayBlack, fontSize: 12, color: C.primary },
  ctaPtsTextFilled: { color: '#fff' },
});

/**
 * Ranking detail (mockup "My Ranking", fe-handoff §15) — 1:1 port of
 * my-ranking.jsx with the confirmed combo: cardStyle=department (VIP plate) ·
 * emblem=medal (starburst) · gauge=bar · ranksLayout=path.
 *
 * Data via useRanking() (MOCK_MODE) — contract Ranking with breakdown. Tier
 * names are i18n'd by stable key (BE sends no translated name). No risk render.
 * All glyphs SVG (no emoji); hide-on-scroll header (§6).
 */
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Stop, Text as SvgText } from 'react-native-svg';
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
  IconCamera,
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

      <StickyHeader hidden={hidden} mode="back" title={t('ranking.headerTitle')} titleKo={t('ranking.headerTitleKo')} onBack={() => router.back()} />
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
      {/* 1 · VIP plate hero (department) */}
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{t('ranking.vipEyebrow')}</Text>
        <View style={styles.heroEmblem}>
          <MedalEmblem level={cur.level} size={84} />
        </View>
        <Text style={styles.tierEn}>{t(`ranking.tier.${cur.key}`)}</Text>
        <Text style={styles.tierKo}>
          {t(`ranking.tierKo.${cur.key}`)} · {t('ranking.levelLabel', { level: cur.level })}
        </Text>
        <View style={styles.heroDivider} />
        {bd && (
          <Text style={styles.flavor}>
            {t('ranking.flavorPre')} <Text style={styles.flavorB}>{bd.diversity.count}</Text> {t('ranking.flavorPost')}
          </Text>
        )}
        <Text style={styles.totalPts}>
          <Text style={styles.totalPtsB}>{rk.score}</Text> total points
        </Text>
      </View>

      {/* 2 · next-tier bar gauge */}
      {next ? (
        <View style={styles.card}>
          <View style={styles.gaugeHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toNext}>
                <Text style={styles.toNextNum}>{rk.pointsToNext}</Text> {t('ranking.ptsTo', { tier: t(`ranking.tier.${next.key}`) })}
              </Text>
              <Text style={styles.toNextKo}>{t('ranking.ptsToKo', { tier: t(`ranking.tierKo.${next.key}`) })}</Text>
            </View>
            <View style={styles.totalChip}>
              <Text style={styles.totalChipText}>{t('ranking.totalChip', { score: rk.score })}</Text>
            </View>
          </View>
          <Gauge score={rk.score} from={cur.at} to={next.at} />
          <View style={styles.tickRow}>
            <Text style={styles.tick}>{t('ranking.tickPts', { at: cur.at })}</Text>
            <Text style={styles.tick}>{t('ranking.tickPts', { at: next.at })}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.card, styles.maxed]}>
          <View style={styles.maxedIc}>
            <IconCheck size={22} color={C.riskSafe} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.maxedTitle}>{t('ranking.topTier')}</Text>
            <Text style={styles.maxedSub}>{t('ranking.topTierSub')}</Text>
          </View>
        </View>
      )}

      {/* 3 · score breakdown */}
      {bd && (
        <View style={styles.sec}>
          <View style={styles.secHead}>
            <Text style={styles.secTitle}>{t('ranking.breakdownTitle')}</Text>
            <Text style={styles.secSub}>{t('ranking.breakdownSub')}</Text>
          </View>
          <View style={styles.breakCard}>
            <BreakRow icon={<IconSpeech size={20} color={C.primary} />} label={t('ranking.reviewsLabel')} labelKo={t('ranking.reviewsLabelKo')} detail={t('ranking.reviewsDetail', { count: bd.reviews.count })} factor={bd.reviews} first />
            <BreakRow icon={<IconFood size={20} color={C.primary} />} label={t('ranking.diversityLabel')} labelKo={t('ranking.diversityLabelKo')} detail={t('ranking.diversityDetail', { count: bd.diversity.count })} factor={bd.diversity} />
            <BreakRow icon={<IconScanLines size={20} color={C.primary} />} label={t('ranking.scansLabel')} labelKo={t('ranking.scansLabelKo')} detail={t('ranking.scansDetail', { count: bd.scans.count })} factor={bd.scans} />
            <View style={styles.breakTotal}>
              <Text style={styles.breakTotalLabel}>{t('ranking.oneMore')}</Text>
              <Text style={styles.breakTotalPlus}>{t('ranking.oneMorePlus')}</Text>
            </View>
          </View>
        </View>
      )}

      {/* 4 · all ranks (path ladder) */}
      <View style={styles.sec}>
        <View style={styles.secHead}>
          <Text style={styles.secTitle}>{t('ranking.ladderTitle')}</Text>
          <Text style={styles.secSub}>{t('ranking.ladderSub')}</Text>
        </View>
        <View style={styles.path}>
          {TIERS.map((tier, i) => (
            <PathRow
              key={tier.key}
              tier={tier}
              curLevel={cur.level}
              first={i === 0}
              last={i === TIERS.length - 1}
            />
          ))}
        </View>
      </View>

      {/* 5 · CTAs */}
      <View style={styles.ctaCol}>
        <Cta onPress={onReview} icon={<IconSpeech size={18} color="#fff" />} label={t('ranking.ctaReview')} pts={t('ranking.ctaReviewPts')} filled />
        <Cta onPress={onScan} icon={<IconCamera size={18} color={C.ink} />} label={t('ranking.ctaScan')} pts={t('ranking.ctaScanPts')} />
      </View>
    </View>
  );
}

/* ---------- hero medal emblem (starburst, my-ranking.jsx MedalEmblem) ---------- */
const RAY_PTS = (() => {
  const cx = 50, cy = 43, n = 12, R = 35, r = 28;
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI / n) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
})();

function MedalEmblem({ level, size }: { level: number; size: number }) {
  const gid = React.useId();
  const c1 = C.primary, c2 = C.primary2;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c1} />
          <Stop offset="1" stopColor={c2} />
        </LinearGradient>
      </Defs>
      <Path d="M40 66 L32 96 L41 88 L48 95 L48 70 Z" fill={c2} opacity={0.92} />
      <Path d="M60 66 L68 96 L59 88 L52 95 L52 70 Z" fill={c1} opacity={0.92} />
      <Polygon points={RAY_PTS} fill={c1} opacity={0.55} />
      <Circle cx={50} cy={43} r={27} fill={`url(#${gid})`} />
      <Circle cx={50} cy={43} r={27} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={2} />
      <Circle cx={50} cy={43} r={22} fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={1} />
      <Path d="M34 34 a20 20 0 0 1 24 -8" fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={2.4} strokeLinecap="round" />
      <SvgText x={50} y={53.5} textAnchor="middle" fill="#fff" fontFamily={font.displayBlack} fontSize={30}>
        {String(level)}
      </SvgText>
    </Svg>
  );
}

/* ---------- ladder medallion (plain disc) ---------- */
function Medallion({ level, color, muted, done, size = 42 }: { level: number; color: string; muted?: boolean; done?: boolean; size?: number }) {
  const gid = React.useId();
  return (
    <Svg width={size} height={size} viewBox="0 0 42 42">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={muted ? '#EFE7DC' : color} />
          <Stop offset="1" stopColor={muted ? '#E4D8C8' : color} stopOpacity={muted ? 1 : 0.82} />
        </LinearGradient>
      </Defs>
      <Circle cx={21} cy={21} r={18} fill={`url(#${gid})`} />
      <Circle cx={21} cy={21} r={18} fill="none" stroke={muted ? '#D8C9B6' : '#fff'} strokeOpacity={muted ? 1 : 0.5} strokeWidth={1.6} />
      {done ? (
        <Path d="M13 21.5 l5 5 L30 15" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <SvgText x={21} y={27} textAnchor="middle" fill={muted ? '#B0A395' : '#fff'} fontFamily={font.displayBlack} fontSize={17}>
          {String(level)}
        </SvgText>
      )}
    </Svg>
  );
}

/* ---------- bar gauge ---------- */
function Gauge({ score, from, to }: { score: number; from: number; to: number }) {
  const pct = to > from ? Math.max(0, Math.min(1, (score - from) / (to - from))) : 1;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]}>
        <View style={styles.knob} />
      </View>
    </View>
  );
}

/* ---------- breakdown row ---------- */
function BreakRow({ icon, label, labelKo, detail, factor, first }: { icon: React.ReactNode; label: string; labelKo: string; detail: string; factor: RankingFactor; first?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.breakRow, !first && styles.breakRowBorder]}>
      <View style={styles.breakIc}>{icon}</View>
      <View style={styles.breakMeta}>
        <View style={styles.breakLabelRow}>
          <Text style={styles.breakLabel}>{label}</Text>
          <Text style={styles.breakLabelKo}>{labelKo}</Text>
        </View>
        <Text style={styles.breakDetail}>{detail}</Text>
      </View>
      <View style={styles.gain}>
        <Text style={styles.gainText}>{t('ranking.gain', { points: factor.points })}</Text>
      </View>
    </View>
  );
}

/* ---------- path ladder row (connected climb trail) ---------- */
function PathRow({ tier, curLevel, first, last }: { tier: Tier; curLevel: number; first: boolean; last: boolean }) {
  const { t } = useTranslation();
  const state: 'done' | 'current' | 'locked' = tier.level < curLevel ? 'done' : tier.level === curLevel ? 'current' : 'locked';
  const topSolid = tier.level <= curLevel;
  const botSolid = tier.level < curLevel;
  const dim = state === 'locked';

  const medallion = <Medallion level={tier.level} color={tier.color} muted={dim} done={state === 'done'} />;

  return (
    <View style={styles.pathRow}>
      <View style={styles.nodeCol}>
        <View style={[styles.line, { minHeight: 12 }, first && styles.lineHide, topSolid && styles.lineSolid]} />
        {state === 'current' ? <View style={styles.nodeCur}>{medallion}</View> : medallion}
        <View style={[styles.line, { minHeight: 12 }, last && styles.lineHide, botSolid && styles.lineSolid]} />
      </View>
      <View style={[styles.nodeBody, state === 'current' && styles.nodeBodyCur]}>
        <View style={styles.nodeMain}>
          <View style={styles.nodeNameRow}>
            <Text style={[styles.nodeName, dim && styles.dim]}>{t(`ranking.tier.${tier.key}`)}</Text>
            {state === 'current' && (
              <View style={styles.nowPill}>
                <Text style={styles.nowPillText}>{t('ranking.now')}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.nodeKo, dim && styles.dim]}>{t(`ranking.tierKo.${tier.key}`)}</Text>
        </View>
        <View style={dim ? styles.dim : undefined}>
          {state === 'done' && (
            <View style={styles.rankRight}>
              <IconCheck size={13} color={C.riskSafe} />
              <Text style={styles.doneText}>{t('ranking.done')}</Text>
            </View>
          )}
          {state === 'current' && <Text style={styles.atCur}>{t('ranking.entryPts', { at: tier.at })}</Text>}
          {state === 'locked' && (
            <View style={styles.rankRight}>
              <IconLock size={12} color={C.ink3} />
              <Text style={styles.atLocked}>{t('ranking.lockedPts', { at: tier.at })}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/* ---------- CTA ---------- */
function Cta({ icon, label, pts, filled, onPress }: { icon: React.ReactNode; label: string; pts: string; filled?: boolean; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.cta, filled ? styles.ctaFilled : styles.ctaGhost, pressed && styles.ctaPressed]} onPress={onPress}>
      {icon}
      <Text style={[styles.ctaLabel, filled && styles.ctaLabelFilled]}>{label}</Text>
      <View style={[styles.ctaPts, filled ? styles.ctaPtsFilled : styles.ctaPtsGhost]}>
        <Text style={[styles.ctaPtsText, filled && styles.ctaPtsTextFilled]}>{pts}</Text>
      </View>
    </Pressable>
  );
}

const PRIMARY_TINT = 'rgba(226,88,12,0.08)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 6, gap: 18 },

  // hero VIP plate
  hero: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    borderRadius: radius.lg,
    backgroundColor: '#FFFDFB',
    borderWidth: 1.5,
    borderColor: 'rgba(226,88,12,0.5)',
    ...shadow.sh1,
  },
  eyebrow: { fontFamily: font.bodyBold, fontSize: 10.5, letterSpacing: 3, color: C.primary },
  heroEmblem: { marginTop: 4, marginBottom: 2, ...shadow.sh2 },
  tierEn: { fontFamily: font.displayBlack, fontSize: 30, color: C.ink, letterSpacing: -0.6, lineHeight: 34 },
  tierKo: { fontFamily: font.koBold, fontSize: 12.5, color: C.ink3, letterSpacing: 0.2 },
  heroDivider: { width: 44, height: 2, borderRadius: 2, backgroundColor: 'rgba(226,88,12,0.35)', marginTop: 8, marginBottom: 6 },
  flavor: { fontFamily: font.body, fontSize: 12.5, lineHeight: 18, color: C.ink2, textAlign: 'center', maxWidth: 280 },
  flavorB: { fontFamily: font.bodyBlack, color: C.ink2 },
  totalPts: { marginTop: 8, fontFamily: font.body, fontSize: 12, letterSpacing: 0.4, color: C.ink2 },
  totalPtsB: { fontFamily: font.display, fontSize: 15, color: C.primary },

  // cards / sections
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 16, ...shadow.sh1 },
  sec: { gap: 11 },
  secHead: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  secTitle: { fontFamily: font.display, fontSize: 17, color: C.ink, letterSpacing: -0.2 },
  secSub: { fontFamily: font.koBold, fontSize: 12.5, color: C.ink3 },

  // gauge
  gaugeHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  toNext: { fontFamily: font.bodyBold, fontSize: 18, color: C.ink, letterSpacing: -0.2 },
  toNextNum: { fontFamily: font.displayBlack, fontSize: 18, color: C.primary },
  toNextKo: { fontFamily: font.koBold, fontSize: 12, color: C.ink3, marginTop: 1 },
  totalChip: { backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  totalChipText: { fontFamily: font.displayBlack, fontSize: 16, color: C.ink },
  track: { height: 12, borderRadius: 999, backgroundColor: C.surface2, position: 'relative', justifyContent: 'center' },
  fill: { height: 12, minWidth: 12, borderRadius: 999, backgroundColor: C.primary, position: 'relative' },
  knob: { position: 'absolute', right: -3, top: '50%', marginTop: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', borderWidth: 3, borderColor: C.primary, ...shadow.sh1 },
  tickRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  tick: { fontFamily: font.body, fontSize: 10.5, color: C.ink3 },

  // maxed (top tier)
  maxed: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  maxedIc: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#e8f4ec', alignItems: 'center', justifyContent: 'center' },
  maxedTitle: { fontFamily: font.display, fontSize: 17, color: C.ink },
  maxedSub: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: C.ink2, marginTop: 3 },

  // breakdown
  breakCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 6, ...shadow.sh1 },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13 },
  breakRowBorder: { borderTopWidth: 1, borderTopColor: C.hair },
  breakIc: { width: 40, height: 40, borderRadius: 12, backgroundColor: PRIMARY_TINT, alignItems: 'center', justifyContent: 'center' },
  breakMeta: { flex: 1, gap: 2 },
  breakLabelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  breakLabel: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink },
  breakLabelKo: { fontFamily: font.ko, fontSize: 12, color: C.ink3 },
  breakDetail: { fontFamily: font.body, fontSize: 11.5, color: C.ink2 },
  gain: { backgroundColor: PRIMARY_TINT, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 6 },
  gainText: { fontFamily: font.displayBlack, fontSize: 16, color: C.primary },
  breakTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -16, marginBottom: -6, marginTop: 4, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, borderStyle: 'dashed' },
  breakTotalLabel: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink2 },
  breakTotalPlus: { fontFamily: font.displayBlack, fontSize: 13.5, color: C.primary },

  // path ladder
  path: { paddingHorizontal: 2, paddingTop: 2 },
  pathRow: { flexDirection: 'row', gap: 14, alignItems: 'stretch' },
  nodeCol: { width: 42, alignItems: 'center' },
  line: { width: 3, flex: 1, borderRadius: 3, backgroundColor: C.surface2 },
  lineSolid: { backgroundColor: C.primary },
  lineHide: { opacity: 0 },
  nodeCur: { borderRadius: 24, padding: 3, backgroundColor: 'rgba(226,88,12,0.16)', ...shadow.sh2 },
  nodeBody: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 7, paddingBottom: 19 },
  nodeBodyCur: { backgroundColor: 'rgba(226,88,12,0.07)', borderRadius: radius.sm, borderWidth: 1.5, borderColor: 'rgba(226,88,12,0.28)', paddingHorizontal: 13, paddingVertical: 11, marginVertical: 3 },
  nodeMain: { flex: 1, gap: 1 },
  nodeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  nodeName: { fontFamily: font.display, fontSize: 15.5, color: C.ink, letterSpacing: -0.2 },
  nodeKo: { fontFamily: font.ko, fontSize: 12, color: C.ink2 },
  dim: { opacity: 0.58 },
  rankRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doneText: { fontFamily: font.bodyBold, fontSize: 12, color: C.riskSafe },
  atCur: { fontFamily: font.bodyBold, fontSize: 11, color: C.primary },
  atLocked: { fontFamily: font.bodyBold, fontSize: 11, color: C.ink3 },
  nowPill: { backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  nowPillText: { fontFamily: font.bodyBold, fontSize: 8.5, letterSpacing: 1, color: '#fff' },

  // CTAs
  ctaCol: { gap: 10, marginTop: 4 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14 },
  ctaPressed: { opacity: 0.9 },
  ctaFilled: { backgroundColor: C.primary, ...shadow.sh2 },
  ctaGhost: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, ...shadow.sh1 },
  ctaLabel: { fontFamily: font.display, fontSize: 16, color: C.ink },
  ctaLabelFilled: { color: '#fff' },
  ctaPts: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  ctaPtsFilled: { backgroundColor: 'rgba(255,255,255,0.24)' },
  ctaPtsGhost: { backgroundColor: PRIMARY_TINT },
  ctaPtsText: { fontFamily: font.bodyBold, fontSize: 12, color: C.primary },
  ctaPtsTextFilled: { color: '#fff' },
});

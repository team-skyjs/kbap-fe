/**
 * Ranking — KB-434 D-6(4150:14720, 375×1503). AppBar "My Ranking" → VIP MEMBERSHIP
 * → 메달 히어로(RankMedal 56 — 월계수 일러스트 SVG 부재 생략) → 등급명 20/700 +
 * ko 등급 필 → 시식 카운트 문구 → 진행 카드(별 그리드 6열 — 1별=1pt, 다음 등급
 * 간격 30pt 초과 구간은 규칙 불일치로 진행 바 대체(발주 규정·REPORTS)) →
 * Score breakdown 3열 카드(reviews·variety 잠금 표기 — 현 매핑 무변, scans 활성) →
 * All ranks 3열 그리드(현재 = primary 보더 + NOW 배지) → FixedBottom "Scan a menu +2".
 *
 * Data via useRanking() — 계약·계산 무변. 등급명 i18n 키(BE 번역 미송신).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import Svg, { Path } from 'react-native-svg';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import { Btn, RankMedal, SubHeader, IconScanLines } from '@/components';
import { D4Lock, D4ForkKnife } from '@/components/design4Assets';
import { ScrollView } from 'react-native';
import { useBottomInset } from '@/lib/useBottomInset';
import { useRanking } from '@/lib/data/useRanking';
import { QueryErrorBlock } from '@/components/StateBlock';
import { TIERS, tierByKey, type Tier } from '@/lib/ranking';
import type { Ranking } from '@/lib/api/types';

const INK_TITLE = '#2F3137';
const PRIMARY_10 = 'rgba(255,113,52,0.10)';
/** 별 그리드 규칙(발주): 1별 = 1pt — 다음 등급 간격이 30pt(6×5)를 넘으면 규칙
 *  불일치 → 진행 바 대체. export = 유닛 잠금용. */
export const STAR_GRID_MAX = 30;

// Stars.tsx STAR_D(시안 16그리드)를 46px로 스케일 — 채움 primary + 흰 20% 3px stroke
const STAR_D =
  'M8 1.3l2.06 4.18 4.61.67-3.34 3.25.79 4.59L8 11.82l-4.12 2.17.79-4.59L1.33 6.15l4.61-.67L8 1.3z';

function PointStar({ filled }: { filled: boolean }) {
  return (
    <View style={styles.starCell}>
      <Svg width={46} height={46} viewBox="0 0 16 16">
        <Path
          d={STAR_D}
          fill={filled ? C.primary : C.hair}
          stroke={filled ? 'rgba(255,255,255,0.2)' : C.hair}
          strokeWidth={3 * (16 / 46)}
          strokeLinejoin="round"
        />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <D4ForkKnife size={24} color={filled ? '#FFFFFF' : C.line2} />
        </View>
      </View>
    </View>
  );
}

export default function RankingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const bottom = useBottomInset(); // P-055
  const { data: rk, error, refetch } = useRanking(); // P-164: 에러 표면

  return (
    <View style={styles.root}>
      <SubHeader title={t('ranking.headerTitle')} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: 110 + bottom }]}>
        {/* P-164 → P-184: 로드 실패 = 공용 에러 — 정중앙은 블록 소유 */}
        {error && !rk ? (
          <QueryErrorBlock error={error} onRetry={() => void refetch()} onGoBack={() => router.back()} />
        ) : (
          rk && <RankingBody rk={rk} />
        )}
      </ScrollView>

      {/* FixedBottom — outline "Scan a menu +2" */}
      <View style={[styles.bottomBar, { paddingBottom: bottom + 10 }]} testID="ranking-bottom-bar">
        <Btn variant="ghost" onPress={() => router.navigate('/scan' as Href)} testID="ranking-cta-scan">
          {`${t('ranking.ctaScan')} ${t('ranking.ctaScanPts')}`}
        </Btn>
      </View>
    </View>
  );
}

function RankingBody({ rk }: { rk: Ranking }) {
  const { t } = useTranslation();
  const cur: Tier = tierByKey(rk.tier) ?? TIERS[0];
  const next = rk.nextTier ? tierByKey(rk.nextTier) : null;
  const bd = rk.breakdown;
  const span = next ? next.at - cur.at : 0;
  const gained = Math.max(0, Math.min(span, rk.score - cur.at));

  return (
    <View style={styles.body}>
      {/* 히어로 — VIP MEMBERSHIP + RankMedal 56 + 등급명 + ko 필 + 시식 문구 */}
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{t('ranking.vipEyebrow')}</Text>
        <RankMedal level={cur.level} size={56} />
        <Text style={styles.tierName}>{t(`ranking.tier.${cur.key}`)}</Text>
        <View style={styles.tierPill}>
          <Text style={styles.tierPillText}>
            {t(`ranking.tierKo.${cur.key}`)} {t('ranking.levelLabel', { level: cur.level })}
          </Text>
        </View>
        {bd && (
          <Text style={styles.flavor}>
            {t('ranking.flavorPre')} {bd.diversity.count} {t('ranking.flavorPost')}
          </Text>
        )}
      </View>

      {/* 진행 카드 — "pts to {tier}" + 점수, 별 그리드(1별=1pt) 또는 진행 바 대체 */}
      {next && (
        <View style={styles.progCard} testID="ranking-progress-card">
          <View style={styles.progHead}>
            <Text style={styles.progTo}>{t('ranking.ptsTo', { tier: t(`ranking.tier.${next.key}`) })}</Text>
            <Text style={styles.progPts}>
              <Text style={styles.progPtsCur}>{t('ranking.totalChip', { score: rk.score })}</Text>
              <Text style={styles.progPtsGoal}> / {t('ranking.tickPts', { at: next.at })}</Text>
            </Text>
          </View>
          {span > 0 && span <= STAR_GRID_MAX ? (
            <View style={styles.starGrid} testID="ranking-star-grid">
              {Array.from({ length: span }, (_, i) => (
                <PointStar key={i} filled={i < gained} />
              ))}
            </View>
          ) : (
            /* 간격 30pt 초과 = 1별=1pt 규칙 불일치 — 진행 바 대체(발주 규정) */
            <View style={styles.track} testID="ranking-progress-bar">
              <View style={[styles.fill, { width: `${span > 0 ? Math.round((gained / span) * 100) : 100}%` }]} />
            </View>
          )}
        </View>
      )}

      {/* Score breakdown — 제목 16/500 + ko 13/500 */}
      <View style={styles.secHead}>
        <Text style={styles.secTitle}>{t('ranking.breakdownTitle')}</Text>
        <Text style={styles.secSub}>{t('ranking.breakdownSub')}</Text>
      </View>
      {/* 내역 카드 3열 — reviews·variety = 잠금(현 매핑 무변 — P-048·P-058), scans 활성 */}
      <View style={styles.breakCard}>
        <BreakCol
          icon={<D4Lock size={20} color={C.ink3} />}
          label={t('ranking.reviewsLabel')}
          labelKo={t('ranking.reviewsLabelKo')}
          detail={t('ranking.reviewsComing')}
          detailColor="#30C120"
          locked
        />
        <View style={styles.breakDiv} />
        <BreakCol
          icon={<D4Lock size={20} color={C.ink3} />}
          label={t('ranking.diversityLabel')}
          labelKo={t('ranking.diversityLabelKo')}
          detail={t('ranking.reviewsComing')}
          detailColor="#30C120"
          locked
        />
        <View style={styles.breakDiv} />
        <BreakCol
          icon={<IconScanLines size={20} color={C.primary} />}
          label={t('ranking.scansLabel')}
          labelKo={t('ranking.scansLabelKo')}
          detail={bd ? t('ranking.scansDetail', { count: bd.scans.count }) : ''}
          detailColor={C.ink3}
          pts={bd ? t('ranking.gain', { points: bd.scans.points }) : undefined}
        />
      </View>

      {/* All ranks — 3열 × 2행 + 마지막 full */}
      <View style={styles.secHead}>
        <Text style={styles.secTitle}>{t('ranking.ladderTitle')}</Text>
        <Text style={styles.secSub}>{t('ranking.ladderSub')}</Text>
      </View>
      <View style={styles.rankGrid}>
        {TIERS.map((tier) => {
          const now = tier.level === cur.level;
          return (
            <View
              key={tier.key}
              style={[styles.rankCard, tier.level === 7 && styles.rankCardFull, now && styles.rankCardNow]}
              testID={now ? 'rank-now' : `rank-${tier.key}`}
            >
              {now && (
                <View style={styles.nowBadge}>
                  <Text style={styles.nowBadgeText}>{t('ranking.now')}</Text>
                </View>
              )}
              <RankMedal level={tier.level} size={28} />
              <Text style={styles.rankName} numberOfLines={1}>{t(`ranking.tier.${tier.key}`)}</Text>
              <Text style={styles.rankKo} numberOfLines={1}>{t(`ranking.tierKo.${tier.key}`)}</Text>
              <Text style={[styles.rankPts, now && { color: C.primary }]}>{t('ranking.tickPts', { at: tier.at })}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** 내역 카드 열 — 아이콘 원 40 + 제목/ko + 설명 + 점수 필(잠금 = opacity 0.2 "-"). */
function BreakCol({
  icon,
  label,
  labelKo,
  detail,
  detailColor,
  pts,
  locked,
}: {
  icon: React.ReactNode;
  label: string;
  labelKo: string;
  detail: string;
  detailColor: string;
  pts?: string;
  locked?: boolean;
}) {
  return (
    <View style={styles.breakCol}>
      <View style={styles.breakIc}>{icon}</View>
      <Text style={styles.breakLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.breakKo} numberOfLines={1}>{labelKo}</Text>
      <Text style={[styles.breakDetail, { color: detailColor }]} numberOfLines={2}>{detail}</Text>
      <View style={[styles.gainPill, locked && { opacity: 0.2 }]}>
        <Text style={styles.gainText}>{locked ? '-' : pts}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  scroll: { paddingTop: 8 },
  body: { gap: 16 },

  hero: { alignItems: 'center', gap: 8, paddingTop: 12, paddingHorizontal: 20 },
  eyebrow: { fontSize: 14, fontWeight: '500', color: INK_TITLE, textAlign: 'center' },
  tierName: { fontSize: 20, fontWeight: '700', color: '#1C1E21', textAlign: 'center', marginTop: 4 },
  tierPill: { backgroundColor: PRIMARY_10, borderRadius: 24, paddingVertical: 4, paddingHorizontal: 12 },
  tierPillText: { fontSize: 13, fontWeight: '500', color: C.primary },
  flavor: { fontSize: 14, fontWeight: '400', color: C.ink3, textAlign: 'center', lineHeight: 20, maxWidth: 300 },

  // 진행 카드 — mx 20 pad 20 r8 border #F2F3F6
  progCard: { marginHorizontal: 20, padding: 20, borderRadius: 8, borderWidth: 1, borderColor: C.hair, gap: 14 },
  progHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  progTo: { fontSize: 16, fontWeight: '500', color: '#1C1E21', flexShrink: 1 },
  progPts: { fontSize: 12 },
  progPtsCur: { fontSize: 18, fontWeight: '600', color: '#1C1E21' },
  progPtsGoal: { fontSize: 12, fontWeight: '400', color: C.inkMute },
  starGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  starCell: { width: 46, height: 46 },
  track: { height: 10, borderRadius: 16, backgroundColor: '#EDEFF4', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 16, backgroundColor: C.primary },

  secHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 20, marginTop: 4 },
  secTitle: { fontSize: 16, fontWeight: '500', color: '#1C1E21' },
  secSub: { fontSize: 13, fontWeight: '500', color: C.ink2 },

  // 내역 카드 3열 — pad 16 r20, 열 구분선 #EAEBEE
  breakCard: { marginHorizontal: 20, flexDirection: 'row', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: C.hair },
  breakCol: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  breakDiv: { width: 1, backgroundColor: C.line },
  breakIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  breakLabel: { fontSize: 14, fontWeight: '600', color: '#1C1E21' },
  breakKo: { fontSize: 12, fontWeight: '500', color: C.ink3 },
  breakDetail: { fontSize: 12, fontWeight: '400', textAlign: 'center', lineHeight: 16, minHeight: 32 },
  gainPill: { backgroundColor: C.primary, borderRadius: 100, paddingVertical: 6, paddingHorizontal: 10, marginTop: 2 },
  gainText: { fontSize: 13, fontWeight: '500', color: '#FFFFFF' },

  // All ranks 그리드 — 106w h145 gap 8 pad 12/8 r8(3열, 마지막 full)
  rankGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  rankCard: { width: '31.5%', flexGrow: 1, height: 145, borderRadius: 8, borderWidth: 1, borderColor: C.hair, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', gap: 3 },
  rankCardFull: { width: '100%' },
  rankCardNow: { borderColor: C.primary },
  nowBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: INK_TITLE, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 5 },
  nowBadgeText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },
  rankName: { fontSize: 15, fontWeight: '600', color: '#1C1E21', marginTop: 4 },
  rankKo: { fontSize: 12, fontWeight: '400', color: C.ink3 },
  rankPts: { fontSize: 13, fontWeight: '500', color: C.ink3, marginTop: 2 },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: C.line },
});

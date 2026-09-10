/**
 * Ranking — KB-434 D-6(4150:14720, 375×1503). AppBar "My Ranking" → VIP MEMBERSHIP
 * → 메달 히어로(RankMedal 56 — 월계수 일러스트 SVG 부재 생략) → 등급명 20/700 +
 * ko 등급 필 → 시식 카운트 문구 → 진행 카드(별 그리드 6열 — 1별=1pt, 다음 등급
 * 간격 30pt 초과 구간은 규칙 불일치로 진행 바 대체(발주 규정·REPORTS)) →
 * Score breakdown 3열 카드(P-283: 리뷰·다양성·스캔 3칸 전부 서버 breakdown 실배선) →
 * All ranks 3열 그리드(현재 = primary 보더 + NOW 배지) → FixedBottom "Scan a menu +2".
 *
 * Data via useRanking() — 계약·계산 무변. 등급명 i18n 키(BE 번역 미송신).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import { Btn, RankMedal, SubHeader, IconScanLines, IconTabReviews } from '@/components';
import { MEDAL_COLORS } from '@/components/RankMedal';
import { IconCutlery, RankPointBadge, RankWreath } from '@/components/rankBadge';
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

/** P-327(KB-486): 진행 배지 = 12각 스타 + 수저 글리프(rankBadge.tsx — .fig 재디코드).
 *  구 5각 별(Stars.tsx STAR_D 스케일) 폐기. 6칸 행 단위로 chunk(space-evenly). */
export function chunk6<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 6) rows.push(items.slice(i, i + 6));
  return rows;
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
      {/* 히어로 — VIP MEMBERSHIP + 월계수(opacity 0.5) 뒤 RankMedal 56(그림자) + 등급명 + ko 필 + 시식 문구 */}
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{t('ranking.vipEyebrow')}</Text>
        <View style={styles.medalGroup} testID="ranking-medal-group">
          <View style={StyleSheet.absoluteFill}>
            <RankWreath />
          </View>
          <View style={styles.medalShadow}>
            <RankMedal level={cur.level} size={56} />
          </View>
        </View>
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
            /* P-327: 6열 space-evenly 행 단위(열 gap ≈2.7 — gap 상수 아님), 행 gap 10 */
            <View style={styles.starGrid} testID="ranking-star-grid">
              {chunk6(Array.from({ length: span }, (_, i) => i)).map((row, r) => (
                <View key={r} style={styles.starRow}>
                  {row.map((i) => (
                    <View key={i} testID={i < gained ? 'rank-badge-on' : 'rank-badge-off'}>
                      <RankPointBadge on={i < gained} />
                    </View>
                  ))}
                </View>
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
      {/* P-283(9/5 예진 확정): 3칸 전부 실배선 — 서버 breakdown 실값(리뷰 10·고유 음식 5·
          스캔 2pt, Ranking.kt). 자물쇠+Coming 하드코딩 소멸. 리뷰 아이콘 = 시안
          점수 내역 카드에 활성 리뷰 아이콘 부재 → 리뷰 탭 아이콘 통일(발주 규정·REPORTS) */}
      <View style={styles.breakCard}>
        <BreakCol
          icon={<IconTabReviews size={24} color={'#9196A1'} />}
          label={t('ranking.reviewsLabel')}
          labelKo={t('ranking.reviewsLabelKo')}
          detail={bd ? t('ranking.reviewsDetail', { count: bd.reviews.count }) : ''}
          detailColor={C.ink3}
          points={bd?.reviews.points}
        />
        <View style={styles.breakDiv} />
        <BreakCol
          icon={<IconCutlery size={24} color={'#9196A1'} />}
          label={t('ranking.diversityLabel')}
          labelKo={t('ranking.diversityLabelKo')}
          detail={bd ? t('ranking.diversityDetail', { count: bd.diversity.count }) : ''}
          detailColor={C.ink3}
          points={bd?.diversity.points}
        />
        <View style={styles.breakDiv} />
        <BreakCol
          icon={<IconScanLines size={24} color={'#9196A1'} />}
          label={t('ranking.scansLabel')}
          labelKo={t('ranking.scansLabelKo')}
          detail={bd ? t('ranking.scansDetail', { count: bd.scans.count }) : ''}
          detailColor={C.ink3}
          points={bd?.scans.points}
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
              style={[
                styles.rankCard,
                tier.level >= 4 && tier.level !== 7 && styles.rankCardRow2,
                tier.level === 7 && styles.rankCardFull,
                now && styles.rankCardNow,
              ]}
              testID={now ? 'rank-now' : `rank-${tier.key}`}
            >
              {now && (
                <View style={styles.nowBadge}>
                  <Text style={styles.nowBadgeText}>{t('ranking.now')}</Text>
                </View>
              )}
              {/* P-327 → P-369 ②: 메달 글로우 0/3 blur8 @0.40 — 색 = 각 등급 메달 원색(C-38) */}
              <View style={[styles.medalGlow, { shadowColor: MEDAL_COLORS[tier.level - 1] }]}>
                <RankMedal level={tier.level} size={28} />
              </View>
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

/** 내역 카드 열 — 아이콘 원 40 + 제목/ko + 설명 + 점수 필(P-283: 3칸 전부 활성 — locked 소멸).
 *  Codex #89 P2: 비활성 판정 = **숫자 points**(없음·0) — 포맷("+n")은 필 안에서. */
function BreakCol({
  icon,
  label,
  labelKo,
  detail,
  detailColor,
  points,
}: {
  icon: React.ReactNode;
  label: string;
  labelKo: string;
  detail: string;
  detailColor: string;
  points?: number;
}) {
  const { t } = useTranslation();
  const active = points != null && points > 0;
  return (
    <View style={styles.breakCol}>
      <View style={styles.breakIc}>{icon}</View>
      <Text style={styles.breakLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.breakKo} numberOfLines={1}>{labelKo}</Text>
      <Text style={[styles.breakDetail, { color: detailColor }]} numberOfLines={2}>{detail}</Text>
      {/* P-327: 비활성(0점 포함) = opacity 0.2 + "-" */}
      <View style={[styles.gainPill, !active && { opacity: 0.2 }]} testID={active ? 'gain-active' : 'gain-inactive'}>
        <Text style={styles.gainText}>{active ? t('ranking.gain', { points }) : '-'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  scroll: {},
  body: {},

  // P-327 §2: 헤더→라벨 16 · 라벨→메달 그룹 17 · 메달→이름 9 · 필/문구 gap 8
  hero: { alignItems: 'center', paddingTop: 16, paddingHorizontal: 20 },
  eyebrow: { fontSize: 14, fontWeight: '500', color: INK_TITLE, textAlign: 'center' },
  medalGroup: { width: 130, height: 70, alignItems: 'center', justifyContent: 'center', marginTop: 17 },
  medalShadow: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 22.9, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  tierName: { fontSize: 20, fontWeight: '700', color: '#1C1E21', textAlign: 'center', marginTop: 9 },
  tierPill: { backgroundColor: PRIMARY_10, borderRadius: 24, paddingVertical: 4, paddingHorizontal: 12, marginTop: 8 },
  tierPillText: { fontSize: 13, fontWeight: '500', color: C.primary },
  flavor: { fontSize: 14, fontWeight: '400', color: '#9196A1', textAlign: 'center', lineHeight: 20, maxWidth: 300, marginTop: 8 },

  // P-327 §3: 히어로→카드 24 · pad 20 gap 10 r8 stroke #F2F3F6
  progCard: { marginTop: 24, marginHorizontal: 20, padding: 20, borderRadius: 8, borderWidth: 1, borderColor: '#F2F3F6', backgroundColor: '#FFFFFF', gap: 10 },
  progHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  progTo: { fontSize: 16, fontWeight: '500', color: '#1C1E21', flexShrink: 1 },
  progPts: { fontSize: 12 },
  progPtsCur: { fontSize: 18, fontWeight: '600', color: INK_TITLE },
  progPtsGoal: { fontSize: 12, fontWeight: '400', color: '#B1B5BD' },
  starGrid: { gap: 10 },
  starRow: { flexDirection: 'row', justifyContent: 'space-evenly' },
  track: { height: 10, borderRadius: 16, backgroundColor: '#EDEFF4', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 16, backgroundColor: C.primary },

  // P-327 §4: 카드→헤드 18 · 헤드 gap 6 · 헤드→리스트 0(카드 자체 상단 pad)
  secHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 20, marginTop: 18 },
  secTitle: { fontSize: 16, fontWeight: '500', color: '#1C1E21' },
  secSub: { fontSize: 13, fontWeight: '500', color: '#6A6F7C' },

  // 내역 카드 — r20 흰 보더 없음 pad 상하 16/좌우 0, 열 사이 1px #EAEBEE(h175)
  breakCard: { marginHorizontal: 20, flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 0, borderRadius: 20, backgroundColor: '#FFFFFF' },
  breakCol: { flex: 1, alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  breakDiv: { width: 1, height: 175, alignSelf: 'center', backgroundColor: '#EAEBEE' },
  breakIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  breakLabel: { fontSize: 14, fontWeight: '600', color: '#1C1E21' },
  breakKo: { fontSize: 12, fontWeight: '500', color: '#9196A1', marginTop: -6 }, // 제목/ko gap 2(열 gap 8 보정)
  breakDetail: { fontSize: 12, fontWeight: '400', textAlign: 'center', lineHeight: 16, minHeight: 32 },
  gainPill: { height: 32, justifyContent: 'center', backgroundColor: C.primary, borderRadius: 100, paddingVertical: 6, paddingHorizontal: 10 },
  gainText: { fontSize: 13, fontWeight: '500', color: '#FFFFFF' },

  // P-327 §5: 헤드→그리드 10 · 비현재 보더 없음(NOW만 primary 1) · 1행 h145/2행·풀 h129
  rankGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 10 },
  rankCard: { width: '31.5%', flexGrow: 1, height: 145, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  rankCardRow2: { height: 129 },
  rankCardFull: { width: '100%', height: 129 },
  rankCardNow: { borderWidth: 1, borderColor: C.primary, paddingTop: 24, paddingBottom: 16 },
  nowBadge: { position: 'absolute', top: 4, left: 4, backgroundColor: INK_TITLE, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6 },
  nowBadgeText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },
  medalGlow: { shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 }, // P-369 ②: shadowColor = 등급색(인라인)
  rankName: { fontSize: 15, fontWeight: '600', color: '#1C1E21', marginTop: 6 },
  rankKo: { fontSize: 12, fontWeight: '400', color: C.ink3, marginTop: 2 },
  rankPts: { fontSize: 13, fontWeight: '500', color: C.ink3, marginTop: 6 },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: C.line },
});

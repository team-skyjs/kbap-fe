/**
 * 평점 요약 박스(KB-431 §2-3, 4150:16775) — 좌 별·총점 "n / 5"·OVERALL / 우 3축 세로 막대(최고 축 강조).
 * KB-848: 리뷰 전체 목록에서 꺼내 음식 상세 리뷰 섹션 상단과 공용.
 * 축 = 전부 서버 집계(overall 또는 KR only = sameNationality): Taste = 평균 평점 · Speed·Service = KB-857 축 평균. 값 없는 축 = 미표시.
 * (KB-848 QA AG3: 화면마다 로드된 리뷰로 계산하면 상세·목록 값이 갈렸다 — 서버 값만 쓴다)
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { Stars } from '@/components';
import { color as C, radius } from '@/lib/theme';
import type { RatingAggregate } from '@/lib/api/types';

type TFn = (k: string, o?: Record<string, unknown>) => string;
export type AxisAverages = { taste: number | null; speed: number | null; service: number | null };

/** 서버 집계만 — 토글 따라 overall/같은 국적 집계 하나에서 세 축(상세·목록이 같은 함수 = 같은 값). 축 평균 없음 = null(숨김) */
export function serverAxes(agg: RatingAggregate): AxisAverages {
  return { taste: agg.average, speed: agg.speedAverage ?? null, service: agg.serviceAverage ?? null };
}

/** KB-431 §2-3: 세로 바 1개 — 뱃지(최고값 강조) + 바(fill 높이 = 점수/5 × 46) + 라벨. */
export function AxisBar({ label, value, top, testID }: { label: string; value: number; top: boolean; testID?: string }) {
  const fillH = Math.max(0, Math.min(1, value / 5)) * 46;
  return (
    <View style={styles.axisCol} testID={testID}>
      <View style={[styles.axisBadge, top ? styles.axisBadgeTop : styles.axisBadgeRest]}>
        <Text style={[styles.axisBadgeText, top && { color: '#FFFFFF' }]}>{value.toFixed(1)}</Text>
      </View>
      <View style={styles.axisTrack}>
        <View style={[styles.axisFill, { height: fillH }, top ? styles.axisFillTop : styles.axisFillRest]} testID={testID ? `${testID}-fill` : undefined} />
      </View>
      <Text style={styles.axisLbl} numberOfLines={2}>{label}</Text>
    </View>
  );
}

export function RatingSummaryBox({
  overall,
  sameNat = false,
  axes,
  axisLabels,
  t,
}: {
  overall: Pick<RatingAggregate, 'average' | 'count'>;
  /** KB-865: 가공식품 = 같은 박스, 축 라벨만 Spiciness·Sweetness(값은 speed·service 자리에 맵기·당도) */
  axisLabels?: { speed: string; service: string };
  /** P-360: KR only ON — 라벨 = SAME NATIONALITY(값은 호출측이 sameNationality 전달) */
  sameNat?: boolean;
  axes: AxisAverages;
  t: TFn;
}) {
  const bars: [string, string, number][] = [
    ['taste', t('review.extrasTaste'), axes.taste],
    ['speed', axisLabels?.speed ?? t('review.extrasSpeed'), axes.speed],
    ['service', axisLabels?.service ?? t('review.extrasService'), axes.service],
  ].flatMap(([key, label, v]) => (v != null ? [[key as string, label as string, v as number]] : []));
  const max = Math.max(...bars.map((b) => b[2]), 0);
  return (
    <View style={styles.summaryBox} testID="rating-summary-box">
      <View style={styles.summaryLeft}>
        <Stars value={overall.average ?? 0} size={16} />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
          <Text style={styles.bigScore}>{overall.average?.toFixed(1) ?? '—'}</Text>
          <Text style={styles.bigScoreOf}>/ 5</Text>
        </View>
        <Text style={styles.overallLbl}>{t(sameNat ? 'reviews.sameNationality' : 'reviews.overall').toUpperCase()}</Text>
      </View>
      {bars.length > 0 && (
        <View style={styles.summaryRight}>
          {bars.map(([key, label, value]) => (
            <AxisBar key={key} label={label} value={value} top={value === max} testID={`axis-${key}`} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryBox: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: radius.md, paddingVertical: 16, paddingHorizontal: 0, gap: 29 }, // A-RL-04
  summaryLeft: { flex: 1, minWidth: 96, maxWidth: 149, gap: 4, justifyContent: 'center', alignItems: 'center' }, // A-RL-04(#105 P2: minWidth 96 = Stars 16×5+gap — 320폭에서 별 넘침 방지)
  bigScore: { fontSize: 34, fontWeight: '700', color: C.ink, lineHeight: 42 },
  bigScoreOf: { fontSize: 20, fontWeight: '400', color: C.inkMute },
  overallLbl: { fontSize: 14, fontWeight: '500', color: C.ink3 },
  axisCol: { alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }, // A-RL-05(#105 3R: 넘칠 때만 축소)
  axisBadge: { width: 34, height: 20, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  axisBadgeTop: { backgroundColor: '#2F3137' },
  axisBadgeRest: { backgroundColor: C.inkDisabled },
  axisBadgeText: { fontSize: 13, fontWeight: '600', color: '#2F3137' },
  axisTrack: { width: 8, height: 46, borderRadius: radius.pill, backgroundColor: '#DCDEE3', justifyContent: 'flex-end', overflow: 'hidden' }, // A-RL-06(fill 3위 색은 C-57)
  axisFill: { width: 8, borderRadius: radius.pill },
  axisFillTop: { backgroundColor: '#2F3137' },
  axisFillRest: { backgroundColor: C.inkDisabled },
  axisLbl: { fontSize: 11, fontWeight: '500', color: C.ink3, textAlign: 'center' }, // #105 3R: 축소 시 2줄 랩 중앙
  summaryRight: { flexGrow: 1, flexShrink: 1, minWidth: 0, flexDirection: 'row', gap: 13, alignItems: 'flex-start', justifyContent: 'center' }, // P-343 2-B(#105 4R: 상단 정렬 — 트랙 46 고정이라 바닥 공유, 2줄 라벨만 아래로 확장)
});

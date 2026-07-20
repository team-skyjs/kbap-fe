/**
 * Skeleton — loading placeholders with a shimmer sweep (mockup Screen J1).
 * Shimmer runs on the UI thread via reanimated.
 */
import * as React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { color as C, radius } from '@/lib/theme';

function Shimmer({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const p = useSharedValue(0);
  React.useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [p]);
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(p.value, [0, 1], [-220, 220]) }],
  }));
  return (
    <View style={[styles.block, style]}>
      <Animated.View style={[styles.sweep, sweep]} />
    </View>
  );
}

/** Home-style loading skeleton: banner + a few list rows. */
export function SkeletonList() {
  return (
    <View style={styles.wrap}>
      <Shimmer style={styles.banner} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.card}>
          <Shimmer style={styles.thumb} />
          <View style={{ flex: 1, gap: 8 }}>
            <Shimmer style={[styles.line, { width: '70%' }]} />
            <Shimmer style={[styles.line, { width: '40%' }]} />
            <Shimmer style={[styles.line, { width: '55%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---- P-009(KB-174 후속): 탭별 스켈레톤 — 각 화면의 렌더 완료 레이아웃과 같은
 * 골격(패딩·블록 크기 미러, 시프트 0 목표). 톤·애니메이션은 Shimmer 원자 재사용,
 * 새 디자인 결정 없음. 치수는 각 화면 styles와 대응 (홈 body 18/4/20 등) —
 * 화면 레이아웃을 바꾸면 여기도 같이 갱신할 것. ---- */

/** 홈: 인사말 2줄 → 기피 배너 → 히어로 CTA → 섹션 제목 + 카드 행 2개. */
export function SkeletonHome() {
  return (
    <View style={sk.tabWrap}>
      <View style={{ gap: 7 }}>
        <Shimmer style={{ height: 26, width: '55%', borderRadius: 8 }} />
        <Shimmer style={[sk.line, { width: '75%' }]} />
      </View>
      <Shimmer style={{ height: 96, borderRadius: radius.lg }} />
      <Shimmer style={{ height: 76, borderRadius: radius.lg }} />
      <Shimmer style={{ height: 17, width: '40%', borderRadius: 7 }} />
      {[0, 1].map((i) => (
        <View key={i} style={styles.card}>
          <Shimmer style={styles.thumb} />
          <View style={{ flex: 1, gap: 8 }}>
            <Shimmer style={[sk.line, { width: '60%' }]} />
            <Shimmer style={[sk.line, { width: '35%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** 음식 탭: 2열 그리드 카드 ×6 (사진 102 + 이름/뱃지 줄) — FlatList 패딩 안에서 렌더. */
export function SkeletonFoodGrid() {
  return (
    <View style={sk.grid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={sk.gridCard}>
          <Shimmer style={{ height: 102 }} />
          <View style={{ padding: 10, gap: 7 }}>
            <Shimmer style={[sk.line, { width: '70%' }]} />
            <Shimmer style={[sk.line, { width: '45%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** 프로필: 아바타 원 56 + 닉네임 줄 → 랭킹 카드 → 섹션 제목 + 행 3개. */
export function SkeletonProfile() {
  return (
    <View style={sk.tabWrap}>
      <View style={sk.idRow}>
        <Shimmer style={{ width: 56, height: 56, borderRadius: 28 }} />
        <View style={{ flex: 1, gap: 8 }}>
          <Shimmer style={[sk.line, { width: '45%' }]} />
          <Shimmer style={[sk.line, { width: '30%' }]} />
        </View>
      </View>
      <Shimmer style={{ height: 110, borderRadius: radius.lg }} />
      <Shimmer style={{ height: 17, width: '35%', borderRadius: 7 }} />
      {[0, 1, 2].map((i) => (
        <Shimmer key={i} style={{ height: 52, borderRadius: radius.lg }} />
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  tabWrap: { paddingHorizontal: 18, paddingTop: 4, gap: 20 }, // 홈·프로필 body와 동일
  line: { height: 12, borderRadius: 6 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 13 }, // profile id 행
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  gridCard: { width: '48.5%', backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, overflow: 'hidden' },
});

const styles = StyleSheet.create({
  wrap: { padding: 18, gap: 14 },
  block: { backgroundColor: C.surface2, overflow: 'hidden' },
  sweep: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 120, backgroundColor: 'rgba(255,255,255,0.45)', opacity: 0.7 },
  banner: { height: 64, borderRadius: radius.lg },
  card: { flexDirection: 'row', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 12 },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  line: { height: 12, borderRadius: 6 },
});

export { Shimmer };
export default SkeletonList;

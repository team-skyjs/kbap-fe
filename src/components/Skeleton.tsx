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

/* ---- P-287(최종본 4003:12994~13466): 프리미티브 — 이미지 블록 #F2F3F6 r8 ·
 * 텍스트 바 #EAEBEE r4. Shimmer 스윕 유지. 치수는 발주 표 실측. ---- */
function SkImg({ w, h, r = 8 }: { w: number | `${number}%`; h: number; r?: number }) {
  return <Shimmer style={{ width: w, height: h, borderRadius: r, backgroundColor: '#F2F3F6' }} />;
}
function SkBar({ w, h = 12 }: { w: number | `${number}%`; h?: number }) {
  // Codex #47 6차: 고정폭 바가 협폭 기기(320pt) 콘텐츠 폭 초과 — 일괄 축소 허용(전 바 공통 규칙)
  return <Shimmer style={{ width: w, maxWidth: '100%', flexShrink: 1, height: h, borderRadius: 4, backgroundColor: '#EAEBEE' }} />;
}

/** P-287 홈(4003:12994): 인기 카드 2열 + RECENTLY 행 ×4 + 리뷰 블록 ×3. */
export function SkeletonHome() {
  return (
    <View style={sk287.wrap} testID="skeleton-home">
      <View style={sk287.grid2}>
        {[0, 1].map((i) => (
          <View key={i} style={{ gap: 12, flex: 1 }}>{/* A-SK-01(KB-486) */}
            <SkImg w={'100%' as const} h={118} />
            <SkBar w={96} />
            <SkBar w={72} h={10} />
            <SkBar w={40} h={10} />
          </View>
        ))}
      </View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={sk287.recentRow}>
          <SkImg w={100} h={100} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkBar w={140} h={14} />
            <SkBar w={110} />
            <SkBar w={60} />
            <SkBar w={120} />
            <SkBar w={80} />
          </View>
        </View>
      ))}
      {[0, 1, 2].map((i) => (
        <View key={i} style={sk287.reviewBlock}>
          <View style={sk287.rowGap8}>
            <Shimmer style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#EAEBEE' }} />{/* A-SK-02 */}
            <SkBar w={120} />
            <Shimmer style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#EAEBEE' }} />
          </View>
          <View style={sk287.rowGap12}>{/* A-SK-02: 평점 바 6개 */}
            <SkBar w={40} />
            <SkBar w={60} />
            <SkBar w={40} />
            <SkBar w={60} />
            <SkBar w={40} />
            <SkBar w={60} />
          </View>
          <SkBar w={220} h={14} />
          <SkBar w={280} h={14} />
          <SkBar w={240} h={14} />
          {/* Codex #47 4차: 4×104+gap = 440 > 콘텐츠 폭 — 3장 flex 균등(실사진 슬롯 최대 3장 정책 일치) */}
          <View style={sk287.rowGap8}>
            {[0, 1, 2].map((j) => (
              <Shimmer key={j} style={sk287.photoTile} />
            ))}
          </View>
          <View style={sk287.rowGap8}>
            {[0, 1, 2].map((j) => (
              <Shimmer key={j} style={{ width: 72, height: 24, borderRadius: 12, backgroundColor: '#EAEBEE' }} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** P-287 음식 상세(4003:13466): 안전 행 + 히어로 텍스트 + 탭 칩 + 재료 타일 3열 + 리뷰 블록. */
export function SkeletonFoodDetail() {
  return (
    <View testID="skeleton-food-detail">
      {/* Codex #47 7차: 히어로 정방(폭=화면 1:1) 자리 — 로드 시 레이아웃 점프 0 */}
      <Shimmer style={sk287.hero} />
      <View style={sk287.safeRow}>
        <SkImg w={26} h={26} r={6} />
        <View style={{ gap: 6 }}>
          <SkBar w={120} h={10} />
          <SkBar w={180} h={8} />
        </View>
      </View>
      <View style={[sk287.wrap, { paddingTop: 20 }]}>
        <View style={sk287.rowBetween}>
          <View style={{ gap: 8, flex: 1 }}>
            <View style={sk287.rowGap8}>
              <SkBar w={44} h={10} />
              {[0, 1, 2, 3, 4].map((i) => (
                <SkImg key={i} w={12} h={12} r={6} />
              ))}
            </View>
            <SkBar w={160} h={18} />
            <SkBar w={110} />
            <SkBar w={260} />
            <SkBar w={220} />
          </View>
          <SkImg w={36} h={36} />
        </View>
        <View style={sk287.rowGap8}>
          {[0, 1, 2, 3].map((i) => (
            <SkImg key={i} w={44} h={24} r={12} />
          ))}
        </View>
        {/* Codex #47 5차: 3×106+gap=332 > 360pt 기기 폭 — flex 균등(홈 리뷰 사진과 동일 문법) */}
        <View style={sk287.tileGrid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <View key={i} style={sk287.tileCell}>
              <Shimmer style={sk287.tileFill} />
            </View>
          ))}
        </View>
        {[0, 1, 2].map((i) => (
          <SkImg key={i} w={'100%' as const} h={290} />
        ))}
      </View>
    </View>
  );
}

/** P-287 스캔 결과(4003:13135): 행 ×4 h150 — 썸 118 + 바 5개. */
export function SkeletonScanResults() {
  return (
    <View style={sk287.wrap} testID="skeleton-scan-results">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={sk287.recentRow}>
          <SkImg w={118} h={118} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkBar w={140} h={14} />
            <SkBar w={110} />
            <SkBar w={60} />
            <SkBar w={120} />
            <SkBar w={80} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** P-287 내 리뷰(4003:12753): 카드 — 아바타 32 + 별 + 본문 3줄 + 사진 4장. */
export function SkeletonMyReviews() {
  return (
    <View style={sk287.wrap} testID="skeleton-my-reviews">
      {[0, 1, 2].map((i) => (
        <View key={i} style={sk287.myRevCard}>{/* A-SK-04(KB-486): 카드 r8 stroke #EAEBEE pad 16 gap 12 */}
          <View style={sk287.rowGap8}>
            <Shimmer style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#EAEBEE' }} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkBar w={120} h={10} />
              <SkBar w={80} h={10} />
            </View>
          </View>
          <View style={sk287.rowGap8}>
            <SkBar w={32} h={10} />
            {[0, 1, 2, 3].map((j) => (
              <SkImg key={j} w={12} h={12} r={4} />
            ))}
          </View>
          {[0, 1, 2].map((j) => (
            <SkBar key={j} w={303} h={10} />
          ))}
          <View style={sk287.rowGap8}>
            {[0, 1, 2, 3].map((j) => (
              <SkImg key={j} w={64} h={64} />
            ))}
          </View>
          <View style={sk287.rowGap6}>
            {[0, 1, 2, 3].map((j) => (
              <SkImg key={j} w={44} h={24} r={12} />
            ))}
          </View>
          <SkBar w={140} h={10} />
        </View>
      ))}
    </View>
  );
}

/** P-287 마이 푸드 목록(4003:12851): 카드 ×4 h102(하단 line). */
export function SkeletonMyFoods() {
  return (
    <View testID="skeleton-my-foods">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={sk287.myFoodsRow}>
          <SkImg w={70} h={70} />
          <View style={{ flex: 1, gap: 5 }}>{/* A-SK-05 */}
            <SkBar w={140} h={14} />
            <SkBar w={120} h={10} />
            <View style={sk287.rowGap6}>
              <SkBar w={70} h={10} />
              <SkBar w={60} h={10} />
            </View>
          </View>
          <SkImg w={16} h={16} r={4} />
        </View>
      ))}
    </View>
  );
}

/** P-287 주문 상세(4003:12906): 영수증 행 + dish-item. */
export function SkeletonOrderDetail() {
  return (
    <View style={sk287.wrap} testID="skeleton-order-detail">
      <SkImg w={'100%' as const} h={160} />
      <View style={{ gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={sk287.rowBetween}>
            <SkBar w={60} h={10} />
            <SkBar w={120} />
          </View>
        ))}
      </View>
      {/* A-SK-06(KB-486): dish 카드 골격 미러 — 보더 r8 pad 12·썸 58 r8·바 110x14/90x10 gap 2·우 가로 gap 3 */}
      {[0, 1, 2].map((i) => (
        <View key={i} style={sk287.orderDish}>
          <SkImg w={58} h={58} r={8} />
          <View style={{ flex: 1, gap: 2 }}>
            <SkBar w={110} h={14} />
            <SkBar w={90} h={10} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <SkBar w={24} h={10} />
            <SkBar w={44} h={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

const sk287 = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  grid2: { flexDirection: 'row', gap: 16 },
  recentRow: { flexDirection: 'row', gap: 16, paddingVertical: 8 },
  reviewBlock: { gap: 12, paddingVertical: 14 }, // A-SK-02: 블록 간 44(14+16+14)
  rowGap6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  myRevCard: { borderRadius: 8, borderWidth: 1, borderColor: '#EAEBEE', padding: 16, gap: 12 }, // A-SK-04
  orderDish: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EAEBEE', padding: 12 }, // A-SK-06
  rowGap8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowGap12: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  // Codex #47 3차: 로드 전 safe 틴트 = false-safe(헌법 III) — 중립 회색, verdict 도착 후에만 틴트
  safeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, backgroundColor: '#F2F3F6', paddingHorizontal: 20 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tileCell: { flexBasis: '31%', flexGrow: 1 },
  tileFill: { width: '100%', aspectRatio: 106 / 130, borderRadius: 8, backgroundColor: '#F2F3F6' },
  photoTile: { flex: 1, aspectRatio: 1, borderRadius: 8, backgroundColor: '#F2F3F6' },
  hero: { width: '100%', aspectRatio: 1, backgroundColor: '#F2F3F6' },
  myFoodsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 102, paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#EAEBEE' }, // A-SK-05
});

/** 음식 탭: 2열 그리드 카드 ×6 (사진 102 + 이름/뱃지 줄) — FlatList 패딩 안에서 렌더. */
export function SkeletonFoodGrid() {
  return (
    <View style={sk.grid}>
      {/* A-SK-03(KB-486): 카드 프레임(흰·보더·r10) 제거 — 이미지 118 r8 + 바 3개 */}
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[sk.gridCard, { gap: 12 }]}>
          <SkImg w={'100%' as const} h={118} />
          <View style={{ gap: 6 }}>
            <SkBar w={96} h={12} />
            <SkBar w={72} h={10} />
            <SkBar w={40} h={10} />
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
  gridCard: { width: '48.5%' }, // A-SK-03: 프레임 소멸
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

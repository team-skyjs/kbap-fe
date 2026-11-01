/**
 * Food tab — P-318(KB-484) v2: 찾는 카탈로그(세로 그리드 + 필터·정렬).
 * 정본: specs/001-personalized-menu-mvp/home-food-tabs-v2.md.
 * KB-812: 상단 Dishes | Packaged 세그먼트(R-95) — Dishes = 기존 카탈로그 그대로, Packaged = 가공식품 검색.
 * (Dishes 안은 세그먼트 없음 — 칩(위험 4 + Saved 토글) + 정렬 드롭다운, 홈 "See all"의
 * segment·risk 파라미터를 초기 적용(미지값은 parseFoodFilterParams가 강등).
 * 구 greeting·categoryUI(플래그 false 표면)·BrowseCard 소멸 — 데이터 훅·
 * 북마크 토글·위험 필터 로직은 FoodExplorer가 소유(홈 구현 이동, 무변).
 */
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StickyHeader, useStickyScroll, useHeaderHeight } from '@/components';
import { color as C } from '@/lib/theme';
import { FLAGS } from '@/lib/flags';
import { useIsGuest } from '@/lib/auth/useSession';
import { useUnreadCount } from '@/lib/data/useNotifications';
import { FoodExplorer } from '@/features/food/FoodExplorer';
import { parseFoodFilterParams, defaultFoodSegment } from '@/features/food/foodFilterParams';
import { FoodSegmentRow, PackagedExplorer, type FoodSegment } from '@/features/processedFood/PackagedExplorer';
import { useState } from 'react';

// KB-812: 세그먼트 선택 유지(앱 세션 동안 — 탭 화면이 다시 마운트돼도).
// KB-957(예진 11/2): 첫 진입 기본 = Packaged(운영 채널 = 가공식품 없음 → Dishes). 홈 See all(t·view)·딥링크 우선순위는 아래 전이 그대로
let lastSegment: FoodSegment = defaultFoodSegment(FLAGS.processedFoodEnabled);
const rememberSegment = (s: FoodSegment) => { lastSegment = s; };

export default function Food() {
  const router = useRouter();
  const { onScroll, hidden, atTop } = useStickyScroll();
  const headerH = useHeaderHeight();
  const isGuest = useIsGuest();
  const unread = useUnreadCount();
  // P-318: 홈 See all 파라미터 수신 — 배열형(중복 쿼리)은 첫 값, 미지값은 파서가 강등
  const raw = useLocalSearchParams<{ segment?: string | string[]; risk?: string | string[]; t?: string | string[] }>();
  const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  const { segment, risk } = parseFoodFilterParams({ segment: one(raw.segment), risk: one(raw.risk) });
  const [foodSegment, setFoodSegmentState] = useState<FoodSegment>(() => lastSegment);
  const setFoodSegment = (s: FoodSegment) => { rememberSegment(s); setFoodSegmentState(s); };
  // Codex #308 P2: 홈 "See all"(새 t 파라미터) = 요리 카탈로그 요청 — Packaged에 있었어도 Dishes로(렌더 중 전이 비교, KB-603)
  const seeAllKey = one(raw.t) ?? '';
  const [prevSeeAll, setPrevSeeAll] = useState(seeAllKey);
  if (seeAllKey !== prevSeeAll) {
    setPrevSeeAll(seeAllKey);
    if (seeAllKey) { rememberSegment('dishes'); setFoodSegmentState('dishes'); }
  }
  // KB-870: 운영 채널(운영 서버에 가공식품 API 없음) = 세그먼트째 없음 → Dishes 고정(main과 같은 화면)
  // KB-957: Dishes | Packaged = 헤더 로고 줄 안(별도 세그먼트 줄 소멸)
  const segRow = FLAGS.processedFoodEnabled ? <FoodSegmentRow value={foodSegment} onChange={setFoodSegment} /> : null;

  return (
    <View style={styles.root}>
      {segRow && foodSegment === 'packaged' ? (
        <PackagedExplorer top={null} topPad={headerH} onScroll={onScroll} />
      ) : (
      <FoodExplorer
        variant="screen"
        guest={isGuest}
        initialSaved={segment === 'saved'}
        paramsKey={one(raw.t) ?? ''}
        initialRisk={risk}
        srcTag="list"
        onScroll={onScroll}
        topPad={headerH}
      />
      )}
      <StickyHeader
        center={segRow}
        hidden={hidden}
        atTop={atTop}
        mode="brand"
        bell={FLAGS.notificationCenter}
        bellCount={unread}
        onBell={() => router.push('/notifications' as Href)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
});

/**
 * Food tab — P-318(KB-484) v2: 찾는 카탈로그(세로 그리드 + 필터·정렬).
 * 정본: specs/001-personalized-menu-mvp/home-food-tabs-v2.md.
 * 세그먼트 없음 — 칩(위험 4 + Saved 토글) + 정렬 드롭다운, 홈 "See all"의
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
import { useUnreadCount } from '@/lib/notifications/inbox';
import { FoodExplorer } from '@/features/food/FoodExplorer';
import { parseFoodFilterParams } from '@/features/food/foodFilterParams';

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

  return (
    <View style={styles.root}>
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
      <StickyHeader
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

/**
 * Food tab — KB-430 후속(9/5 예진): 홈 음식 캐러셀 블록(FoodExplorer) 재사용.
 * 차이: 기본 활성 탭 = Explore food · 그리드 무한 스크롤(4장 제한 없음) ·
 * AppBar 동일(로고+벨) · 하단 Recently scanned/Reviews 섹션 없음.
 * 구 greeting·categoryUI(플래그 false 표면)·BrowseCard 소멸 — 데이터 훅·
 * 북마크 토글·위험 필터 로직은 FoodExplorer가 소유(홈 구현 이동, 무변).
 */
import { View, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { StickyHeader, useStickyScroll, useHeaderHeight } from '@/components';
import { color as C } from '@/lib/theme';
import { FLAGS } from '@/lib/flags';
import { useIsGuest } from '@/lib/auth/useSession';
import { useUnreadCount } from '@/lib/notifications/inbox';
import { FoodExplorer } from '@/features/food/FoodExplorer';

export default function Food() {
  const router = useRouter();
  const { onScroll, hidden } = useStickyScroll();
  const headerH = useHeaderHeight();
  const isGuest = useIsGuest();
  const unread = useUnreadCount();

  return (
    <View style={styles.root}>
      <FoodExplorer
        variant="screen"
        guest={isGuest}
        initialTab="food"
        srcTag="list"
        onScroll={onScroll}
        topPad={headerH}
      />
      <StickyHeader
        hidden={hidden}
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

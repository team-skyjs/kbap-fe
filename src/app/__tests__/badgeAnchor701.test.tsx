/* eslint-disable @typescript-eslint/no-require-imports, import/first -- jest.mock 팩토리 안 require · 목 등록 뒤 import(homeFeed317 하네스) */
/**
 * KB-701 · Codex #229 — 홈 불꽃 뱃지 앵커 = **실제 렌더된 검색 줄(스캔 버튼) 바로 아래**.
 * top = 헤더 높이 + FoodExplorer 래퍼 y(위의 업데이트 넛지 유무로 바뀜) + 검색 줄 아래 끝 + BADGE_GAP. 측정 전엔 null(미표시).
 * (옛 고정 오프셋 headerH + 64는 넛지가 뜨면 스캔 버튼과 겹쳤고, 넛지 없이도 실제 검색 줄 paddingTop 0이라 간격이 16이었다.)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
  };
});
jest.mock('@/features/community/moderation', () => ({ ModerationFlow: () => null })); // P-339 ②: 홈 신고 플로우 표면 목
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  usePathname: () => '/',
  useFocusEffect: () => {},
  Redirect: () => null,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
// 피드 유닛 표적 격리 — 홈의 다른 표면은 마커/무시
const mockExplorer = jest.fn((_p: { onScanRowBottom?: (y: number) => void }) => null);
jest.mock('@/features/food/FoodExplorer', () => ({ FoodExplorer: (p: { onScanRowBottom?: (y: number) => void }) => mockExplorer(p) }));
const mockBadge = jest.fn((_p: { top: number | null }) => null);
jest.mock('@/features/scan/HomeQuotaBadge', () => ({ ...jest.requireActual('@/features/scan/HomeQuotaBadge'), HomeQuotaBadge: (p: { top: number | null }) => mockBadge(p) }));
jest.mock('@/features/review/FeedCard', () => {
  const { View } = require('react-native');
  return { FeedCard: ({ review }: { review: { id: string } }) => <View testID={`feed-${review.id}`} /> };
});
jest.mock('@/lib/data/useHome', () => ({
  useHome: () => ({ isLoading: false, isError: false, error: null, refetch: jest.fn(), data: { authenticated: true, recent: [] } }),
}));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '1', restrictions: [] } }) }));
jest.mock('@/lib/data/useNotifications', () => ({ useUnreadCount: () => 0 }));
const mockFeed = jest.fn();
jest.mock('@/lib/data/useFoodReviews', () => ({ useGlobalReviews: () => mockFeed() }));
mockFeed.mockReturnValue({ data: { pages: [] }, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });

import Home from '../(tabs)/index';
import { headerHeight } from '@/components/StickyHeader';
import { BADGE_GAP } from '@/features/scan/HomeQuotaBadge';

const lastTop = () => mockBadge.mock.calls[mockBadge.mock.calls.length - 1][0].top;
/** FoodExplorer를 감싼 래퍼 = FoodExplorer 목의 **바로 위** View(FlatList 셀 래퍼 등 바깥 onLayout View와 구분) */
const explorerWrap = (t: ReactTestRenderer) => {
  const fe = t.root.findAll((n) => n.props?.onScanRowBottom != null && typeof n.type === 'function')[0];
  const parent = fe.parent!;
  expect(typeof parent.props.onLayout).toBe('function');
  return parent;
};
const layout = (y: number) => ({ nativeEvent: { layout: { x: 0, y, width: 390, height: 300 } } });

it('측정 전 = top null(뱃지 미표시) → 래퍼 y·검색 줄 아래 끝을 재면 헤더 + y + 아래 끝 + 4', () => {
  let t!: ReactTestRenderer;
  act(() => {
    t = renderer.create(<Home />);
  });
  expect(lastTop()).toBeNull();
  act(() => explorerWrap(t).props.onLayout(layout(0))); // 넛지 없음 — FoodExplorer가 헤더 컴포넌트 맨 위
  expect(lastTop()).toBeNull(); // 아직 검색 줄 미측정
  act(() => mockExplorer.mock.calls[mockExplorer.mock.calls.length - 1][0].onScanRowBottom!(48)); // 검색 줄 paddingTop 0 + 48
  expect(BADGE_GAP).toBe(4);
  expect(lastTop()).toBe(headerHeight(0) + 0 + 48 + 4);
  act(() => t.unmount());
});

it('업데이트 넛지가 뜨면(FoodExplorer가 40 내려감) 뱃지도 같이 내려간다 — 스캔 버튼과 겹침 0', () => {
  let t!: ReactTestRenderer;
  act(() => {
    t = renderer.create(<Home />);
  });
  act(() => mockExplorer.mock.calls[mockExplorer.mock.calls.length - 1][0].onScanRowBottom!(48));
  act(() => explorerWrap(t).props.onLayout(layout(40)));
  const scanBottom = headerHeight(0) + 40 + 48;
  expect(lastTop()).toBe(scanBottom + 4);
  act(() => explorerWrap(t).props.onLayout(layout(0))); // 넛지 닫힘
  expect(lastTop()).toBe(headerHeight(0) + 48 + 4);
  act(() => t.unmount());
});

it('죽은 홈 검색 줄 스타일 제거 — 실제 검색 줄은 FoodExplorer 하나(위치 근거가 둘로 갈리지 않게)', () => {
  const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;
  expect(read('src/app/(tabs)/index.tsx')).not.toMatch(/searchRow|scanBtn/);
  const fe = read('src/features/food/FoodExplorer.tsx');
  expect(fe).toMatch(/style=\{styles\.searchRow\}\s*onLayout=\{onScanRowBottom/);
  expect(fe).toContain("searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 0 }");
  expect(fe).toMatch(/searchBox: \{\s*flex: 1,\s*height: 48,/); // 줄 높이 = 스캔 버튼 48(세로 가운데) → 줄 아래 끝 = 버튼 아래 끝
  expect(fe).toMatch(/scanBtn: \{ width: 48, height: 48,/);
});

/**
 * P-317(KB-483) 홈 v2 — 무한 스크롤 리뷰 피드 유닛.
 * ① 페이지 병합 = 경계 중복 0(같은 id는 1회만 렌더 — keyExtractor 충돌 방지)
 * ② onEndReached → fetchNextPage(hasNextPage && !isFetchingNextPage 가드)
 * ③ 다음 페이지 로딩 = 하단 스켈레톤(home-feed-skel) 노출.
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
jest.mock('@/features/food/FoodExplorer', () => ({ FoodExplorer: () => null }));
jest.mock('@/features/review/FeedCard', () => {
  const { View } = require('react-native');
  return { FeedCard: ({ review }: { review: { id: string } }) => <View testID={`feed-${review.id}`} /> };
});
jest.mock('@/lib/data/useHome', () => ({
  useHome: () => ({ isLoading: false, isError: false, error: null, refetch: jest.fn(), data: { authenticated: true, recent: [] } }),
}));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '1', restrictions: [] } }) }));
jest.mock('@/lib/notifications/inbox', () => ({ useUnreadCount: () => 0 }));
const mockFeed = jest.fn();
jest.mock('@/lib/data/useFoodReviews', () => ({ useGlobalReviews: () => mockFeed() }));

import Home from '../(tabs)/index';

const rv = (id: string) => ({ id, foodId: 'f1' });
const mockFetchNext = jest.fn();
const feedOf = (pages: { items: ReturnType<typeof rv>[] }[], over: Record<string, unknown> = {}) => ({
  data: { pages },
  hasNextPage: true,
  isFetchingNextPage: false,
  fetchNextPage: mockFetchNext,
  ...over,
});

const trees: ReactTestRenderer[] = [];
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeEach(() => jest.clearAllMocks());

const cardCount = (tree: ReactTestRenderer, id: string) =>
  tree.root.findAll((n) => n.props?.testID === `feed-${id}` && n.type === 'View').length;

it('① 페이지 병합 — 경계 중복(b)은 1회만 렌더, 전 페이지 항목 전부 노출', () => {
  mockFeed.mockReturnValue(feedOf([{ items: [rv('a'), rv('b')] }, { items: [rv('b'), rv('c')] }]));
  const tree = render(<Home />);
  expect(cardCount(tree, 'a')).toBe(1);
  expect(cardCount(tree, 'b')).toBe(1); // 커서 경계 중복 제거
  expect(cardCount(tree, 'c')).toBe(1);
});

it('② onEndReached → fetchNextPage — isFetchingNextPage·hasNextPage 가드', () => {
  mockFeed.mockReturnValue(feedOf([{ items: [rv('a')] }]));
  const tree = render(<Home />);
  const list = tree.root.findAll((n) => n.props?.testID === 'home-list' && typeof n.props?.onEndReached === 'function')[0];
  act(() => list.props.onEndReached({ distanceFromEnd: 0 }));
  expect(mockFetchNext).toHaveBeenCalledTimes(1);
  // 로딩 중·마지막 페이지엔 미호출
  for (const over of [{ isFetchingNextPage: true }, { hasNextPage: false }]) {
    mockFetchNext.mockClear();
    mockFeed.mockReturnValue(feedOf([{ items: [rv('a')] }], over));
    const t2 = render(<Home />);
    const l2 = t2.root.findAll((n) => n.props?.testID === 'home-list' && typeof n.props?.onEndReached === 'function')[0];
    act(() => l2.props.onEndReached({ distanceFromEnd: 0 }));
    expect(mockFetchNext).not.toHaveBeenCalled();
  }
});

it('③ 다음 페이지 로딩 — 하단 스켈레톤 노출(공백 금지, P-188 계열)', () => {
  mockFeed.mockReturnValue(feedOf([{ items: [rv('a')] }], { isFetchingNextPage: true }));
  expect(render(<Home />).root.findAll((n) => n.props?.testID === 'home-feed-skel').length).toBeGreaterThanOrEqual(1);
  mockFeed.mockReturnValue(feedOf([{ items: [rv('a')] }]));
  expect(render(<Home />).root.findAll((n) => n.props?.testID === 'home-feed-skel')).toHaveLength(0);
});

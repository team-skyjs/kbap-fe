/** KB-777 B3-5: 저장 목록 헤더 개수 = 지금 보이는(칩 필터 적용) 개수 — Avoid 2개인데 "11 dishes"이던 것. */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c ?? Pressable },
    createAnimatedComponent: (c: unknown) => c,
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    useAnimatedScrollHandler: () => () => {},
    useAnimatedProps: () => ({}),
    useReducedMotion: () => false,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: { count?: number }) => (o?.count != null ? `${k}:${o.count}` : k), i18n: { language: 'en' } }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('@/lib/analytics', () => ({ EVENTS: new Proxy({}, { get: (_t, k) => String(k) }), track: jest.fn() }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { restrictions: [{ kind: 'allergy', code: 'EGG' }] } }) }));
const food = (id: string, risk: string) => ({ foodId: id, name: `Food ${id}`, nameKo: `음식 ${id}`, photoUrl: null, risk });
const mockList = [food('1', 'danger'), food('2', 'danger'), ...['3', '4', '5', '6', '7', '8', '9', '10', '11'].map((i) => food(i, 'safe'))];
jest.mock('@/lib/data/bookmarks', () => ({
  useBookmarks: () => ({ data: mockList, isLoading: false, isError: false, error: null, refetch: jest.fn(), fetchNextPage: jest.fn(), hasNextPage: false, isFetchingNextPage: false }),
  useRemoveBookmark: () => ({ mutate: jest.fn() }),
  useRestoreBookmark: () => ({ mutate: jest.fn() }),
  useSavedIds: () => ({ ids: new Set<string>(), ready: true }),
}));
jest.mock('@/features/food/FoodCards', () => ({
  FoodGridCard: () => null,
  padOddGrid: (a: unknown[]) => a,
  isGridPad: () => false,
}));

// eslint-disable-next-line import/first -- jest.mock 뒤
import Saved from '../profile/saved';

it('KB-777 B3-5: 전체 = 11 · Avoid 칩 = 2 · 다시 전체 = 11 (헤더 개수 = 보이는 개수)', () => {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Saved />); });
  const count = () => tree.root.findAll((n) => n.props?.testID === 'saved-count' && typeof n.type === 'string')[0].props.children;
  expect(count()).toBe('saved.count:11');
  act(() => tree.root.findAll((n) => n.props?.testID === 'saved-chip-danger' && typeof n.props?.onPress === 'function')[0].props.onPress());
  expect(count()).toBe('saved.count:2');
  act(() => tree.root.findAll((n) => n.props?.testID === 'saved-chip-all' && typeof n.props?.onPress === 'function')[0].props.onPress());
  expect(count()).toBe('saved.count:11');
  act(() => tree.unmount());
});

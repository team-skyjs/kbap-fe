/**
 * KB-729 홈 트리거 — 설문 시트는 서버 surveyCompleted===false인 회원에게만(게스트·구서버 null·true·온보딩 미완 = 없음).
 * 시트 자체는 features/survey 유닛 — 여기선 open prop 배선만(마커 목).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = jest.requireActual<typeof import('react-native')>('react-native');
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
jest.mock('@/features/community/moderation', () => ({ ModerationFlow: () => null }));
jest.mock('expo-image', () => { const { View } = jest.requireActual<typeof import('react-native')>('react-native'); return { Image: View }; });
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  usePathname: () => '/',
  useFocusEffect: () => {},
  Redirect: () => null,
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/features/food/FoodExplorer', () => ({ FoodExplorer: () => null }));
jest.mock('@/features/review/FeedCard', () => ({ FeedCard: () => null }));
jest.mock('@/lib/data/useHome', () => ({
  useHome: () => ({ isLoading: false, isError: false, error: null, refetch: jest.fn(), data: { authenticated: true, recent: [] } }),
}));
const mockMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: mockMe() }) }));
jest.mock('@/lib/data/useNotifications', () => ({ useUnreadCount: () => 0 }));
jest.mock('@/lib/data/useFoodReviews', () => ({ useGlobalReviews: () => ({ data: { pages: [] }, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() }) }));
const mockSheet = jest.fn();
jest.mock('@/features/survey/ProfileSurveySheet', () => ({ ProfileSurveySheet: (p: { open: boolean }) => { mockSheet(p.open); return null; } }));

/* eslint-disable import/first -- jest.mock 뒤 */
import Home from '../(tabs)/index';
/* eslint-enable import/first */

const trees: ReactTestRenderer[] = [];
const render = (me: Record<string, unknown>) => {
  mockMe.mockReturnValue(me);
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<Home />); });
  trees.push(t);
  return mockSheet.mock.calls.at(-1)?.[0];
};
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeEach(() => jest.clearAllMocks());

it('surveyCompleted=false 회원 = 시트 open · true = 닫힘 · 게스트(필드 없음) = 닫힘 · 구서버(null) = 닫힘 · 온보딩 미완 = 닫힘', () => {
  expect(render({ id: '1', restrictions: [], surveyCompleted: false, onboardingCompleted: true })).toBe(true);
  expect(render({ id: '1', restrictions: [], surveyCompleted: true, onboardingCompleted: true })).toBe(false);
  expect(render({ id: 'u_001', restrictions: [] })).toBe(false);
  expect(render({ id: '1', restrictions: [], surveyCompleted: null })).toBe(false);
  expect(render({ id: '1', restrictions: [], surveyCompleted: false, onboardingCompleted: false })).toBe(false);
});

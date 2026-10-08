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
let mockFocused = true;
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  usePathname: () => '/',
  // 포커스면 마운트 시 콜백 실행(블러 = 미실행) — 홈이 포커스일 때만 시트(/review 4)
  useFocusEffect: (cb: () => void | (() => void)) => { const R = jest.requireActual<typeof import('react')>('react'); R.useEffect(() => (mockFocused ? cb() : undefined), []); },
  Redirect: () => null,
}));
const mockGate = jest.fn(() => ({ mode: 'pass' }));
jest.mock('@/lib/versionGate', () => ({ ...jest.requireActual('@/lib/versionGate'), useVersionGate: () => mockGate() }));
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
let mockResolveSplash: () => void = () => {};
jest.mock('@/lib/bootGate', () => ({ ...jest.requireActual('@/lib/bootGate'), whenSplashDone: () => new Promise<void>((r) => { mockResolveSplash = r; }) }));
const mockSheet = jest.fn();
jest.mock('@/features/survey/ProfileSurveySheet', () => ({ ProfileSurveySheet: (p: { open: boolean; memberId?: string }) => { mockSheet(p.open, p.memberId); return null; } }));

/* eslint-disable import/first -- jest.mock 뒤 */
import Home from '../(tabs)/index';
import { _resetSurveyHiddenForTest, hideSurveyThisRun } from '@/lib/survey/surveySession';
/* eslint-enable import/first */

const trees: ReactTestRenderer[] = [];
const mount = (me: Record<string, unknown>) => {
  mockMe.mockReturnValue(me);
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<Home />); });
  trees.push(t);
  return t;
};
const lastOpen = () => mockSheet.mock.calls.at(-1)?.[0];
const splash = async () => { await act(async () => { mockResolveSplash(); await Promise.resolve(); }); };
const render = async (me: Record<string, unknown>) => { mount(me); await splash(); return lastOpen(); };
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeEach(() => { jest.clearAllMocks(); _resetSurveyHiddenForTest(); mockFocused = true; mockGate.mockReturnValue({ mode: 'pass' }); });

it('surveyCompleted=false 회원 = 시트 open · true = 닫힘 · 게스트(필드 없음) = 닫힘 · 구서버(null) = 닫힘 · 온보딩 미완 = 닫힘', async () => {
  expect(await render({ id: '1', restrictions: [], surveyCompleted: false, onboardingCompleted: true })).toBe(true);
  expect(await render({ id: '1', restrictions: [], surveyCompleted: true, onboardingCompleted: true })).toBe(false);
  expect(await render({ id: 'u_001', restrictions: [] })).toBe(false);
  expect(await render({ id: '1', restrictions: [], surveyCompleted: null })).toBe(false);
  expect(await render({ id: '1', restrictions: [], surveyCompleted: false, onboardingCompleted: false })).toBe(false);
});

it('콜드 스타트: 스플래시가 걷히기 전엔 open=false(별도 창 Modal이 스플래시 위에 뜨는 것 방지) → 걷힌 뒤 true', async () => {
  mount({ id: '1', restrictions: [], surveyCompleted: false, onboardingCompleted: true });
  expect(lastOpen()).toBe(false);
  await splash();
  expect(lastOpen()).toBe(true);
});

it('"나중에"(이번 실행 숨김) = open=false · 리셋(재시작)이면 다시 true', async () => {
  const me = { id: '1', restrictions: [], surveyCompleted: false, onboardingCompleted: true };
  expect(await render(me)).toBe(true);
  act(() => hideSurveyThisRun());
  expect(lastOpen()).toBe(false);
  _resetSurveyHiddenForTest();
  expect(await render(me)).toBe(true);
});

it('강제 업데이트 게이트(blocked) = open=false(Modal이 게이트 View를 덮지 않게) · nudge/pass = true', async () => {
  const me = { id: '1', restrictions: [], surveyCompleted: false, onboardingCompleted: true };
  mockGate.mockReturnValue({ mode: 'blocked', storeUrl: null } as never);
  expect(await render(me)).toBe(false);
  mockGate.mockReturnValue({ mode: 'nudge', latestVersion: '9.9.9', storeUrl: null } as never);
  expect(await render(me)).toBe(true);
});

it('홈이 포커스가 아니면(딥링크·푸시 콜드 스타트로 다른 화면이 위) open=false · memberId 전달', async () => {
  const me = { id: '42', restrictions: [], surveyCompleted: false, onboardingCompleted: true };
  mockFocused = false;
  expect(await render(me)).toBe(false);
  mockFocused = true;
  expect(await render(me)).toBe(true);
  expect(mockSheet.mock.calls.at(-1)?.[1]).toBe('42');
});

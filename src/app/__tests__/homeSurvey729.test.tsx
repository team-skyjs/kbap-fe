/**
 * KB-729 홈 트리거 — 설문 시트는 서버 surveyCompleted===false인 회원에게만(게스트·구서버 null·true·온보딩 미완 = 없음).
 * 시트 자체는 features/survey 유닛 — 여기선 open prop 배선만(마커 목).
 * KB-733: 홈의 일회성 모달 큐 스텝(useProfileSurveyStep) — 포커스에 등록·블러에 취소, 스플래시·me 판정 가능까지 기다린 뒤 판정.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
let mockBlur: () => void = () => {};
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  usePathname: () => '/',
  // 포커스면 마운트 시 콜백 실행(블러 = 미실행) + 정리 함수를 mockBlur로 노출(블러 시뮬) — KB-733 큐 등록/취소 수명
  useFocusEffect: (cb: () => void | (() => void)) => {
    const R = jest.requireActual<typeof import('react')>('react');
    R.useEffect(() => { if (!mockFocused) return undefined; const c = cb(); mockBlur = () => { c?.(); }; return c; }, []);
  },
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
// members/me: 렌더(useMe)와 판정(fetchMe — 큐 스텝이 ensureQueryData로 읽음) 둘 다 mockMe
const mockMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: mockMe() }), fetchMe: async () => mockMe() }));
jest.mock('@/lib/i18n/useAppLanguage', () => ({ useAppLanguage: () => 'en' }));
// 스텝이 쓰는 싱글턴 queryClient = 이 테스트의 mockQc(테스트마다 새 인스턴스)
jest.mock('@/lib/queryClient', () => ({ get queryClient() { return mockQc; } }));
jest.mock('@/lib/data/useNotifications', () => ({ useUnreadCount: () => 0 }));
jest.mock('@/lib/data/useFoodReviews', () => ({ useGlobalReviews: () => ({ data: { pages: [] }, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() }) }));
let mockResolveSplash: () => void = () => {};
jest.mock('@/lib/bootGate', () => ({ ...jest.requireActual('@/lib/bootGate'), whenSplashDone: () => new Promise<void>((r) => { mockResolveSplash = r; }) }));
const mockSheet = jest.fn();
jest.mock('@/features/survey/ProfileSurveyScreen', () => ({ ProfileSurveyScreen: (p: { open: boolean; memberId?: string; onClosed?: () => void }) => { mockSheet(p.open, p.memberId, p.onClosed); return null; } }));

/* eslint-disable import/first -- jest.mock 뒤 */
import Home from '../(tabs)/index';
import { _resetSurveyHiddenForTest, hideSurveyThisRun } from '@/lib/survey/surveySession';
/* eslint-enable import/first */

let mockQc: QueryClient;
const wrap = () => <QueryClientProvider client={mockQc}><Home /></QueryClientProvider>;
const trees: ReactTestRenderer[] = [];
const mount = (me: Record<string, unknown>) => {
  mockMe.mockReturnValue(me);
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(wrap()); });
  trees.push(t);
  return t;
};
const lastOpen = () => mockSheet.mock.calls.at(-1)?.[0];
// 한 act 안에서 마이크로태스크를 비운다 — 스플래시 resolve → Promise.all 연속 → setTurn이 act 밖에 떨어지면 경고
const drain = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const splash = async () => { await act(async () => { mockResolveSplash(); await drain(); }); };
const render = async (me: Record<string, unknown>) => { mount(me); await splash(); return lastOpen(); };
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeEach(() => { jest.clearAllMocks(); _resetSurveyHiddenForTest(); mockFocused = true; mockBlur = () => {}; mockGate.mockReturnValue({ mode: 'pass' }); mockQc = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });

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
  act(() => _resetSurveyHiddenForTest()); // 마운트된 트리에 알림 → act 안에서
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

it('KB-733: 스텝이 기다리는 동안(스플래시 전) 블러되면 — 걷혀도 open=false(대상 화면 → 시트 순서) · 다시 포커스(재마운트) = true', async () => {
  const me = { id: '1', restrictions: [], surveyCompleted: false, onboardingCompleted: true };
  mount(me);
  act(() => mockBlur()); // 딥링크·푸시 콜드 스타트 = 대상 화면이 위로
  await splash();
  expect(lastOpen()).toBe(false);
  expect(await render(me)).toBe(true);
});

it('KB-733: 콜드 스타트 — 포커스가 members/me보다 먼저여도 판정은 ensureQueryData(캐시/재조회)로 → 렌더 me가 아직 undefined여도 true', async () => {
  const me = { id: '1', restrictions: [], surveyCompleted: false, onboardingCompleted: true };
  mockMe.mockReturnValueOnce(undefined).mockReturnValue(me); // 첫 렌더만 undefined, fetchMe·이후 렌더는 회원
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(wrap()); });
  trees.push(t);
  await splash();
  expect(lastOpen()).toBe(true);
});

it('KB-733: 큐 — 제출로 닫혀 onClosed가 오면 차례 반납(open=false 유지) · 같은 포커스에서 다시 뜨지 않는다', async () => {
  const me = { id: '1', restrictions: [], surveyCompleted: false, onboardingCompleted: true };
  expect(await render(me)).toBe(true);
  const onClosed = mockSheet.mock.calls.at(-1)?.[2] as () => void;
  expect(typeof onClosed).toBe('function');
  mockMe.mockReturnValue({ ...me, surveyCompleted: true }); // 제출 성공 = 캐시 true
  act(() => { trees.at(-1)!.update(wrap()); });
  expect(lastOpen()).toBe(false);
  await act(async () => { onClosed(); await drain(); });
  expect(lastOpen()).toBe(false);
});

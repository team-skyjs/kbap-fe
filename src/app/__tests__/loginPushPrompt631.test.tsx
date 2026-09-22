/**
 * KB-631(spec 006) — 로그인 화면 트리거: 첫 설치 첫 표시(`/login?entry=intro`, returnTo 없음)에서만
 * 어댑터 헬퍼 1회. 게이트 복귀(returnTo)·직접 진입(파라미터 없음)·기타 entry = 0회 (FR-001/006, SC-002).
 * 목 구성은 loginCollageMarquee 스위트 재사용.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    cancelAnimation: jest.fn(),
    Easing: { linear: () => 0, out: () => () => 0, quad: 0 },
  };
});
jest.mock('react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo', () => ({
  __esModule: true,
  default: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove: jest.fn() }) },
}));
const mockParams = { value: {} as Record<string, string> };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => mockParams.value,
  usePathname: () => '/login',
  useFocusEffect: (cb: () => (() => void) | undefined) => { require('react').useEffect(cb, [cb]); },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/components/SocialAuthButtons', () => ({ SocialAuthButtons: () => null }), { virtual: true });
jest.mock('@/lib/useAppFonts', () => ({ useAppFonts: () => [true, null] }));
const mockPush = { prompt: jest.fn().mockResolvedValue(undefined) };
jest.mock('@/lib/push/pushAdapter', () => ({ get promptPermissionOnFirstLogin() { return mockPush.prompt; } }));

import Login from '../login';

async function mount(params: Record<string, string>) {
  mockParams.value = params;
  let tree: renderer.ReactTestRenderer | undefined;
  await act(async () => { tree = renderer.create(<Login />); });
  await act(async () => {});
  return tree!;
}

beforeEach(() => jest.clearAllMocks());

it('첫 설치 첫 표시(entry=intro, returnTo 없음) = 헬퍼 1회 — 마운트(렌더 커밋) 뒤', async () => {
  const tree = await mount({ entry: 'intro' });
  expect(mockPush.prompt).toHaveBeenCalledTimes(1);
  expect(tree.root.findByProps({ testID: 'browse-first' })).toBeTruthy(); // 로그인 화면 기존 요소 유지
  tree.unmount();
});

it('게이트 복귀(returnTo) = 0회 (FR-006)', async () => {
  const tree = await mount({ entry: 'intro', returnTo: '/(tabs)/profile' });
  expect(mockPush.prompt).not.toHaveBeenCalled();
  tree.unmount();
});

it('파라미터 없음(세션 만료·게스트 CTA 등) = 0회', async () => {
  const tree = await mount({});
  expect(mockPush.prompt).not.toHaveBeenCalled();
  tree.unmount();
});

it('entry=gate_* 등 intro 외 = 0회', async () => {
  const tree = await mount({ entry: 'gate_review' });
  expect(mockPush.prompt).not.toHaveBeenCalled();
  tree.unmount();
});

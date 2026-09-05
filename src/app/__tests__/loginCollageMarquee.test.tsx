/**
 * KB-433 후속(9/5) — 로그인 콜라주 꽉 채우기 + 마퀴 잠금.
 * ① 높이·행수·마퀴 순수 함수 ② reduce-motion = 애니메이션 미시작(정적)
 * ③ 언포커스 = 정지(cancelAnimation) ④ flex 채움·행 자동 소스 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockWithRepeat = jest.fn((v: unknown) => v);
const mockCancel = jest.fn();
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
    withRepeat: (...a: unknown[]) => mockWithRepeat(a[0]),
    cancelAnimation: (...a: unknown[]) => mockCancel(...a),
    Easing: { linear: () => 0, out: () => () => 0, quad: 0 },
  };
});
let mockReduceMotion = false;
jest.mock('react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo', () => ({
  __esModule: true,
  default: {
    isReduceMotionEnabled: () => Promise.resolve(mockReduceMotion),
    addEventListener: () => ({ remove: jest.fn() }),
  },
}));
let focusCleanup: (() => void) | undefined;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/login',
  useFocusEffect: (cb: () => (() => void) | undefined) => {
    const React2 = require('react');
    React2.useEffect(() => {
      const cleanup = cb();
      focusCleanup = cleanup ?? undefined;
      return cleanup;
    }, [cb]);
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/components/SocialAuthButtons', () => ({ SocialAuthButtons: () => null }), { virtual: true });
jest.mock('@/lib/useAppFonts', () => ({ useAppFonts: () => [true, null] }));

import Login from '../login';
import { collageRows, embedAvailableH, marqueeDuration, marqueeSpan, MIN_COLLAGE_H } from '@/lib/loginCollage';

const trees: ReactTestRenderer[] = [];
async function render(el: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(el);
    await Promise.resolve(); // isReduceMotionEnabled resolve
  });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });

beforeEach(() => {
  jest.clearAllMocks();
  mockReduceMotion = false;
  focusCleanup = undefined;
});

it('① 순수 함수 — 행수 3~5 자동·스팬 588·20px/s 지속시간·임베드 가용 높이', () => {
  expect(collageRows(0)).toBe(3); // 미측정 = 최소
  expect(collageRows(353)).toBe(3); // 구 기본 높이대
  expect(collageRows(560)).toBe(4);
  expect(collageRows(900)).toBe(5); // 상한 5
  expect(marqueeSpan(4)).toBe(588); // 4×(136+11)
  expect(marqueeDuration(588)).toBe(29400); // 588px ÷ 20px/s
  expect(MIN_COLLAGE_H).toBe(220);
  // 임베드 = 화면 − 헤더 56 − 탭바(콘텐츠+safe-bottom)
  expect(embedAvailableH(844, 49, 34)).toBe(844 - 56 - 83);
});

it('② 기본(포커스·모션 허용) = 행마다 무한 마퀴 시작 — 행 수 = 측정 전 3', async () => {
  const tree = await render(<Login />);
  expect(mockWithRepeat).toHaveBeenCalledTimes(3); // collageRows(0)=3행
  // 측정 도착(700) → 5행으로 증가
  const collage = tree.root.findAll((n) => n.props?.testID === 'login-collage' && typeof n.props?.onLayout === 'function')[0];
  await act(async () => collage.props.onLayout({ nativeEvent: { layout: { height: 700 } } }));
  expect(mockWithRepeat.mock.calls.length).toBeGreaterThanOrEqual(5);
});

it('③ reduce-motion = 애니메이션 미시작(정적 콜라주 렌더)', async () => {
  mockReduceMotion = true;
  const tree = await render(<Login />);
  expect(tree.root.findAll((n) => n.props?.testID === 'login-collage').length).toBeGreaterThanOrEqual(1); // 정적 렌더 유지
  expect(mockWithRepeat).not.toHaveBeenCalled();
});

it('④ 언포커스 = 정지(cancelAnimation) — 재시작 없음', async () => {
  await render(<Login />);
  expect(mockWithRepeat).toHaveBeenCalled();
  const started = mockWithRepeat.mock.calls.length;
  await act(async () => focusCleanup?.()); // 화면 언포커스
  expect(mockCancel).toHaveBeenCalled(); // 각 행 정지
  expect(mockWithRepeat.mock.calls.length).toBe(started); // 재시작 0
});

it('⑤ 소스 잠금 — flex 채움(최소 220)·시안 오프셋·3배 복제 seamless·그라데이션 유지', () => {
  const src = require('fs').readFileSync('src/app/login.tsx', 'utf8') as string;
  expect(src).toContain('collage: { flex: 1, minHeight: MIN_COLLAGE_H, overflow: \'hidden\' }');
  expect(src).toContain('-101 + row * ((TILE + GAP) / 2) - span'); // 시안 좌우 오프셋 + seamless 기저 시프트
  expect(src).toContain('Array.from({ length: 12 }, (_, i) => DISHES[(row * 4 + (i % 4)) % DISHES.length])');
  expect(src).toContain('collageFade'); // 흰→투명 그라데이션 유지
  expect(src).toContain('embedAvailableH(winH, TABBAR_CONTENT_H, insets.bottom)'); // 임베드 = 탭바 차감
});

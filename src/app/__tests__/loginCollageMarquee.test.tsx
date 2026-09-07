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
import { embedAvailableH, marqueeDuration, marqueeSpan, MIN_COLLAGE_H } from '@/lib/loginCollage';

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

it('① 순수 함수 — 스팬 588·20px/s·임베드 가용 높이 (P-308: 행수·블러 함수 소멸)', () => {
  expect(marqueeSpan(4)).toBe(588); // 4×(136+11)
  expect(marqueeDuration(588)).toBe(29400); // 20px/s
  expect(embedAvailableH(844, 0, 56, 34)).toBe(844 - 90); // 게스트 프로필 탭(헤더 0)
  expect(embedAvailableH(300, 0, 56, 34)).toBe(MIN_COLLAGE_H + 200); // 하한
  // P-308: P-280 전면 배경 전용 함수 삭제 잠금
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lib = require('fs').readFileSync('src/lib/loginCollage.ts', 'utf8') as string;
  expect(lib).not.toContain('function collageRows');
  expect(lib).not.toContain('function blurredFromRow');
});

it('② 기본(포커스·모션 허용) = 행마다 무한 마퀴 시작 — 3행 고정', async () => {
  const tree = await render(<Login />);
  expect(mockWithRepeat).toHaveBeenCalledTimes(3); // P-308: 3행 고정(COLLAGE_ROWS)
  // P-308: 행수 측정(onLayout) 소멸 — 3행 고정, 추가 시작 없음
  expect(tree.root.findAll((n) => n.props?.testID === 'login-collage' && typeof n.props?.onLayout === 'function').length).toBe(0);
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

it('⑤ 소스 잠금(P-308 원복) — 상단 3행 고정·시안 오프셋·seamless 유지, 전면 배경·블러·워시 잔존 0', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const src = require('fs').readFileSync('src/app/login.tsx', 'utf8') as string;
  expect(src).toContain('const COLLAGE_ROWS = 3;'); // 시안 3행
  expect(src).toContain("collage: { height: TILE * COLLAGE_ROWS + GAP * (COLLAGE_ROWS - 1) - 24, overflow: 'hidden' }"); // 상단 블록(첫 행 −24 크롭)
  expect(src).toContain('-101 + row * ((TILE + GAP) / 2) - span'); // 시안 행 오프셋 + seamless 시프트(#37 유지)
  expect(src).not.toContain('blurRadius'); // 블러 잔존 0
  expect(src).not.toContain('collageWash'); // 하단 워시 잔존 0
  expect(src).not.toContain("position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden'"); // 전면 배경 잔존 0
  expect(src).not.toContain('heroTop'); // 가독 구간 계산 잔존 0
});

/**
 * P-288(KB-437) — AnimatedSplash 잠금: 타이밍 상수 스냅샷 · reduce-motion 분기 ·
 * 종료(1.6s+0.45s) 언마운트 · 4s 캡 · 네이티브 구성(app.json) 소스 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockWithDelay = jest.fn((_d: number, v: unknown) => v);
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    // withTiming 완료 콜백 즉시 실행(페이드아웃 → finish 경로 검증용)
    withTiming: (v: unknown, _c?: unknown, cb?: (f: boolean) => void) => {
      cb?.(true);
      return v;
    },
    withDelay: (...a: unknown[]) => mockWithDelay(a[0] as number, a[1]),
    cancelAnimation: () => {},
    runOnJS: (fn: (...a: unknown[]) => void) => fn,
    Easing: { bezier: () => 0, in: () => () => 0, out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
let mockReduceMotion = false;
jest.mock('react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo', () => ({
  __esModule: true,
  default: { isReduceMotionEnabled: () => Promise.resolve(mockReduceMotion), addEventListener: () => ({ remove: jest.fn() }) },
}));

import { AnimatedSplash, SPLASH_TIMING } from '@/components/AnimatedSplash';

const trees: ReactTestRenderer[] = [];
async function render(el: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(el);
    await Promise.resolve();
  });
  trees.push(tree);
  return tree;
}
afterEach(() => {
  while (trees.length) act(() => trees.pop()!.unmount());
  jest.useRealTimers();
});
beforeEach(() => {
  jest.clearAllMocks();
  mockReduceMotion = false;
});

it('타이밍 상수 = 프로토타입 모션 A 수치 그대로(스냅샷)', () => {
  expect(SPLASH_TIMING).toMatchInlineSnapshot(`
{
  "bowl": {
    "delay": 50,
    "dur": 550,
  },
  "cap": 4000,
  "dot": {
    "delay": 850,
    "dur": 350,
  },
  "fadeOutAt": 1600,
  "fadeOutDur": 450,
  "k": {
    "delay": 300,
    "dur": 600,
  },
  "reduceHold": 600,
  "tagline": {
    "delay": 950,
    "dur": 500,
  },
}
`);
});

it('active + 모션 허용 = 4그룹 딜레이 시작(50/300/850/950) → 1.6s 페이드아웃 → onDone', async () => {
  jest.useFakeTimers();
  const onDone = jest.fn();
  await render(<AnimatedSplash active onDone={onDone} />);
  const delays = mockWithDelay.mock.calls.map((c) => c[0]);
  for (const d of [50, 300, 850, 950]) expect(delays).toContain(d);
  expect(onDone).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(SPLASH_TIMING.fadeOutAt)); // 1.6s — 페이드(목 = 즉시 완료 콜백)
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('reduce-motion = 모션 미시작(정지 표시) → 0.6s 후 페이드아웃 → onDone', async () => {
  jest.useFakeTimers();
  mockReduceMotion = true;
  const onDone = jest.fn();
  await render(<AnimatedSplash active onDone={onDone} />);
  expect(mockWithDelay).not.toHaveBeenCalled(); // 모션 0 — 정지 표시
  act(() => jest.advanceTimersByTime(SPLASH_TIMING.reduceHold));
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('4s 캡 — active가 영영 안 와도 언마운트 보장(bootGate 캡 동률)', async () => {
  jest.useFakeTimers();
  const onDone = jest.fn();
  await render(<AnimatedSplash active={false} onDone={onDone} />);
  act(() => jest.advanceTimersByTime(SPLASH_TIMING.cap - 1));
  expect(onDone).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1));
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('배선·네이티브 구성 소스 잠금 — hideAsync 프레임 활성·흰 배경·마크 에셋·81pt', () => {
  const fs = require('fs');
  const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8') as string;
  expect(layout).toContain('setSplashActive(true);'); // hideAsync와 같은 effect(프레임)
  expect(layout).toContain('SplashScreen.hideAsync().catch(() => {});');
  expect(layout).toContain('{splashVisible && <AnimatedSplash active={splashActive}');
  const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  const splash = app.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
  expect(splash.backgroundColor).toBe('#FFFFFF'); // 흰 고정(다크 변형 없음)
  expect(splash.image).toBe('./assets/images/splash-mark-ios.png');
  expect(splash.imageWidth).toBe(81); // P-291: 타이트 캔버스(245×285) — 마크 화면상 81pt
  expect(splash.android.image).toBe('./assets/images/splash-mark-android.png');
  expect(splash.android.imageWidth).toBe(131); // 안드 원형 마스크 캔버스(396) 보정
});

it('P-291 viewBox 정정 소스 잠금 — K 라운드 캡(y<0)이 잘리지 않는 좌표계', () => {
  const fs = require('fs');
  // 스플래시 마크: 캡 포함 viewBox(0 -6.72 81.614 94.719) — 두 Svg(그릇/K) 공통 상수 소비
  const splashSrc = fs.readFileSync('src/components/AnimatedSplash.tsx', 'utf8') as string;
  expect(splashSrc).toContain("const MARK_VIEWBOX = '0 -6.72 81.614 94.719';");
  expect(splashSrc.match(/viewBox=\{MARK_VIEWBOX\}/g)).toHaveLength(2);
  expect(splashSrc).toContain('const MARK_H = 94.719;');
  expect(splashSrc).not.toContain('viewBox="0 0 81.614'); // 구(캡 잘림) viewBox 잔존 0
  // 앱바 마크: 캡 포함 viewBox + 자연 크기 기본값(글리프 스케일 1:1)
  const assetsSrc = fs.readFileSync('src/components/design4Assets.tsx', 'utf8') as string;
  expect(assetsSrc).toContain('viewBox="0 -1.528 18.551 21.528"');
  expect(assetsSrc).toContain('height = 21.528');
  expect(assetsSrc).not.toContain('viewBox="0 0 18.551 20"');
  expect(fs.readFileSync('src/components/StickyHeader.tsx', 'utf8')).toContain('<AppBarMark height={21.528} />');
});

/**
 * P-288 → P-299(KB-444) — AnimatedSplash 잠금: 시퀀스 B(재등장 0·덧붙임 모션) 타이밍
 * 스냅샷 · reduce-motion 분기 · 종료(3s+0.45s) 언마운트 · 4s 캡 · 네이티브 구성 소스 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockWithDelay = jest.fn((_d: number, v: unknown) => v);
const mockWithSequence = jest.fn((...vals: unknown[]) => vals[vals.length - 1]);
const mockCancelAnimation = jest.fn();
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    // P-296: 실제 reanimated처럼 렌더 안정(리렌더에도 같은 객체) — deps 비교 재현에 필수
    useSharedValue: (v: unknown) => require('react').useRef({ value: v }).current,
    useAnimatedStyle: () => ({}),
    // withTiming 완료 콜백 즉시 실행(페이드아웃 → finish 경로 검증용)
    withTiming: (v: unknown, _c?: unknown, cb?: (f: boolean) => void) => {
      cb?.(true);
      return v;
    },
    withDelay: (...a: unknown[]) => mockWithDelay(a[0] as number, a[1]),
    withSequence: (...a: unknown[]) => mockWithSequence(...a),
    cancelAnimation: (...a: unknown[]) => mockCancelAnimation(...a),
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

it('타이밍 상수 = 시퀀스 B(카드 B 정본) 수치 그대로(스냅샷)', () => {
  expect(SPLASH_TIMING).toMatchInlineSnapshot(`
{
  "bowlTilt": {
    "delay": 700,
    "dur": 1100,
  },
  "cap": 4000,
  "dot": {
    "delay": 1650,
    "dur": 350,
  },
  "fadeOutAt": 3000,
  "fadeOutDur": 450,
  "hold": 700,
  "kHop": {
    "delay": 950,
    "dur": 600,
  },
  "reduceHold": 3000,
  "tagline1": {
    "delay": 1750,
    "dur": 450,
  },
  "tagline2": {
    "delay": 1900,
    "dur": 450,
  },
}
`);
});

it('P-299 타임라인 순서 — hold ≤ tilt < hop < dot < tag1 < tag2 ≤ fadeOutAt', () => {
  const T = SPLASH_TIMING;
  expect(T.bowlTilt.delay).toBe(T.hold); // 흔들림 = 홀드 직후
  expect(T.kHop.delay).toBeGreaterThan(T.bowlTilt.delay);
  expect(T.dot.delay).toBeGreaterThan(T.kHop.delay);
  expect(T.tagline1.delay).toBeGreaterThan(T.dot.delay);
  expect(T.tagline2.delay).toBeGreaterThan(T.tagline1.delay);
  expect(T.fadeOutAt).toBeGreaterThanOrEqual(T.tagline2.delay);
});

it('P-299 재등장 0 소스 잠금 — 그릇·K 초기값 = 최종 상태(등장 셰어드값·구 모션 A 잔존 0)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const src = require('fs').readFileSync('src/components/AnimatedSplash.tsx', 'utf8') as string;
  expect(src).not.toContain('useSharedValue(26)'); // 구 그릇 등장 오프셋
  expect(src).not.toContain('useSharedValue(-34)'); // 구 K 등장 오프셋
  expect(src).toContain('const tilt = useSharedValue(0);'); // 덧붙임 동작만
  expect(src).toContain('const hop = useSharedValue(0);');
  // 그릇·K에 opacity 등장 없음 — bowlStyle/kStyle은 transform 전용
  expect(src).not.toMatch(/bowlO|kO =/);
});

it('active + 모션 허용 = 덧붙임 5그룹 딜레이(700/950/1650/1750/1900) → 3s 페이드아웃 → onDone', async () => {
  jest.useFakeTimers();
  const onDone = jest.fn();
  await render(<AnimatedSplash active onDone={onDone} />);
  const delays = mockWithDelay.mock.calls.map((c) => c[0]);
  for (const d of [700, 950, 1650, 1750, 1900]) expect(delays).toContain(d);
  expect(mockWithSequence).toHaveBeenCalledTimes(2); // 흔들림·튐 = 시퀀스 2건
  expect(onDone).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(SPLASH_TIMING.fadeOutAt)); // 3s — 페이드(목 = 즉시 완료 콜백)
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('reduce-motion = 흔들림·튐 스킵(시퀀스 0) → 홀드 후 점·문구 페이드만 → 3s 후 onDone', async () => {
  jest.useFakeTimers();
  mockReduceMotion = true;
  const onDone = jest.fn();
  await render(<AnimatedSplash active onDone={onDone} />);
  expect(mockWithDelay).not.toHaveBeenCalled(); // 이동 모션 0
  expect(mockWithSequence).not.toHaveBeenCalled(); // 흔들림·튐 스킵
  act(() => jest.advanceTimersByTime(SPLASH_TIMING.reduceHold));
  expect(onDone).toHaveBeenCalledTimes(1);
});

/* ---- P-296(Codex #52 P1): onDone 정체성 변경 리렌더에도 모션·타이머 생존 ---- */

it('P-296 onDone 새 정체성 리렌더(entryChecked 플립 재현) — cancelAnimation 0·페이드 정상', async () => {
  jest.useFakeTimers();
  const done = jest.fn();
  // 인라인 화살표 = 리렌더마다 새 onDone (버그 재현 조건)
  const tree = await render(<AnimatedSplash active ready={false} onDone={() => done()} />);
  await act(async () => {
    tree.update(<AnimatedSplash active ready={false} onDone={() => done()} />); // 부팅 중 리렌더
  });
  expect(mockCancelAnimation).not.toHaveBeenCalled(); // 모션 effect cleanup 미발동(정체성 안정)
  act(() => jest.advanceTimersByTime(SPLASH_TIMING.fadeOutAt + 10)); // 최소 노출 타이머 생존
  expect(done).not.toHaveBeenCalled(); // ready 전 보류(P-293 유지)
  await act(async () => {
    tree.update(<AnimatedSplash active ready onDone={() => done()} />); // ready 도착(또 새 정체성)
  });
  expect(mockCancelAnimation).not.toHaveBeenCalled();
  expect(done).toHaveBeenCalledTimes(1); // 페이드(목 즉시 콜백) → 최신 onDone 호출
});

it('P-296 배선 소스 잠금 — _layout onDone = 안정 콜백(인라인 화살표 잔존 0)', () => {
  const fs = require('fs');
  const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8') as string;
  expect(layout).toContain('const onSplashDone = useCallback(() => setSplashVisible(false), []);');
  expect(layout).toContain('onDone={onSplashDone}');
  expect(layout).not.toContain('onDone={() =>');
});

/* ---- P-293: ready 게이트 — 페이드아웃 = max(최소 노출, 부트 준비) ---- */

it('P-293① ready=false: 1.6s 지나도 페이드아웃 보류(정지 유지) → ready=true에 즉시 페이드·onDone', async () => {
  jest.useFakeTimers();
  const onDone = jest.fn();
  const tree = await render(<AnimatedSplash active ready={false} onDone={onDone} />);
  act(() => jest.advanceTimersByTime(SPLASH_TIMING.fadeOutAt + 500)); // 최소 노출 도달 후에도
  expect(onDone).not.toHaveBeenCalled(); // ready 전엔 보류
  await act(async () => {
    tree.update(<AnimatedSplash active ready onDone={onDone} />);
  });
  expect(onDone).toHaveBeenCalledTimes(1); // 페이드(목 = 즉시 완료 콜백) → onDone
});

it('P-293② ready 선도착(기본 true): 기존 타임라인 그대로 1.6s에 페이드·onDone', async () => {
  jest.useFakeTimers();
  const onDone = jest.fn();
  await render(<AnimatedSplash active ready onDone={onDone} />);
  act(() => jest.advanceTimersByTime(SPLASH_TIMING.fadeOutAt - 1));
  expect(onDone).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1));
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('P-293③ reduce-motion + ready=false: 0.6s 후에도 보류 → ready=true에 페이드·onDone', async () => {
  jest.useFakeTimers();
  mockReduceMotion = true;
  const onDone = jest.fn();
  const tree = await render(<AnimatedSplash active ready={false} onDone={onDone} />);
  act(() => jest.advanceTimersByTime(SPLASH_TIMING.reduceHold + 500));
  expect(onDone).not.toHaveBeenCalled();
  await act(async () => {
    tree.update(<AnimatedSplash active ready onDone={onDone} />);
  });
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('P-293④ 배선 소스 잠금 — hideAsync/active는 폰트만 게이트·Stack=entryChecked 조건부·ready 전달·SPLASH_MIN_MS 0', () => {
  const fs = require('fs');
  const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8') as string;
  expect(layout).toContain('if (fontsLoaded || fontError) {'); // entryChecked 대기 제거
  expect(layout).not.toContain('(fontsLoaded || fontError) && entryChecked'); // 구 게이트 잔존 0
  expect(layout).toContain('{entryChecked && ('); // 렌더 가드(P-041/P-217)는 Stack 조건부가 승계
  expect(layout).toContain('ready={entryChecked}');
  expect(fs.readFileSync('src/lib/bootGate.ts', 'utf8')).toContain('export const SPLASH_MIN_MS = 0;');
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

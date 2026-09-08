/**
 * P-337(KB-490) — 바텀시트 스와이프 닫기 공용 훅.
 * ① 임계(이동 80 또는 속도 500) 이상 → onClose 1회 / 미만 → 복귀(닫힘 0)
 * ② 단일 발사(임계 후 재드래그 무시) ③ 배선 = 제스처 영역이 핸들+헤더에 한정(소스 잠금).
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const timers: Array<() => void> = [];
  return {
    __esModule: true,
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    // 완료 콜백 즉시 발화(성공) — 퇴장 애니메이션 종단 = onClose 경로 검증(호출 기록 = 스파이)
    withTiming: jest.fn((v: unknown, _c?: unknown, cb?: (f: boolean) => void) => {
      if (cb) cb(true);
      return v;
    }),
    runOnJS: (fn: (...a: unknown[]) => void) => fn,
    interpolate: () => 1,
    Extrapolation: { CLAMP: 'clamp' },
    __timers: timers,
  };
});

import { useSheetSwipeDismiss } from '../useSheetSwipeDismiss';

type PanEvent = { translationY: number; velocityY: number };
type PanHandlers = { onUpdate?: (e: PanEvent) => void; onEnd?: (e: PanEvent) => void };

function mount(onClose: () => void, open = true) {
  const out: { swipe?: ReturnType<typeof useSheetSwipeDismiss> } = {};
  function Probe() {
    out.swipe = useSheetSwipeDismiss(onClose, open);
    return null;
  }
  act(() => { renderer.create(<Probe />); });
  // RNGH v2 제스처 빌더 — 등록 콜백은 handlers에 보관(jest 환경)
  const handlers = (out.swipe!.gesture as unknown as { handlers: PanHandlers }).handlers;
  return { handlers, swipe: out.swipe! };
}

it('임계 이상(이동 80 / 속도 500) → onClose 1회 · 임계 미만 → 복귀(닫힘 0)', () => {
  const onClose = jest.fn();
  const { handlers } = mount(onClose);
  // 미만 — 복귀
  handlers.onUpdate?.({ translationY: 40, velocityY: 0 });
  handlers.onEnd?.({ translationY: 40, velocityY: 100 });
  expect(onClose).not.toHaveBeenCalled();
  // 이동 임계
  handlers.onEnd?.({ translationY: 90, velocityY: 0 });
  expect(onClose).toHaveBeenCalledTimes(1);

  const onClose2 = jest.fn();
  const h2 = mount(onClose2).handlers;
  // 속도 임계(이동은 미만)
  h2.onEnd?.({ translationY: 30, velocityY: 620 });
  expect(onClose2).toHaveBeenCalledTimes(1);
  // 단일 발사 — 임계 후 재발화 무시
  h2.onEnd?.({ translationY: 200, velocityY: 900 });
  expect(onClose2).toHaveBeenCalledTimes(1);
});

it('Codex #98 P2: 퇴장 목표 = 시트 onLayout 실높이(측정 전 = 화면 높이 폴백)', () => {
  const { withTiming } = require('react-native-reanimated') as { withTiming: jest.Mock };
  const { handlers, swipe } = mount(jest.fn());
  (swipe as unknown as { onSheetLayout: (e: unknown) => void }).onSheetLayout({ nativeEvent: { layout: { height: 900 } } });
  handlers.onEnd?.({ translationY: 120, velocityY: 0 });
  expect(withTiming.mock.calls.at(-1)![0]).toBe(900); // 실높이만큼 이동
  // 측정 전 = 화면 높이 폴백(고정 640 소멸)
  const src = require('fs').readFileSync('src/components/useSheetSwipeDismiss.ts', 'utf8') as string;
  expect(src).toContain('sheetH.current || winH');
  expect(src).not.toContain('EXIT_Y');
});

it('위로 드래그는 0 고정(음수 translateY 미추종)', () => {
  const { handlers, swipe } = mount(jest.fn());
  handlers.onUpdate?.({ translationY: -60, velocityY: 0 });
  const ty = (swipe as unknown as { sheetStyle: object }).sheetStyle; // 스타일 목 — 값 검증은 소스 계약
  expect(ty).toBeDefined();
  const src = require('fs').readFileSync('src/components/useSheetSwipeDismiss.ts', 'utf8') as string;
  expect(src).toContain('Math.max(0, e.translationY)');
});

it('배선 — TagPickerSheet·온보딩 약관 시트: 제스처 영역 = 핸들+헤더 한정, 핸들 a11y 버튼(닫기)', () => {
  const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;
  const co = read('src/app/community/compose.tsx');
  expect(co).toContain('useSheetSwipeDismiss(onClose, kind != null)');
  expect(co).toMatch(/<GestureDetector gesture=\{swipe\.gesture\}>[^]*?pickerHeader[^]*?<\/GestureDetector>/);
  expect(co).toContain('testID="sheet-grab"');
  expect(co).toContain('onLayout={swipe.onSheetLayout}');
  expect(co).toMatch(/sheet-grab[^]*?accessibilityLabel=\{t\('common\.close'\)\}|accessibilityLabel=\{t\('common\.close'\)\}[^]*?sheet-grab/);
  const ob = read('src/app/onboarding/index.tsx');
  expect(ob).toContain('useSheetSwipeDismiss(onClose, doc != null)');
  expect(ob).toContain('onLayout={swipe.onSheetLayout}');
  expect(ob).toMatch(/<GestureDetector gesture=\{swipe\.gesture\}>[^]*?sheetTitle[^]*?<\/GestureDetector>/);
  // 리스트/본문(ScrollView·FlatList)은 GestureDetector 블록 밖 — 스크롤 우선
  const coBlock = /<GestureDetector gesture=\{swipe\.gesture\}>([^]*?)<\/GestureDetector>/.exec(co)![1];
  expect(coBlock).not.toMatch(/FlatList|ScrollView/);
  const obBlock = /<GestureDetector gesture=\{swipe\.gesture\}>([^]*?)<\/GestureDetector>/.exec(ob)![1];
  expect(obBlock).not.toMatch(/FlatList|ScrollView/);
});

/**
 * KB-706 — react-native-gesture-handler 테스트 목. GestureDetector = 자식 그대로, Gesture.Pan() = 콜백을 기록하는 체인.
 * 테스트가 `pans`에서 마지막 Pan을 꺼내 onStart/onUpdate/onEnd/onFinalize를 직접 몰 수 있다(실기 제스처는 jest가 못 돈다 — 발행 전 실기 확인 대상).
 * 사용: `jest.mock('react-native-gesture-handler', () => require('@/__tests__/helpers/gestureHandlerMock'));`
 */
import * as React from 'react';

type Cb = (e?: unknown) => void;
export interface RecordedPan {
  handlers: Record<string, Cb>;
  config: Record<string, unknown>;
}
export const pans: RecordedPan[] = [];

function chain(rec: RecordedPan) {
  const api: Record<string, unknown> = {};
  for (const ev of ['onBegin', 'onStart', 'onUpdate', 'onChange', 'onEnd', 'onFinalize']) {
    api[ev] = (cb: Cb) => {
      rec.handlers[ev] = cb;
      return api;
    };
  }
  for (const opt of ['runOnJS', 'minDistance', 'activeOffsetX', 'activeOffsetY', 'failOffsetX', 'failOffsetY', 'enabled', 'shouldCancelWhenOutside']) {
    api[opt] = (v: unknown) => {
      rec.config[opt] = v;
      return api;
    };
  }
  return api;
}

export const Gesture = {
  Pan: () => {
    const rec: RecordedPan = { handlers: {}, config: {} };
    pans.push(rec);
    return chain(rec);
  },
};

export function GestureDetector({ children }: { gesture: unknown; children: React.ReactNode }) {
  return <>{children}</>;
}
export function GestureHandlerRootView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

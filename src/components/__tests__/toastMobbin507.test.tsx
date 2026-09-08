/**
 * P-346(KB-507) — Mobbin 스타일 상단 토스트: 형태 스냅·Close 즉시 소멸·2.5s 타이머·
 * reduce-motion 분기 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockReduced = jest.fn(() => false);
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    // 퇴장 완료 콜백 즉시 발화 — 언마운트 경로 검증
    withTiming: jest.fn((v: unknown, _c?: unknown, cb?: (f: boolean) => void) => {
      if (cb) cb(true);
      return v;
    }),
    withSpring: jest.fn((v: unknown) => v),
    runOnJS: (fn: (...a: unknown[]) => void) => fn,
    useReducedMotion: () => mockReduced(),
    Easing: { out: (f: unknown) => f, cubic: 0 },
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 40, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { TopToastHost, showTopToast } from '../TopToast';

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<TopToastHost />); });
  return tree;
}

afterEach(() => {
  jest.useRealTimers();
  mockReduced.mockReturnValue(false);
});

it('형태 스냅 — r24 #2F3137 minHeight 56 pad 20 · 텍스트 16/500 좌정렬 2줄 · Close 16/700 · 체크 원 22/에러 AlertTri', () => {
  const tt = read('src/components/TopToast.tsx');
  expect(tt).toMatch(/minHeight: 56,[^}]*backgroundColor: '#2F3137',\s*borderRadius: 24,\s*paddingHorizontal: 20/s);
  expect(tt).toContain("text: { flex: 1, fontSize: 16, fontWeight: '500', color: '#FFFFFF', lineHeight: 22, textAlign: 'left' }");
  expect(tt).toContain("close: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' }");
  expect(tt).toContain("checkDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF'");
  expect(tt).toContain('IconAlertTri size={22} color="#FFFFFF"');
  expect(tt).toContain('const SHOW_MS = 2500');
  expect(tt).not.toContain('rgba(0,0,0,0.5)'); // 구 DS 9:4239 폐기
});

it('Close 탭 = 즉시 소멸 · 자동 2.5s 소멸 · 재발화 = 텍스트 교체(스프링 재진입 없음)', () => {
  jest.useFakeTimers();
  const { withSpring } = require('react-native-reanimated') as { withSpring: jest.Mock };
  const tree = render();
  act(() => { showTopToast('저장됨'); });
  expect(tree.root.findAll((n) => n.props?.testID === 'top-toast').length).toBeGreaterThanOrEqual(1);
  const springCalls = withSpring.mock.calls.length;
  // 표시 중 재발화 — 스프링 재진입 없음(타이머 리셋·텍스트 교체만)
  act(() => { showTopToast('해제됨'); });
  expect(withSpring.mock.calls.length).toBe(springCalls);
  expect(JSON.stringify(tree.toJSON())).toContain('해제됨');
  // Close 탭 = 즉시 소멸(퇴장 목이 완료 콜백 즉발 → 언마운트)
  act(() => { tree.root.findAll((n) => n.props?.testID === 'top-toast-close' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
  act(() => {}); // setState 플러시(직접 호출 — 이벤트 배칭 밖)
  expect(tree.root.findAll((n) => n.props?.testID === 'top-toast')).toHaveLength(0);
  // 자동 2.5s
  act(() => { showTopToast('다시'); });
  act(() => { jest.advanceTimersByTime(2600); });
  act(() => {});
  expect(tree.root.findAll((n) => n.props?.testID === 'top-toast')).toHaveLength(0);
});

it('reduce-motion = 슬라이드 없이 페이드만(withSpring 미호출)', () => {
  jest.useFakeTimers();
  mockReduced.mockReturnValue(true);
  const { withSpring } = require('react-native-reanimated') as { withSpring: jest.Mock };
  withSpring.mockClear();
  const tree = render();
  act(() => { showTopToast('저장됨'); });
  expect(withSpring).not.toHaveBeenCalled();
  expect(tree.root.findAll((n) => n.props?.testID === 'top-toast').length).toBeGreaterThanOrEqual(1);
});

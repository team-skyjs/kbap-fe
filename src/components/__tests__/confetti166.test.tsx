/**
 * P-166: 주문 완료 폭죽 — Done 탭 = 모달+confetti 동시 마운트 · DURATION 후
 * 언마운트 · Reduce Motion 스킵 · pointerEvents none(터치 통과) · 위험도 4색 미사용.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => mockReduced,
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) })); // KB-730 시트 useBottomInset
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }) })); // KB-730 useReviewPrompt
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }), initReactI18next: { type: '3rdParty', init: () => {} } }));

import { ConfettiBurst, CONFETTI_COUNT, CONFETTI_DURATION_MS } from '../ConfettiBurst';
import { FlippedOrderCard } from '@/features/order/FlippedOrderCard';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const t = (k: string) => k;

beforeEach(() => {
  mockReduced = false;
});

/** RTR은 Modal onDismiss를 안 쏜다 — 닫힌(visible=false) Modal의 onDismiss를 테스트가 대신 호출(iOS 직렬화 체인 흉내) */
const fireDismissed = async (tree: ReactTestRenderer) => {
  const seen = new Set<unknown>();
  for (const n of tree.root.findAll((x) => typeof x.props?.onDismiss === 'function' && x.props?.visible === false)) {
    if (seen.has(n.props.onDismiss)) continue;
    seen.add(n.props.onDismiss);
    await act(async () => { n.props.onDismiss(); });
  }
  for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); });
};

it('파티클 수 상수·pointerEvents none·위험도 4색 미사용', () => {
  const tree = render(<ConfettiBurst />);
  const root = tree.root.findAll((n) => n.props?.testID === 'confetti')[0];
  expect(root.props.pointerEvents).toBe('none'); // 확인 버튼 즉시 탭 가능
  const s = JSON.stringify(tree.toJSON());
  for (const banned of ['#2F8F5B', '#D9A404aa', '#C0392B']) void banned; // 참고용
  // 위험도 팔레트(theme risk*) 미사용 — 소스 잠금이 정본
  const src = require('fs').readFileSync('src/components/ConfettiBurst.tsx', 'utf8') as string;
  expect(src).not.toMatch(/risk(Safe|Caution|Danger|Unable)/);
  expect(src).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u); // 이모지 0
  expect(s.length).toBeGreaterThan(0);
});

it('Reduce Motion → 폭죽 스킵(null)', () => {
  mockReduced = true;
  const tree = render(<ConfettiBurst />);
  expect(tree.root.findAll((n) => n.props?.testID === 'confetti').length).toBe(0);
});

it('Done 탭 → 모달+confetti 동시 마운트, DURATION 경과 후 언마운트(모달 유지)', () => {
  jest.useFakeTimers();
  const tree = render(
    <FlippedOrderCard items={[{ nameKo: '김치찌개', name: 'Kimchi', qty: 1, priceKrw: null }]} avoidCodes={[]} avoidNames={[]} currency="USD" onDone={jest.fn()} t={t} />,
  );
  const done = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'order.done').length > 0).pop()!;
  act(() => done.props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'order-done-confirm').length).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'confetti').length).toBeGreaterThanOrEqual(1); // 동시
  act(() => {
    jest.advanceTimersByTime(CONFETTI_DURATION_MS + 300);
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'confetti').length).toBe(0); // 자연 소멸
  expect(tree.root.findAll((n) => n.props?.testID === 'order-done-confirm').length).toBeGreaterThanOrEqual(1); // 모달 유지
  jest.useRealTimers();
});

it('파티클 수 = 상수(40~60 발주 범위) — 저사양 조정 노브', () => {
  expect(CONFETTI_COUNT).toBeGreaterThanOrEqual(40);
  expect(CONFETTI_COUNT).toBeLessThanOrEqual(60);
});

// KB-730: 주문 완료 모달의 복귀 버튼 → 모달을 닫은 뒤 리뷰 유도 시트(겹침 0) → 나중에 = onDone 1회 · 조건 미달(이미 종료)이면 바로 onDone
it('KB-730 주문 완료 → 복귀 탭 = 유도 시트(첫 노출) → 나중에 = onDone 1회 · 종료 상태면 시트 0·즉시 onDone', async () => {
  const asMod = jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock') as { default?: unknown } & Record<string, unknown>;
  const AsyncStorage = (asMod.default ?? asMod) as { clear: () => Promise<void>; setItem: (k: string, v: string) => Promise<void>; getItem: (k: string) => Promise<string | null>; removeItem: (k: string) => Promise<void> };
  await AsyncStorage.clear();
  const onDone = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<FlippedOrderCard items={[{ nameKo: '김치찌개', name: 'Kimchi', qty: 1, priceKrw: null }]} avoidCodes={[]} avoidNames={[]} currency="USD" onDone={onDone} t={t} />);
  });
  const press = async (id: string) => { const n = tree.root.findAll((x) => x.props?.testID === id && typeof x.props?.onPress === 'function')[0]; await act(async () => { n.props.onPress(); }); for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); }); };
  const doneBtn = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'order.done').length > 0).pop()!;
  await act(async () => { doneBtn.props.onPress(); });
  const home = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'order.doneHome').length > 0).pop()!;
  await act(async () => { home.props.onPress(); });
  for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); });
  expect(tree.root.findAll((n) => n.props?.testID === 'review-prompt' && typeof n.type === 'string')).toHaveLength(0); // dismiss 전 present 0(프리즈 방지)
  await fireDismissed(tree); // iOS: 완료 모달이 완전히 닫힌 뒤
  expect(tree.root.findAll((n) => n.props?.testID === 'review-prompt' && typeof n.type === 'string')).toHaveLength(1);
  expect(onDone).not.toHaveBeenCalled();
  await press('review-prompt-later');
  expect(onDone).toHaveBeenCalledTimes(1);
  // 종료 상태(좋아요/별로예요 뒤) = 시트 0 · 바로 복귀
  await AsyncStorage.setItem('kbap.reviewPrompt.v1', JSON.stringify({ lastShownAt: 1, shows: 1, done: true, scanSuccess: 0 }));
  await act(async () => { doneBtn.props.onPress(); });
  const home2 = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'order.doneHome').length > 0).pop()!;
  await act(async () => { home2.props.onPress(); });
  await fireDismissed(tree);
  expect(tree.root.findAll((n) => n.props?.testID === 'review-prompt' && typeof n.type === 'string')).toHaveLength(0);
  expect(onDone).toHaveBeenCalledTimes(2);
});

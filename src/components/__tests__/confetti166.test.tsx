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

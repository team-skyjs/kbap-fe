/** KB-695(#226 공부 보강 a) — NEW 배지 만료 타이머가 경계보다 **조금 일찍** 발화해도 배지가 내려간다(벽시계·타이머 시계 축이 다름 — 고착 방지). */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { NEW_FOOD_WINDOW_MS, useIsNewFood } from '../newFood';

function Probe({ publishedAt }: { publishedAt: string }) {
  return <Text testID="n">{String(useIsNewFood(publishedAt))}</Text>;
}

afterEach(() => jest.useRealTimers());

it('경계 1초 전 마운트 → 벽시계가 100ms 뒤로 밀린 채 타이머 발화(경계 100ms 전) → 그래도 NEW 해제', () => {
  jest.useFakeTimers();
  const T0 = Date.parse('2026-10-02T00:00:00Z');
  jest.setSystemTime(T0);
  const pub = new Date(T0 - NEW_FOOD_WINDOW_MS + 1000).toISOString(); // 경계 = T0 + 1000
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(<Probe publishedAt={pub} />);
  });
  expect(t.root.findByProps({ testID: 'n' }).props.children).toBe('true');
  jest.setSystemTime(T0 - 100); // 벽시계 후퇴(타이머 축과 어긋남)
  act(() => jest.advanceTimersByTime(1000)); // 발화 시점 Date.now() = T0 + 900 < 경계
  expect(t.root.findByProps({ testID: 'n' }).props.children).toBe('false');
});

it('정상 발화(경계 정각) → NEW 해제 · 재마운트 없이', () => {
  jest.useFakeTimers();
  const T0 = Date.parse('2026-10-02T00:00:00Z');
  jest.setSystemTime(T0);
  const pub = new Date(T0 - NEW_FOOD_WINDOW_MS + 1000).toISOString();
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(<Probe publishedAt={pub} />);
  });
  act(() => jest.advanceTimersByTime(1000));
  expect(t.root.findByProps({ testID: 'n' }).props.children).toBe('false');
});

/**
 * KB-851 떠 있는 리뷰 알약 표시 규칙(시안 kpop-detail v1 "Review CTA") — K-pop 카드 보이는 동안 숨김 · 아래로 누적 12 = 숨김 ·
 * 위로 누적 12 = 표시 · 300ms 멈춤 = 표시 · 맨 위/아래 = 표시(카드 규칙이 우선).
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { cardOnScreen, pillOnIdle, pillOnScroll, PILL_DIR_THRESHOLD, PILL_IDLE_MS, useScrollAwarePill, type PillScroll, type PillState } from '../scrollAwarePill';

const S = (y: number, card: PillScroll['card'] = null): PillScroll => ({ y, viewH: 700, contentH: 3000, card });
const ST = (shown: boolean, lastY: number, acc = 0): PillState => ({ shown, lastY, acc });

it('임계 12 · 멈춤 300ms', () => {
  expect(PILL_DIR_THRESHOLD).toBe(12);
  expect(PILL_IDLE_MS).toBe(300);
});

it('K-pop 카드가 화면에 걸쳐 있으면 숨김(맨 위·위로 스크롤이어도) · 화면 밖이면 일반 규칙', () => {
  const card = { y: 640, h: 132 };
  expect(cardOnScreen(S(0, card))).toBe(true);
  expect(pillOnScroll(ST(true, 0), S(0, card)).shown).toBe(false); // 진입(시안 01)
  expect(pillOnScroll(ST(true, 300), S(250, card)).shown).toBe(false); // 위로 50이어도 카드 보이면 숨김
  expect(cardOnScreen(S(800, card))).toBe(false); // 카드 바닥 772 < 800
  expect(pillOnIdle(ST(false, 800), S(800, card)).shown).toBe(true);
  expect(pillOnIdle(ST(true, 0), S(0, card)).shown).toBe(false);
});

it('아래로 누적 12 = 숨김(11은 그대로) · 위로 누적 12 = 표시 · 방향이 바뀌면 누적 새로', () => {
  let st = ST(true, 1000);
  st = pillOnScroll(st, S(1006)); expect(st.shown).toBe(true);
  st = pillOnScroll(st, S(1011)); expect(st.shown).toBe(true); // 누적 11
  st = pillOnScroll(st, S(1012)); expect(st.shown).toBe(false); // 누적 12
  st = pillOnScroll(st, S(1006)); expect(st.shown).toBe(false); // 위로 6
  st = pillOnScroll(st, S(1010)); expect(st.shown).toBe(false); // 다시 아래(누적 새로)
  st = pillOnScroll(st, S(998)); expect(st.shown).toBe(true); // 위로 12
});

it('맨 위·맨 아래 = 표시(카드 없을 때)', () => {
  expect(pillOnScroll(ST(false, 20), S(0)).shown).toBe(true);
  expect(pillOnScroll(ST(false, 2280), S(2300)).shown).toBe(true); // 2300 + 700 = 콘텐츠 끝
});

it('훅: 아래로 스크롤 = 숨김 → 300ms 멈춤 = 표시 · 카드 위치가 보이는 자리면 숨김', () => {
  jest.useFakeTimers();
  let api!: ReturnType<typeof useScrollAwarePill>;
  const keep = (a: ReturnType<typeof useScrollAwarePill>) => { api = a; };
  function Harness({ onApi }: { onApi: typeof keep }) { onApi(useScrollAwarePill()); return null; }
  act(() => { renderer.create(<Harness onApi={keep} />); });
  const ev = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y }, layoutMeasurement: { width: 375, height: 700 }, contentSize: { width: 375, height: 3000 } } }) as never;
  act(() => { api.onViewLayout(700); api.onContentSize(3000); });
  expect(api.shown).toBe(true);
  act(() => { api.onScroll(ev(1000)); });
  act(() => { api.onScroll(ev(1030)); });
  expect(api.shown).toBe(false);
  act(() => { jest.advanceTimersByTime(PILL_IDLE_MS - 1); });
  expect(api.shown).toBe(false);
  act(() => { jest.advanceTimersByTime(1); });
  expect(api.shown).toBe(true);
  act(() => { api.onCardLayout(1100, 132); }); // 지금 화면(1030~1730) 안 → 숨김
  expect(api.shown).toBe(false);
  act(() => { jest.advanceTimersByTime(PILL_IDLE_MS * 2); });
  expect(api.shown).toBe(false);
  // Codex #328: 카드가 사라지면 위치를 높이 0으로 비운다 → 같은 자리에서도 다시 표시
  act(() => { api.onCardLayout(0, 0); });
  expect(api.shown).toBe(true);
  jest.useRealTimers();
  const src = jest.requireActual('fs').readFileSync('src/app/food/[id]/index.tsx', 'utf8') as string;
  expect(src).toContain('if (!idolVideo) onIdolLayout?.(0, 0);');
});

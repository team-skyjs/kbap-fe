/**
 * KB-851 → KB-871 하단 리뷰 버튼 영역 표시 규칙 — 아래로 누적 12 = 숨김 · 위로 누적 12 = 표시 · 맨 위/아래 = 표시 ·
 * **한 제스처(끌기+관성) 안 전환 1회**(깜빡임 0) · 멈춤 표시는 제스처가 끝난 뒤 300ms만 · K-pop 카드는 버튼 띠와 겹칠 때만 숨김.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { cardUnderPill, emptyCtaOnScreen, pillOnGestureStart, pillOnIdle, pillOnScroll, PILL_DIR_THRESHOLD, PILL_IDLE_MS, useScrollAwarePill, type PillScroll, type PillState } from '../scrollAwarePill';

const BAND = 72; // 버튼 48 + 하단 여백 16 + 8
const S = (y: number, card: PillScroll['card'] = null): PillScroll => ({ y, viewH: 700, contentH: 3000, card, band: BAND });
const ST = (shown: boolean, lastY: number, acc = 0, flipped = false): PillState => ({ shown, lastY, acc, flipped });

it('임계 12 · 멈춤 300ms', () => {
  expect(PILL_DIR_THRESHOLD).toBe(12);
  expect(PILL_IDLE_MS).toBe(300);
});

it('아래로 누적 12 = 숨김(11은 그대로) · 위로 누적 12 = 표시 · 방향이 바뀌면 누적 새로', () => {
  let st = ST(true, 1000);
  st = pillOnScroll(st, S(1006)); expect(st.shown).toBe(true);
  st = pillOnScroll(st, S(1011)); expect(st.shown).toBe(true); // 누적 11
  st = pillOnScroll(st, S(1012)); expect(st.shown).toBe(false); // 누적 12
  st = pillOnGestureStart(st); // 다음 제스처
  st = pillOnScroll(st, S(1006)); expect(st.shown).toBe(false); // 위로 6
  st = pillOnScroll(st, S(1010)); expect(st.shown).toBe(false); // 다시 아래(누적 새로)
  st = pillOnScroll(st, S(998)); expect(st.shown).toBe(true); // 위로 12
});

it('KB-871 ①: 한 제스처 안에서는 숨김 → 표시로 되돌아가지 않는다(손가락 떨림·관성 끝 반동으로 위 12가 와도)', () => {
  let st = pillOnGestureStart(ST(true, 500));
  st = pillOnScroll(st, S(520)); expect(st.shown).toBe(false); // 내리는 순간 숨김(전환 1회 사용)
  st = pillOnScroll(st, S(505)); expect(st.shown).toBe(false); // 같은 제스처 안 위로 15 — 그대로
  st = pillOnScroll(st, S(700)); expect(st.shown).toBe(false);
  st = pillOnScroll(st, S(680)); expect(st.shown).toBe(false);
  // 새 제스처에서 위로 12 = 표시
  st = pillOnGestureStart(st);
  st = pillOnScroll(st, S(668)); expect(st.shown).toBe(true);
});

it('맨 위·맨 아래 = 표시(제스처 잠금과 무관 — 끝에 닿으면 보인다)', () => {
  expect(pillOnScroll(ST(false, 20, 0, true), S(0)).shown).toBe(true);
  expect(pillOnScroll(ST(false, 2280, 0, true), S(2300)).shown).toBe(true); // 2300 + 700 = 콘텐츠 끝
});

it('KB-871 ②: K-pop 카드는 버튼 띠(화면 아래 72)와 겹칠 때만 숨김 — 첫 화면 위쪽에 있는 카드는 버튼을 막지 않는다', () => {
  const top = { y: 420, h: 180 }; // 제목 아래 카드(화면 420~600) — 띠(628~700)와 안 겹침
  expect(cardUnderPill(S(0, top))).toBe(false);
  expect(pillOnScroll(ST(true, 0), S(0, top)).shown).toBe(true); // 진입부터 표시(구 규칙 = 여기서 숨김이었다)
  expect(pillOnIdle(ST(false, 0), S(0, top)).shown).toBe(true);
  const low = { y: 600, h: 180 }; // 화면 600~780 — 띠와 겹침
  expect(cardUnderPill(S(0, low))).toBe(true);
  expect(pillOnScroll(ST(true, 0), S(0, low)).shown).toBe(false);
  expect(pillOnIdle(ST(true, 0), S(0, low)).shown).toBe(false);
  expect(cardUnderPill(S(200, low))).toBe(false); // 200 내리면 카드 400~580 — 띠 위로 지나감
  expect(cardUnderPill({ ...S(0, low), band: undefined })).toBe(false); // 띠 측정 전 = 카드 규칙 없음
});

it('KB-871 QA AP ②: 바닥·위 바운스(오버스크롤)의 이동은 방향 판정에서 뺀다 — 맨 아래 도달 직후 흐려졌다 다시 뜨는 깜빡임 0', () => {
  // 콘텐츠 3000 · 화면 700 → 최대 y 2300. 관성으로 2300을 넘어 2340까지 갔다 돌아옴
  let st = pillOnGestureStart(ST(true, 2300)); // 맨 아래(최대 y)에 막 도달
  for (const y of [2320, 2340, 2325, 2310, 2300]) { st = pillOnScroll(st, S(y)); expect({ y, shown: st.shown }).toEqual({ y, shown: true }); }
  expect(st.acc).toBe(0);
  // 위 바운스(음수)도 같음
  st = pillOnGestureStart(ST(true, 0));
  for (const y of [-20, -40, -10, 0]) { st = pillOnScroll(st, S(y)); expect(st.shown).toBe(true); }
  // 정상 구간 이동은 그대로 판정
  st = pillOnGestureStart(ST(true, 1000));
  st = pillOnScroll(st, S(1015));
  expect(st.shown).toBe(false);
});

it('KB-871 QA ③: 본문 빈 리뷰 상자("Write a review")가 화면에 보이는 동안 = 숨김 · 화면 밖 = 일반 규칙', () => {
  const cta = { y: 1500, h: 140 };
  expect(emptyCtaOnScreen({ ...S(1000), emptyCta: cta })).toBe(true); // 화면 1000~1700 안
  expect(pillOnScroll(ST(true, 1000), { ...S(1000), emptyCta: cta }).shown).toBe(false);
  expect(pillOnIdle(ST(true, 1000), { ...S(1000), emptyCta: cta }).shown).toBe(false);
  expect(emptyCtaOnScreen({ ...S(600), emptyCta: cta })).toBe(false); // 화면 600~1300 — 아직 아래
  expect(pillOnIdle(ST(false, 600), { ...S(600), emptyCta: cta }).shown).toBe(true);
});

describe('훅 — 첫 진입(KB-871 QA AP ①)', () => {
  let api!: ReturnType<typeof useScrollAwarePill>;
  const keep = (a: ReturnType<typeof useScrollAwarePill>) => { api = a; };
  function Probe({ ex, onApi }: { ex: { card: boolean; emptyCta: boolean }; onApi: typeof keep }) { onApi(useScrollAwarePill(ex)); return null; }
  const Harness = ({ expect: ex }: { expect: { card: boolean; emptyCta: boolean } }) => <Probe ex={ex} onApi={keep} />;
  it('겹침 대상(카드)이 있으면 띠·카드 측정 전까지 숨김(ready=false) → 겹치지 않으면 그때 표시', () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Harness expect={{ card: true, emptyCta: false }} />); });
    expect([api.ready, api.shown]).toEqual([false, false]);
    act(() => { api.onViewLayout(700); api.onContentSize(3000); });
    expect([api.ready, api.shown]).toEqual([false, false]); // 띠·카드 아직
    act(() => { api.onBand(BAND); });
    expect([api.ready, api.shown]).toEqual([false, false]); // 카드 아직
    act(() => { api.onCardLayout(420, 180); });
    expect([api.ready, api.shown]).toEqual([true, true]); // 카드 = 띠 위쪽 → 표시
    act(() => t.unmount());
  });
  it('카드가 띠와 겹치는 자리면 측정 뒤에도 숨김(번쩍 보였다 사라짐 0)', () => {
    act(() => { renderer.create(<Harness expect={{ card: true, emptyCta: false }} />); });
    act(() => { api.onViewLayout(700); api.onContentSize(3000); api.onBand(BAND); api.onCardLayout(600, 180); });
    expect([api.ready, api.shown]).toEqual([true, false]);
  });
  it('Codex #337: 첫 리뷰를 쓰고 돌아와 빈 리뷰 상자가 사라지면(높이 0) 옛 자리로 숨어 있지 않고 다시 판정 = 표시', () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Harness expect={{ card: false, emptyCta: true }} />); });
    act(() => { api.onViewLayout(700); api.onContentSize(3000); api.onBand(BAND); api.onEmptyCtaLayout(200, 140); });
    expect([api.ready, api.shown]).toEqual([true, false]); // 상자가 화면 안
    act(() => { t.update(<Harness expect={{ card: false, emptyCta: false }} />); api.onEmptyCtaLayout(0, 0); });
    expect([api.ready, api.shown]).toEqual([true, true]);
  });
  it('Codex #337 회귀: 대상 집합이 바뀌면 사라진 대상의 옛 사각형은 지운다(높이 0 보고가 없어도) · 새 대상은 측정까지 다시 숨김', () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Harness expect={{ card: false, emptyCta: true }} />); });
    act(() => { api.onViewLayout(700); api.onContentSize(3000); api.onBand(BAND); api.onEmptyCtaLayout(200, 140); });
    expect([api.ready, api.shown]).toEqual([true, false]);
    act(() => { t.update(<Harness expect={{ card: false, emptyCta: false }} />); }); // 첫 리뷰 뒤 — 상자 사라짐(레이아웃 보고 없음)
    expect([api.ready, api.shown]).toEqual([true, true]);
    act(() => { t.update(<Harness expect={{ card: true, emptyCta: false }} />); }); // 카드 캐시가 새로 생김 — 측정 전 = 숨김
    expect([api.ready, api.shown]).toEqual([false, false]);
    act(() => { api.onCardLayout(420, 180); });
    expect([api.ready, api.shown]).toEqual([true, true]);
  });
  it('KB-871 ②: 카드가 버튼 띠 위쪽이면 표시 · 띠와 겹치면 숨김 · 카드가 사라지면(높이 0) 표시', () => {
    act(() => { renderer.create(<Harness expect={{ card: true, emptyCta: false }} />); });
    act(() => { api.onViewLayout(700); api.onContentSize(3000); api.onBand(BAND); api.onCardLayout(420, 180); });
    expect(api.shown).toBe(true);
    act(() => { api.onCardLayout(600, 180); });
    expect(api.shown).toBe(false);
    act(() => { api.onCardLayout(0, 0); });
    expect(api.shown).toBe(true);
  });
  it('대상 없는 음식 = 바로 표시(지금 동작 유지) · 음식이 뜬 뒤 대상이 생기면 그 측정까지 숨김', () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Harness expect={{ card: false, emptyCta: false }} />); });
    expect([api.ready, api.shown]).toEqual([true, true]);
    act(() => { t.update(<Harness expect={{ card: false, emptyCta: true }} />); });
    expect([api.ready, api.shown]).toEqual([false, false]);
    act(() => { api.onViewLayout(700); api.onContentSize(3000); api.onBand(BAND); api.onEmptyCtaLayout(2700, 140); });
    expect([api.ready, api.shown]).toEqual([true, true]); // 상자는 화면 밖(아래)
  });
});

describe('훅', () => {
  let api!: ReturnType<typeof useScrollAwarePill>;
  const keep = (a: ReturnType<typeof useScrollAwarePill>) => { api = a; };
  function Harness({ onApi }: { onApi: typeof keep }) { onApi(useScrollAwarePill()); return null; }
  const ev = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y }, layoutMeasurement: { width: 375, height: 700 }, contentSize: { width: 375, height: 3000 } } }) as never;
  beforeEach(() => {
    jest.useFakeTimers();
    act(() => { renderer.create(<Harness onApi={keep} />); });
    act(() => { api.onViewLayout(700); api.onContentSize(3000); api.onBand(BAND); });
  });
  afterEach(() => jest.useRealTimers());

  it('KB-871 ①: 끌기 중 300ms 멈춰도(손가락 댄 채) 다시 뜨지 않는다 · 관성 중에도 · 제스처가 끝나고 300ms 뒤에만 표시', () => {
    expect(api.shown).toBe(true);
    act(() => { api.onScrollBeginDrag(); api.onScroll(ev(1000)); api.onScroll(ev(1030)); });
    expect(api.shown).toBe(false);
    act(() => { jest.advanceTimersByTime(PILL_IDLE_MS * 3); }); // 손가락 댄 채 멈춤 — 구 규칙은 여기서 다시 떴다
    expect(api.shown).toBe(false);
    act(() => { api.onScroll(ev(1060)); api.onScrollEndDrag(); api.onMomentumScrollBegin(); });
    act(() => { jest.advanceTimersByTime(PILL_IDLE_MS * 2); }); // 관성 중
    expect(api.shown).toBe(false);
    act(() => { api.onScroll(ev(1200)); api.onScroll(ev(1185)); }); // 관성 끝 반동(위로 15) — 같은 제스처라 그대로
    expect(api.shown).toBe(false);
    act(() => { api.onMomentumScrollEnd(); });
    act(() => { jest.advanceTimersByTime(PILL_IDLE_MS - 1); });
    expect(api.shown).toBe(false);
    act(() => { jest.advanceTimersByTime(1); });
    expect(api.shown).toBe(true);
  });

  it('관성 없는 끌기 끝 = 300ms 뒤 표시 · 새 제스처 시작 = 대기 중 멈춤 판정 취소', () => {
    act(() => { api.onScrollBeginDrag(); api.onScroll(ev(1000)); api.onScroll(ev(1030)); api.onScrollEndDrag(); });
    act(() => { jest.advanceTimersByTime(PILL_IDLE_MS - 50); api.onScrollBeginDrag(); });
    act(() => { jest.advanceTimersByTime(PILL_IDLE_MS * 2); });
    expect(api.shown).toBe(false);
    act(() => { api.onScrollEndDrag(); jest.advanceTimersByTime(PILL_IDLE_MS); });
    expect(api.shown).toBe(true);
  });

});

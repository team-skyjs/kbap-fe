/**
 * 음식 상세 하단 리뷰 버튼 영역의 표시 규칙(KB-851 → KB-871 예진 10/22 실기 수정).
 * - 아래로 스크롤(누적 12) = 숨김 · 위로 스크롤(누적 12) = 표시 · 맨 위·맨 아래 = 표시
 * - **한 제스처(끌기 + 이어지는 관성) 안에서는 상태가 한 번만 바뀐다**(KB-871 ①: 내리는 순간 숨었다가 조금 더 내리면 다시 뜨던 깜빡임).
 *   원인 = 멈춤 타이머가 스크롤 이벤트 사이(손가락을 댄 채 잠깐 멈춘 끌기·관성 직전)에 터져 제스처 도중 "표시"로 되돌렸다.
 *   이제 멈춤 표시(300ms)는 제스처가 완전히 끝난 뒤(끌기 끝 + 관성 없음 / 관성 끝)에만.
 * - K-pop 카드 = **버튼 영역과 겹칠 때만** 숨김(KB-871 ②). 원인 = 구 규칙이 "카드가 화면 어디든 보이면 숨김"이었고 카드가 첫 화면
 *   (제목 바로 아래)에 있어, 진입부터 카드를 헤더 뒤로 넘길 때까지 맨 위·멈춤 규칙보다 카드 규칙이 이겨 버튼이 뜨지 않았다.
 * - 오버스크롤(위 바운스 y < 0 · 아래 바운스 y > 콘텐츠 − 화면)의 이동은 방향 판정에서 뺀다(KB-871 QA AP: 바닥 바운스 깜빡임)
 * - 첫 진입: 카드·빈 리뷰 상자처럼 겹침을 판정할 대상이 있으면 그 측정과 버튼 띠 측정이 끝날 때까지 **애니메이션 없이 숨김**으로 시작,
 *   측정 뒤 겹치지 않으면 그때 페이드인(KB-871 QA AP: K-pop 음식 진입 때 버튼이 카드 위에 0.15초 보였다 사라짐). 대상 없는 음식 = 바로 표시.
 * - 본문 빈 리뷰 상자("Write a review")가 화면에 보이는 동안 = 숨김(같은 버튼이 두 개 보이지 않게, QA 참고 ③)
 * - 스크린리더 켜짐 = 항상 표시(숨긴 버튼을 VoiceOver가 못 찾는다, KB-851 QA)
 * 순수 함수 + 훅 — 화면은 표시 여부만 받아 슬라이드·페이드(모션 줄이기 = 슬라이드 없이 페이드만)로 그린다.
 */
import * as React from 'react';
import { AccessibilityInfo, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

export const PILL_DIR_THRESHOLD = 12;
export const PILL_IDLE_MS = 300;
export const PILL_FADE_MS = 200;

/** band = 화면 바닥에서 버튼 영역 위끝까지(버튼 줄 + 하단 여백 + 8) — 카드가 이 띠와 겹칠 때만 숨긴다 */
export type Rect = { y: number; h: number };
export type PillScroll = { y: number; viewH: number; contentH: number; card: Rect | null; band?: number; emptyCta?: Rect | null };
/** flipped = 이번 제스처에서 이미 상태를 바꿨다(제스처가 끝날 때까지 방향 판정으로는 더 안 바꾼다) */
export type PillState = { shown: boolean; lastY: number; acc: number; flipped: boolean };

export const cardUnderPill = (s: PillScroll): boolean => {
  if (!s.card || s.card.h <= 0 || !s.band) return false;
  const top = s.card.y - s.y;
  const bottom = top + s.card.h;
  return top < s.viewH && bottom > s.viewH - s.band;
};
/** 본문 빈 리뷰 상자가 화면 안에 보임 */
export const emptyCtaOnScreen = (s: PillScroll): boolean => {
  if (!s.emptyCta || s.emptyCta.h <= 0 || s.viewH <= 0) return false;
  const top = s.emptyCta.y - s.y;
  return top < s.viewH && top + s.emptyCta.h > 0;
};
const blocked = (s: PillScroll) => cardUnderPill(s) || emptyCtaOnScreen(s);
const overscrolled = (y: number, s: PillScroll) => y < 0 || (s.contentH > 0 && s.viewH > 0 && y > Math.max(0, s.contentH - s.viewH));

/** 스크롤 한 번 — 방향이 바뀌면 누적을 새로 시작, 임계를 넘으면(이번 제스처 첫 전환일 때만) 상태를 바꾼다 */
export function pillOnScroll(st: PillState, s: PillScroll): PillState {
  // 바운스(오버스크롤) 구간이 걸린 이동은 방향으로 세지 않는다
  const dy = overscrolled(s.y, s) || overscrolled(st.lastY, s) ? 0 : s.y - st.lastY;
  const acc = dy === 0 ? st.acc : Math.sign(dy) !== Math.sign(st.acc) ? dy : st.acc + dy;
  const atTop = s.y <= 0;
  const atBottom = s.contentH > 0 && s.y + s.viewH >= s.contentH - 1;
  let { shown, flipped } = st;
  let nextAcc = acc;
  if (blocked(s)) shown = false;
  else if (atTop || atBottom) shown = true;
  else if (!st.flipped && acc >= PILL_DIR_THRESHOLD) { if (shown) flipped = true; shown = false; nextAcc = 0; }
  else if (!st.flipped && acc <= -PILL_DIR_THRESHOLD) { if (!shown) flipped = true; shown = true; nextAcc = 0; }
  return { shown, lastY: s.y, acc: nextAcc, flipped };
}

/** 새 제스처(손가락이 닿음) — 전환 잠금·누적 초기화 */
export const pillOnGestureStart = (st: PillState): PillState => ({ ...st, acc: 0, flipped: false });

/** 제스처가 끝나고 300ms 멈춤 — 카드가 버튼 자리에 없으면 표시 */
export const pillOnIdle = (st: PillState, s: PillScroll): PillState => ({ ...st, shown: !blocked(s), acc: 0, flipped: false });

type Ev = NativeSyntheticEvent<NativeScrollEvent>;

/** 화면 배선 — ScrollView onScroll·끌기/관성 시작·끝·onLayout·onContentSizeChange와 카드·빈 리뷰 상자 위치·버튼 띠를 받아 표시 여부를 돌려준다.
 *  expect = 겹침을 판정할 대상이 이 화면에 생기는지(카드 캐시·리뷰 0) — 있으면 그 측정 전까지 ready=false(숨김, 애니메이션 없음) */
export function useScrollAwarePill(expect: { card: boolean; emptyCta: boolean } = { card: false, emptyCta: false }) {
  const scroll = React.useRef<PillScroll>({ y: 0, viewH: 0, contentH: 0, card: null, emptyCta: null });
  const st = React.useRef<PillState>({ shown: true, lastY: 0, acc: 0, flipped: false });
  // 음식이 뜬 뒤에야 대상 유무를 알므로 렌더마다 파생 — 기다릴 대상이 있으면 측정이 다 올 때까지 ready=false
  const waiting = expect.card || expect.emptyCta;
  const [gotAll, setGotAll] = React.useState(false);
  // Codex #337: 대상 집합이 바뀌면(첫 리뷰 뒤 빈 상자 사라짐 · 카드 캐시 생김/사라짐) 준비 상태를 다시 — 렌더 중 전이 비교(KB-603 문법)
  const key = `${expect.card}|${expect.emptyCta}`;
  const [prevKey, setPrevKey] = React.useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setGotAll(false);
  }
  const ready = !waiting || gotAll;
  const expectRef = React.useRef(expect);
  const idle = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = React.useRef({ dragging: false, momentum: false });
  const [shown, setShown] = React.useState(true);
  const [reader, setReader] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => { if (alive) setReader(on); });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    return () => { alive = false; sub.remove(); };
  }, []);
  const apply = React.useCallback((next: PillState) => {
    st.current = next;
    setShown(next.shown);
  }, []);
  // 판정 입력 = 지금 기대하는 대상의 사각형만 — 사라진 대상의 옛 사각형으로 숨지 않는다(Codex #337)
  const view = React.useCallback((): PillScroll => {
    const e = expectRef.current;
    const c = scroll.current;
    return { ...c, card: e.card ? c.card : null, emptyCta: e.emptyCta ? c.emptyCta : null };
  }, []);
  // 기다리는 측정(띠·카드·빈 상자)이 다 오면 그때 처음으로 규칙대로(겹침 없으면 표시) 정한다
  const settle = React.useCallback(() => {
    const e = expectRef.current;
    const c = scroll.current;
    const all = !!c.band && (!e.card || c.card != null) && (!e.emptyCta || c.emptyCta != null);
    if (all && !gotAll) {
      setGotAll(true);
      apply(pillOnIdle(st.current, view())); // 첫 판정 = 멈춘 상태와 같이(겹침 없으면 표시)
      return;
    }
    apply(pillOnScroll(st.current, view()));
  }, [apply, view, gotAll]);
  // 대상 집합 변경 = 사라진 대상의 측정값을 지우고 다시 판정(새로 생긴 대상은 그 측정이 올 때까지 ready=false)
  React.useEffect(() => {
    expectRef.current = { card: expect.card, emptyCta: expect.emptyCta };
    scroll.current = { ...scroll.current, card: expect.card ? scroll.current.card : null, emptyCta: expect.emptyCta ? scroll.current.emptyCta : null };
    settle();
  }, [expect.card, expect.emptyCta]); // eslint-disable-line react-hooks/exhaustive-deps -- 대상 집합이 바뀔 때만(settle은 매 측정에서 따로 부른다)
  const clearIdle = () => { if (idle.current) { clearTimeout(idle.current); idle.current = null; } };
  const scheduleIdle = React.useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => { idle.current = null; apply(pillOnIdle(st.current, view())); }, PILL_IDLE_MS);
  }, [apply, view]);
  React.useEffect(() => () => { if (idle.current) clearTimeout(idle.current); }, []);
  const read = (e: Ev) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    // 일부 이벤트(테스트·플랫폼 차이)는 측정값이 빠질 수 있다 — 빠지면 마지막 레이아웃 값 유지
    scroll.current = { ...scroll.current, y: contentOffset.y, viewH: layoutMeasurement?.height ?? scroll.current.viewH, contentH: contentSize?.height ?? scroll.current.contentH };
  };
  const onScroll = React.useCallback((e: Ev) => {
    read(e);
    apply(pillOnScroll(st.current, view()));
    // 끌기·관성 이벤트가 없는 스크롤(프로그램 이동 등)만 여기서 멈춤 판정 — 제스처 중엔 끝 이벤트가 맡는다
    if (!active.current.dragging && !active.current.momentum) scheduleIdle();
  }, [apply, scheduleIdle, view]);
  const onScrollBeginDrag = React.useCallback(() => {
    clearIdle();
    active.current = { dragging: true, momentum: false };
    apply(pillOnGestureStart(st.current));
  }, [apply]);
  // 끌기 끝 — 관성이 이어지면 onMomentumScrollBegin이 멈춤 판정을 취소한다
  const onScrollEndDrag = React.useCallback(() => { active.current = { ...active.current, dragging: false }; scheduleIdle(); }, [scheduleIdle]);
  const onMomentumScrollBegin = React.useCallback(() => { clearIdle(); active.current = { ...active.current, momentum: true }; }, []);
  const onMomentumScrollEnd = React.useCallback(() => { active.current = { dragging: false, momentum: false }; scheduleIdle(); }, [scheduleIdle]);
  const onViewLayout = React.useCallback((h: number) => { scroll.current = { ...scroll.current, viewH: h }; settle(); }, [settle]);
  const onContentSize = React.useCallback((h: number) => { scroll.current = { ...scroll.current, contentH: h }; settle(); }, [settle]);
  const onBand = React.useCallback((band: number) => {
    if (scroll.current.band === band) return;
    scroll.current = { ...scroll.current, band };
    settle();
  }, [settle]);
  const onCardLayout = React.useCallback((y: number, h: number) => {
    scroll.current = { ...scroll.current, card: { y, h } };
    // 높이 0 = 카드가 사라짐(Codex #328) — 카드 때문에 숨어 있던 버튼을 멈춤과 같이 다시 보인다
    if (h === 0) apply(pillOnIdle(st.current, view()));
    else settle();
  }, [settle, apply, view]);
  const onEmptyCtaLayout = React.useCallback((y: number, h: number) => {
    scroll.current = { ...scroll.current, emptyCta: { y, h } };
    // 높이 0 = 상자가 사라짐(첫 리뷰를 쓰고 돌아옴 — Codex #337) — 옛 자리 기준으로 계속 숨지 않게 멈춤과 같이 다시 판정
    if (h === 0) apply(pillOnIdle(st.current, view()));
    else settle();
  }, [settle, apply, view]);
  return { shown: ready && (shown || reader), ready, onEmptyCtaLayout, onScroll, onScrollBeginDrag, onScrollEndDrag, onMomentumScrollBegin, onMomentumScrollEnd, onViewLayout, onContentSize, onCardLayout, onBand };
}

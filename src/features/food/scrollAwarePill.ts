/**
 * 음식 상세 하단 리뷰 버튼 영역의 표시 규칙(KB-851 → KB-871 예진 10/22 실기 수정).
 * - 아래로 스크롤(누적 12) = 숨김 · 위로 스크롤(누적 12) = 표시 · 맨 위·맨 아래 = 표시
 * - **한 제스처(끌기 + 이어지는 관성) 안에서는 상태가 한 번만 바뀐다**(KB-871 ①: 내리는 순간 숨었다가 조금 더 내리면 다시 뜨던 깜빡임).
 *   원인 = 멈춤 타이머가 스크롤 이벤트 사이(손가락을 댄 채 잠깐 멈춘 끌기·관성 직전)에 터져 제스처 도중 "표시"로 되돌렸다.
 *   이제 멈춤 표시(300ms)는 제스처가 완전히 끝난 뒤(끌기 끝 + 관성 없음 / 관성 끝)에만.
 * - K-pop 카드 = **버튼 영역과 겹칠 때만** 숨김(KB-871 ②). 원인 = 구 규칙이 "카드가 화면 어디든 보이면 숨김"이었고 카드가 첫 화면
 *   (제목 바로 아래)에 있어, 진입부터 카드를 헤더 뒤로 넘길 때까지 맨 위·멈춤 규칙보다 카드 규칙이 이겨 버튼이 뜨지 않았다.
 * - 스크린리더 켜짐 = 항상 표시(숨긴 버튼을 VoiceOver가 못 찾는다, KB-851 QA)
 * 순수 함수 + 훅 — 화면은 표시 여부만 받아 슬라이드·페이드(모션 줄이기 = 슬라이드 없이 페이드만)로 그린다.
 */
import * as React from 'react';
import { AccessibilityInfo, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

export const PILL_DIR_THRESHOLD = 12;
export const PILL_IDLE_MS = 300;
export const PILL_FADE_MS = 200;

/** band = 화면 바닥에서 버튼 영역 위끝까지(버튼 줄 + 하단 여백 + 8) — 카드가 이 띠와 겹칠 때만 숨긴다 */
export type PillScroll = { y: number; viewH: number; contentH: number; card: { y: number; h: number } | null; band?: number };
/** flipped = 이번 제스처에서 이미 상태를 바꿨다(제스처가 끝날 때까지 방향 판정으로는 더 안 바꾼다) */
export type PillState = { shown: boolean; lastY: number; acc: number; flipped: boolean };

export const cardUnderPill = (s: PillScroll): boolean => {
  if (!s.card || s.card.h <= 0 || !s.band) return false;
  const top = s.card.y - s.y;
  const bottom = top + s.card.h;
  return top < s.viewH && bottom > s.viewH - s.band;
};

/** 스크롤 한 번 — 방향이 바뀌면 누적을 새로 시작, 임계를 넘으면(이번 제스처 첫 전환일 때만) 상태를 바꾼다 */
export function pillOnScroll(st: PillState, s: PillScroll): PillState {
  const dy = s.y - st.lastY;
  const acc = dy === 0 ? st.acc : Math.sign(dy) !== Math.sign(st.acc) ? dy : st.acc + dy;
  const atTop = s.y <= 0;
  const atBottom = s.contentH > 0 && s.y + s.viewH >= s.contentH - 1;
  let { shown, flipped } = st;
  let nextAcc = acc;
  if (cardUnderPill(s)) shown = false;
  else if (atTop || atBottom) shown = true;
  else if (!st.flipped && acc >= PILL_DIR_THRESHOLD) { if (shown) flipped = true; shown = false; nextAcc = 0; }
  else if (!st.flipped && acc <= -PILL_DIR_THRESHOLD) { if (!shown) flipped = true; shown = true; nextAcc = 0; }
  return { shown, lastY: s.y, acc: nextAcc, flipped };
}

/** 새 제스처(손가락이 닿음) — 전환 잠금·누적 초기화 */
export const pillOnGestureStart = (st: PillState): PillState => ({ ...st, acc: 0, flipped: false });

/** 제스처가 끝나고 300ms 멈춤 — 카드가 버튼 자리에 없으면 표시 */
export const pillOnIdle = (st: PillState, s: PillScroll): PillState => ({ ...st, shown: !cardUnderPill(s), acc: 0, flipped: false });

type Ev = NativeSyntheticEvent<NativeScrollEvent>;

/** 화면 배선 — ScrollView onScroll·끌기/관성 시작·끝·onLayout·onContentSizeChange와 카드 위치·버튼 띠를 받아 표시 여부를 돌려준다 */
export function useScrollAwarePill() {
  const scroll = React.useRef<PillScroll>({ y: 0, viewH: 0, contentH: 0, card: null });
  const st = React.useRef<PillState>({ shown: true, lastY: 0, acc: 0, flipped: false });
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
  const settle = React.useCallback(() => apply(pillOnScroll(st.current, scroll.current)), [apply]);
  const clearIdle = () => { if (idle.current) { clearTimeout(idle.current); idle.current = null; } };
  const scheduleIdle = React.useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => { idle.current = null; apply(pillOnIdle(st.current, scroll.current)); }, PILL_IDLE_MS);
  }, [apply]);
  React.useEffect(() => () => { if (idle.current) clearTimeout(idle.current); }, []);
  const read = (e: Ev) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    // 일부 이벤트(테스트·플랫폼 차이)는 측정값이 빠질 수 있다 — 빠지면 마지막 레이아웃 값 유지
    scroll.current = { ...scroll.current, y: contentOffset.y, viewH: layoutMeasurement?.height ?? scroll.current.viewH, contentH: contentSize?.height ?? scroll.current.contentH };
  };
  const onScroll = React.useCallback((e: Ev) => {
    read(e);
    apply(pillOnScroll(st.current, scroll.current));
    // 끌기·관성 이벤트가 없는 스크롤(프로그램 이동 등)만 여기서 멈춤 판정 — 제스처 중엔 끝 이벤트가 맡는다
    if (!active.current.dragging && !active.current.momentum) scheduleIdle();
  }, [apply, scheduleIdle]);
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
    if (h === 0) apply(pillOnIdle(st.current, scroll.current));
    else settle();
  }, [settle, apply]);
  return { shown: shown || reader, onScroll, onScrollBeginDrag, onScrollEndDrag, onMomentumScrollBegin, onMomentumScrollEnd, onViewLayout, onContentSize, onCardLayout, onBand };
}

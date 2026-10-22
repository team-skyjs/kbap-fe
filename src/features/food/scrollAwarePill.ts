/**
 * 음식 상세 떠 있는 리뷰 알약의 표시 규칙(KB-851, 시안 kpop-detail-2026-10-21 v1 "Review CTA").
 * - K-pop 카드가 화면에 보이는 동안 = 숨김(무조건). "보임" = 플로팅 헤더 아래 ~ 하단 안전 영역 위(헤더 뒤로 들어간 카드는 안 보임 — KB-851 QA)
 * - 스크린리더 켜짐 = 항상 표시(숨김 규칙 끔 — 숨긴 버튼을 VoiceOver가 못 찾는다, KB-851 QA)
 * - 카드가 화면 밖: 아래로 스크롤(누적 12) = 숨김 · 위로 스크롤(누적 12) = 표시 · 300ms 멈춤 = 표시
 * - 맨 위·맨 아래 = 표시(카드가 보이면 카드 규칙이 이긴다)
 * 순수 함수 + 훅 — 화면은 표시 여부만 받아 150ms 페이드(모션 줄이기 = 즉시)로 그린다.
 */
import * as React from 'react';
import { AccessibilityInfo, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

export const PILL_DIR_THRESHOLD = 12;
export const PILL_IDLE_MS = 300;
export const PILL_FADE_MS = 150;

/** top = 화면 위를 덮는 플로팅 헤더 높이 · bottom = 하단 안전 영역 — 이 사이만 "보이는" 영역 */
export type PillScroll = { y: number; viewH: number; contentH: number; card: { y: number; h: number } | null; top?: number; bottom?: number };
export type PillState = { shown: boolean; lastY: number; acc: number };

export const cardOnScreen = (s: PillScroll): boolean =>
  !!s.card && s.card.h > 0 && s.card.y < s.y + s.viewH - (s.bottom ?? 0) && s.card.y + s.card.h > s.y + (s.top ?? 0);

/** 스크롤 한 번 — 방향이 바뀌면 누적을 새로 시작, 임계를 넘으면 상태를 바꾸고 누적을 비운다 */
export function pillOnScroll(st: PillState, s: PillScroll): PillState {
  const dy = s.y - st.lastY;
  const acc = dy === 0 ? st.acc : Math.sign(dy) !== Math.sign(st.acc) ? dy : st.acc + dy;
  const atTop = s.y <= 0;
  const atBottom = s.contentH > 0 && s.y + s.viewH >= s.contentH - 1;
  let shown = st.shown;
  let nextAcc = acc;
  if (cardOnScreen(s)) shown = false;
  else if (atTop || atBottom) shown = true;
  else if (acc >= PILL_DIR_THRESHOLD) { shown = false; nextAcc = 0; }
  else if (acc <= -PILL_DIR_THRESHOLD) { shown = true; nextAcc = 0; }
  return { shown, lastY: s.y, acc: nextAcc };
}

/** 300ms 멈춤 — 카드가 보이지 않으면 표시 */
export const pillOnIdle = (st: PillState, s: PillScroll): PillState => ({ ...st, shown: !cardOnScreen(s), acc: 0 });

/** 화면 배선 — ScrollView onScroll·onLayout·onContentSizeChange와 카드 위치를 받아 표시 여부를 돌려준다 */
export function useScrollAwarePill() {
  const scroll = React.useRef<PillScroll>({ y: 0, viewH: 0, contentH: 0, card: null });
  const st = React.useRef<PillState>({ shown: true, lastY: 0, acc: 0 });
  const idle = React.useRef<ReturnType<typeof setTimeout> | null>(null);
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
  React.useEffect(() => () => { if (idle.current) clearTimeout(idle.current); }, []);
  const onScroll = React.useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    // 일부 이벤트(테스트·플랫폼 차이)는 측정값이 빠질 수 있다 — 빠지면 마지막 레이아웃 값 유지
    scroll.current = { ...scroll.current, y: contentOffset.y, viewH: layoutMeasurement?.height ?? scroll.current.viewH, contentH: contentSize?.height ?? scroll.current.contentH };
    apply(pillOnScroll(st.current, scroll.current));
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => apply(pillOnIdle(st.current, scroll.current)), PILL_IDLE_MS);
  }, [apply]);
  const onViewLayout = React.useCallback((h: number) => { scroll.current = { ...scroll.current, viewH: h }; settle(); }, [settle]);
  const onContentSize = React.useCallback((h: number) => { scroll.current = { ...scroll.current, contentH: h }; settle(); }, [settle]);
  const onInsets = React.useCallback((top: number, bottom: number) => {
    if (scroll.current.top === top && scroll.current.bottom === bottom) return;
    scroll.current = { ...scroll.current, top, bottom };
    settle();
  }, [settle]);
  const onCardLayout = React.useCallback((y: number, h: number) => {
    scroll.current = { ...scroll.current, card: { y, h } };
    // 높이 0 = 카드가 사라짐(Codex #328) — 카드 때문에 숨어 있던 알약을 멈춤과 같이 다시 보인다
    if (h === 0) apply(pillOnIdle(st.current, scroll.current));
    else settle();
  }, [settle, apply]);
  return { shown: shown || reader, onScroll, onViewLayout, onContentSize, onCardLayout, onInsets };
}

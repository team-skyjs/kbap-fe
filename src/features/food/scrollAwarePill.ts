/**
 * 음식 상세 떠 있는 리뷰 알약의 표시 규칙(KB-851, 시안 kpop-detail-2026-10-21 v1 "Review CTA").
 * - K-pop 카드가 화면에 보이는 동안 = 숨김(무조건)
 * - 카드가 화면 밖: 아래로 스크롤(누적 12) = 숨김 · 위로 스크롤(누적 12) = 표시 · 300ms 멈춤 = 표시
 * - 맨 위·맨 아래 = 표시(카드가 보이면 카드 규칙이 이긴다)
 * 순수 함수 + 훅 — 화면은 표시 여부만 받아 150ms 페이드(모션 줄이기 = 즉시)로 그린다.
 */
import * as React from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export const PILL_DIR_THRESHOLD = 12;
export const PILL_IDLE_MS = 300;
export const PILL_FADE_MS = 150;

export type PillScroll = { y: number; viewH: number; contentH: number; card: { y: number; h: number } | null };
export type PillState = { shown: boolean; lastY: number; acc: number };

export const cardOnScreen = (s: PillScroll): boolean => !!s.card && s.card.h > 0 && s.card.y < s.y + s.viewH && s.card.y + s.card.h > s.y;

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
  const onCardLayout = React.useCallback((y: number, h: number) => { scroll.current = { ...scroll.current, card: { y, h } }; settle(); }, [settle]);
  return { shown, onScroll, onViewLayout, onContentSize, onCardLayout };
}

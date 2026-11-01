/**
 * KB-954(P-570 추가, 예진 실기): 탭바 누름 신호 — 탭 바(_layout AppTabBar)가 낸다.
 * reselect = 이미 그 탭에서 다시 누름(맨 위 + 새로고침) · enter = 다른 탭에서 들어옴(Reviews = 첫 페이지 재조회).
 * 화면은 내비게이션 훅 없이 구독만(테스트·임베드 화면에서도 안전 — Provider·내비게이터 불필요).
 */
import * as React from 'react';

export type TabName = 'index' | 'food' | 'community' | 'profile';
export type TabPressKind = 'reselect' | 'enter';
const subs = new Map<string, Set<(kind: TabPressKind) => void>>();

export function emitTabPress(tab: string, kind: TabPressKind): void {
  subs.get(tab)?.forEach((fn) => fn(kind));
}

export function useTabPress(tab: TabName, fn: (kind: TabPressKind) => void, enabled = true): void {
  const latest = React.useRef(fn);
  // KB-657: 최신 콜백 ref는 커밋에서 동기화(렌더 중 ref 쓰기 0)
  React.useLayoutEffect(() => {
    latest.current = fn;
  });
  React.useEffect(() => {
    if (!enabled) return;
    const handler = (kind: TabPressKind) => latest.current(kind);
    const set = subs.get(tab) ?? new Set();
    subs.set(tab, set);
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }, [tab, enabled]);
}

/** QA Q-388 ②: 재탭 = 맨 위 이동을 먼저(애니메이션 없이 — 애니메이션 스크롤과 RefreshControl refreshing이 동시에 걸리면 iOS에서 스크롤이 중간에 멈췄다) → 다음 프레임에 새로고침 */
export function topThenRefresh(scrollTop: () => void, refresh: () => void): void {
  scrollTop();
  requestAnimationFrame(refresh);
}

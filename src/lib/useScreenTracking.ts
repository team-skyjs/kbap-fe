/**
 * useScreenTracking (KB-784) — 화면 조회 계측의 유일한 지점(app/_layout 루트에서 1회 호출).
 * screen = 라우트 **패턴**(useSegments — `food/[id]`, `(tabs)/profile` · 실제 id 없음). 패턴이 바뀔 때 1회 screen_view.
 * 탭 전환·스택 push/pop·뒤로가기 복귀·딥링크 진입이 전부 세그먼트 변화라 32개 라우트를 한 번에 덮는다.
 * 앱 포그라운드 복귀 재발화는 하지 않는다(예진 10/14 — 세그먼트가 안 바뀌면 안 보냄). 기존 app_tab_view는 그대로 유지.
 * ui_click의 screen도 여기서 갱신한다(lib/uiClick setCurrentScreen).
 */
import * as React from 'react';
import { useSegments } from 'expo-router';
import { EVENTS, track } from '@/lib/analytics';
import { screenFromSegments, setCurrentScreen } from '@/lib/uiClick';
import { hasPendingDeeplink, isEntryResolved, releaseNavHold, subscribeEntryResolved } from '@/lib/deeplink';

/** PR 280 Codex P2: 진입 정착(lib/deeplink — 첫 실행 판별·로그인 리다이렉트 끝) **뒤에만** screen_view. 신규 설치는 부팅 때 (tabs)가 먼저
 *  마운트됐다가 /login으로 교체된다 — 그 (tabs)/index는 실제 진입이 아니다. 정착 순간 현재 화면을 1회 기록한다. */
export function useScreenTracking(): void {
  const segments = useSegments();
  const screen = screenFromSegments(segments);
  const resolved = React.useSyncExternalStore(subscribeEntryResolved, isEntryResolved, isEntryResolved);
  // KB-786(#280 Codex P2): 보류 딥링크가 있으면(콜드 스타트 kbap://) 기본 루트를 기록하지 않고 이동 뒤 목적지부터
  const holding = React.useSyncExternalStore(subscribeEntryResolved, hasPendingDeeplink, hasPendingDeeplink);
  const prev = React.useRef<string | null>(null);
  /** 첫 기록을 미루는 동안 보이던 화면 — 이것과 다른 세그먼트가 오면 = 딥링크 이동이 실제 반영됨(#283 Codex P2) */
  const heldOn = React.useRef<string | null>(null);
  React.useEffect(() => {
    setCurrentScreen(screen); // ui_click 화면은 정착과 무관하게 최신
    // 보류 대기는 **첫 기록만**(콜드 스타트) — 그 뒤 로그인·온보딩 위 보류 중에도 화면 조회는 그대로
    if (!resolved) return;
    if (holding && prev.current === null) {
      if (heldOn.current === null) heldOn.current = screen;
      if (screen === heldOn.current) return; // 아직 옛 경로(이동 큐만 들어감) — 기록 0
      releaseNavHold(); // 세그먼트가 바뀜 = 목적지 도착 → 보류 해제 후 이 화면을 첫 기록으로
    }
    if (prev.current === screen) return;
    prev.current = screen;
    track(EVENTS.screen_view, { screen });
  }, [screen, resolved, holding]);
}

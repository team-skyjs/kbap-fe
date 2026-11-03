import * as React from 'react';
import { AppState, Platform } from 'react-native';
import { useNavigationContainerRef } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { track } from '@/lib/analytics';
import { BE_BASE } from '@/lib/data/config';
import { hasPendingDeeplink, isEntryResolved, subscribeEntryResolved } from '@/lib/deeplink';
import { runtimeContext } from './runtimeContext';
import { activeVisitRoute, type RouteState } from './visitRoute';
import { installVisitRuntime, VisitRuntime } from './visitRuntime';
import { isOccluded, subscribeOcclusion } from './occlusion';
import { FLAGS } from '@/lib/flags';

/** One app-root owner. Mounted after splash; route/deeplink settlement still gates every focus update. */
export function VisitTrackingHost() {
  // QA AV(da6fc0b4): expo-router 57의 useRootNavigationState는 getParent('__root').getState() 스냅숏 — 구독이 없어
  // 루트 레이아웃(여기)은 하위 이동에 다시 그려지지 않았다 → 방문 0. 컨테이너 ref의 'state' 이벤트로 받는다(렌더 중 ambient 읽기 0).
  const nav = useNavigationContainerRef();
  const [state, setState] = React.useState<RouteState | undefined>(() => (nav.isReady() ? (nav.getRootState() as RouteState) : undefined));
  React.useEffect(() => {
    let reread: ReturnType<typeof setTimeout> | null = null;
    const off = nav.addListener('state', (e) => {
      setState(e.data.state as RouteState | undefined);
      // 스택 위에 새로 올린 중첩 내비게이터(예: 상세에서 탭으로 navigate = 새 (tabs))의 첫 상태는 'state' 이벤트를 다시 내지 않는다
      // → 다음 틱에 한 번 더 읽는다. 같은 화면이면 screen·identity가 같아 방문 중복 0
      if (reread) clearTimeout(reread);
      reread = setTimeout(() => { reread = null; if (nav.isReady()) setState(nav.getRootState() as RouteState); }, 0);
    });
    return () => { off(); if (reread) clearTimeout(reread); };
  }, [nav]);
  const resolved = React.useSyncExternalStore(subscribeEntryResolved, isEntryResolved, isEntryResolved);
  const holding = React.useSyncExternalStore(subscribeEntryResolved, hasPendingDeeplink, hasPendingDeeplink);
  const owner = React.useRef<VisitRuntime | null>(null);
  const focused = resolved && !holding ? activeVisitRoute(state) : null;
  const screen = focused?.screen;
  const identity = focused?.identity;
  React.useEffect(() => {
    // Constants.platform native values are binary metadata, not expoConfig from a downloaded OTA manifest.
    const native = Constants.platform;
    const next = new VisitRuntime(() => performance.now(), track, runtimeContext({
      development: __DEV__, os: Platform.OS, beBase: BE_BASE, channel: Updates.channel,
      nativeVersion: native?.ios?.appVersion,
      nativeBuild: Platform.OS === 'ios' ? native?.ios?.buildNumber : native?.android?.versionCode,
      updateId: Updates.updateId, runtimeVersion: Updates.runtimeVersion,
    }), { dwell: FLAGS.engagementDwell }); // KB-873 ②b: 체류 = dev 채널만(teamtest·production OFF — 실수신 ③ 확인 전)
    owner.current = next;
    const uninstall = installVisitRuntime(next);
    next.setForeground(AppState.currentState === 'active');
    next.setOccluded(isOccluded());
    const offOcclusion = subscribeOcclusion(() => next.setOccluded(isOccluded()));
    const sub = AppState.addEventListener('change', (value) => next.setForeground(value === 'active'));
    return () => { offOcclusion(); sub.remove(); uninstall(); if (owner.current === next) owner.current = null; };
  }, []);
  React.useEffect(() => {
    const next = owner.current;
    // StrictMode setup/cleanup replay must not publish a phantom initial visit.
    queueMicrotask(() => { if (owner.current === next) next?.focus(screen && identity ? { screen, identity } : null); });
  }, [screen, identity]);
  return null;
}

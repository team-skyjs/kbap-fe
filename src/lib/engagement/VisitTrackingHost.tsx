import * as React from 'react';
import { AppState, Platform } from 'react-native';
import { useRootNavigationState } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { track } from '@/lib/analytics';
import { BE_BASE } from '@/lib/data/config';
import { hasPendingDeeplink, isEntryResolved, subscribeEntryResolved } from '@/lib/deeplink';
import { runtimeContext } from './runtimeContext';
import { activeVisitRoute } from './visitRoute';
import { installVisitRuntime, VisitRuntime } from './visitRuntime';

/** One app-root owner. Mounted after splash; route/deeplink settlement still gates every focus update. */
export function VisitTrackingHost() {
  const state = useRootNavigationState();
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
    }));
    owner.current = next;
    const uninstall = installVisitRuntime(next);
    next.setForeground(AppState.currentState === 'active');
    const sub = AppState.addEventListener('change', (value) => next.setForeground(value === 'active'));
    return () => { sub.remove(); uninstall(); if (owner.current === next) owner.current = null; };
  }, []);
  React.useEffect(() => {
    const next = owner.current;
    // StrictMode setup/cleanup replay must not publish a phantom initial visit.
    queueMicrotask(() => { if (owner.current === next) next?.focus(screen && identity ? { screen, identity } : null); });
  }, [screen, identity]);
  return null;
}

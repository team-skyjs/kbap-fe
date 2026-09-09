/**
 * OtaAutoApplyHost (KB-420/P-204) — 루트 레이아웃에 1회 마운트되는 OTA 자동
 * 적용 배선 + prod 배너.
 *
 * - 트리거: 마운트 + AppState active 복귀(스로틀은 otaCheck 코어).
 * - __DEV__ 또는 Updates.isEnabled=false(Metro) = 전 구간 no-op.
 * - 적용 판정은 otaPolicy 한 곳 — 비-prod 즉시 reload / prod는 안전 순간에만,
 *   아니면 상단 비차단 배너(탭 = 수동 적용). 라우트·뮤테이션 변화 시 재평가.
 * - expo-updates는 지연 require(정적 import 금지 관례 — pushAdapter와 동일 계열).
 */
import * as React from 'react';
import { AppState } from 'react-native';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { isProdChannel } from '@/lib/flags';
import { checkAndFetchOta, type OtaUpdatesModule } from './otaCheck';
import { OTA_BOOT_GUARD_MS, OTA_NETWORK_IDLE_MS, canReloadNow, otaApplyDecision } from './otaPolicy';

// P-304(KB-458): 부팅 시각 = 모듈 로드 시각 — reloadAsync 부팅 가드 기준점
const BOOTED_AT = Date.now();

function updatesModule(): OtaUpdatesModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-updates') as OtaUpdatesModule;
  } catch {
    return null; // 웹/모듈 부재 — no-op
  }
}

function applyNow(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates') as { reloadAsync(): Promise<void> };
    void Updates.reloadAsync().catch((e: Error) => console.log('[ota] reload failed:', e?.message));
  } catch {
    /* 모듈 부재 — 무시 */
  }
}

/** P-347(KB-509): 네트워크 정적 창 — react-query 진행 카운트(useIsFetching·useIsMutating)가
 *  둘 다 0으로 OTA_NETWORK_IDLE_MS 연속 정착해야 true(정착 중 재증가 = 리셋).
 *  reload 중 진행 fetch의 reject가 죽은 런타임에 스케줄되는 크래시(REACT-NATIVE-8) 봉쇄.
 *  상한 없음 — 계속 바쁘면 계속 보류(다음 포그라운드/콜드 스타트에 적용). */
export function useNetworkIdle(): boolean {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const busy = fetching > 0 || mutating > 0;
  const [idle, setIdle] = React.useState(false);
  React.useEffect(() => {
    if (busy) {
      setIdle(false); // 정착 중 재증가 = 리셋
      return;
    }
    const timer = setTimeout(() => setIdle(true), OTA_NETWORK_IDLE_MS);
    return () => clearTimeout(timer);
  }, [busy]);
  return idle;
}

export function OtaAutoApplyHost({ splashDone = true }: { splashDone?: boolean }) {
  const [ready, setReady] = React.useState(false);
  // P-304: 부팅 가드 반응 소스 — appState(active 복귀)·가드 충족 시각 타이머 재평가
  const [appActive, setAppActive] = React.useState(AppState.currentState === 'active');
  const [guardTick, setGuardTick] = React.useState(0);
  const networkIdle = useNetworkIdle(); // P-347 — QueryClientProvider 안(레이아웃 확인됨)
  const stateRef = React.useRef({ lastCheckAt: 0 });

  React.useEffect(() => {
    const check = () => {
      if (__DEV__) return; // Metro 개발 중 = no-op(코어의 isEnabled 게이트와 이중)
      const u = updatesModule();
      if (!u) return;
      void checkAndFetchOta(u, stateRef.current, Date.now()).then((r) => {
        if (r === 'ready') setReady(true);
      });
    };
    check(); // 콜드 스타트 1회
    const sub = AppState.addEventListener('change', (st) => {
      setAppActive(st === 'active'); // P-304: 가드 재평가 소스
      if (st === 'active') check(); // 포그라운드 복귀 — 스로틀은 코어가 판정
    });
    return () => sub.remove();
  }, []);

  // P-304: reloadAsync 부팅 가드 — 정책이 reload여도 가드(8s+스플래시 종료+active)
  // 통과 시에만 실행. 배너 수동 탭도 동일 경로(부팅 창 크래시 봉쇄).
  const tryApply = React.useCallback((): boolean => {
    if (!canReloadNow({ bootedAt: BOOTED_AT, now: Date.now(), splashDone, appState: appActive ? 'active' : 'background', networkIdle })) return false;
    applyNow();
    return true;
  }, [splashDone, appActive, networkIdle]);

  // 적용 재평가 — fetch 완료·라우트 변경·뮤테이션 종료·스플래시/포그라운드/가드 타이머마다
  const prod = isProdChannel();
  React.useEffect(() => {
    if (!ready) return;
    if (otaApplyDecision({ prod, pathname: '/', mutating: 0 }) !== 'reload') return; // P-316: prod 상수 defer — 라우트·뮤테이션 무관
    if (tryApply()) return;
    // 가드 미충족 — 시간 조건은 충족 시각에 1회 재평가(스플래시·active는 deps가 재평가)
    const remain = Math.max(0, OTA_BOOT_GUARD_MS - (Date.now() - BOOTED_AT)) + 50;
    const timer = setTimeout(() => setGuardTick((n) => n + 1), remain);
    return () => clearTimeout(timer);
  }, [ready, prod, tryApply, guardTick]);

  // P-316: prod = 배너·수동 적용 경로 없음(다음 콜드 스타트 자동 적용) — 렌더 0
  return null;
}


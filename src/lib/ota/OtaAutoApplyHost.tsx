/**
 * OtaAutoApplyHost (KB-420 → KB-978) — OTA 즉시 적용 배선. 운영·비운영 같은 로직(예진 11/04 P-316 변경).
 *
 * - OtaLaunchGate: 루트 트리 마운트 **전** 체크→fetch(상한 3초, 스플래시 유지). 받으면 바로 reload,
 *   넘거나 에러면 현재 번들로 트리 마운트.
 * - OtaAutoApplyHost: AppState active 복귀 순간부터 3초 창 안에서만 reload — 작업 화면 차단·
 *   네트워크 정적 게이트(P-347)·2분 스로틀 유지. 창이 닫히면 deferred(다음 복귀/콜드 스타트).
 *   KB-980: 복귀 = background를 거친 active만(iOS 시스템 팝업은 inactive만 거친다) ·
 *   권한 요청 중·응답 뒤 5초 = reload 금지(Android 팝업의 background 전이).
 * - __DEV__ 또는 Updates.isEnabled=false(Metro·dev client·jest) = 호출 0.
 * - expo-updates는 지연 require(정적 import 금지 관례 — pushAdapter와 동일 계열).
 */
import * as React from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { EVENTS, track as trackEvent } from '@/lib/analytics';
import { checkAndFetchOta, launchCheckOta, type OtaState, type OtaUpdatesModule } from './otaCheck';
import { inflightCount, subscribeInflight, track } from '@/lib/net/inflight';
import { OTA_LAUNCH_TIMEOUT_MS, OTA_NETWORK_IDLE_MS, OTA_RESUME_WINDOW_MS, canReloadNow, isBlockedRoute } from './otaPolicy';
import { permissionPromptSettled } from '@/lib/permissionPrompt';

type UpdatesWithReload = OtaUpdatesModule & { reloadAsync(): Promise<void> };
type OtaResult = 'applied' | 'none' | 'timeout' | 'error' | 'deferred';
type OtaTrigger = 'launch' | 'resume';

/** 시작·복귀 공유 상태 — 루트 1회 마운트 전제(quietRef와 같은 관례). */
const otaState: OtaState = { lastCheckAt: 0, ready: false };
let applying = false; // reload 요청 뒤 재진입(같은 창의 effect 재평가) 차단

function report(result: OtaResult, trigger: OtaTrigger): void {
  trackEvent(EVENTS.app_ota_apply, { result, trigger });
}

function updatesModule(): UpdatesWithReload | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-updates') as UpdatesWithReload;
  } catch {
    return null; // 웹/모듈 부재 — no-op
  }
}

/** __DEV__·모듈 부재·isEnabled false = null(호출 0). */
function enabledUpdates(): UpdatesWithReload | null {
  if (__DEV__) return null;
  const u = updatesModule();
  return u?.isEnabled ? u : null;
}

/** 이벤트를 먼저 남긴다 — reload가 성공하면 이 런타임은 끝난다(Amplitude 큐는 저장소 경유 다음 실행 전송).
 *  true = reload 요청됨(실패 시 'error' 추가 보고 후 false로 resolve). */
async function applyNow(u: UpdatesWithReload, trigger: OtaTrigger): Promise<boolean> {
  if (applying) return true;
  applying = true;
  report('applied', trigger);
  try {
    await u.reloadAsync();
    return true;
  } catch (e) {
    console.log('[ota] reload failed:', (e as Error)?.message);
    applying = false;
    report('error', trigger);
    return false;
  }
}

/** 시작 판정 — true = reload 요청됨(트리를 마운트하지 않는다). */
export async function runLaunchOta(u: UpdatesWithReload): Promise<boolean> {
  const r = await launchCheckOta(u, otaState, Date.now(), OTA_LAUNCH_TIMEOUT_MS);
  if (r === 'skip') return false;
  if (r !== 'ready') {
    report(r, 'launch');
    return false;
  }
  // 트리 전이라 보통 0 — 모듈 로드 부작용 요청이 있으면 P-347 창이라 보류(다음 복귀가 적용)
  if (inflightCount() > 0) {
    report('deferred', 'launch');
    return false;
  }
  return applyNow(u, 'launch');
}

/** reload가 resolve됐는데 런타임이 살아 있으면(드문 경우) 이만큼 뒤 트리를 마운트 — 빈 화면 고착 방지. */
const RELOAD_STUCK_MS = 2_000;

/** 루트 트리 마운트 전 OTA 판정(KB-978). 판정 동안 null = 네이티브 스플래시 유지(hideAsync는 트리 안). */
export function OtaLaunchGate({ children }: { children: React.ReactNode }) {
  const [u] = React.useState(enabledUpdates);
  const [done, setDone] = React.useState(u == null);
  React.useEffect(() => {
    if (!u) return;
    let alive = true;
    let stuck: ReturnType<typeof setTimeout> | undefined;
    void runLaunchOta(u).then((reloading) => {
      if (!alive) return;
      if (!reloading) setDone(true);
      else stuck = setTimeout(() => alive && setDone(true), RELOAD_STUCK_MS);
    });
    return () => {
      alive = false;
      clearTimeout(stuck);
    };
  }, [u]);
  return done ? children : null;
}

/** P-347(KB-509): 네트워크 정적 창 — RQ 진행 카운트 + raw inflight가 전부 0으로
 *  OTA_NETWORK_IDLE_MS 연속 정착해야 true(정착 중 재증가 = 리셋).
 *  reload 중 진행 fetch의 reject가 죽은 런타임에 스케줄되는 크래시(REACT-NATIVE-8) 봉쇄.
 *  상한 없음 — 계속 바쁘면 계속 보류(다음 포그라운드/콜드 스타트에 적용).
 *
 *  Codex #109 9R P1: 정착 판정을 React 상태(effect 커밋)에 얹으면 짧은 busy가
 *  커밋 전에 끝났을 때 idle=true가 살아남는다(500ms 재대기 소실) — 판정은
 *  **구독 기반 타임스탬프**: 콜백(커밋과 무관하게 호출)에서 동기 재계산. */
// Host 루트 1회 마운트 전제 — 훅과 tryApply 최종 게이트가 같은 값을 본다.
const quietRef: { since: number | null } = { since: Date.now() };

function netBusy(qc: QueryClient): boolean {
  return inflightCount() > 0 || qc.isFetching() > 0 || qc.isMutating() > 0;
}

/** 호출 시점 계산(렌더 스냅샷 아님) — tryApply 최종 게이트와 훅 반환이 공유. */
export function networkQuietNow(qc: QueryClient, now = Date.now()): boolean {
  return quietRef.since != null && now - quietRef.since >= OTA_NETWORK_IDLE_MS && !netBusy(qc);
}

/** KB-695: 판정을 렌더 본문의 일반 호출(`return networkQuietNow(qc)`)로 두면 React Compiler가 [qc]로 메모이즈해 첫 렌더 값이
 *  굳었다(비-prod에서 세션 중 자동 reload 막힘 · prod는 항상 defer라 무증상). useSyncExternalStore = 렌더마다 getSnapshot을
 *  **호출 시점**으로 다시 계산(컴파일러가 캐시하지 않는 훅 경계) — "새 요청 시작 = 같은 렌더에서 동기 false"(#109 2R) 유지.
 *  이벤트·정착 타이머는 스토어 변경 통지(onChange)로. 구독 본문(quietRef 갱신·마이크로태스크 지연·busy 전이 생략)은 기존 그대로.
 *  모든 이벤트를 (코얼레스해) 통지 — 발행값이 바뀌는 순간은 전부 재렌더로 이어져 적용 effect가 다시 평가된다(#226 Codex P2:
 *  옛 "busy 전이 없으면 통지 생략"은 정적 창 리셋을 숨겨, 그 창 안에서 거절된 tryApply가 다른 활동 전까지 재시도되지 않았다). */
export function useNetworkIdle(): boolean {
  const qc = useQueryClient();
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let alive = true; // P-363: 구독 해제 후 지연 통지 방지
      let pending = false; // 마이크로태스크 1개로 코얼레스
      const onEvent = () => {
        // >0 = 창 닫힘 · 0 = 이벤트 자체가 활동 증거라 지금부터 재계량 —
        // RQ notify 배치로 시작·종료가 한 콜백에 합쳐져도 리셋이 산다(9R P1)
        const busy = netBusy(qc);
        quietRef.since = busy ? null : Date.now();
        if (timer) clearTimeout(timer);
        if (!busy) timer = setTimeout(() => { if (alive) onChange(); }, OTA_NETWORK_IDLE_MS + 10); // 정착 시 재평가 1회
        // P-363(KB-526): QueryCache는 렌더 중(useQuery 관찰자 추가)에도 동기로 이벤트를
        // 쏜다 — 즉시 통지 = "다른 컴포넌트 렌더 중 setState" 경고 → 마이크로태스크로 지연.
        // KB-695(#226 Codex P2): **busy 전이가 없어도 통지**한다 — busy 아닌 이벤트도 정적 창(since)을 리셋해
        // 발행값 true를 false로 바꾸는데, 옛 "전이 없으면 생략"은 그 변화를 숨겨 그 창 안에서 거절된 tryApply의
        // 재시도 계기를 없앴다(정착 타이머가 와도 스냅샷 = 마지막 발행값 true → 재렌더 생략). 재렌더는
        // useSyncExternalStore가 **값이 바뀔 때만** 하므로 이벤트 폭주에도 버스트당 최대 2회(false, 정착 후 true) —
        // P-363의 "전역 캐시 이벤트마다 Host 리렌더 방지"는 유지(유닛으로 상한 잠금).
        if (pending) return;
        pending = true;
        queueMicrotask(() => {
          pending = false;
          if (alive) onChange();
        });
      };
      const subs = [subscribeInflight(onEvent), qc.getQueryCache().subscribe(onEvent), qc.getMutationCache().subscribe(onEvent)];
      onEvent(); // 구독 시점 동기화
      return () => {
        alive = false;
        for (const u of subs) u();
        if (timer) clearTimeout(timer);
      };
    },
    [qc],
  );
  const getSnapshot = React.useCallback(() => networkQuietNow(qc), [qc]);
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 테스트 전용 — 모듈 상태(otaState·applying·정적 창) 초기화. 루트 1회 마운트 전제라 앱은 부르지 않는다. */
export function resetOtaModuleStateForTest(): void {
  otaState.lastCheckAt = 0;
  otaState.ready = false;
  applying = false;
  quietRef.since = Date.now();
}

export function OtaAutoApplyHost() {
  /** 복귀 적용 창의 끝 시각 — 0 = 창 없음. */
  const [windowUntil, setWindowUntil] = React.useState(0);
  const networkIdle = useNetworkIdle(); // P-347 — QueryClientProvider 안(레이아웃 확인됨)
  const queryClient = useQueryClient(); // #109 2R P1 ②: 호출 시점 동기 재확인용
  // #109 5R ①: 작업 화면(카메라·온보딩·편집·작성·로그인) = 보류 — 로그인 시트·사진 선택기 복귀도 active 전환이다
  const pathname = usePathname();

  React.useEffect(() => {
    // KB-980: inactive→active(권한·ATT·알림 센터 등 시스템 팝업)는 복귀가 아니다 — 창·체크·이벤트 0
    let wentBackground = false;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') wentBackground = true;
      if (st !== 'active') return;
      if (!wentBackground) return;
      wentBackground = false;
      const u = enabledUpdates();
      if (!u) return;
      const until = Date.now() + OTA_RESUME_WINDOW_MS;
      // #109 4R: 받아둔 업데이트(시작 상한 뒤 도착 포함) = 재체크 생략 — 네이티브 프라미스 위 reload 창 제거
      if (otaState.ready) {
        setWindowUntil(until);
        return;
      }
      // #109 4R ②: 체크도 inflight 경유 — 정적 창이 체크 자체도 본다
      void track(checkAndFetchOta(u, otaState, Date.now())).then((r) => {
        if (r === 'ready') setWindowUntil(until); // 받는 데 창을 넘겼으면 아래 effect가 바로 deferred
        else if (r !== 'skip') report(r, 'resume'); // skip = 스로틀(이벤트 없음)
      });
    });
    return () => sub.remove();
  }, []);

  const tryApply = React.useCallback((): boolean => {
    if (isBlockedRoute(pathname)) return false;
    if (!permissionPromptSettled()) return false; // KB-980: 팝업 중·응답 뒤 5초 — 창이 닫히면 deferred
    if (!canReloadNow({ appState: AppState.currentState, networkIdle })) return false;
    // #109 2R P1 ② → 9R: 렌더 상태(networkIdle)와 무관한 **호출 시점 동기 최종 게이트**
    if (!networkQuietNow(queryClient)) return false;
    const u = enabledUpdates();
    if (!u) return false;
    void applyNow(u, 'resume');
    return true;
  }, [networkIdle, queryClient, pathname]);

  // 창 안 재평가 — 라우트 변경·네트워크 정착마다(deps). 창이 닫히면 deferred 1회.
  React.useEffect(() => {
    if (windowUntil === 0) return;
    if (Date.now() < windowUntil && tryApply()) return; // 창 밖 = 사용 중 — reload 금지
    const timer = setTimeout(() => {
      report('deferred', 'resume');
      setWindowUntil(0);
    }, Math.max(0, windowUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [windowUntil, tryApply]);

  return null;
}

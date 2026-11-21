/**
 * maintenance — 점검 화면 스위치 (KB-1026, 11/22 AWS → 홈서버 이전).
 *
 * 스위치 = Cloudflare Pages 정적 파일 {"maintenance": boolean} — API 서버(BE_BASE)와 무관하게 살아 있다.
 * 그래서 api 클라이언트가 아니라 절대 URL fetch(캐시 금지, 5초 타임아웃).
 *
 * **페일 오픈**: 점검이 아닌 상태에서 조회 실패·타임아웃·404·깨진 JSON = 통과(오프라인 사용자를 잠그지 않는다).
 * 읽었는데 필드 누락·true가 아닌 값 = 통과. 이미 점검 중일 때의 조회 실패는 **유지**(versionGate의 "blocked면 유지"와 같은 규칙) —
 * 30초 재조회는 계속 돌아, 파일이 false로 읽히는 순간 풀린다.
 *
 * 구조: versionGate와 같은 모듈 스토어. 루트에서 startMaintenance() 1회(시작 + 포그라운드 복귀 조회).
 * 앱이 active인 동안 항상 재조회(Q-431): 점검 중 30초 · 점검 아닐 때 60초 — 스위치를 켠 순간 앱을 쓰던 사용자도 1분 안에 본다.
 * 시작 조회를 못 읽으면 5초 뒤 1회 재시도. 백그라운드에서는 타이머를 돌리지 않는다. 타이머는 하나(조회가 끝날 때마다 다음 것 예약).
 * 화면은 useMaintenance() 구독(useSyncExternalStore).
 * JS-only(네이티브 신규 의존 0 — 지문 불변, OTA 안전).
 */
import * as React from 'react';
import { AppState } from 'react-native';

export const MAINTENANCE_URL = 'https://kbap-status.pages.dev/status.json';
export const MAINTENANCE_TIMEOUT_MS = 5_000;
/** 점검 중 재조회 주기 */
export const MAINTENANCE_POLL_MS = 30_000;
/** 점검이 아닐 때 재조회 주기 */
export const MAINTENANCE_IDLE_POLL_MS = 60_000;
/** 시작 조회를 못 읽었을 때 1회 재시도까지 */
export const MAINTENANCE_START_RETRY_MS = 5_000;

/** 순수 판정 — 정확히 maintenance === true일 때만 점검. 그 외 전부 통과. */
export function isMaintenanceOn(body: unknown): boolean {
  return typeof body === 'object' && body !== null && (body as { maintenance?: unknown }).maintenance === true;
}

/* ---- 모듈 스토어 ---- */

let on = false;
const subs = new Set<() => void>();
let started = false;
let active = true;
/** 시작 조회 실패 때 5초 재시도 1회 남음 */
let startRetry = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
/** 늦게 도착한 옛 응답이 새 결과를 덮지 않게 */
let seq = 0;

function setOn(next: boolean) {
  if (next === on) return;
  on = next;
  subs.forEach((f) => f());
}

function clearPoll() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
}

/** 다음 조회 예약 — 타이머는 하나. 시작 전·백그라운드면 예약하지 않는다. */
function schedule(ms: number) {
  clearPoll();
  if (!started || !active) return;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    void refreshMaintenance();
  }, ms);
}

export async function refreshMaintenance(): Promise<void> {
  const my = ++seq;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MAINTENANCE_TIMEOUT_MS);
  let next: boolean | null = null; // null = 못 읽음 → 상태 유지
  try {
    const res = await fetch(MAINTENANCE_URL, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: ctrl.signal });
    if (res.ok) next = isMaintenanceOn(await res.json());
  } catch {
    // 못 읽음 — 상태 유지(초기값 통과 = 페일 오픈). 이미 점검 중이면 유지: 그때는 API 서버가 내려가 있어 풀면 오류 화면이다
  }
  clearTimeout(timer);
  if (my !== seq) return; // 더 새 조회가 결과와 다음 예약을 맡는다
  if (next !== null) setOn(next);
  const retry = next === null && startRetry;
  startRetry = false;
  schedule(retry ? MAINTENANCE_START_RETRY_MS : on ? MAINTENANCE_POLL_MS : MAINTENANCE_IDLE_POLL_MS);
}

/** 루트 1회 — 시작 조회 + 포그라운드 복귀 재조회. cleanup 반환. */
export function startMaintenance(): () => void {
  if (started) return () => {};
  started = true;
  active = true;
  startRetry = true;
  void refreshMaintenance();
  const sub = AppState.addEventListener('change', (s) => {
    active = s === 'active';
    if (active) void refreshMaintenance();
    else clearPoll(); // 백그라운드: 타이머 0
  });
  return () => {
    sub.remove();
    started = false;
    clearPoll();
  };
}

export function useMaintenance(): boolean {
  return React.useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => on,
    () => on,
  );
}

/** 현재 상태 — 훅 밖 조회(테스트·비리액트 코드). */
export function getMaintenanceState(): boolean {
  return on;
}

/** 테스트 전용 */
export function __resetMaintenance(): void {
  on = false;
  started = false;
  seq = 0;
  active = true;
  startRetry = false;
  clearPoll();
  subs.clear();
}
export const __isPolling = () => pollTimer != null;

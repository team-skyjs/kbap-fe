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
 * 구조: versionGate와 같은 모듈 스토어. 루트에서 startMaintenance() 1회(시작 + 포그라운드 복귀 조회),
 * 점검 중에는 30초마다 재조회해 false가 되면 자동 해제. 화면은 useMaintenance() 구독(useSyncExternalStore).
 * JS-only(네이티브 신규 의존 0 — 지문 불변, OTA 안전).
 */
import * as React from 'react';
import { AppState } from 'react-native';

export const MAINTENANCE_URL = 'https://kbap-status.pages.dev/status.json';
export const MAINTENANCE_TIMEOUT_MS = 5_000;
export const MAINTENANCE_POLL_MS = 30_000;

/** 순수 판정 — 정확히 maintenance === true일 때만 점검. 그 외 전부 통과. */
export function isMaintenanceOn(body: unknown): boolean {
  return typeof body === 'object' && body !== null && (body as { maintenance?: unknown }).maintenance === true;
}

/* ---- 모듈 스토어 ---- */

let on = false;
const subs = new Set<() => void>();
let started = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
/** 늦게 도착한 옛 응답이 새 결과를 덮지 않게 */
let seq = 0;

function setOn(next: boolean) {
  if (next !== on) {
    on = next;
    subs.forEach((f) => f());
  }
  if (on && !pollTimer) pollTimer = setInterval(() => void refreshMaintenance(), MAINTENANCE_POLL_MS);
  if (!on && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
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
  if (my === seq && next !== null) setOn(next);
}

/** 루트 1회 — 시작 조회 + 포그라운드 복귀 재조회. cleanup 반환. */
export function startMaintenance(): () => void {
  if (started) return () => {};
  started = true;
  void refreshMaintenance();
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') void refreshMaintenance();
  });
  return () => {
    sub.remove();
    started = false;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
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
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  subs.clear();
}
export const __isPolling = () => pollTimer != null;

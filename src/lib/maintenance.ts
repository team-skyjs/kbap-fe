/**
 * maintenance — 점검 화면 스위치 (KB-1026, 11/22 AWS → 홈서버 이전).
 *
 * 스위치 = Cloudflare Pages 정적 파일 {"maintenance": boolean} — API 서버(BE_BASE)와 무관하게 살아 있다.
 * 그래서 api 클라이언트가 아니라 절대 URL fetch(캐시 금지, 5초 타임아웃).
 *
 * **페일 오픈**: 조회 실패·타임아웃·404·깨진 JSON·필드 누락·true가 아닌 값 = 전부 통과(오프라인 사용자를 잠그지 않는다).
 * 표시 중 재조회가 실패해도 통과로 푼다 — 점검이 끝났는데 스위치 파일만 못 읽는 사용자가 갇히지 않게.
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
  let next = false;
  try {
    const res = await fetch(MAINTENANCE_URL, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: ctrl.signal });
    if (res.ok) next = isMaintenanceOn(await res.json());
  } catch {
    // 페일 오픈 — 통과
  }
  clearTimeout(timer);
  if (my === seq) setOn(next);
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

/**
 * inflight (P-347 2R/KB-509) — 앱 전체 HTTP in-flight 카운터(단일 관문).
 *
 * react-query 카운터(useIsFetching/useIsMutating)가 못 보는 raw 요청
 * (VersionGate refreshVersionGate·legalText 등)을 OTA reload 네트워크 정적 창에
 * 포함시키기 위한 모듈. api/client.ts의 fetch와 legalText raw fetch가 inc/dec를
 * 지나므로 **향후 어떤 호출 경로가 생겨도 client.ts를 쓰는 한 자동 포함** —
 * 화면별 배선 금지. dec는 호출측 try/finally로 보장.
 */
let count = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function incInflight(): void {
  count += 1;
  notify();
}

export function decInflight(): void {
  count = Math.max(0, count - 1);
  notify();
}

export function inflightCount(): number {
  return count;
}

/** useSyncExternalStore 계약 — 변경마다 통지, 해제 함수 반환. */
export function subscribeInflight(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

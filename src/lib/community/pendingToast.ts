/**
 * pendingToast — 화면 전환을 넘어 전달되는 1회성 토스트 (P-087: 상세발 차단 →
 * 피드 복귀+토스트). 모듈 상태 하나 — 인프라 불요.
 */
let pending: string | null = null;
export function setPendingToast(msg: string): void {
  pending = msg;
}
export function consumePendingToast(): string | null {
  const m = pending;
  pending = null;
  return m;
}

/**
 * topToastStore (P-346) — showTopToast 발화 채널. TopToastHost(reanimated 의존)와
 * 분리해 lib(bookmarks 등)이 애니메이션 스택을 끌고 오지 않게 한다(잼 격리 포함).
 */
/** P-366 ③(KB-529): icon — 'check'(기본) | 'alert'(흰 원 안 느낌표 — 에러 변형 아님). */
export type ToastMsg = { text: string; error?: boolean; icon?: 'check' | 'alert'; key: number };

// P-370(KB-533): 리스너 = 스택 — 네이티브 모달(scan fullScreenModal) 위 화면의
// 호스트가 마지막에 마운트돼 수신, 언마운트하면 이전(루트) 호스트 자동 복원.
const listeners: Array<(m: ToastMsg, remainingMs?: number) => void> = [];
let seq = 0;

// P-370 ②(#137 Codex P2): 표시 창(2.5s — TopToast SHOW_MS 동일) 안에 top 호스트가
// 언마운트되면(모달 닫힘 등) 진행 중이던 토스트를 새 top에 같은 key로 핸드오프.
// 빈 스택이면 보류했다가 다음 subscribe에 1회 전달. 화면 코드 무변.
// P-373(KB-537): ① 닫힌 토스트는 핸드오프 대상에서 제외(dismissTopToast)
// ② 핸드오프는 남은 표시 시간만 전달 — 총 노출이 SHOW_MS를 넘지 않는다.
const HANDOFF_MS = 2500;
const MIN_HANDOFF_MS = 200; // 잔여가 이보다 짧으면 깜빡임만 남아 전달 생략
let lastMsg: { msg: ToastMsg; at: number } | null = null;
let pendingHandoff = false;

/** 살아 있는 토스트의 남은 표시 시간(ms) — 없거나 너무 짧으면 null. */
function remaining(): number | null {
  if (!lastMsg) return null;
  const left = HANDOFF_MS - (Date.now() - lastMsg.at);
  return left >= MIN_HANDOFF_MS ? left : null;
}

/** 어디서든 호출 — 호스트 미마운트(빈 스택)면 조용히 무시(웹·테스트 안전). */
export function showTopToast(text: string, opts?: { error?: boolean; icon?: 'check' | 'alert' }) {
  const msg: ToastMsg = { text, error: opts?.error, icon: opts?.icon, key: ++seq };
  lastMsg = { msg, at: Date.now() };
  pendingHandoff = false; // 새 토스트가 보류분을 대체
  listeners[listeners.length - 1]?.(msg);
}

/**
 * 호스트 전용 — 토스트가 닫혔음을 알린다(Close 탭·자동 만료 공통).
 * 닫은 토스트가 화면 pop 시 이전 호스트에 재등장하는 것을 막는다(P-373 ①).
 */
export function dismissTopToast(key: number) {
  if (lastMsg?.msg.key !== key) return; // 이미 새 토스트로 교체됨 — 무시
  lastMsg = null;
  pendingHandoff = false;
}

/** 호스트 전용 — 마운트 시 스택 push, 해제는 자기 것만 제거(이전 호스트 복원). */
export function subscribeTopToast(fn: (m: ToastMsg, remainingMs?: number) => void): () => void {
  listeners.push(fn);
  if (pendingHandoff) {
    pendingHandoff = false;
    const left = remaining();
    if (left !== null && lastMsg) fn(lastMsg.msg, left); // 보류분 1회(잔여 시간으로)
  }
  return () => {
    const i = listeners.indexOf(fn);
    if (i < 0) return;
    const wasTop = i === listeners.length - 1;
    listeners.splice(i, 1);
    if (!wasTop) return;
    const left = remaining();
    if (left === null) return; // 닫혔거나 표시 창이 끝남
    const top = listeners[listeners.length - 1];
    if (top) top(lastMsg!.msg, left); // 이전 호스트로 핸드오프(같은 key·잔여 시간)
    else pendingHandoff = true; // 빈 스택 — 다음 subscribe 시 1회
  };
}

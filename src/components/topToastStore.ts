/**
 * topToastStore (P-346) — showTopToast 발화 채널. TopToastHost(reanimated 의존)와
 * 분리해 lib(bookmarks 등)이 애니메이션 스택을 끌고 오지 않게 한다(잼 격리 포함).
 */
/** P-366 ③(KB-529): icon — 'check'(기본) | 'alert'(흰 원 안 느낌표 — 에러 변형 아님). */
export type ToastMsg = { text: string; error?: boolean; icon?: 'check' | 'alert'; key: number };

// P-370(KB-533): 리스너 = 스택 — 네이티브 모달(scan fullScreenModal) 위 화면의
// 호스트가 마지막에 마운트돼 수신, 언마운트하면 이전(루트) 호스트 자동 복원.
const listeners: Array<(m: ToastMsg) => void> = [];
let seq = 0;

// P-370 ②(#137 Codex P2): 표시 창(2.5s — TopToast SHOW_MS 동일) 안에 top 호스트가
// 언마운트되면(모달 닫힘 등) 진행 중이던 토스트를 새 top에 같은 key로 핸드오프.
// 빈 스택이면 보류했다가 다음 subscribe에 1회 전달. 화면 코드 무변.
const HANDOFF_MS = 2500;
let lastMsg: { msg: ToastMsg; at: number } | null = null;
let pendingHandoff = false;

/** 어디서든 호출 — 호스트 미마운트(빈 스택)면 조용히 무시(웹·테스트 안전). */
export function showTopToast(text: string, opts?: { error?: boolean; icon?: 'check' | 'alert' }) {
  const msg: ToastMsg = { text, error: opts?.error, icon: opts?.icon, key: ++seq };
  lastMsg = { msg, at: Date.now() };
  listeners[listeners.length - 1]?.(msg);
}

/** 호스트 전용 — 마운트 시 스택 push, 해제는 자기 것만 제거(이전 호스트 복원). */
export function subscribeTopToast(fn: (m: ToastMsg) => void): () => void {
  listeners.push(fn);
  if (pendingHandoff) {
    pendingHandoff = false;
    if (lastMsg && Date.now() - lastMsg.at < HANDOFF_MS) fn(lastMsg.msg); // 보류분 1회
  }
  return () => {
    const i = listeners.indexOf(fn);
    if (i < 0) return;
    const wasTop = i === listeners.length - 1;
    listeners.splice(i, 1);
    if (wasTop && lastMsg && Date.now() - lastMsg.at < HANDOFF_MS) {
      const top = listeners[listeners.length - 1];
      if (top) top(lastMsg.msg); // 이전 호스트로 핸드오프(같은 key)
      else pendingHandoff = true; // 빈 스택 — 다음 subscribe 시 1회
    }
  };
}

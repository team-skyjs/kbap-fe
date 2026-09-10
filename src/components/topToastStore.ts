/**
 * topToastStore (P-346) — showTopToast 발화 채널. TopToastHost(reanimated 의존)와
 * 분리해 lib(bookmarks 등)이 애니메이션 스택을 끌고 오지 않게 한다(잼 격리 포함).
 */
/** P-366 ③(KB-529): icon — 'check'(기본) | 'alert'(흰 원 안 느낌표 — 에러 변형 아님). */
export type ToastMsg = { text: string; error?: boolean; icon?: 'check' | 'alert'; key: number };

let listener: ((m: ToastMsg) => void) | null = null;
let seq = 0;

/** 어디서든 호출 — 호스트 미마운트면 조용히 무시(웹·테스트 안전). */
export function showTopToast(text: string, opts?: { error?: boolean; icon?: 'check' | 'alert' }) {
  listener?.({ text, error: opts?.error, icon: opts?.icon, key: ++seq });
}

/** 호스트 전용 — 마운트 1회 구독. */
export function subscribeTopToast(fn: (m: ToastMsg) => void): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

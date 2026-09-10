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

/** 어디서든 호출 — 호스트 미마운트(빈 스택)면 조용히 무시(웹·테스트 안전). */
export function showTopToast(text: string, opts?: { error?: boolean; icon?: 'check' | 'alert' }) {
  listeners[listeners.length - 1]?.({ text, error: opts?.error, icon: opts?.icon, key: ++seq });
}

/** 호스트 전용 — 마운트 시 스택 push, 해제는 자기 것만 제거(이전 호스트 복원). */
export function subscribeTopToast(fn: (m: ToastMsg) => void): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

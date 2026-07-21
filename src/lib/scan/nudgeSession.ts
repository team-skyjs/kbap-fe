/**
 * nudgeSession — 빈 프로필 첫 스캔 배너의 세션 내 재노출 억제 (P-038/KB-212).
 * 모듈 스코프 플래그 = JS 세션 수명 — 닫으면 이번 실행 동안만 숨고, 재실행 시
 * 다시 노출(영구 억제 아님 — 기획 확정). AsyncStorage 불사용이 사양이다.
 */
let dismissed = false;

export const isNudgeDismissed = () => dismissed;
export const dismissNudge = () => {
  dismissed = true;
};
/** 테스트 전용 — 케이스 간 독립성 확보 */
export const resetNudgeForTest = () => {
  dismissed = false;
};

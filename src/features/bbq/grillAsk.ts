/**
 * KB-1019 장면 3: 종업원에게 보여 주는 한국어 카드. 한국어는 데이터(사장님 카드와 같은 원칙 — i18n 아님),
 * 문구는 예진 확정(P-631) 그대로. 서버 호출·저장 없음.
 */
export const GRILL_ASK_KO = '고기를 직접 구워야 하나요, 구워 주시나요?';
export const GRILL_ANSWERS = [
  { key: 'self', ko: '직접 구우세요' },
  { key: 'staff', ko: '구워 드려요' },
] as const;
export type GrillAnswer = (typeof GRILL_ANSWERS)[number]['key'];

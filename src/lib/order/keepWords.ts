/**
 * KB-777 B1-10: 사장님 카드 한국어가 어절 중간("메뉴|가")에서 줄바꿈되지 않게 — 어절 안 글자 사이에 단어 결합자(U+2060)를
 * 넣어 줄바꿈 기회를 공백에만 남긴다. 화면 표시 전용(문구는 orderCard.ts 그대로, 공유·복사 원문에 쓰지 말 것).
 * iOS·Android 모두 U+2060을 보이지 않는 줄바꿈 금지 문자로 다룬다(Android엔 word-break: keep-all 대응 prop이 없다).
 * 한 어절이 한 줄보다 길면 OS가 강제로 끊는다(넘침 없음).
 */
const WJ = '⁠';
export const keepWordsKo = (s: string): string => s.replace(/\S+/g, (w) => Array.from(w).join(WJ));

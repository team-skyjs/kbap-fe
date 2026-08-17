/**
 * displayNickname (P-224/KB-307) — 닉네임 표시 절단 한 곳.
 *
 * 서버 자동 닉네임·수동 닉네임 모두 길이를 클라가 통제하지 못한다(서버 제약은
 * BE 안건). 문장 속 보간("Block {name}?")에 numberOfLines를 걸면 이름 뒤의
 * 동사·물음표까지 잘려 **문장이 훼손**되므로 — 문장을 살리고 **이름을 자른다**.
 *
 * 단독 표시(홈 인사·프로필 탭 등)는 이 헬퍼가 아니라 numberOfLines={1}이 맞다
 * (폰 폭마다 수용량이 달라 고정 글자수 절단은 낭비/부족 발생 — tail ellipsis).
 *
 * 이모지·국기 등 서로게이트 쌍 안전: Array.from(코드포인트 단위)으로 세어
 * 절단 지점이 쌍을 반으로 가르지 않는다.
 */
export const NICKNAME_DISPLAY_MAX = 14; // 시트 폭 기준(발주 재량 12~16자 안팎)

export function displayNickname(raw: string | null | undefined, max = NICKNAME_DISPLAY_MAX): string {
  if (!raw) return '';
  const points = Array.from(raw); // 코드포인트 단위 — 서로게이트 쌍 미분할
  if (points.length <= max) return raw;
  return `${points.slice(0, max).join('')}…`;
}

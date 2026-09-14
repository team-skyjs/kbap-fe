/**
 * shareCard (P-380/KB-518) — 주문 공유 카드의 **데이터 결정 3건**을 순수 함수로 분리.
 * 렌더와 떼어 둔 이유는 실기 없이 잠글 수 있게 하기 위함(레이아웃 변형·"외 N"·폴백).
 *
 * 9/14 예진 확정:
 * ① 사진 장수대로 레이아웃을 바꾼다 — 빈 칸·기본 이미지로 채우지 않는다.
 * ② 메뉴줄 = 최대 3개 + 넘치면 "외 N".
 * ③ 가게명 = place.name → roadAddress → **줄 숨김**(빈 줄 금지).
 */

/** 카드 폭(시안 고정) — 미리보기·내보내기 공통 기준. */
export const SHARE_CARD_W = 210;
/** 사진 그리드 높이(시안 고정). 칸은 이 안에서 장수에 따라 나뉜다. */
export const SHARE_GRID_H = 210;
/** 메뉴줄에 나열하는 최대 개수(초과분은 "외 N"). */
export const SHARE_MENU_MAX = 3;

/** 한 칸의 위치·크기(px). 부모는 SHARE_CARD_W × SHARE_GRID_H. */
export type ShareCell = { left: number; top: number; width: number; height: number };

/**
 * ① 장수별 칸 배치 — 1=전체 / 2=좌우 / 3=좌 큰 것 + 우 위아래 / 4=2×2.
 * 5장 이상은 오지 않지만(서버가 4로 자른다) 와도 앞 4장만 쓴다.
 */
export function shareCells(count: number): ShareCell[] {
  const full = SHARE_CARD_W;
  const half = SHARE_CARD_W / 2;
  const halfH = SHARE_GRID_H / 2;
  switch (Math.min(count, 4)) {
    case 1:
      return [{ left: 0, top: 0, width: full, height: SHARE_GRID_H }];
    case 2:
      return [
        { left: 0, top: 0, width: half, height: SHARE_GRID_H },
        { left: half, top: 0, width: half, height: SHARE_GRID_H },
      ];
    case 3:
      return [
        { left: 0, top: 0, width: half, height: SHARE_GRID_H },
        { left: half, top: 0, width: half, height: halfH },
        { left: half, top: halfH, width: half, height: halfH },
      ];
    case 4:
      return [
        { left: 0, top: 0, width: half, height: halfH },
        { left: half, top: 0, width: half, height: halfH },
        { left: 0, top: halfH, width: half, height: halfH },
        { left: half, top: halfH, width: half, height: halfH },
      ];
    default:
      return []; // 0장 = 그리드 자체를 렌더하지 않는다(호출부 분기)
  }
}

/**
 * ② 메뉴줄 — 앞 3개를 가운뎃점으로 잇고 나머지는 "외 N"으로 접는다.
 * 빈 이름은 버린다(서버 menuName 부재 = '' 어댑터 폴백).
 */
export function shareMenuLine(
  menuNames: (string | null | undefined)[],
  moreLabel: (count: number) => string,
): string {
  const names = menuNames.map((n) => (n ?? '').trim()).filter(Boolean);
  const head = names.slice(0, SHARE_MENU_MAX).join(' · ');
  const rest = names.length - SHARE_MENU_MAX;
  return rest > 0 ? `${head} ${moreLabel(rest)}` : head;
}

/**
 * ③ 가게명 3단 폴백. **place가 와도 이 경로는 그대로 산다** — 기존 주문은
 * place가 영구 null이기 때문(백필 없음, 설계 §1). null = 그 줄을 숨긴다.
 */
export function sharePlaceName(src: { placeName?: string | null; roadAddress?: string | null }): string | null {
  const name = (src.placeName ?? '').trim();
  if (name) return name;
  const road = (src.roadAddress ?? '').trim();
  return road || null;
}

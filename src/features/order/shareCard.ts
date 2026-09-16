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
 * ② 메뉴줄 — 앞 3개를 쉼표로 잇고 나머지는 "외 N"으로 접는다.
 * 빈 이름은 버린다(서버 menuName 부재 = '' 어댑터 폴백).
 *
 * 구분자는 **쉼표**다. 시안은 가운뎃점이지만 P-196(사용자 노출 가운뎃점 전수 제거)이
 * 시안보다 우선한다는 9/14 예진 판정 — 시안 대조 시 이 줄만 예외다.
 */
export function shareMenuLine(
  menuNames: (string | null | undefined)[],
  moreLabel: (count: number) => string,
): string {
  const names = menuNames.map((n) => (n ?? '').trim()).filter(Boolean);
  const head = names.slice(0, SHARE_MENU_MAX).join(', ');
  const rest = names.length - SHARE_MENU_MAX;
  return rest > 0 ? `${head} ${moreLabel(rest)}` : head;
}

/**
 * ③ 메타줄 도시 — `place.address`(회원 언어 해석)에서 도시 부분만 뽑는다.
 * **확실할 때만 표시한다**: 공백으로 갈린 표기(한국어식 "서울 마포구 …")만 첫 토큰을 쓴다.
 * 쉼표 표기는 마지막 조각이 도시인지 국가인지 알 수 없고("…, Seoul, South Korea"),
 * 공백이 없는 표기(일본어·중국어)는 주소 전체가 한 토큰이라 — 둘 다 생략한다(날짜만).
 * 서버가 구조화 city 필드를 주면 그때 직결한다 — 추측으로 채우지 않는다.
 *
 * TODO(BE 후속, 9/16 커맨드 센터): `OrderPlaceResponse.city` 추가 예정(주문 저장 시 Places
 * address_components의 locality 스냅샷). 오면 **이 함수 위에서** `place.city`를 먼저 보고,
 * 없을 때만 아래 폴백을 타게 한 줄 끼우면 된다 — `city ?? shareMetaCity(address) ?? 날짜만`.
 * 호출부(order/[id].tsx metaCity)는 그대로 둔다.
 *
 * 가게명 자체는 `lib/data/useOrders.orderPlaceLabel`(P-386)이 정본이다 — 같은 규칙을
 * 두 번 두지 않는다(P-386 머지로 중복이 생겨 이쪽을 지웠다).
 */
export function shareMetaCity(address: string | null | undefined): string | null {
  const a = (address ?? '').trim();
  if (!a) return null;
  // 쉼표 표기(영어·유럽식)는 마지막 조각이 도시일 수도, **국가·우편번호**일 수도 있다
  // ("12 Wausan-ro, Mapo-gu, Seoul" vs "…, Seoul, South Korea"). 구조화 필드 없이
  // 도시를 고를 방법이 없으므로 **생략한다** — 날짜만 남는다(틀린 도시보다 낫다, Codex 4R).
  if (a.includes(',')) return null;
  // 공백이 아예 없는 표기(일본어·중국어 "東京都渋谷区神宮前…")는 주소 통째가 한 토큰이라
  // 첫 토큰 = 전체 주소가 된다 — 도시 자리에 주소가 박히느니 생략한다(Codex 6R).
  const tokens = a.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  // 공백 표기(한국어식)는 도시가 맨 앞이다 — dev 응답이 이 형태다
  return tokens[0] || null;
}

/**
 * ④ 공유 카드에 쓸 사진 선별 (Codex 8R) — **서버 대체 이미지를 카드에 넣지 않는다**(9/14 예진 ①).
 *
 * 계약(dev Swagger): `thumbnails`·`imageRef` 모두 "READY 음식만 실사진, 준비중이거나 사진이
 * 없으면 **기본 대체 이미지**"다. 즉 `thumbnails`를 그대로 쓰면 플레이스홀더 타일이 카드에 박힌다.
 * 항목(`items`)에는 `ready` 불리언이 있으므로 **준비중은 계약으로 걸러낸다** —
 * URL 문자열로 준비중을 판정하는 건 금지(종한 명시, useOrders 주석).
 *
 * ⚠️ 남는 구멍: `ready=true`인데 사진만 없는 경우도 서버가 같은 대체 이미지를 준다. 이건
 * 계약상 구분 불가라 BE에 `hasPhoto`(또는 대체 이미지 판별 수단) 요청이 필요하다(커맨드 센터 보고).
 */
export function sharePhotos(items: { imageUrl: string | null; ready?: boolean }[]): string[] {
  return items
    .filter((it) => it.ready !== false && !!it.imageUrl)
    .map((it) => it.imageUrl as string)
    .slice(0, 4);
}

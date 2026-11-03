/**
 * resultSort (P-226 ②③ → P-354/KB-516) — 스캔 결과 리스트 정렬 한 곳.
 *
 * - `menu`(기본) = 메뉴판 그대로 순 — **unable(판정불가·미매칭)도 제자리**. KB-908(T-009, 10/30 커맨드 결정·예진 확인 예정):
 *   실물 메뉴판과 줄을 맞추는 모드라 순서가 어긋나면 모드가 깨진다. 불확실 표시는 행의 Unable 라벨·회색 리본이 한다.
 *   (P-226 "unable 최하단"은 이 모드에서 폐지 — 예진이 뒤집으면 이 커밋만 되돌린다)
 * - `priceDesc`/`priceAsc` = 가격순(KB-516 — 구 safety 모드 대체). **가격 null은
 *   어느 방향이든 맨 아래**(그 안에서는 메뉴판 순 유지 — 안정 정렬).
 *
 * 정렬은 안정 정렬(Array.prototype.sort — ES2019+ 안정 보장) — 동순위는 메뉴판 순.
 */
import type { RiskState } from '@/lib/theme';

export type ResultSortMode = 'menu' | 'priceDesc' | 'priceAsc';

export function sortResultDishes<T extends { risk: RiskState; priceKrw?: number | null }>(
  dishes: readonly T[],
  mode: ResultSortMode,
): T[] {
  if (mode === 'priceDesc' || mode === 'priceAsc') {
    const dir = mode === 'priceDesc' ? -1 : 1;
    return [...dishes].sort((a, b) => {
      const ap = a.priceKrw ?? null;
      const bp = b.priceKrw ?? null;
      if (ap == null && bp == null) return 0; // 둘 다 무가격 = 메뉴판 순 유지
      if (ap == null) return 1; // null = 맨 아래
      if (bp == null) return -1;
      return (ap - bp) * dir;
    });
  }
  return [...dishes]; // menu: 메뉴판 순 그대로(KB-908)
}

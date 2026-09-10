/**
 * resultSort (P-226 ②③ → P-354/KB-516) — 스캔 결과 리스트 정렬 한 곳.
 *
 * - `menu`(기본) = 메뉴판 그대로 순. 단 **unable(판정불가)은 최하단**(§14-5 현행 유지
 *   — 불확실을 안전해 보이는 위치에 두지 않는다, false-safe).
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
  // menu: 원 순서 유지 + unable만 최하단(현행 §14-5)
  return [...dishes].sort((a, b) => (a.risk === 'unable' ? 1 : 0) - (b.risk === 'unable' ? 1 : 0));
}

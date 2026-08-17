/**
 * resultSort (P-226 ②③/KB-29·306) — 스캔 결과 리스트 정렬 한 곳.
 *
 * - `menu`(기본) = 메뉴판 그대로 순. 단 **unable(판정불가)은 최하단**(§14-5 현행 유지).
 * - `safety` = 위험도 오름차순 safe → caution → danger → **unable 최하단**.
 *
 * ⚠️ false-safe: unable은 어느 모드에서도 danger 위·caution 옆 같은 "안전해 보이는
 * 위치"에 오지 않는다 — 항상 최하단. 이 순서가 바뀌면 판정불가 메뉴가 안전 착시를
 * 만들므로 유닛이 순서를 잠근다.
 *
 * 정렬은 안정 정렬(Array.prototype.sort — ES2019+ 안정 보장) — 같은 등급 안에서는
 * 메뉴판 순서 유지.
 */
import type { RiskState } from '@/lib/theme';

export type ResultSortMode = 'menu' | 'safety';

/** safety 모드 등급 — 숫자가 작을수록 위. unable = 최대(최하단). */
const SAFETY_RANK: Record<RiskState, number> = { safe: 0, caution: 1, danger: 2, unable: 3 };

export function sortResultDishes<T extends { risk: RiskState }>(dishes: readonly T[], mode: ResultSortMode): T[] {
  if (mode === 'safety') {
    return [...dishes].sort((a, b) => SAFETY_RANK[a.risk] - SAFETY_RANK[b.risk]);
  }
  // menu: 원 순서 유지 + unable만 최하단(현행 §14-5)
  return [...dishes].sort((a, b) => (a.risk === 'unable' ? 1 : 0) - (b.risk === 'unable' ? 1 : 0));
}

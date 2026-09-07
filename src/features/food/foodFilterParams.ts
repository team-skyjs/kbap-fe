/**
 * foodFilterParams (P-317/KB-483 → P-318/KB-484 공용) — 홈 "See all" → 음식 탭
 * 필터 상태 전달 상수·헬퍼. 정본: specs/001-personalized-menu-mvp/home-food-tabs-v2.md.
 */
export type GridSegment = 'popular' | 'saved' | 'food';
export type RiskChipParam = 'all' | 'safe' | 'danger' | 'caution';

export const GRID_SEGMENTS: GridSegment[] = ['popular', 'saved', 'food'];
export const RISK_CHIP_PARAMS: RiskChipParam[] = ['all', 'safe', 'danger', 'caution'];

/** 홈 See all → 음식 탭 진입 href — 같은 필터 상태 승계. */
export function foodTabHref(segment: GridSegment, risk: RiskChipParam): string {
  return `/food?segment=${segment}&risk=${risk}`;
}

/** 음식 탭 수신측 파서 — 미지/부재 값은 기본(popular·all)으로 강등(딥링크 방어). */
export function parseFoodFilterParams(p: { segment?: string; risk?: string }): { segment: GridSegment; risk: RiskChipParam } {
  return {
    segment: (GRID_SEGMENTS as string[]).includes(p.segment ?? '') ? (p.segment as GridSegment) : 'popular',
    risk: (RISK_CHIP_PARAMS as string[]).includes(p.risk ?? '') ? (p.risk as RiskChipParam) : 'all',
  };
}

/**
 * foodFilterParams (P-317/KB-483 → P-318/KB-484 공용) — 홈 "See all" → 음식 탭
 * 필터 상태 전달 상수·헬퍼. 정본: specs/001-personalized-menu-mvp/home-food-tabs-v2.md.
 */
export type GridSegment = 'popular' | 'saved' | 'food';
export type RiskChipParam = 'all' | 'safe' | 'danger' | 'caution';

export const GRID_SEGMENTS: GridSegment[] = ['popular', 'saved', 'food'];
export const RISK_CHIP_PARAMS: RiskChipParam[] = ['all', 'safe', 'danger', 'caution'];

/** 홈 See all → 음식 탭 진입 href — 같은 필터 상태 승계.
 *  Codex #81 P1: nonce(t) = 내비게이션마다 갱신 — 같은 segment/risk로 재진입해도
 *  수신측 재동기화 effect가 발화하게(탭바 직진입은 t 불변 → 사용자 선택 보존). */
export function foodTabHref(segment: GridSegment, risk: RiskChipParam, nonce?: number): string {
  return `/food?segment=${segment}&risk=${risk}${nonce != null ? `&t=${nonce}` : ''}`;
}

/** 음식 탭 수신측 파서 — 미지/부재 값은 기본(popular·all)으로 강등(딥링크 방어). */
export function parseFoodFilterParams(p: { segment?: string; risk?: string }): { segment: GridSegment; risk: RiskChipParam } {
  return {
    segment: (GRID_SEGMENTS as string[]).includes(p.segment ?? '') ? (p.segment as GridSegment) : 'popular',
    risk: (RISK_CHIP_PARAMS as string[]).includes(p.risk ?? '') ? (p.risk as RiskChipParam) : 'all',
  };
}

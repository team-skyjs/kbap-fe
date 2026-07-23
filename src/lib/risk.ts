/**
 * risk.ts — personalized-risk display chokepoint (Constitution III · SC-003).
 *
 * SAFETY INVARIANT (v2.1.0, 2026-07-23 개정): '안전 단정 금지'는 **기피 재료를
 * 설정한 사용자의 개인화 판정**에 적용된다. 회피 **미설정** 사용자에게는 BE
 * 판정을 **그대로** 표시한다 — 종전 FE 강등(safe→caution)은 폐지. 안전장치는
 * 첫 스캔 '기피 설정' 유도 배너 + 안전 고지 페이지가 담당.
 *
 * This stays the single chokepoint every risk render goes through — 정책이
 * 다시 바뀌어도 여기 한 곳이다.
 */
import type { RiskState } from '@/lib/theme';

/**
 * @param raw              risk as returned by the API (personalized server-side)
 * @param hasRestrictions  whether the user has any dietary restrictions
 *                         (v2.1.0: 표시엔 미사용 — 정책 재변경 대비 시그니처 유지)
 */
export function personalRisk(raw: RiskState, hasRestrictions: boolean): RiskState {
  void hasRestrictions; // v2.1.0: 미설정도 BE 판정 그대로
  return raw;
}

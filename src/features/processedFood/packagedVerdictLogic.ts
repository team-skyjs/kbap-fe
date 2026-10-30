/** KB-914(R-137) 감지 재료 타일 판정 — 순수 함수(화면 부품과 분리 — 유닛 잠금). false-safe 0: 판정이 없으면 마크 0 */
import type { ProcessedDetection, ProcessedMatch, ProcessedVerdict } from '@/lib/api/processedFoodAdapter';
import type { RiskState } from '@/lib/theme';

export type VerdictFields = { verdict: ProcessedVerdict | null; avoidMatches: ProcessedMatch[]; mayContainMatches: ProcessedMatch[]; unclearIngredients: string[] };

/** 타일에 그릴 코드 — 감지 + 회피 일치 + 혼입 일치(중복 제거, 서버 순서) */
export function detectedCodes(d: { detections: ProcessedDetection[]; avoidMatches: ProcessedMatch[]; mayContainMatches: ProcessedMatch[] }): string[] {
  return [...new Set([...d.avoidMatches.map((m) => m.code), ...d.mayContainMatches.map((m) => m.code), ...d.detections.map((x) => x.code)])];
}

/** 코드 → 타일 마크(판정이 있을 때만). 회피 일치가 혼입 일치보다 먼저(더 보수적인 쪽) */
export function tileRisk(code: string, d: VerdictFields, personalized: boolean): RiskState | null {
  if (!personalized || d.verdict == null) return null;
  if (d.avoidMatches.some((m) => m.code === code)) return 'danger';
  if (d.mayContainMatches.some((m) => m.code === code)) return 'caution';
  return 'safe';
}


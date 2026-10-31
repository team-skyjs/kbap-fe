/** KB-914(R-137) 감지 재료 타일 판정 — 순수 함수(화면 부품과 분리 — 유닛 잠금). false-safe 0: 판정이 없으면 마크 0 */
import type { ProcessedDetection, ProcessedMatch, ProcessedVerdict, UnclearLabel } from '@/lib/api/processedFoodAdapter';
import type { RiskState } from '@/lib/theme';

export type VerdictFields = { verdict: ProcessedVerdict | null; avoidMatches: ProcessedMatch[]; mayContainMatches: ProcessedMatch[]; unclearIngredients: string[]; unclearIngredientLabels: UnclearLabel[] };

/** 타일에 그릴 코드 — 감지 + 회피 일치 + 혼입 일치(중복 제거, 서버 순서) */
export function detectedCodes(d: { detections: ProcessedDetection[]; avoidMatches: ProcessedMatch[]; mayContainMatches: ProcessedMatch[] }): string[] {
  return [...new Set([...d.avoidMatches.map((m) => m.code), ...d.mayContainMatches.map((m) => m.code), ...d.detections.map((x) => x.code)])];
}

/** KB-945 "What's inside" 한 그리드 = 감지·일치 + 주요 알레르기(비회원·회피 0개) + 혼입 가능 — 구 감지 카드·주요 알레르기 문단을 합침(중복 제거, 서버 순서) */
export function insideCodes(d: { detections: ProcessedDetection[]; avoidMatches: ProcessedMatch[]; mayContainMatches: ProcessedMatch[]; majorAllergens: string[] | null; mayContain: { code: string }[] }): string[] {
  return [...new Set([...detectedCodes(d), ...(d.majorAllergens ?? []), ...d.mayContain.map((m) => m.code)])];
}

/** 코드 → 타일 마크(판정이 있을 때만). 회피 일치가 혼입 일치보다 먼저(더 보수적인 쪽) */
export function tileRisk(code: string, d: VerdictFields, personalized: boolean): RiskState | null {
  if (!personalized || d.verdict == null) return null;
  if (d.avoidMatches.some((m) => m.code === code)) return 'danger';
  if (d.mayContainMatches.some((m) => m.code === code)) return 'caution';
  return 'safe';
}


/** KB-936 SAFE_WITH_NOTE 부제 — 서버 라벨(사용자 언어, 같은 label 중복 제거) → 없으면(구서버·빈 배열) 원문 unclearIngredients → 그것도 비면 null(생략) */
export function unclearSubtitle(d: { unclearIngredients: string[]; unclearIngredientLabels: UnclearLabel[] }): string | null {
  const labels = [...new Set(d.unclearIngredientLabels.map((l) => l.label))];
  return (labels.length ? labels : d.unclearIngredients).join(', ') || null;
}

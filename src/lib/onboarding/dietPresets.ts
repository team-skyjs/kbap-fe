/**
 * dietPresets.ts (P-203/KB-305) — 식이/종교 카테고리 → 회피 성분 프리셋 15종.
 *
 * 정본: spec/specs/001-personalized-menu-mvp/diet-presets.md + 확정본
 * dropbox/yj/2026-08-14-식이종교-프리셋-매핑.md (2026-08-14 — (D) 전부 "포함" 확정).
 * **번호 = 정본 표의 성분 번호(INGREDIENTS 1-based 순서와 1:1)** — 표 그대로
 * 전사해 코드 리뷰 대조 가능하게 유지, 코드 문자열은 파생(presetSubstanceCodes).
 *
 * 원칙(헌법 false-safe 정합): 프리셋 = **기본 선택 도우미**일 뿐(유저 해제/추가
 * 자유), 애매한 유래는 보수 포함(과포함은 풀면 되지만 누락은 위험).
 * BE `GET /api/diet-presets` 확정 시 이 상수를 서버 응답으로 스왑(API 형태 제안
 * 동일 — code+substances). 저장 모델 무변(평면 81종 — 카테고리는 저장 축 아님).
 */
import { INGREDIENTS } from '@/lib/mocks/ingredients';

export type PresetGroup = 'diet' | 'religion' | 'allergy';

export interface DietPreset {
  id: string; // 정본 코드 제안(VEGAN 등) — BE API 확정 시 그대로 와이어 후보
  group: PresetGroup;
  /** 카테고리명 i18n 키 — onboarding.presets.<id 소문자> */
  labelKey: string;
  /** 정본 표 성분 번호(1~81 — 범위는 [시작, 끝] 튜플) */
  nums: (number | [number, number])[];
}

const P = (id: string, group: PresetGroup, nums: (number | [number, number])[]): DietPreset => ({
  id,
  group,
  labelKey: `onboarding.presets.${id.toLowerCase()}`,
  nums,
});

/** 정본 매핑 테이블 전사(2026-08-14 확정) — 행 순서·번호 표기 정본 그대로. */
export const DIET_PRESETS: DietPreset[] = [
  // ---- 식이 (Dietary) 8 ----
  P('VEGAN', 'diet', [[1, 11], [37, 66]]),
  P('VEGETARIAN', 'diet', [8, 9, 11, [37, 66]]),
  P('LACTO_VEGETARIAN', 'diet', [1, 8, 9, 11, [37, 66]]),
  P('OVO_VEGETARIAN', 'diet', [[2, 9], 11, [37, 66]]),
  P('PESCATARIAN', 'diet', [8, 9, 11, 59, [61, 66]]),
  P('GLUTEN_FREE', 'diet', [26, 28, 29, 30]), // 메밀(27)·옥수수(31) 제외 — 글루텐 없음
  P('LACTOSE_FREE', 'diet', [[2, 7]]),
  P('NO_ALCOHOL', 'diet', [78, 79, 80]),
  // ---- 종교 (Religious) 5 ----
  P('MUSLIM', 'religion', [8, 9, 11, 59, 62, 63, 64, 78, 79, 80]), // ⚠️ 할랄 도축 여부는 성분 판별 불가 — 사장님 확인 영역
  P('HINDU', 'religion', [8, 9, 59, 61, 64]),
  P('KOSHER', 'religion', [8, 9, 11, [37, 51], 59, 62, 63]), // 비늘 생선(53~57)은 허용 · 육류×유제품 조합 금지는 표현 불가(한계)
  P('BUDDHIST', 'religion', [1, 8, 9, 11, [37, 66], [72, 77]]), // 오신채 73~77 + 양파(72) 확장 통례
  P('JAIN', 'religion', [1, 8, 9, 10, 11, [37, 66], [70, 76]]), // ⚠️ 흥거(77) 제외 — 자이나교는 마늘 대체재로 사용
  // ---- 알레르기 묶음 2 ----
  P('NUT_ALLERGY', 'allergy', [[13, 22]]), // 밤(22) 보수 포함 확정
  P('SHELLFISH_ALLERGY', 'allergy', [[37, 51]]),
];

function expandNums(nums: (number | [number, number])[]): number[] {
  return nums.flatMap((n) => (Array.isArray(n) ? Array.from({ length: n[1] - n[0] + 1 }, (_, i) => n[0] + i) : [n]));
}

/** 프리셋 → 회피 코드(UPPER_SNAKE — 와이어 값) 집합. 번호는 INGREDIENTS 1-based. */
export function presetSubstanceCodes(preset: DietPreset): string[] {
  return expandNums(preset.nums).map((n) => INGREDIENTS[n - 1].code);
}

/** 복수 선택 = 합집합(발주 고정). base(기존 선택)와도 합집합 — 기존 삭제 금지(안전). */
export function unionPresetCodes(presetIds: string[], base: Iterable<string> = []): Set<string> {
  const out = new Set(base);
  for (const id of presetIds) {
    const preset = DIET_PRESETS.find((p) => p.id === id);
    if (preset) for (const code of presetSubstanceCodes(preset)) out.add(code);
  }
  return out;
}

/** P-208: 서버 스왑판 합집합 — resolved(서버 우선·상수 폴백) codes 기준. */
export function unionResolvedCodes(
  presets: { id: string; codes: string[] }[],
  presetIds: string[],
  base: Iterable<string> = [],
): Set<string> {
  const out = new Set(base);
  for (const id of presetIds) {
    const p = presets.find((x) => x.id === id);
    if (p) for (const code of p.codes) out.add(code);
  }
  return out;
}

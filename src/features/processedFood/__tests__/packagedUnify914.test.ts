/** KB-914 1차(R-137·R-138·R-139) — 가공식품 화면을 메뉴판·음식 상세 부품으로 */
import * as fs from 'fs';

import { detectedCodes, tileRisk } from '../packagedVerdictLogic';

const read = (f: string) => fs.readFileSync(f, 'utf8');
const base = { verdict: 'AVOID' as const, avoidMatches: [{ code: 'MILK', evidence: [] }], mayContainMatches: [{ code: 'PEANUT', evidence: [] }], unclearIngredients: [], detections: [{ code: 'WHEAT', evidence: '', fromLabel: true }, { code: 'MILK', evidence: '', fromLabel: true }] };

describe('R-137 감지 재료 타일 — 위험 마크(false-safe 0)', () => {
  it('타일 코드 = 회피 일치 → 혼입 일치 → 감지(중복 제거)', () => {
    expect(detectedCodes(base)).toEqual(['MILK', 'PEANUT', 'WHEAT']);
  });
  it('회원 판정 있음 = 회피 일치 danger · 혼입 일치 caution · 그 밖 감지 safe(내 회피 목록 밖)', () => {
    expect(tileRisk('MILK', base, true)).toBe('danger');
    expect(tileRisk('PEANUT', base, true)).toBe('caution');
    expect(tileRisk('WHEAT', base, true)).toBe('safe');
  });
  it('회피·혼입 둘 다 걸리면 더 보수적인 danger', () => {
    expect(tileRisk('MILK', { ...base, mayContainMatches: [{ code: 'MILK', evidence: [] }] }, true)).toBe('danger');
  });
  it('판정 없음(비회원·회피 0개·확인 못 함·판정 기준이 바뀐 결과) = 마크 0 — safe를 그리지 않는다', () => {
    expect(tileRisk('WHEAT', base, false)).toBeNull();
    expect(tileRisk('WHEAT', { ...base, verdict: null }, true)).toBeNull();
    expect(tileRisk('MILK', { ...base, verdict: null }, true)).toBeNull();
  });
});

describe('R-137 같은 부품', () => {
  it('판정 띠·재료 타일 = 음식 상세와 가공식품(상세·성분표 결과)이 같은 공용 부품', () => {
    const food = read('src/app/food/[id]/index.tsx');
    expect(food).toContain('<VerdictBand state={dishRisk}');
    expect(food).toContain('<IngredientTile key={ing.code}');
    const v = read('src/features/processedFood/PackagedVerdict.tsx');
    expect(v).toContain('return <VerdictBand state={state}');
    expect(v).toContain('<IngredientTile key={code}');
    const pf = read('src/app/processed-foods/[id].tsx');
    expect(pf).toContain('<PackagedVerdictBand d={{ ...d, verdict: d.verdict }}');
    expect(pf).toContain('<PackagedDetectedTiles d={d} personalized={hasVerdict}');
    expect(pf).not.toContain('<RiskBadge'); // 사진 위 작은 리본 소멸 — 판정은 띠
    expect(pf).toMatch(/testID="pf-write-review-bar"/); // 하단 고정 CTA
    const res = read('src/features/scan/PackagedScanScreens.tsx');
    expect(res).toContain('<PackagedVerdictBand d={{ ...result, verdict: result.verdict }}');
    expect(res).toContain('reason={avoid}'); // 결과 전용 문장 그대로(문구 무변)
  });
  it('원재료 한 체계 — 상세·결과 모두 IngredientsText(번역·원문 = 같은 위계 소제목)', () => {
    expect(read('src/app/processed-foods/[id].tsx')).toContain('<IngredientsText translated={d.ingredients.translated}');
    expect(read('src/features/scan/PackagedScanScreens.tsx')).toContain('<IngredientsText translated={translated}');
    expect(read('src/app/processed-foods/[id].tsx')).not.toContain('testID="pf-original"'); // 구 별도 Korean original 섹션
  });
});

describe('R-138 후보 줄', () => {
  it('메뉴판 결과 줄 치수·회피 칩 부품 재사용 · 칩 = 위험 판정 줄만 상세 프리페치 · 확정 버튼 0', () => {
    const s = read('src/features/scan/PackagedScanScreens.tsx');
    expect(s).toContain("import { richStyles, WarnChips } from './ScanRichList';");
    expect(s).toContain("useProcessedDetail(risk === 'danger' || risk === 'caution' ? item.id : undefined)");
    expect(s).toContain('<WarnChips warns={warns}');
    expect(s).not.toContain('testID="pscan-confirm"');
    expect(read('src/features/scan/ScanRichList.tsx')).toContain('<WarnChips warns={warns} testID={`warn-${dish.itemId}`}');
  });
});

describe('R-139 어두운 안내·오류 화면', () => {
  it('메뉴판 오류 화면과 가공식품 안내 페이지 = 같은 ScanDarkMessage', () => {
    expect(read('src/app/scan.tsx')).toContain('<ScanDarkMessage');
    const s = read('src/features/scan/PackagedScanScreens.tsx');
    expect(s).toMatch(/<ScanDarkMessage\s+testID=\{testID\}/);
    expect(s).not.toContain('<SubHeader title={headerTitle}'); // 구 밝은 헤더 페이지
  });
});

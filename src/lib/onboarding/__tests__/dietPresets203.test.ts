/**
 * P-203: 식이/종교 프리셋 — 정본 매핑 대조(전 카테고리 스냅샷+근거 포인트)·
 * 합집합(기존 보존)·스킵/플래그 배선 소스 잠금.
 */
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));

import { DIET_PRESETS, presetSubstanceCodes, unionPresetCodes } from '../dietPresets';

it('구성 — 15종(식이 8·종교 5·알레르기 묶음 2), 정본 코드 제안 그대로', () => {
  expect(DIET_PRESETS).toHaveLength(15);
  expect(DIET_PRESETS.filter((p) => p.group === 'diet')).toHaveLength(8);
  expect(DIET_PRESETS.filter((p) => p.group === 'religion')).toHaveLength(5);
  expect(DIET_PRESETS.filter((p) => p.group === 'allergy')).toHaveLength(2);
});

it('매핑 정본 대조 — 전 카테고리 성분 코드 집합 스냅샷(dropbox 확정본 8/14)', () => {
  const all = Object.fromEntries(DIET_PRESETS.map((p) => [p.id, [...presetSubstanceCodes(p)].sort()]));
  expect(all).toMatchSnapshot();
});

it('정본 근거 포인트 잠금 — 제외/포함이 의도인 항목들', () => {
  const codes = (id: string) => new Set(presetSubstanceCodes(DIET_PRESETS.find((p) => p.id === id)!));
  // 글루텐 프리: 메밀·옥수수 제외(글루텐 없음), 귀리 포함(교차오염 통례 — D 확정)
  expect(codes('GLUTEN_FREE').has('BUCKWHEAT')).toBe(false);
  expect(codes('GLUTEN_FREE').has('CORN')).toBe(false);
  expect(codes('GLUTEN_FREE').has('OAT')).toBe(true);
  // 자이나: 흥거 제외(마늘 대체재), 달래(76)까지는 포함
  expect(codes('JAIN').has('ASAFOETIDA')).toBe(false);
  expect(codes('JAIN').has('WILD_CHIVE')).toBe(true);
  // 불교: 오신채 전부(흥거 포함) + 양파 확장 통례
  expect(codes('BUDDHIST').has('ASAFOETIDA')).toBe(true);
  expect(codes('BUDDHIST').has('ONION')).toBe(true);
  // 코셔: 비늘 없는 수산물(37~51)만 — 비늘 생선(FISH 52 계열) 허용
  expect(codes('KOSHER').has('SEAFOOD')).toBe(true);
  expect(codes('KOSHER').has('FISH')).toBe(false);
  expect(codes('KOSHER').has('SALMON')).toBe(false);
  // 무슬림: 돼지·라드·알코올류 핵심 + 보수 포함(젤라틴·육수·카민·우지·레닛 — D 전부 확정)
  for (const c of ['PORK', 'LARD', 'ALCOHOL', 'MIRIN', 'COOKING_WINE', 'GELATIN', 'BROTH', 'CARMINE', 'TALLOW', 'RENNET']) {
    expect(codes('MUSLIM').has(c)).toBe(true);
  }
  // 견과 묶음: 트리넛 13~22 — 피넛(12)은 별도 성분이라 미포함, 밤(22) 보수 포함
  expect(codes('NUT_ALLERGY').has('PEANUT')).toBe(false);
  expect(codes('NUT_ALLERGY').has('CHESTNUT')).toBe(true);
});

it('복수 선택 = 합집합 + 기존 선택 보존(삭제 금지 — 안전)', () => {
  const merged = unionPresetCodes(['NO_ALCOHOL', 'LACTOSE_FREE'], ['PEANUT']);
  expect(merged.has('PEANUT')).toBe(true); // 기존 보존
  for (const c of ['ALCOHOL', 'MIRIN', 'COOKING_WINE', 'MILK', 'CHEESE', 'GHEE']) expect(merged.has(c)).toBe(true);
  expect(merged.size).toBe(1 + 3 + 6); // 중복 없는 합집합
});

it('배선 소스 잠금 — 온보딩 스텝 플래그 분기·스킵 무주입·프로필 합집합 적용·플래그 dev 한정', () => {
  const fs = require('fs');
  const ob = fs.readFileSync('src/app/onboarding/index.tsx', 'utf8') as string;
  expect(ob).toContain("FLAGS.dietPresetsEnabled\n  ? ['consent', 'nationality', 'presets', 'restrictions', 'spice']"); // off = 현행 4스텝
  expect(ob).toContain("if (step === 'presets') setRestrictions((cur) => unionResolvedCodes(dietPresets, Array.from(presets), cur));"); // 기본 체크 주입(기존 보존 — P-208 서버 매핑 기준)
  expect(ob).toContain("if (step === 'presets') return setStep(ORDER[idx + 1]);"); // 스킵 = 주입 없음(현행 동일)
  const pr = fs.readFileSync('src/app/profile/restrictions.tsx', 'utf8') as string;
  expect(pr).toContain('unionResolvedCodes(dietPresets, Array.from(presetSel), cur)'); // 프로필 = 합집합 적용(P-208)
  expect(fs.readFileSync('src/lib/flags.ts', 'utf8')).toContain('dietPresetsEnabled: !PROD_CHANNEL');
});

/* ---- P-208: 서버 스왑 — 파싱·폴백 ---- */
describe('P-208: useDietPresets 서버 스왑', () => {
  it('서버 매핑 파싱 — diets[].code·ingredients[].code 채택(서버 우선)', async () => {
    jest.resetModules();
    jest.doMock('@/lib/api/client', () => ({
      api: { get: jest.fn().mockResolvedValue({ diets: [{ code: 'NO_ALCOHOL', name: '무알코올', ingredients: [{ code: 'ALCOHOL' }, { code: 'MIRIN' }] }] }) },
      apiLang: () => 'en',
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { _fetchDietPresetsForTest } = require('@/lib/data/useDietPresets') as typeof import('@/lib/data/useDietPresets');
    const map = await _fetchDietPresetsForTest();
    expect(map.get('NO_ALCOHOL')?.codes).toEqual(['ALCOHOL', 'MIRIN']);
    expect(map.get('NO_ALCOHOL')?.name).toBe('무알코올'); // 운반만(표시는 lang 미해석 실측으로 i18n 유지)
  });

  it('배선 소스 잠금 — 소비처 = 서버 우선 resolved 경유(unionResolvedCodes)·폴백 = 상수', () => {
    const fs = require('fs');
    const ob = fs.readFileSync('src/app/onboarding/index.tsx', 'utf8') as string;
    expect(ob).toContain('unionResolvedCodes(dietPresets, Array.from(presets), cur)');
    expect(fs.readFileSync('src/app/profile/restrictions.tsx', 'utf8')).toContain('unionResolvedCodes(dietPresets, Array.from(presetSel), cur)');
    // 폴백 = 상수 파생(오프라인 온보딩 생존)
    expect(fs.readFileSync('src/lib/data/useDietPresets.ts', 'utf8')).toContain('hit?.codes ?? presetSubstanceCodes(p)');
  });
});

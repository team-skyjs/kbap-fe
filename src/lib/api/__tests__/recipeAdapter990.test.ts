/** KB-990 조리법 어댑터(S-961 초안) — 방식 거르기·순서·수치 검증·빈 섹션 숨김. */
import { adaptRecipe } from '../recipeAdapter';

const MW = {
  type: 'MICROWAVE',
  water: { ml: 220, line: 'INNER' },
  power: [{ watt: 1000, seconds: 120 }, { watt: 700, seconds: 150 }],
  waitSeconds: 60,
  drainKeepMl: null,
  steps: ['Open the lid halfway.', '  ', 'Add water to the inner line.'],
  cautions: ['The container gets hot.', ''],
};
const BW = { type: 'BOILING_WATER', water: { ml: null, line: 'COVER_NOODLES' }, power: [], waitSeconds: 180, steps: ['Pour boiling water.'], cautions: [] };

it('방식: 전자레인지가 먼저(서버 순서 무관) · 모르는 방식 버림 · 빈 줄·빈 주의 버림', () => {
  const r = adaptRecipe({ source: 'LABEL', methods: [BW, { type: 'OVEN' }, MW] })!;
  expect(r.methods.map((m) => m.type)).toEqual(['MICROWAVE', 'BOILING_WATER']);
  expect(r.methods[0]).toEqual({
    type: 'MICROWAVE', waterMl: 220, waterLine: 'INNER', power: [{ watt: 1000, seconds: 120 }, { watt: 700, seconds: 150 }],
    waitSeconds: 60, drainKeepMl: null, steps: ['Open the lid halfway.', 'Add water to the inner line.'], cautions: ['The container gets hot.'],
  });
  expect(r.methods[1].waterLine).toBe('COVER_NOODLES');
  expect(r.source).toBe('LABEL');
});

it('수치: 0·음수·NaN = null(타일 미표시) · 전력은 W·초가 둘 다 양수인 줄만 · 모르는 물 선 = null', () => {
  const m = adaptRecipe({ methods: [{ ...MW, water: { ml: -1, line: 'TOP' }, power: [{ watt: 0, seconds: 60 }, { watt: 1000, seconds: NaN }, { watt: 600, seconds: 200 }], waitSeconds: -5 }] })!.methods[0];
  expect(m.waterMl).toBeNull();
  expect(m.waterLine).toBeNull();
  expect(m.power).toEqual([{ watt: 600, seconds: 200 }]);
  expect(m.waitSeconds).toBeNull();
});

it('recipe 없음·방식 0·보여 줄 게 없는 방식뿐 = null(섹션 숨김)', () => {
  expect(adaptRecipe(undefined)).toBeNull();
  expect(adaptRecipe(null)).toBeNull();
  expect(adaptRecipe({ methods: [] })).toBeNull();
  expect(adaptRecipe({ methods: [{ type: 'MICROWAVE', water: null, power: null, steps: [], cautions: ['hot'] }] })).toBeNull();
});

it('P-633 계약(dev Swagger): steps는 문자열 배열 — 초안 객체 모양({ text })은 단계로 읽지 않는다', () => {
  const r = adaptRecipe({ source: 'LABEL', methods: [{ ...BW, steps: ['물을 붓는다', 'Wait.'] }] })!;
  expect(r.methods[0].steps).toEqual(['물을 붓는다', 'Wait.']);
  const legacy = adaptRecipe({ methods: [{ type: 'MICROWAVE', water: null, power: null, steps: [{ text: 'x' }] as unknown as string[], cautions: [] }] });
  expect(legacy).toBeNull(); // 보여 줄 게 없는 방식 = 숨김(객체를 문자열로 오인해 "[object Object]"를 그리지 않는다)
});

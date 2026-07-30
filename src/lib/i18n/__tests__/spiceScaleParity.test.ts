/**
 * P-015(KB-187) 맵기 라벨 i18n 패리티 → P-081 5단계 개편: spice.band.0~4(라벨)와
 * spice.example.0~4(대표 음식 예시)가 10개 로케일 전부에 비어 있지 않게 존재해야
 * 한다 (번역 누락·영어 하드코딩 회귀 방지). 구 spice.scale(10단)은 폐기 잠금.
 */
const LANGS = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];

type SpiceI18n = { spice?: { band?: Record<string, string>; example?: Record<string, string>; scale?: unknown } };

it.each(LANGS)('%s 로케일에 spice.band·example 0~4 전부 존재 (패리티)', (lang) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const json = require(`../${lang}.json`) as SpiceI18n;
  for (let i = 0; i <= 4; i++) {
    for (const group of ['band', 'example'] as const) {
      const v = json.spice?.[group]?.[String(i)];
      expect(typeof v).toBe('string');
      expect((v as string).length).toBeGreaterThan(0);
    }
  }
});

it.each(LANGS)('%s — 구 spice.scale(10단)은 폐기됨', (lang) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const json = require(`../${lang}.json`) as SpiceI18n;
  expect(json.spice?.scale).toBeUndefined();
});

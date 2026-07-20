/**
 * P-015(KB-187): 맵기 라벨 i18n 이전 잠금 — SPICE_SCALE은 i18n 키 11개이고,
 * 10개 로케일 전부에 spice.scale.0~10이 비어 있지 않게 존재해야 한다
 * (영어 하드코딩 회귀·번역 누락 방지).
 */
import { SPICE_SCALE } from '@/lib/onboarding/data';

const LANGS = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];

it('SPICE_SCALE = i18n 키 11개 (spice.scale.0~10)', () => {
  expect(SPICE_SCALE).toHaveLength(11);
  SPICE_SCALE.forEach((k, i) => expect(k).toBe(`spice.scale.${i}`));
});

it.each(LANGS)('%s 로케일에 spice.scale 0~10 전부 존재 (패리티)', (lang) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const json = require(`../${lang}.json`) as { spice?: { scale?: Record<string, string> } };
  for (let i = 0; i <= 10; i++) {
    const v = json.spice?.scale?.[String(i)];
    expect(typeof v).toBe('string');
    expect((v as string).length).toBeGreaterThan(0);
  }
});

/** KB-679 — 번역 버튼 3키(translation.translate·seeOriginal·translateFailed) 10로케일 존재 · 비어 있지 않음 · 이모지 없음. */
import * as fs from 'fs';
import * as path from 'path';

const DIR = path.join(__dirname, '..');
const LOCALES = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

it('로케일 10개 전부 검사 대상', () => {
  expect([...LOCALES].sort()).toEqual(['en', 'es', 'id', 'ja', 'ko', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']);
});

it.each(LOCALES)('%s — translation 3키 존재 · 비어 있지 않음 · 이모지 0 · 버튼 라벨은 짧다(24자 이하)', (l) => {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, `${l}.json`), 'utf8')) as { translation?: Record<string, string> };
  for (const k of ['translate', 'seeOriginal', 'translateFailed']) {
    const v = j.translation?.[k];
    expect(typeof v).toBe('string');
    expect(v!.trim().length).toBeGreaterThan(0);
    expect(/\p{Extended_Pictographic}/u.test(v!)).toBe(false);
  }
  expect(j.translation!.translate.length).toBeLessThanOrEqual(24);
  expect(j.translation!.seeOriginal.length).toBeLessThanOrEqual(24);
});

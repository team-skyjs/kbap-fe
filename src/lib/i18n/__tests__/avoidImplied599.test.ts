/** KB-599 — 함의 회피 근거 문구 키(detail.avoidImplied) 10로케일 존재 · {{ingredient}} 보간 · 길이 상한. */
import * as fs from 'fs';
import * as path from 'path';

const DIR = path.join(__dirname, '..');
const LOCALES = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

it('로케일 10개 전부 검사 대상', () => {
  expect(LOCALES.sort()).toEqual(['en', 'es', 'id', 'ja', 'ko', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']);
});

it.each(LOCALES)('%s — detail.avoidImplied 존재 · {{ingredient}} 1회 · 48자 이하(타일 2줄 클램프)', (l) => {
  const v = (JSON.parse(fs.readFileSync(path.join(DIR, `${l}.json`), 'utf8')) as { detail: Record<string, string> }).detail.avoidImplied;
  expect(typeof v).toBe('string');
  expect(v.match(/\{\{ingredient\}\}/g)).toHaveLength(1);
  expect(v.replace('{{ingredient}}', '').length).toBeLessThanOrEqual(48);
});

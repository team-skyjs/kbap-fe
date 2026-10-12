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

/* 공부 세션 지적(#218): 타일 폭(375pt ≈90pt · 320pt ≈70pt)에서 2줄 클램프는 **뒤쪽**을 자른다 — 재료명이 문장 끝에
   있으면 핵심 정보(어떤 재료 때문인지)가 먼저 잘린다(es·ru 실례). 재료명은 앞쪽에 둔다. */
it.each(LOCALES)('%s — {{ingredient}}가 앞 18자 안에서 시작(2줄 클램프가 재료명을 자르지 않게)', (l) => {
  const v = (JSON.parse(fs.readFileSync(path.join(DIR, `${l}.json`), 'utf8')) as { detail: Record<string, string> }).detail.avoidImplied;
  expect(v.indexOf('{{ingredient}}')).toBeLessThanOrEqual(18);
});

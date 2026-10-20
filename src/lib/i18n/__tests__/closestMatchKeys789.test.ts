/**
 * KB-789 — scan.closestMatch* 5키가 10로케일 전부 존재 + 보간 자리표시자(scanned·food·foodKo) 보존.
 * 누락 = 빈 칩/카드 라벨, 자리표시자 누락 = 원문·음식명이 안 보이는 안내.
 */
import * as fs from 'fs';
import * as path from 'path';

const LOCALES = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
const dir = path.join(__dirname, '..');
const load = (l: string) => JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8')) as Record<string, Record<string, string>>;

const KEYS = ['closestMatchChip', 'closestMatchLine', 'closestMatchSheetTitle', 'closestMatchSheetBody', 'closestMatchSeeDetails'];
const PLACEHOLDERS: Record<string, string[]> = {
  closestMatchLine: ['{{scanned}}'],
  closestMatchSheetBody: ['{{scanned}}', '{{food}}', '{{foodKo}}'],
  closestMatchSeeDetails: ['{{food}}'],
};

it('closestMatch 5키가 10로케일 scan 네임스페이스에 비어 있지 않게 존재한다', () => {
  for (const l of LOCALES) {
    const scan = load(l).scan;
    for (const k of KEYS) expect({ locale: l, key: k, type: typeof scan[k], empty: !scan[k]?.trim() }).toEqual({ locale: l, key: k, type: 'string', empty: false });
  }
});

it('보간 자리표시자 보존 — scanned·food·foodKo', () => {
  for (const l of LOCALES) {
    const scan = load(l).scan;
    for (const [k, ps] of Object.entries(PLACEHOLDERS)) for (const p of ps) expect({ locale: l, key: k, has: scan[k].includes(p), p }).toEqual({ locale: l, key: k, has: true, p });
  }
});

it('긍정 프레임 — "못 찾음/준비중" 류 부정 문구 0 (헌법 III, 발주 금지어)', () => {
  const BAD = [/not found/i, /couldn.t find/i, /coming soon/i, /준비 ?중/, /못 ?찾/];
  for (const l of LOCALES) {
    const scan = load(l).scan;
    for (const k of KEYS) for (const re of BAD) expect({ locale: l, key: k, bad: re.test(scan[k]) }).toEqual({ locale: l, key: k, bad: false });
  }
});

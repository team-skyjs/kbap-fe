/** KB-909 Codex #367 P2 — 글자 상향 코드모드가 lineHeight만 올리고 같은 스타일의 고정 높이(2줄 슬롯)는 못 따라간 유형.
 *  ① 고정 2줄 슬롯 = 2 × lineHeight ② 전수: 같은 객체에 height·lineHeight 리터럴이 함께 있으면 height ≥ lineHeight(한 줄도 못 담는 상자 0) */
import * as fs from 'fs';
import * as path from 'path';

const read = (f: string) => fs.readFileSync(f, 'utf8');
const style = (src: string, key: string) => src.match(new RegExp(`^\\s+${key}: \\{[^\\n]*`, 'm'))?.[0] ?? '';
const num = (s: string, k: string) => Number(s.match(new RegExp(`\\b${k}: (\\d+(?:\\.\\d+)?)\\b`))?.[1]);

it('고정 2줄 슬롯 = 2 × lineHeight(맵기 설명·랭킹 내역 설명)', () => {
  const spice = style(read('src/app/onboarding/index.tsx'), 'spiceDesc');
  expect(num(spice, 'height')).toBe(2 * num(spice, 'lineHeight'));
  const detail = style(read('src/app/profile/ranking.tsx'), 'breakDetail');
  expect(num(detail, 'minHeight')).toBe(2 * num(detail, 'lineHeight'));
});

it('전수: 한 줄 스타일 객체에 height·lineHeight가 함께 있으면 height ≥ lineHeight', () => {
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : walk(path.join(d, e.name))) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));
  const bad: string[] = [];
  for (const f of walk('src')) {
    for (const m of read(f).matchAll(/^\s+(\w+): \{([^{}\n]*)\}/gm)) {
      const h = num(m[2], 'height'), lh = num(m[2], 'lineHeight');
      if (Number.isFinite(h) && Number.isFinite(lh) && h < lh) bad.push(`${f}:${m[1]} height ${h} < lineHeight ${lh}`);
    }
  }
  expect(bad).toEqual([]);
});

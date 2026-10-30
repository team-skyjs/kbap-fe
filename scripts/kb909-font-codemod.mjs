#!/usr/bin/env node
/**
 * KB-909 — 기본 글자 크기 한 단계 상향(예진 10/30 "상한은 그대로, 전반적으로 글자 키워야 해").
 * 소스의 `fontSize: <숫자>` 리터럴을 표대로 한 번에 치환한다(런타임 간접층 없음 — 소스 숫자 = 실제 크기).
 * 같은 스타일 객체({ … })에 `lineHeight: <숫자>`가 있으면 새/옛 비율로 올려 반올림한다(잘림 방지).
 * 대상: src/**\/*.ts(x) — __tests__·theme.ts 제외(type 토큰은 손으로 표대로). 16 이상은 그대로.
 *
 *   node scripts/kb909-font-codemod.mjs          # 치환
 *   node scripts/kb909-font-codemod.mjs --dry    # 바뀔 수만
 */
import fs from 'node:fs';
import path from 'node:path';

// 발주 표(11→12·12→13·12.5→13·13→14·13.5→14·14→16·15→16, 16 이상 그대로) + 표 밖 값은 같은 규칙(x.5 = x의 목표)으로: 9.5→10·10→11·10.5→11·11.5→12·14.5→16·15.5→16
const MAP = { 9.5: 10, 10: 11, 10.5: 11, 11: 12, 11.5: 12, 12: 13, 12.5: 13, 13: 14, 13.5: 14, 14: 16, 14.5: 16, 15: 16, 15.5: 16 };
const dry = process.argv.includes('--dry');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') walk(p, out); }
    else if (/\.tsx?$/.test(e.name) && !p.endsWith(path.join('lib', 'theme.ts'))) out.push(p);
  }
  return out;
}

/** idx를 감싸는 가장 안쪽 { … } 범위 — 문자열 안 괄호는 드물어 무시(ponytail: 따옴표 안 중괄호가 있는 객체는 범위가 틀릴 수 있다 — 결과 diff로 확인) */
function enclosing(src, idx) {
  let depth = 0, start = -1;
  for (let i = idx; i >= 0; i--) {
    const c = src[i];
    if (c === '}') depth++;
    else if (c === '{') { if (depth === 0) { start = i; break; } depth--; }
  }
  if (start < 0) return null;
  depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return [start, i + 1]; }
  }
  return null;
}

let files = 0, sizes = 0, lines = 0;
for (const f of walk('src')) {
  const src = fs.readFileSync(f, 'utf8');
  const edits = []; // [start, end, text]
  for (const m of src.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)\b/g)) {
    const old = Number(m[1]);
    const nu = MAP[old];
    if (nu == null) continue;
    const at = m.index + m[0].length - m[1].length;
    edits.push([at, at + m[1].length, String(nu)]);
    sizes++;
    const box = enclosing(src, m.index);
    if (!box) continue;
    const obj = src.slice(box[0], box[1]);
    // 같은 객체 안에 fontSize가 하나뿐일 때만 lineHeight를 따라 올린다(여러 개면 어느 쪽 비율인지 모호)
    if ((obj.match(/fontSize:/g) ?? []).length !== 1) continue;
    for (const l of obj.matchAll(/lineHeight:\s*(\d+(?:\.\d+)?)\b/g)) {
      const lh = Number(l[1]);
      const nlh = Math.round((lh * nu) / old);
      if (nlh === lh) continue;
      const la = box[0] + l.index + l[0].length - l[1].length;
      edits.push([la, la + l[1].length, String(nlh)]);
      lines++;
    }
  }
  if (!edits.length) continue;
  files++;
  if (dry) continue;
  let out = src;
  for (const [a, b, t] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + t + out.slice(b);
  fs.writeFileSync(f, out);
}
console.log(`${dry ? '[dry] ' : ''}files ${files} · fontSize ${sizes} · lineHeight ${lines}`);

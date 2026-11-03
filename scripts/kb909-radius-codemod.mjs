#!/usr/bin/env node
/**
 * KB-909 — 모서리 radius 하드코딩 → theme 토큰(radius.xs 4 · md 12 · lg 16 · xl 24 · pill 999, 예진 10/30 "알약으로 맞추자").
 * 분류(스타일 객체 단위):
 *   - 바텀시트 윗모서리(borderTopLeft/RightRadius) = xl
 *   - 원·알약: 값 ≥ 상자 높이/2(같은 객체의 height·width·minHeight 리터럴) 또는 값 ≥ 99 = pill (원은 정사각 상자라 pill이어도 원)
 *   - 그 밖 값: ≤ 6 = xs · 7~13 = md · 14~20 = lg · 21 이상 = 상자 높이를 모르면 보고(수동)
 *   - 위험도 띠·배지·리본(RISK_KEEP 파일·키)은 모양 유지 — 같은 값 토큰이 있을 때만 토큰, 아니면 리터럴 그대로 + 보고
 * 리터럴이 아닌 식(size / 2 등)은 그대로 둔다(계산값 — 하드코딩 아님).
 *
 *   node scripts/kb909-radius-codemod.mjs --report   # 분류표만
 *   node scripts/kb909-radius-codemod.mjs            # 치환 + import 보충
 */
import fs from 'node:fs';
import path from 'node:path';

const report = process.argv.includes('--report');
const TOK = { xs: 4, md: 12, lg: 16, xl: 24, pill: 999 };
// 위험도 표시 모양 유지(헌법: 4상태 형태 구분) — 파일 경로·스타일 키 이름으로 고른다
const RISK_KEEP_FILE = /(RiskBadge|RiskPill|VerdictBand|RiskRibbon|riskBand|Ribbon)/i;
const RISK_KEEP_KEY = /^(risk|verdict|ribbon|band|riskBadge|riskPill|badgeRisk)/i;

// 21 이상인데 상자 높이를 모르는 곳 — 스타일 키로 직접 판정(PR 본문 표와 같다)
const MANUAL = {
  confirmCard: 'xl', dialog: 'xl', editCard: 'xl', card: 'xl', box: 'xl', // 확인 대화상자·편집 카드·카메라 자리 = 시트급 표면
  fab: 'pill', tierPill: 'pill', moreChip: 'pill', demoMark: 'pill', // 떠 있는 버튼·칩·표시 = 알약
  tile: 'md', // 로그인 아이콘 타일 = 이미지 타일
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') walk(p, out); }
    else if (/\.tsx?$/.test(e.name) && !p.endsWith(path.join('lib', 'theme.ts'))) out.push(p);
  }
  return out;
}
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
const num = (obj, k) => { const m = obj.match(new RegExp(`\\b${k}:\\s*(\\d+(?:\\.\\d+)?)\\b`)); return m ? Number(m[1]) : null; };
/** 객체의 바깥 층만(shadowOffset { width, height } 같은 안쪽 객체 제외 — 그 height를 상자 높이로 읽어 카드가 알약이 되던 오분류 3건) */
const topLevel = (obj) => { let d = 0, out = ''; for (const c of obj) { if (c === '{') d++; if (d <= 1) out += c; if (c === '}') d--; } return out; };
/** 객체 바로 앞의 스타일 키 이름(`  pill: {`) */
const keyOf = (src, start) => (src.slice(Math.max(0, start - 60), start).match(/(\w+)\s*:\s*$/) ?? [])[1] ?? '';

// 기존 토큰 흡수: radius.sm(8)·radius.lg(10) → radius.md(12). 토큰 이름 lg는 이제 16(카드)이라 먼저 옮긴다
if (!report) for (const f of walk('src')) {
  const s0 = fs.readFileSync(f, 'utf8');
  const s1 = s0.replace(/\bradius\.(sm|lg)\b/g, 'radius.md');
  if (s1 !== s0) fs.writeFileSync(f, s1);
}

const rows = [];
let changedFiles = 0;
for (const f of walk('src')) {
  const src = fs.readFileSync(f, 'utf8');
  const edits = [];
  for (const m of src.matchAll(/\b(border(?:Top|Bottom)?(?:Left|Right)?Radius):\s*(\d+(?:\.\d+)?)\b(?!\s*[*/+-])/g)) {
    const prop = m[1], v = Number(m[2]);
    if (v === 0) continue; // 0 = 라운딩 없음(의도된 직각 — 예: 프로필 Dietary 타일 A-PF-07) — 토큰 대상 아님
    const box = enclosing(src, m.index);
    const obj = box ? src.slice(box[0], box[1]) : '';
    const key = box ? keyOf(src, box[0]) : '';
    const top = topLevel(obj);
    const h = num(top, 'height') ?? num(top, 'minHeight'), w = num(top, 'width');
    const side = Math.min(...[h, w].filter((x) => x != null));
    let tok = null, why = '';
    if (RISK_KEEP_FILE.test(f) || RISK_KEEP_KEY.test(key)) {
      tok = Object.keys(TOK).find((k) => TOK[k] === v) ?? null; why = tok ? 'risk(같은 값)' : 'risk-keep';
    } else if (/^borderTop(Left|Right)Radius$/.test(prop) && v >= 14) { tok = 'xl'; why = 'sheet-top'; }
    else if (v >= 99 || (Number.isFinite(side) && v * 2 >= side - 1)) { tok = 'pill'; why = Number.isFinite(side) ? `pill(${side})` : 'pill'; }
    else if (v <= 6) { tok = 'xs'; why = 'small'; }
    else if (v <= 13) { tok = 'md'; why = 'tile/input'; }
    else if (v <= 20) { tok = 'lg'; why = 'card'; }
    else if (MANUAL[key]) { tok = MANUAL[key]; why = `manual:${key}`; }
    else { why = 'manual'; }
    rows.push({ f, key, prop, v, tok, why });
    if (tok) { const at = m.index + m[0].length - m[2].length; edits.push([at, at + m[2].length, `radius.${tok}`]); }
  }
  if (!edits.length || report) continue;
  let out = src;
  for (const [a, b, t] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + t + out.slice(b);
  // radius import 보충(이미 theme에서 가져오면 이름만 추가)
  if (!/\bradius\b[^;]*from '@\/lib\/theme'/.test(out)) {
    const im = out.match(/import \{([^}]*)\} from '@\/lib\/theme';/);
    if (im) out = out.replace(im[0], `import {${im[1].replace(/\s*$/, '')}, radius } from '@/lib/theme';`);
    else out = out.replace(/((?:^import [^\n]*\n)+)/m, `$1import { radius } from '@/lib/theme';\n`);
  }
  fs.writeFileSync(f, out);
  changedFiles++;
}
const by = {};
for (const r of rows) by[r.why.replace(/\(\d+\)/, '')] = (by[r.why.replace(/\(\d+\)/, '')] ?? 0) + 1;
console.log(JSON.stringify(by));
for (const r of rows.filter((r) => r.why === 'manual' || r.why.startsWith('risk'))) console.log(`${r.why}\t${r.f}\t${r.key}\t${r.prop}: ${r.v}`);
if (!report) console.log(`changed files ${changedFiles}`);

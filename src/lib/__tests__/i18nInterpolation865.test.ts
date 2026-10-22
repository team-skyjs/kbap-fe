/**
 * KB-865 QA AR: "{{max}}"가 화면에 그대로 나온 회귀 — t(키) 호출이 en 값의 자리표시자({{name}})를 넘기지 않으면 실패.
 * 정적 검사: 리터럴 키 t('a', …) · 삼항 키 t(c ? 'a' : 'b', …). 옵션 자리에 변수(객체)를 통째로 넘기면 통과로 본다(내용은 호출부 책임).
 * 템플릿 키 t(`a.${x}`)는 대상 밖 — 그 계열(risk·scan.stage·packagedScan.err 등)은 자리표시자 없음(아래 마지막 it이 잠금).
 */
import fs from 'fs';
import path from 'path';

const en = JSON.parse(fs.readFileSync('src/lib/i18n/en.json', 'utf8')) as Record<string, unknown>;
const get = (k: string): unknown => k.split('.').reduce<unknown>((o, p) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[p] : undefined), en);
const values = (k: string): string[] => {
  const v = get(k);
  if (typeof v === 'string') return [v];
  return ['_one', '_other'].map((s) => get(k + s)).filter((x): x is string => typeof x === 'string');
};
const placeholders = (k: string) => new Set(values(k).flatMap((v) => [...v.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1])));
const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : files(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });

/** 키 목록 + 옵션 원문(없음 = '') → 빠진 자리표시자 */
const missing = (keys: string[], opts: string) => {
  if (opts && !opts.trim().startsWith('{')) return []; // 변수 통째 전달
  return keys.flatMap((k) => [...placeholders(k)].filter((n) => !new RegExp(`\\b${n}\\b`).test(opts)).map((n) => `${k} {{${n}}}`));
};

describe('i18n 보간 — 자리표시자는 전부 값을 받는다', () => {
  it('리터럴·삼항 키 t() 호출 전수', () => {
    const offenders: string[] = [];
    const literal = /\bt\(\s*'([\w.]+)'\s*(?:,\s*(\{[^}]*\}|[\w.]+))?\s*\)/g;
    const ternary = /\bt\([^()'`]*?\?\s*'([\w.]+)'\s*:\s*'([\w.]+)'\s*(?:,\s*(\{[^}]*\}|[\w.]+))?\s*\)/g;
    for (const f of files('src')) {
      const src = fs.readFileSync(f, 'utf8');
      const line = (i: number) => src.slice(0, i).split('\n').length;
      for (const m of src.matchAll(literal)) for (const x of missing([m[1]], m[2] ?? '')) offenders.push(`${f}:${line(m.index ?? 0)} ${x}`);
      for (const m of src.matchAll(ternary)) for (const x of missing([m[1], m[2]], m[3] ?? '')) offenders.push(`${f}:${line(m.index ?? 0)} ${x}`);
    }
    expect(offenders).toEqual([]);
  });
  it('검사기 자체: 빠진 값을 잡는다(뮤테이션 대역)', () => {
    expect(missing(['packagedScan.labelMaxReached'], '')).toEqual(['packagedScan.labelMaxReached {{max}}']);
    expect(missing(['packagedScan.labelMaxReached'], '{ max }')).toEqual([]);
    expect(missing(['packagedScan.labelMaxReached'], 'vars')).toEqual([]);
  });
  it('템플릿 키 계열(검사 밖) = 자리표시자 없음', () => {
    for (const fam of ['risk', 'scan.stage', 'packagedScan.err', 'scanMode', 'ranking.tier', 'ranking.tierKo', 'community.map', 'community.reason', 'ingCat', 'translation.lang']) {
      const o = get(fam) as Record<string, unknown>;
      expect({ fam, has: JSON.stringify(o).includes('{{') }).toEqual({ fam, has: false });
    }
  });
});

/**
 * teamtest OTA host guard(scripts/teamtest-target.mjs guard dist)는 EAS 워크플로에서만 돈다 — 번들에 반대 환경 전체 호스트가
 * 실리면 발행이 막히는데 jest·CI는 못 봤다(10/27 develop e7132a20: runtimeContext의 'dev.kbap.site' 리터럴).
 * ① 실제 BE 주소가 사는 config.ts 밖 코드에 전체 호스트 리터럴 0 ② 서브도메인 분류 = 이전 규칙과 같은 결과.
 */
import fs from 'fs';
import path from 'path';
import { runtimeContext } from '../runtimeContext';

const ALLOWED = new Set([path.join('src', 'lib', 'data', 'config.ts')]); // BE_BASE 기본값(실제 주소의 집)
const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : files(p);
    return /\.(ts|tsx|js|jsx)$/.test(e.name) ? [p] : [];
  });

it('src 코드(주석 제외)에 dev.kbap.site·prod.kbap.site 문자열 리터럴 0 — config.ts만 허용', () => {
  const offenders: string[] = [];
  for (const f of files('src')) {
    if (ALLOWED.has(f)) continue;
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // 주석 줄 — 번들에 안 실린다
      if (/['"`][^'"`\n]*\b(dev|prod)\.kbap\.site/.test(line)) offenders.push(`${f}:${i + 1}`);
    });
  }
  expect(offenders).toEqual([]);
});

it('be_env 서브도메인 분류 = 이전 정확 일치 규칙과 같은 결과(https · 정확히 <sub>.kbap.site 한 단계)', () => {
  const env = (beBase: string) => runtimeContext({ development: false, os: 'ios', beBase }).be_env;
  const cases: [string, string][] = [
    ['https://dev.kbap.site', 'dev'], ['https://prod.kbap.site', 'prod'], ['https://prod.kbap.site/api', 'prod'],
    ['http://dev.kbap.site', 'other'], ['https://staging.kbap.site', 'other'], ['https://x.dev.kbap.site', 'other'],
    ['https://prod.kbap.site.attacker.test', 'other'], ['https://kbap.site', 'other'], ['https://dev.kbap.site.', 'other'],
    ['https://example.com', 'other'], ['not a url', 'unknown'],
  ];
  for (const [u, want] of cases) expect({ u, got: env(u) }).toEqual({ u, got: want });
});

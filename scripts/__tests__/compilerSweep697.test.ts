/**
 * KB-697 — 컴파일러 굳는 자리 검사(scripts/compiler-sweep.cjs)의 판정 단위.
 * 렌더 중 바깥 값 읽기 = 후보 · 중첩 함수(이벤트·효과) 안 = 아님 · 바깥 값 읽는 헬퍼 호출 = 후보 · 기준선 대비 개수 비교 · 0파일 = "안 돌았다".
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS 스크립트(노드로 직접 실행)
const sweep = require('../compiler-sweep.cjs') as {
  sweepSource: (code: string, rel: string, impure: Map<string, string>) => { items: { key: string }[]; stats: { compiled: number } };
  collectImpureHelpers: (s: { rel: string; code: string }[], failures?: string[]) => Map<string, string>;
  diffBaseline: (items: { key: string }[], base: { key: string; count: number; verdict: string }[]) => { fresh: { key: string; extra: number }[]; gone: { key: string }[] };
  runSweep: (srcRoot: string) => { files: number; compiled: number; failures: string[] };
  didNotRun: (r: { files: number; compiled: number; failures: string[]; items: unknown[] }, baselineTotal: number) => boolean;
};

const keys = (code: string, impure = new Map<string, string>()) => sweep.sweepSource(code, 'x/Comp.tsx', impure).items.map((i) => i.key);

it('렌더 중 Date.now() = 후보 — 의존 없음이라 인스턴스당 1회(once)로 굳는다', () => {
  const k = keys(`export function Comp({ a }: { a: string }) { const n = Date.now(); return <Text>{a}{n}</Text>; }`);
  expect(k).toEqual(['direct | x/Comp.tsx | time/random | once | Date.now()']);
});

it('이벤트 핸들러(중첩 함수) 안의 Date.now()·getQueryData = 후보 아님', () => {
  const k = keys(`export function Comp({ qc }: { qc: { getQueryData: (k: string) => unknown } }) {
    const onPress = () => console.log(Date.now(), qc.getQueryData('k'));
    return <Pressable onPress={onPress} />;
  }`);
  expect(k).toEqual([]);
});

it('렌더 중 캐시 읽기 = 후보(의존 [qc, id]가 같으면 옛 값 — KB-694) · 렌더 본문의 단순 싱글턴 읽기는 매 렌더 다시 읽혀 후보 아님', () => {
  const k = keys(`import i18n from 'i18n';
    export function Comp({ qc, id }: { qc: { getQueryData: (k: string) => unknown }; id: string }) {
      const d = qc.getQueryData(id); const l = i18n.language; return <Text>{String(d)}{l}</Text>;
    }`);
  expect(k).toEqual(['direct | x/Comp.tsx | store read | deps | qc.getQueryData(id)']);
});

it('바깥 값 읽는 모듈 헬퍼(한 단계)의 렌더 중 호출 = helper 후보(lint·grep이 놓친 apiLang() 유형)', () => {
  const code = `import i18n from 'i18n';
    function apiLang() { return i18n.language.slice(0, 2); }
    export function Comp({ a }: { a: string }) { const l = apiLang(); return <Text>{a}{l}</Text>; }`;
  const impure = sweep.collectImpureHelpers([{ rel: 'x/Comp.tsx', code }]);
  expect([...impure.keys()]).toEqual(['apiLang']);
  expect(keys(code, impure)).toEqual(expect.arrayContaining(['helper | x/Comp.tsx | reads i18n.language | once | apiLang()']));
});

it('기준선 비교 = 개수 — 같은 식이 한 자리 더 생기면 새 항목, 사라지면 gone', () => {
  const k = 'direct | a.tsx | time/random | deps | Date.now()';
  const base = [{ key: k, count: 1, verdict: '경미' }];
  expect(sweep.diffBaseline([{ key: k }], base)).toEqual({ fresh: [], gone: [], count: expect.any(Map) });
  expect(sweep.diffBaseline([{ key: k }, { key: k }], base).fresh).toEqual([{ key: k, extra: 1 }]);
  expect(sweep.diffBaseline([], base).gone).toEqual([expect.objectContaining({ key: k })]);
});

it('"안 돌았다" 판별 재료 — 빈 디렉터리 = 0파일 · 파싱 실패 = failures(통과와 다른 출력)', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-empty-'));
  expect(sweep.runSweep(empty)).toEqual(expect.objectContaining({ files: 0, compiled: 0, failures: [] }));
  const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-bad-'));
  fs.writeFileSync(path.join(bad, 'Bad.tsx'), 'export const x = (;\n');
  expect(sweep.runSweep(bad).failures.length).toBeGreaterThan(0);
});

it('기준선 파일 = 판정 4종만 · 키 중복 0 · 개수 ≥ 1', () => {
  const b = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'compiler-sweep-baseline.json'), 'utf8')) as { items: { key: string; count: number; verdict: string }[] };
  expect(b.items.length).toBeGreaterThan(0);
  for (const it2 of b.items) {
    expect(['잠복', '경미', '안전', '오탐']).toContain(it2.verdict);
    expect(it2.count).toBeGreaterThanOrEqual(1);
  }
  expect(new Set(b.items.map((i) => i.key)).size).toBe(b.items.length);
});

it('#231: 렌더 중 동기 콜백(배열 메서드) 안의 읽기 = 후보 — 컴파일러가 _temp로 끌어올리거나 tN에 메모해도 따라간다 · 이벤트 핸들러 안은 아님', () => {
  const hoisted = keys(`export function A({ items }: { items: string[] }) { const xs = items.map(() => Date.now()); return <Text>{xs.join()}</Text>; }`);
  expect(hoisted).toEqual(['direct | x/Comp.tsx | time/random | deps | Date.now()']); // items.map(_temp) + 모듈 수준 _temp
  const memoized = keys(`export function B({ items, k }: { items: string[]; k: number }) { const xs = items.map((i) => i + k + Date.now()); return <Text>{xs.join()}</Text>; }`);
  expect(memoized).toEqual(['direct | x/Comp.tsx | time/random | deps | Date.now()']); // t2 = i => … ; items.map(t2)
  const handler = keys(`export function C({ items }: { items: string[] }) { const onPress = () => items.map(() => Date.now()); return <Pressable onPress={onPress} />; }`);
  expect(handler).toEqual([]);
});

it('#231: 기준선이 있는데 후보 0 = "안 돌았다"(탐지가 통째로 빗나감) · 기준선도 0이면 정상', () => {
  const ran = { files: 233, compiled: 346, failures: [], items: [] };
  expect(sweep.didNotRun(ran, 12)).toBe(true);
  expect(sweep.didNotRun(ran, 0)).toBe(false);
  expect(sweep.didNotRun({ ...ran, items: [{}] }, 12)).toBe(false);
  expect(sweep.didNotRun({ ...ran, files: 0 }, 0)).toBe(true);
  expect(sweep.didNotRun({ ...ran, failures: ['x'] }, 0)).toBe(true);
});

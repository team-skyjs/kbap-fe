#!/usr/bin/env node
/**
 * KB-697 — React Compiler가 "굳히는 자리" 검사(CI 비차단 리포트).
 * KB-694·695 계열: 렌더 중 바깥 가변 값(시간·난수·캐시/스토어·싱글턴)을 읽으면 컴파일러 메모이즈가 첫 값에 굳힌다.
 * jest 전체 컴파일(#226)은 테스트가 있는 자리만 본다 → 소스 전부를 변환해 출력의 **메모 가드 안·중첩 함수 밖**(렌더 중 실행·캐시)에서
 *  ① 직접 읽기(Date.now·new Date()·Math.random·getQueryData/getState 류·싱글턴 멤버·인자 없는 호출) ② 그런 값을 읽는 모듈 수준
 *  헬퍼(한 단계)의 호출 — 을 찾는다(공부 세션 kb695-compiler-sweep 스크립트 두 개를 변환 1회로 합침). 레포를 고치지 않는다.
 *
 * 기준선(scripts/compiler-sweep-baseline.json, 건별 판정) 대비 **새 항목**만 경고(파일 단위 — 줄 번호는 컴파일러 생성 코드 기준이라 싣지 않는다).
 * 종료 코드: 0 = 돌았음(새 항목이 있어도 — 비차단) · 1 = **안 돌았다**(0파일·컴파일 0·변환 실패·기준선 읽기 실패·기준선이 있는데 후보 0 —
 *  컴파일러 판올림으로 탐지가 통째로 빗나간 경우) 또는 --strict에서 새 항목.
 * 한계: 헬퍼는 한 단계만 · 헬퍼 판정은 **전역 이름 매칭**(바인딩 해석 없음 — 별칭 import는 놓치고, 이름이 같은 순수 함수는 오탐) ·
 *  싱글턴·읽기 메서드 이름은 아래 정규식에 고정.
 * 사용: node scripts/compiler-sweep.cjs [--strict]
 */
/* global __dirname */
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const gen = require('@babel/generator').default;

const ROOT = path.resolve(__dirname, '..');
const BASELINE = path.join(__dirname, 'compiler-sweep-baseline.json');
const PARSE = { sourceType: 'module', plugins: ['typescript', 'jsx'] };
// ponytail: 이름 목록은 고정 정규식 — 새 스토어·싱글턴이 생기면 여기에 추가(한계는 README와 같음: 헬퍼는 한 단계만)
const SINGLETON_MEMBERS = /^(i18n\.language|AppState\.currentState|quietRef\.since)$/;
const READ_METHODS = /^(getQueryData|getQueriesData|getQueryState|getState|isFetching|isMutating|getColorScheme|getLocales|getCalendars)$/;
const IMPURE = /Date\.now\(\)|new Date\(\)|i18n\.language|\.getQueryData\b|\.getState\(\)|Math\.random\(\)|performance\.now\(\)|AppState\.currentState|inflightCount\(\)/;
const MEMO_GUARD = /\$\[\d+\]/;
// 렌더 중 **동기로 실행되는** 콜백(배열 메서드) — 가드 평가 중 돌아 결과가 굳는다(#231 Codex). 이벤트·효과·useCallback 콜백은 제외 그대로.
const SYNC_CALLBACK_METHODS = /^(map|filter|reduce|reduceRight|flatMap|forEach|find|findIndex|findLast|findLastIndex|some|every|sort)$/;
const isSyncMethodCall = (node) =>
  node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.type === 'Identifier' && SYNC_CALLBACK_METHODS.test(node.callee.property.name);
/** 식별자 → 그 이름에 묶인 함수(선언 · 초기값 · 이후 대입) */
const resolveFunctions = (idPath) => {
  const b = idPath.scope.getBinding(idPath.node.name);
  if (!b) return [];
  const out = [];
  if (b.path.isFunctionDeclaration()) out.push(b.path);
  else if (b.path.isVariableDeclarator() && b.path.get('init').isFunction()) out.push(b.path.get('init'));
  for (const cv of b.constantViolations) if (cv.isAssignmentExpression() && cv.get('right').isFunction()) out.push(cv.get('right'));
  return out;
};
const isSyncCallback = (fnPath) => {
  const call = fnPath.parentPath;
  return !!call && call.isCallExpression() && fnPath.listKey === 'arguments' && isSyncMethodCall(call.node);
};

function listSources(srcRoot) {
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p);
      } else if (/\.[jt]sx?$/.test(e.name) && !/\.test\./.test(e.name) && !/\.d\.ts$/.test(e.name)) files.push(p);
    }
  })(srcRoot);
  return files.sort();
}

/** ② 본문에서 바깥 가변 값을 읽는 모듈 수준 함수(훅·컴포넌트 제외) — name → 읽는 것 */
function collectImpureHelpers(sources /* [{ rel, code }] */, failures = []) {
  const impure = new Map();
  for (const { rel, code } of sources) {
    let ast;
    try {
      ast = parser.parse(code, PARSE);
    } catch (e) {
      failures.push(`${rel} — 파싱 실패 ${String(e.message).split('\n')[0].slice(0, 100)}`);
      continue;
    }
    const note = (name, node) => {
      if (!name || /^use[A-Z]/.test(name) || /^[A-Z]/.test(name)) return;
      const m = gen(node).code.match(IMPURE);
      if (m) impure.set(name, `${m[0]} @${rel}`);
    };
    traverse(ast, {
      FunctionDeclaration(p) {
        if (p.parent.type === 'Program' || p.parent.type === 'ExportNamedDeclaration') note(p.node.id && p.node.id.name, p.node);
      },
      VariableDeclarator(p) {
        const gp = p.parentPath.parent.type;
        if ((gp === 'Program' || gp === 'ExportNamedDeclaration') && p.node.init && /Function/.test(p.node.init.type)) note(p.node.id.name, p.node.init);
      },
    });
  }
  return impure;
}

/** 한 파일을 컴파일러로 변환하고 굳는 자리 후보를 낸다. 키에 줄 번호·$[n] 번호를 넣지 않는다(무관한 수정으로 기준선이 흔들리지 않게). */
function sweepSource(code, rel, impure) {
  const stats = { compiled: 0, skipped: [] };
  const out = babel.transformSync(code, {
    filename: rel,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [[require.resolve('babel-plugin-react-compiler'), { target: '19', logger: { logEvent(_f, e) {
      if (e.kind === 'CompileSuccess') stats.compiled++;
      else if (e.kind === 'CompileError') stats.skipped.push(`${rel}:${e.fnLoc ? e.fnLoc.start.line : '?'}`);
    } } }]],
  }).code;
  const items = [];
  if (!out.includes('react/compiler-runtime')) return { items, stats };
  const add = (kind, why, once, expr) => items.push({ key: `${kind} | ${rel} | ${why} | ${once ? 'once' : 'deps'} | ${expr}` });
  // 렌더 중(가드 안·중첩 함수 밖) 한 영역을 훑는 방문자 — 동기 콜백은 들어가 보고, 컴파일러가 식별자로 바꾼 콜백
  // (모듈로 끌어올린 _temp · 메모한 tN = (…) => …)은 그 함수 본문을 찾아 같은 방문자로 본다(#231 Codex).
  const seen = new Set();
  const renderVisitor = (once) => {
    const v = {
      Function(inner) {
        if (!isSyncCallback(inner)) inner.skip(); // 중첩 함수 = 렌더 중 실행 아님(이벤트·효과) — 배열 메서드 콜백은 렌더 중 동기 실행이라 들어가 본다
      },
      IfStatement(inner) { if (MEMO_GUARD.test(gen(inner.node.test).code)) inner.skip(); }, // 안쪽 가드는 그 가드가 따로 본다
      CallExpression(c) {
        const callee = gen(c.node.callee).code;
        const nargs = c.node.arguments.length;
        const last = callee.split('.').pop();
        const expr = gen(c.node).code.replace(/\s+/g, ' ').slice(0, 80);
        if (impure.has(callee)) add('helper', `reads ${impure.get(callee).split(' @')[0]}`, once, expr);
        let why = null;
        if (/^(Date\.now|performance\.now|Math\.random)$/.test(callee)) why = 'time/random';
        else if (READ_METHODS.test(last) && callee.includes('.')) why = 'store read';
        else if (nargs === 0 && /^[a-z_$][\w$]*$/.test(callee) && !/^use[A-Z]/.test(callee) && !/^_temp/.test(callee) && !/^t\d+$/.test(callee)) why = 'zero-arg call';
        else if (nargs === 0 && /^[A-Za-z_$][\w$]*\.[a-z][\w$]*$/.test(callee) && !/^(React|styles|StyleSheet|Object|Array|JSON|Number|String|Symbol|Math)\./.test(callee) && /^(get|is|has|current|read|now|count)/.test(last)) why = 'zero-arg method';
        if (why) add('direct', why, once, expr);
        if (isSyncMethodCall(c.node)) {
          for (const arg of c.get('arguments')) {
            if (!arg.isIdentifier()) continue;
            for (const fn of resolveFunctions(arg)) {
              if (seen.has(fn.node)) continue;
              seen.add(fn.node);
              fn.traverse(renderVisitor(once));
            }
          }
        }
      },
      NewExpression(c) {
        if (gen(c.node.callee).code === 'Date' && c.node.arguments.length === 0) add('direct', 'new Date()', once, 'new Date()');
      },
      MemberExpression(m) {
        const code2 = gen(m.node).code;
        if (SINGLETON_MEMBERS.test(code2)) add('direct', 'singleton', once, code2);
      },
    };
    return v;
  };
  traverse(parser.parse(out, PARSE), {
    IfStatement(p) {
      const test = gen(p.node.test).code;
      if (!MEMO_GUARD.test(test)) return;
      p.get('consequent').traverse(renderVisitor(/memo_cache_sentinel/.test(test)));
    },
  });
  return { items, stats };
}

/** 기준선 대비 — 같은 키가 여러 번(같은 식 두 자리)일 수 있어 개수로 비교 */
function diffBaseline(items, baselineItems) {
  const count = new Map();
  for (const it of items) count.set(it.key, (count.get(it.key) || 0) + 1);
  const base = new Map(baselineItems.map((b) => [b.key, b]));
  const fresh = [];
  for (const [key, n] of count) {
    const extra = n - (base.has(key) ? base.get(key).count : 0);
    if (extra > 0) fresh.push({ key, extra });
  }
  const gone = baselineItems.filter((b) => (count.get(b.key) || 0) < b.count).map((b) => ({ key: b.key, verdict: b.verdict, missing: b.count - (count.get(b.key) || 0) }));
  return { fresh, gone, count };
}

/** "안 돌았다" 판정 — 결과가 아니라 고장인 경우(통과와 다른 출력·종료 1). 기준선이 있는데 후보 0 = 탐지가 통째로 빗나감(컴파일러 판올림 등) */
function didNotRun(r, baselineTotal) {
  return r.files === 0 || r.compiled === 0 || r.failures.length > 0 || (baselineTotal > 0 && r.items.length === 0);
}

function runSweep(srcRoot = path.join(ROOT, 'src')) {
  const files = listSources(srcRoot);
  const sources = files.map((f) => ({ rel: path.relative(srcRoot, f), code: fs.readFileSync(f, 'utf8') }));
  const failures = [];
  const impure = collectImpureHelpers(sources, failures);
  const items = [];
  let compiled = 0;
  const skipped = [];
  for (const s of sources) {
    try {
      const r = sweepSource(s.code, s.rel, impure);
      items.push(...r.items);
      compiled += r.stats.compiled;
      skipped.push(...r.stats.skipped);
    } catch (e) {
      failures.push(`${s.rel} — ${String(e.message).split('\n')[0].slice(0, 120)}`);
    }
  }
  return { files: files.length, compiled, skipped, impure: impure.size, items, failures };
}

function main() {
  const strict = process.argv.includes('--strict');
  const summary = [];
  const log = (s = '') => { console.log(s); summary.push(s); };
  const finish = (code) => {
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
    process.exit(code);
  };
  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    if (!Array.isArray(baseline.items)) throw new Error('items 배열 없음');
  } catch (e) {
    log(`### 컴파일러 굳는 자리 검사 — ❌ 안 돌았다: 기준선을 읽지 못함(${e.message})`);
    return finish(1);
  }
  const r = runSweep();
  // "통과"와 "안 돌았다"를 다른 출력으로 — 0파일·컴파일 0·변환 실패는 결과가 아니라 고장
  const baselineTotal = baseline.items.reduce((a, b) => a + b.count, 0);
  if (didNotRun(r, baselineTotal)) {
    log(`### 컴파일러 굳는 자리 검사 — ❌ 안 돌았다 (파일 ${r.files} · 컴파일된 함수 ${r.compiled} · 변환 실패 ${r.failures.length} · 후보 ${r.items.length}/기준선 ${baselineTotal})`);
    for (const f of r.failures) log(`- 변환 실패: ${f}`);
    return finish(1);
  }
  const { fresh, gone, count } = diffBaseline(r.items, baseline.items);
  log(`### 컴파일러 굳는 자리 검사 (KB-697, 비차단)`);
  log(`파일 ${r.files} · 컴파일된 함수 ${r.compiled} · 컴파일러가 건너뛴 함수 ${r.skipped.length} · 바깥 값 읽는 헬퍼 ${r.impure} · 후보 ${r.items.length}(기준선 ${baselineTotal})`);
  log('');
  if (fresh.length) {
    log(`**새 항목 ${fresh.reduce((a, b) => a + b.extra, 0)}건** — 렌더 중 바깥 값 읽기가 컴파일러 메모에 굳는지 확인(useSyncExternalStore·state로 옮기거나, 안전하면 기준선에 판정과 함께 추가):`);
    for (const f of fresh) {
      log(`- ${f.key}${f.extra > 1 ? ` ×${f.extra}` : ''}`);
      console.log(`::warning file=src/${f.key.split(' | ')[1]},title=KB-697 컴파일러 굳는 자리 후보::${f.key}`); // 파일 단위(줄 번호는 생성 코드 기준이라 엉뚱한 줄을 가리킨다)
    }
  } else {
    log('새 항목 0 — 기준선과 같다.');
  }
  if (gone.length) {
    log('');
    log(`기준선에서 사라진 항목 ${gone.length} — 고쳐졌거나 식이 바뀜, 기준선에서 지울 것:`);
    for (const g of gone) log(`- [${g.verdict}] ${g.key}${g.missing > 1 ? ` ×${g.missing}` : ''}`);
  }
  log('');
  log('<details><summary>현재 후보 전체(판정)</summary>');
  log('');
  const verdict = new Map(baseline.items.map((b) => [b.key, b.verdict]));
  for (const [key, n] of count) log(`- [${verdict.get(key) || '새 항목'}] ${key}${n > 1 ? ` ×${n}` : ''}`);
  log('</details>');
  return finish(strict && fresh.length ? 1 : 0);
}

module.exports = { listSources, collectImpureHelpers, sweepSource, diffBaseline, runSweep, didNotRun };
if (require.main === module) main();

// KB-602 래칫 게이트 — **네가 방금 쓴 줄**에만 warning 0을 요구한다.
//
// 왜 파일 단위가 아니라 줄 단위인가: 이 레포엔 기존 warning이 1,218건 있다(eslint가 그동안
// 미설치라 한 번도 돌지 않았다 — `eslint.config.js` 래칫 블록 참고). 파일 단위로 `--max-warnings 0`을
// 걸면 **부채가 있는 파일을 한 줄만 건드려도 red**가 되어, 게이트가 상시 red = 아무도 안 쓰는
// 게이트가 된다. 실제로 게이트를 도입하는 커밋 자체가 그 게이트에 걸렸다(Codex #175 P1).
//
// 그래서: 변경 파일을 eslint에 넘기되, **diff에서 추가·수정된 줄에 걸린 문제만** 실패로 센다.
// - 신규 파일은 전체가 추가된 줄이므로 **자동으로 전건 검사**가 된다(제일 중요한 경우).
// - 삭제된 줄은 `+` 범위에 없으므로 자연히 빠진다 — 지운 코드의 warning으로 실패하지 않는다.
// - 기존 줄의 부채는 통과. 새 부채만 막는다(= 래칫).
//
// FE 발주 DoD의 "lint 통과" = 이 스크립트의 종료 코드 0.
import { execFileSync } from 'node:child_process';

const BASE = process.env.LINT_BASE ?? 'origin/develop';

const git = (args) => execFileSync('git', args, { encoding: 'utf8' });

/** BASE...HEAD에서 추가·복사·수정·이름변경된 .ts/.tsx (삭제 제외 — 파일이 없으니 린트 불가) */
function changedFiles() {
  return git(['diff', '--name-only', '--diff-filter=ACMR', `${BASE}...HEAD`, '--', '*.ts', '*.tsx'])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 파일별 "추가된 줄 번호" 집합.
 * `--unified=0`이면 헝크 헤더(`@@ -a,b +c,d @@`)의 **+쪽 범위가 곧 추가된 줄**이다.
 * (문맥 줄이 섞이지 않으므로 범위를 그대로 쓸 수 있다.)
 */
function addedLines(files) {
  const out = new Map();
  if (files.length === 0) return out;
  const diff = git(['diff', '--unified=0', `${BASE}...HEAD`, '--', ...files]);
  let file = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).trim();
      file = p === '/dev/null' ? null : p.replace(/^b\//, '');
      if (file) out.set(file, out.get(file) ?? new Set());
      continue;
    }
    if (!file || !line.startsWith('@@')) continue;
    // @@ -12,0 +13,4 @@  → 13,14,15,16 추가
    const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))?/.exec(line);
    if (!m) continue;
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    const set = out.get(file);
    for (let i = 0; i < count; i++) set.add(start + i);
  }
  return out;
}

let files;
try {
  files = changedFiles();
} catch {
  // BASE를 못 찾는 환경(얕은 클론 등)에서 조용히 통과하면 래칫이 풀린다 — 실패로 끝낸다.
  console.error(`lint:changed — '${BASE}'를 찾을 수 없습니다. 먼저 'git fetch origin develop' 하세요.`);
  process.exit(1);
}

if (files.length === 0) {
  console.log('lint:changed — 변경된 .ts/.tsx 없음, 통과');
  process.exit(0);
}

const added = addedLines(files);

let report;
try {
  report = JSON.parse(execFileSync('node', ['./node_modules/.bin/eslint', '-f', 'json', ...files], { encoding: 'utf8' }));
} catch (e) {
  // eslint는 문제가 있으면 비0으로 끝내지만 stdout에 리포트를 낸다 — 그걸 읽는다.
  const stdout = e?.stdout?.toString?.() ?? '';
  if (!stdout.trim().startsWith('[')) {
    console.error('lint:changed — eslint 실행 실패');
    console.error(e?.stderr?.toString?.() ?? e?.message ?? e);
    process.exit(1);
  }
  report = JSON.parse(stdout);
}

const cwd = process.cwd() + '/';
const hits = [];
for (const f of report) {
  const rel = f.filePath.startsWith(cwd) ? f.filePath.slice(cwd.length) : f.filePath;
  const lines = added.get(rel);
  if (!lines) continue;
  for (const m of f.messages) {
    if (m.line == null || !lines.has(m.line)) continue; // 기존 줄의 부채는 통과
    hits.push(`${rel}:${m.line}:${m.column ?? 0}  ${m.severity === 2 ? 'error' : 'warning'}  ${m.message}  ${m.ruleId ?? ''}`);
  }
}

if (hits.length === 0) {
  console.log(`lint:changed — ${files.length}개 파일의 추가·수정된 줄: 문제 0, 통과`);
  process.exit(0);
}

// "네가 방금 쓴 줄"이 보여야 고친다 — 걸린 줄을 그대로 찍는다.
console.error(`lint:changed — 추가·수정된 줄에서 ${hits.length}건:\n`);
for (const h of hits) console.error('  ' + h);
console.error('\n기존 줄의 부채는 통과시킵니다(래칫). 위 줄만 고치면 됩니다.');
process.exit(1);

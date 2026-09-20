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
import path from 'node:path';

const BASE = process.env.LINT_BASE ?? 'origin/develop';

/** eslint가 실제로 검사하는 소스 확장자 전부 — `.ts/.tsx`만 보면 `.js`·`.mjs` 소스가
 *  래칫을 조용히 우회한다(이 스크립트 자신이 `.mjs`다). Codex #175. */
const SOURCE_GLOBS = ['*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs'];

const git = (args) => execFileSync('git', args, { encoding: 'utf8' });

/** BASE...HEAD에서 추가·복사·수정·이름변경된 소스 (삭제 제외 — 파일이 없으니 린트 불가) */
function changedFiles() {
  return git(['diff', '--name-only', '--diff-filter=ACMR', `${BASE}...HEAD`, '--', ...SOURCE_GLOBS])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 새 경로 → BASE에서의 옛 경로 (이름이 바뀐 파일만).
 * ⚠️ 없으면 **순수 리네임이 전건 차단**된다(Codex #175): diff 대상을 새 경로로만 좁히면
 * git이 짝을 못 찾아 `/dev/null → new`로 렌더하고, 모든 줄이 "추가"로 잡힌다.
 * `git show BASE:<새 경로>`도 실패해 기준선이 비므로 기존 부채가 전부 신규가 된다.
 */
function renameMap() {
  const out = new Map();
  const raw = git(['diff', '--name-status', '-M', `${BASE}...HEAD`, '--', ...SOURCE_GLOBS]);
  for (const line of raw.split('\n')) {
    const parts = line.split('\t');
    if (parts.length === 3 && parts[0].startsWith('R')) out.set(parts[2].trim(), parts[1].trim());
  }
  return out;
}

/**
 * 파일별 "추가된 줄 번호" 집합.
 * `--unified=0`이면 헝크 헤더(`@@ -a,b +c,d @@`)의 **+쪽 범위가 곧 추가된 줄**이다.
 * (문맥 줄이 섞이지 않으므로 범위를 그대로 쓸 수 있다.)
 */
function addedLines(files, renames) {
  const out = new Map();
  if (files.length === 0) return out;
  // 옛 경로도 pathspec에 넣어야 git이 리네임 짝을 찾는다 — 그래야 실제 변경만 헝크로 나온다
  const paths = [...new Set([...files, ...files.map((f) => renames.get(f)).filter(Boolean)])];
  const diff = git(['diff', '--unified=0', '-M', `${BASE}...HEAD`, '--', ...paths]);
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
  console.log('lint:changed — 변경된 소스 없음, 통과');
  process.exit(0);
}

const renames = renameMap();
const added = addedLines(files, renames);

/** eslint 실행 — 문제가 있으면 비0으로 끝내지만 stdout에 리포트를 낸다. */
function eslintJson(args, input) {
  try {
    return JSON.parse(execFileSync('node', ['./node_modules/.bin/eslint', '-f', 'json', ...args], { encoding: 'utf8', input }));
  } catch (e) {
    const stdout = e?.stdout?.toString?.() ?? '';
    if (stdout.trim().startsWith('[')) return JSON.parse(stdout);
    console.error('lint:changed — eslint 실행 실패');
    console.error(e?.stderr?.toString?.() ?? e?.message ?? e);
    process.exit(1);
  }
}

/** 진단의 정체성 — **줄 번호에 의존하지 않게** 만든다.
 *  ⚠️ react-hooks 계열은 `message`에 **줄 번호가 박힌 코드 프레임**을 통째로 넣는다.
 *  메시지를 통으로 키로 쓰면, 위에 주석 한 줄만 추가해도 프레임이 달라져 같은 진단이
 *  "새 진단"으로 오인된다(실측). 그래서 **첫 줄 + 룰**만 쓴다. */
const keyOf = (m) => `${m.ruleId ?? '?'}\u0000${String(m.message).split('\n')[0].trim()}`;

/** BASE 시점의 같은 파일에 있던 진단 개수. 파일이 새로 생겼으면 빈 맵. */
function baseCounts(file) {
  let content;
  try {
    // 이름이 바뀌었으면 BASE엔 옛 경로로 있다
    content = git(['show', `${BASE}:${renames.get(file) ?? file}`]);
  } catch {
    return new Map(); // 신규 파일 — 기준선 없음
  }
  // --stdin-filename으로 **원래 경로인 척** 린트한다(설정·룰 해석이 실제와 같아진다)
  const rep = eslintJson(['--stdin', '--stdin-filename', file], content);
  const counts = new Map();
  for (const f of rep) for (const m of f.messages) counts.set(keyOf(m), (counts.get(keyOf(m)) ?? 0) + 1);
  return counts;
}

const report = eslintJson(files);

const cwd = process.cwd();
/** eslint의 절대 경로 → 저장소 상대 경로(POSIX 구분자). Windows 역슬래시 대응(Codex #175). */
const relOf = (abs) => path.relative(cwd, abs).split(path.sep).join('/');

const hits = [];
/** 줄로 못 거르는 진단 — 파일별로 모아 BASE와 대조한다. */
const pending = new Map();

for (const f of report) {
  const rel = relOf(f.filePath);
  const lines = added.get(rel);
  if (!lines) continue;
  for (const m of f.messages) {
    if (m.line != null && lines.has(m.line)) {
      hits.push({ rel, m, why: '추가·수정된 줄' });
      continue;
    }
    // ⚠️ 진단이 **안 바뀐 줄**에 찍히는 경우가 있다(Codex #175 P1): 훅 위에 early return을
    // 새로 넣으면 `rules-of-hooks`는 새 return이 아니라 **기존 훅 호출 줄**을 가리킨다.
    // 줄만 보면 이 위반이 통과해 버린다 — 이 레포에서 가장 위험한 유형이 바로 그것이다.
    // 그래서 남는 진단은 BASE와 **개수로** 대조해 "늘어난 것"만 새 부채로 센다.
    if (!pending.has(rel)) pending.set(rel, []);
    pending.get(rel).push(m);
  }
}

for (const [rel, msgs] of pending) {
  const base = baseCounts(rel);
  const seen = new Map();
  for (const m of msgs) {
    const k = keyOf(m);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    if (n > (base.get(k) ?? 0)) hits.push({ rel, m, why: 'BASE에 없던 진단' });
  }
}

if (hits.length === 0) {
  console.log(`lint:changed — ${files.length}개 파일: 새 문제 0, 통과`);
  process.exit(0);
}

// "네가 방금 만든 것"이 보여야 고친다 — 위치와 사유를 그대로 찍는다.
console.error(`lint:changed — 새로 생긴 문제 ${hits.length}건:\n`);
for (const { rel, m, why } of hits) {
  console.error(`  ${rel}:${m.line ?? 0}:${m.column ?? 0}  ${m.severity === 2 ? 'error' : 'warning'}  ${m.message}  ${m.ruleId ?? ''}  [${why}]`);
}
console.error('\n기존 부채는 통과시킵니다(래칫). 위 항목만 고치면 됩니다.');
process.exit(1);

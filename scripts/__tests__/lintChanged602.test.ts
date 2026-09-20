/**
 * KB-602 줄 단위 래칫 게이트 — 실제 git 저장소를 만들어 스크립트를 돌린다.
 *
 * 파일 단위(`--max-warnings 0`)로는 이 레포에서 게이트가 상시 red가 된다(기존 warning 1,218건).
 * 줄 단위로 바꾼 뒤 **정말 막아야 할 것만 막는지**를 잠근다:
 * ① 신규 파일은 전체가 추가된 줄 = 전건 검사
 * ② 기존 줄의 부채는 통과, 새로 쓴 줄의 위반은 차단
 * ③ 삭제된 줄은 세지 않는다
 * ④ 실패 출력에 걸린 줄 번호가 찍힌다
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO = process.cwd();
let dir: string;

const git = (args: string[], cwd = dir) => execFileSync('git', args, { cwd, encoding: 'utf8' });

/** 스크립트를 임시 저장소에서 실행 — eslint·config는 레포 것을 그대로 쓴다. */
function run(): { code: number; out: string } {
  try {
    const out = execFileSync('node', [path.join(REPO, 'scripts/lint-changed.mjs')], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, LINT_BASE: 'base' },
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: Buffer; stderr?: Buffer };
    return { code: err.status ?? 1, out: String(err.stdout ?? '') + String(err.stderr ?? '') };
  }
}

/** 위반이 있는 컴포넌트 — set-state-in-effect(래칫 대상 룰). */
const BAD = `import { useState, useEffect } from 'react';
export function Bad({ on }: { on: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => { setV(1); }, [on]);
  return v;
}
`;
const CLEAN = `export function clean(a: number): number {
  return a + 1;
}
`;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-'));
  // eslint가 레포 설정·플러그인을 찾도록 심볼릭 링크
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(dir, 'node_modules'));
  fs.copyFileSync(path.join(REPO, 'eslint.config.js'), path.join(dir, 'eslint.config.js'));
  git(['init', '-q']);
  git(['config', 'user.email', 't@t.t']);
  git(['config', 'user.name', 't']);
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

/** base 커밋을 만들고 그 위에 변경을 올린다. */
function scenario(baseFiles: Record<string, string>, headFiles: Record<string, string>) {
  git(['checkout', '-q', '--orphan', `s${Date.now()}`]);
  for (const f of fs.readdirSync(dir)) {
    if (f !== '.git' && f !== 'node_modules' && f !== 'eslint.config.js') fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  }
  for (const [name, body] of Object.entries(baseFiles)) fs.writeFileSync(path.join(dir, name), body);
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'base']);
  git(['branch', '-f', 'base']);
  for (const [name, body] of Object.entries(headFiles)) {
    if (body === '') fs.rmSync(path.join(dir, name), { force: true });
    else fs.writeFileSync(path.join(dir, name), body);
  }
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'head']);
}

it('① 신규 파일은 전건 검사 — 전체가 추가된 줄이라 위반이 걸린다', () => {
  scenario({ 'keep.ts': CLEAN }, { 'new.tsx': BAD });
  const r = run();
  expect(r.code).toBe(1);
  expect(r.out).toContain('react-hooks/set-state-in-effect');
  expect(r.out).toContain('new.tsx:4'); // ④ 걸린 줄 번호가 찍힌다
});

it('② 기존 줄의 부채는 통과 — 같은 파일의 다른 줄만 고쳤을 때', () => {
  scenario({ 'debt.tsx': BAD }, { 'debt.tsx': BAD.replace("return v;", "return v + 0; // 무관한 수정") });
  const r = run();
  expect(r.code).toBe(0);
  expect(r.out).toContain('문제 0');
});

it('② 기존 부채 파일이라도 **새로 쓴 줄**의 위반은 차단', () => {
  scenario(
    { 'debt.tsx': BAD },
    { 'debt.tsx': BAD.replace('  return v;', '  useEffect(() => { setV(2); }, [on]);\n  return v;') },
  );
  const r = run();
  expect(r.code).toBe(1);
  expect(r.out).toContain('set-state-in-effect');
});

it('③ 삭제된 줄은 세지 않는다 — 위반 코드를 지우면 통과', () => {
  scenario({ 'debt.tsx': BAD }, { 'debt.tsx': CLEAN });
  const r = run();
  expect(r.code).toBe(0);
});

it('변경된 소스가 없으면 통과', () => {
  scenario({ 'keep.ts': CLEAN }, { 'notes.md': '# hi' });
  const r = run();
  expect(r.code).toBe(0);
  expect(r.out).toContain('변경된 소스 없음');
});

/* `.ts/.tsx`만 보면 `.js`·`.mjs` 소스가 래칫을 조용히 우회한다 — 이 스크립트 자신이 `.mjs`다.
   (Codex #175 P2) */
it('JS 계열(.js/.mjs)도 검사 대상 — 확장자로 래칫을 우회할 수 없다', () => {
  const BAD_JS = `export function bad() {
  var x = 1;
  return x;
}
`;
  for (const name of ['new.js', 'new.mjs', 'new.jsx']) {
    scenario({ 'keep.ts': CLEAN }, { [name]: BAD_JS });
    const r = run();
    // 위반 유무와 무관하게 **검사 대상에 포함**됐는지가 핵심 — "변경된 소스 없음"이면 우회다
    expect(r.out).not.toContain('변경된 소스 없음');
  }
});

// base를 못 찾을 때 조용히 통과하면 래칫이 풀린다 — 실패해야 한다.
/* ⚠️ Codex #175 P1: 훅 위에 early return을 **새로** 넣으면 `rules-of-hooks`는 새 return이
   아니라 **기존 훅 호출 줄**을 가리킨다. 줄 필터만으로는 이 위반이 통과해 버리는데,
   이 레포에서 가장 위험한 유형이 정확히 그것이다(FLAGS early return 패턴). */
it('①-P1 훅 위 early return 추가 — 진단이 안 바뀐 줄에 찍혀도 잡는다', () => {
  const before = `import { useState } from 'react';
export function C({ on }: { on: boolean }) {
  const [v] = useState(0);
  return v;
}
`;
  // early return만 추가 — useState 줄(기존 줄)은 그대로다
  const after = `import { useState } from 'react';
export function C({ on }: { on: boolean }) {
  if (on) return 0;
  const [v] = useState(0);
  return v;
}
`;
  scenario({ 'c.tsx': before }, { 'c.tsx': after });
  const r = run();
  expect(r.code).toBe(1);
  expect(r.out).toContain('rules-of-hooks');
  expect(r.out).toContain('BASE에 없던 진단'); // 줄 필터가 아니라 BASE 대조로 잡혔다
});

// 위 대조가 과하면 안 된다 — 줄이 밀렸다고 기존 부채를 "새 진단"으로 세면 게이트가 상시 red다.
// (react-hooks 메시지엔 줄 번호가 박힌 코드 프레임이 들어 있어서 실제로 겪은 함정이다.)
it('①-P1 역: 위에 주석만 추가해 줄이 밀린 기존 부채는 새 진단이 아니다', () => {
  scenario({ 'debt.tsx': BAD }, { 'debt.tsx': '// 기록용 주석\n' + BAD });
  const r = run();
  expect(r.code).toBe(0);
});

/* ⚠️ Codex #175: 순수 리네임이면 diff 대상을 새 경로로만 좁혔을 때 git이 짝을 못 찾아
   `/dev/null → new`로 렌더한다 → 모든 줄이 "추가"로 잡혀 **기존 부채가 전건 차단**된다. */
it('순수 리네임 — 내용이 그대로면 기존 부채를 물려받아 통과', () => {
  scenario({ 'old.tsx': BAD }, { 'old.tsx': '', 'new.tsx': BAD });
  const r = run();
  expect(r.code).toBe(0);
});

it('리네임 + 새 위반 — 새로 쓴 줄은 여전히 차단', () => {
  const worse = BAD.replace('  return v;', '  useEffect(() => { setV(3); }, [on]);\n  return v;');
  scenario({ 'old.tsx': BAD }, { 'old.tsx': '', 'new.tsx': worse });
  const r = run();
  expect(r.code).toBe(1);
  expect(r.out).toContain('set-state-in-effect');
});

/* ⚠️ Codex #175 P1: 종류별 **개수만** 비교하면 상쇄된다 — 한 위반을 고치면서 같은 종류를
   파일 안 다른 곳에 새로 넣으면 총계가 그대로라 통과해 버린다. 위치까지 봐야 한다. */
it('①-P1b 상쇄 방지 — 하나 고치고 같은 종류를 다른 곳에 새로 넣으면 차단', () => {
  // BASE: A에 조건부 훅 1건
  const base = `import { useState } from 'react';
export function A({ on }: { on: boolean }) {
  if (on) return 0;
  const [a] = useState(0);
  return a;
}
export function B({ on }: { on: boolean }) {
  const [b] = useState(0);
  return on ? b : 0;
}
`;
  // HEAD: A의 위반을 없애고 **B에 새로** 넣는다 → 종류별 총계는 1로 동일
  const head = `import { useState } from 'react';
export function A({ on }: { on: boolean }) {
  const [a] = useState(0);
  return on ? 0 : a;
}
export function B({ on }: { on: boolean }) {
  if (on) return 0;
  const [b] = useState(0);
  return b;
}
`;
  scenario({ 'ab.tsx': base }, { 'ab.tsx': head });
  const r = run();
  expect(r.code).toBe(1);
  expect(r.out).toContain('rules-of-hooks');
});

/* ⚠️ Codex #175 P2: 순수 삽입 헝크는 `@@ -N,0 +M @@` 꼴로 **앵커 N**에 달린다.
   `oldStart <= baseLine`으로 밀면 앵커 줄(N) 자신까지 한 칸 밀려 매핑돼서,
   부채가 있는 줄 **바로 아래에 무해한 줄 하나 추가**한 것만으로 게이트가 실패한다. */
it('①-P2 삽입 앵커 — 부채 줄 바로 아래에 무해한 줄을 넣어도 통과', () => {
  // 기존 줄은 **하나도 안 건드리고** 주석만 끼워 넣는다 → `@@ -4,0 +5 @@` 순수 삽입.
  // (경고를 새로 만들지 않도록 주석을 쓴다 — 다른 이유로 실패하면 이 케이스를 검증 못 한다.)
  const head = BAD.replace('  return v;', '  // 무해한 주석\n  return v;');
  scenario({ 'debt.tsx': BAD }, { 'debt.tsx': head });
  const r = run();
  expect(r.code).toBe(0);
});

/* ⚠️ Codex #175 P1: diff는 merge-base 기준인데 기준 파일을 BASE **최신 tip**에서 읽으면
   분기 후 develop이 같은 파일을 건드렸을 때 서로 다른 버전을 대조하게 된다. */
it('①-P1c 기준선은 merge-base — 분기 후 base가 같은 파일을 바꿔도 부채를 물려받는다', () => {
  // base 커밋 → 브랜치(HEAD) 분기 → base만 같은 파일을 추가 수정
  git(['checkout', '-q', '--orphan', `p1c${Date.now()}`]);
  for (const f of fs.readdirSync(dir)) {
    if (f !== '.git' && f !== 'node_modules' && f !== 'eslint.config.js') fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(dir, 'debt.tsx'), BAD);
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'base']);
  git(['branch', '-f', 'base']);

  // HEAD: 부채는 그대로 두고 무관한 줄만 수정
  fs.writeFileSync(path.join(dir, 'debt.tsx'), BAD.replace('return v;', 'return v + 0;'));
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'head']);
  const headRef = git(['rev-parse', 'HEAD']).trim();

  // base만 전진 — 같은 파일에 줄을 더 넣는다(분기 이후 변경)
  git(['checkout', '-q', 'base']);
  fs.writeFileSync(path.join(dir, 'debt.tsx'), '// base가 나중에 넣은 줄\n' + BAD);
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'base advances']);
  git(['checkout', '-q', headRef]);

  const r = run();
  expect(r.code).toBe(0); // 물려받은 부채는 여전히 면제
});

it('base를 못 찾으면 통과가 아니라 실패', () => {
  const r = (() => {
    try {
      execFileSync('node', [path.join(REPO, 'scripts/lint-changed.mjs')], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, LINT_BASE: 'no-such-ref' },
      });
      return { code: 0, out: '' };
    } catch (e) {
      const err = e as { status?: number; stderr?: Buffer };
      return { code: err.status ?? 1, out: String(err.stderr ?? '') };
    }
  })();
  expect(r.code).toBe(1);
  expect(r.out).toContain('no-such-ref');
});

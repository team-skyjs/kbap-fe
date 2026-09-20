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

it('변경된 .ts/.tsx가 없으면 통과', () => {
  scenario({ 'keep.ts': CLEAN }, { 'notes.md': '# hi' });
  const r = run();
  expect(r.code).toBe(0);
  expect(r.out).toContain('변경된 .ts/.tsx 없음');
});

// base를 못 찾을 때 조용히 통과하면 래칫이 풀린다 — 실패해야 한다.
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

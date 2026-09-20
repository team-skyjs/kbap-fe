// KB-602 래칫 게이트: **변경·신규 파일만** eslint에 넘기고 --max-warnings 0.
//
// 왜 따로 두나 — 전체 `npm run lint`는 기존 부채 1218 warning을 보여주느라 항상 시끄럽다.
// 반면 이 스크립트는 `origin/develop...HEAD`로 바뀐 .ts/.tsx만 보고, **warning 1건도 통과시키지
// 않는다**. 즉 eslint.config.js에서 warn으로 내려둔 react-hooks 룰들이 신규 코드에선 그대로
// 차단선이 된다(래칫: 부채는 안 늘어난다).
//
// FE 발주 DoD의 "lint 통과" = 이 스크립트의 종료 코드 0.
import { execFileSync } from 'node:child_process';

const BASE = process.env.LINT_BASE ?? 'origin/develop';

/** BASE...HEAD에서 추가·복사·수정·이름변경된 .ts/.tsx (삭제 제외 — 파일이 없으니 린트 불가) */
function changedFiles() {
  const out = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', `${BASE}...HEAD`, '--', '*.ts', '*.tsx'],
    { encoding: 'utf8' },
  );
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

let files;
try {
  files = changedFiles();
} catch {
  // BASE를 못 찾는 환경(얕은 클론 등)에서 게이트가 조용히 통과하면 래칫이 풀린다 — 실패로 끝낸다.
  console.error(`lint:changed — '${BASE}'를 찾을 수 없습니다. 먼저 'git fetch origin develop' 하세요.`);
  process.exit(1);
}

if (files.length === 0) {
  console.log('lint:changed — 변경된 .ts/.tsx 없음, 통과');
  process.exit(0);
}

console.log(`lint:changed — ${files.length}개 파일 (warning 0 요구)`);
try {
  execFileSync('node', ['./node_modules/.bin/eslint', '--max-warnings', '0', ...files], { stdio: 'inherit' });
} catch {
  process.exit(1);
}

/**
 * P-244 🚨: JSX 같은 줄 주석 공백 — `<X /> {/* … *\/}` 의 `/>`와 `{` 사이 공백이
 * **텍스트 노드 " "로 렌더**되어 네이티브에서 "Text strings must be rendered
 * within a <Text> component" 에러(예진 실기 · ReviewFeed 사고).
 * jest 렌더러는 이 규칙을 안 잡으므로(네이티브 런타임 규칙) **소스 정적 잠금**:
 * git 추적 .tsx 전수에서 패턴 0 검사(테스트 파일 제외) — 재발 시 CI에서 잡힌다.
 */
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

it('P-244: `/>` 뒤 같은 줄 `{/*` 주석 패턴 잔존 0 — 공백 텍스트 노드 금지', () => {
  const files = execFileSync('git', ['ls-files', '*.tsx'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !f.includes('__tests__'));
  expect(files.length).toBeGreaterThan(10); // 목록 자체가 비면 잠금이 헛돈다
  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/\/>\s+\{\/\*/.test(line)) offenders.push(`${f}:${i + 1}`);
    });
  }
  expect(offenders).toEqual([]); // 위반 = 파일:줄 목록으로 바로 표시
});

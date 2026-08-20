/**
 * P-247(KB-29): 스캔 소요 안내 + BE 메시지 노출 제거.
 * 🔴 error.detail(서버 message 원문)이 에러 화면 보조 줄로 노출되던 것 삭제 —
 * BE message 사용자 노출 금지(상시 규칙). 진단은 콘솔 로그로만.
 * + 전 소스 서버 message 렌더 잔존 0 잠금(에러 표면 전수).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync } = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execFileSync } = require('child_process');

it('scan.tsx — error.detail 렌더 잔존 0(콘솔 로그만) + errDetail 스타일 소멸', () => {
  const src = readFileSync('src/app/scan.tsx', 'utf8') as string;
  expect(src).not.toContain('errDetail'); // 렌더·스타일 전부
  expect(src).not.toMatch(/<Text[^>]*>\{error\.detail\}/);
  expect(src).toContain('console.log(`[scan] FAIL stage=${stage} detail=${detail}`)'); // 진단 로그 존치
});

it('소요 안내 — stayHint에 30~40초 결합(전 언어) + 진행 화면 배선 존치', () => {
  const langs = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi'];
  for (const l of langs) {
    const dict = JSON.parse(readFileSync(`src/lib/i18n/${l}.json`, 'utf8'));
    expect(dict.scan.stayHint).toMatch(/30/); // 소요 시간 안내 포함
  }
  expect(readFileSync('src/app/scan.tsx', 'utf8')).toContain("t('scan.stayHint')");
});

it('전 소스 — 서버 message/detail을 JSX로 렌더하는 패턴 잔존 0(에러 표면 전수)', () => {
  const files = (execFileSync('git', ['ls-files', '*.tsx'], { encoding: 'utf8' }) as string)
    .split('\n')
    .filter((f: string) => f && !f.includes('__tests__'));
  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8') as string;
    src.split('\n').forEach((line: string, i: number) => {
      // Text 렌더 중괄호 안의 .message / error.detail — BE 원문 노출 후보
      if (/<Text[^>]*>[^<]*\{[^}]*\.(message|detail)\b[^}]*\}/.test(line)) offenders.push(`${f}:${i + 1}`);
    });
  }
  expect(offenders).toEqual([]);
});

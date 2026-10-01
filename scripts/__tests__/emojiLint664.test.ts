/**
 * KB-664(Codex #213 P2) — 헌법 이모지 게이트의 **승인 예외 두 개**(AGENTS.md L22: 맵기 🌶️ · 아기 👶 —
 * 맵기 NONE·MILD 배지 한정, 헌법 v2.3.1)를 맵기 표면 파일에서만 통과시킨다.
 * 레포의 실제 eslint 설정으로 stdin 린트(파일 경로만 가장) — JSX 텍스트·템플릿 리터럴 두 선택자 모두.
 */
import { execFileSync } from 'node:child_process';

const SPICE_FILE = 'src/components/SpicePeppers.tsx'; // 맵기 표면(승인 예외 허용)
const SPICE_ROUTE = 'src/app/food/[id]/index.tsx'; // 대괄호 경로도 glob이 잡는지
const OTHER_FILE = 'src/components/StateBlock.tsx'; // 그 외 화면

type Msg = { ruleId: string | null; message: string };
function lint(file: string, code: string): Msg[] {
  let out: string;
  try {
    out = execFileSync('npx', ['eslint', '--stdin', '--stdin-filename', file, '--format', 'json'], { input: code, encoding: 'utf8' });
  } catch (e) {
    out = (e as { stdout: string }).stdout; // 에러가 있으면 exit 1 — 출력은 그대로 JSON
  }
  return (JSON.parse(out) as { messages: Msg[] }[])[0].messages;
}
const emojiErrors = (file: string, code: string) =>
  lint(file, code).filter((m) => m.ruleId === 'no-restricted-syntax' && m.message.includes('이모지'));
const hangulErrors = (file: string, code: string) =>
  lint(file, code).filter((m) => m.ruleId === 'no-restricted-syntax' && m.message.includes('한글'));

const jsxText = (s: string) => `export const A = () => <Text>${s}</Text>;\n`;
const jsxTemplate = (s: string) => `export const A = ({ n }: { n: number }) => <Text>{\`${s} \${n}\`}</Text>;\n`;

describe.each([
  ['JSX 텍스트', jsxText],
  ['템플릿 리터럴', jsxTemplate],
])('%s', (_label, wrap) => {
  it('맵기 표면: 🌶️(VS16 포함)·👶 = 통과', () => {
    expect(emojiErrors(SPICE_FILE, wrap('\u{1F336}\u{FE0F}'))).toHaveLength(0);
    expect(emojiErrors(SPICE_FILE, wrap('\u{1F476}'))).toHaveLength(0);
    expect(emojiErrors(SPICE_ROUTE, wrap('\u{1F336}'))).toHaveLength(0);
  });

  it('맵기 표면이어도 그 밖의 이모지·keycap = 에러', () => {
    expect(emojiErrors(SPICE_FILE, wrap('\u{1F600}'))).toHaveLength(1);
    expect(emojiErrors(SPICE_FILE, wrap('\u{1F336}\u{1F525}'))).toHaveLength(1); // 예외 + 금지 섞임
    expect(emojiErrors(SPICE_FILE, wrap('1\u{FE0F}\u{20E3}'))).toHaveLength(1);
  });

  it('그 외 파일: 🌶️·👶도 에러(문맥 한정)', () => {
    expect(emojiErrors(OTHER_FILE, wrap('\u{1F336}'))).toHaveLength(1);
    expect(emojiErrors(OTHER_FILE, wrap('\u{1F476}'))).toHaveLength(1);
  });

  it('맵기 표면 블록이 한글 규칙을 지우지 않는다(flat config 룰 교체 대비)', () => {
    expect(hangulErrors(SPICE_FILE, wrap('맵기'))).toHaveLength(1);
  });
});

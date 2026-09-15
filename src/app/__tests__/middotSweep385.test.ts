/**
 * P-385(KB-363) — 사용자 노출 가운뎃점 구분자 **글롭 전수** 잠금 (P-196 ④ 파일 목록 잠금의 후속).
 * 파일 목록 잠금은 새 표면(통화 목록 `code · name`)을 못 잡았다 → src 전체 TS/TSX를 AST로 훑어
 * 문자열·템플릿·JSX 텍스트만 검사한다(주석은 AST에 없으니 구조적으로 제외, __tests__ 제외).
 *
 * 구분자 = 공백 인접 `·` 또는 단독 `·` 텍스트. 단어 결합(`찌개·탕`)은 표기 문장부호라 대상 아님.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const SEPARATOR = /(^|\s)·|·(\s|$)/;
/** 구분자가 아닌 의도된 `·` — 파일 단위 예외(사유 필수). */
const ALLOW: Record<string, string> = {
  'src/lib/legalText.ts': '약관 HTML 목록 불릿(<li> → "· ")·&middot; 엔티티 복원 — 원문 내용(P-196 ④ 동일 예외)',
  'src/lib/order/orderCard.ts': '사장님 카드 기피 재료 나열 조인(P-265 · orderCard.test 잠금) — 라벨·값 구분자 아님, 커맨드 센터 판단 대기',
};
const LOCALES = 'src/lib/i18n';

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') walkFiles(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

function separatorHits(file: string): string[] {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hits: string[] = [];
  const visit = (n: ts.Node) => {
    let text: string | undefined;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) text = n.text;
    else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) text = n.text;
    else if (ts.isJsxText(n)) text = n.text.trim();
    if (text && SEPARATOR.test(text)) {
      const { line } = src.getLineAndCharacterOfPosition(n.getStart());
      hits.push(`${file}:${line + 1} ${JSON.stringify(text)}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return hits;
}

it('src 전체 TS/TSX — 사용자 노출 문자열에 가운뎃점 구분자 0', () => {
  const files = walkFiles('src');
  expect(files.length).toBeGreaterThan(100); // 글롭이 실제로 훑었는지(빈 순회 착시 방지)
  expect(files.filter((f) => !ALLOW[f]).flatMap(separatorHits)).toEqual([]);
});

it('i18n 전 로케일(글롭) — 값에 가운뎃점 구분자 0', () => {
  const locales = fs.readdirSync(LOCALES).filter((f) => f.endsWith('.json'));
  expect(locales.length).toBeGreaterThanOrEqual(10);
  const hits: string[] = [];
  const visit = (v: unknown, key: string) => {
    if (typeof v === 'string') { if (SEPARATOR.test(v)) hits.push(`${key} ${JSON.stringify(v)}`); }
    else if (v && typeof v === 'object') for (const [k, c] of Object.entries(v)) visit(c, `${key}.${k}`);
  };
  for (const f of locales) visit(JSON.parse(fs.readFileSync(path.join(LOCALES, f), 'utf8')), f);
  expect(hits).toEqual([]);
});

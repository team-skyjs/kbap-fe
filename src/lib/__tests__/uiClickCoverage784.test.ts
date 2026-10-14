/**
 * KB-784 — 버튼 클릭 계측 **누락 0** 기계 증명(AST 순회, src 전체 .tsx). 규칙:
 *  R1 누르는 원시 요소(react-native Pressable·Touchable*, gesture-handler 버튼)는 components/Pressable만 쓴다.
 *     예외 = 애니메이션 래퍼 Btn·PressScale(자체 trackUiClick — 아래 R4가 확인)과 래퍼 자신.
 *  R2 onPress·onLongPress가 붙은 **모든** JSX 요소는 testID 또는 uiTarget을 가진다(공용 컴포넌트 호출 자리 + 그 안의 Pressable 둘 다 —
 *     사슬 끝까지 이름이 있어야 target이 'unlabeled'로 새지 않는다).
 *  R3 testID 템플릿에 자유 텍스트 필드(name·title·label·text·body·query·comment·nickname·email·address·place) 보간 금지 — 그런 자리는 uiTarget 고정값.
 *  R4 R1 예외 파일·Txt(누르는 텍스트)는 trackUiClick을 직접 부른다.
 *  R5 Gesture.Tap/LongPress는 버튼이 아니다(사진 더블탭 확대) — 목록 고정, 새로 생기면 여기서 판단.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
const FILES = walk('src');
const parse = (f: string) => ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

const RAW_OK = new Set(['src/components/Pressable.tsx', 'src/components/Btn.tsx', 'src/components/PressScale.tsx']);
/** 스스로 이름을 붙이는 공용 컴포넌트 — 안쪽 Pressable이 자기 데이터로 testID를 만든다(R2가 그 안쪽 요소를 검사). 호출 자리 testID는 불필요 */
const SELF_LABELED = new Set(['RecentRow', 'OrderCard', 'OrderPill', 'FoodGridCard', 'Tab', 'TabBar', 'TranslateButton', 'CountdownBadge', 'HomeRecentRow', 'HomeGridCard']); // Home* = 홈 노출 래퍼(그대로 RecentRow·FoodGridCard 렌더)
const FREE_TEXT = /\.(name|title|label|text|body|query|comment|nickname|email|address|placeName|content)\b|\bplace\b/;

type Site = { file: string; line: number; tag: string };
const pressSites: (Site & { labeled: boolean; thirdParty: boolean; tracksSelf: boolean })[] = [];
const rawImports: string[] = [];
const freeTextIds: string[] = [];
for (const file of FILES) {
  const sf = parse(file);
  const visit = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const mod = n.moduleSpecifier.text;
      const names = n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings) ? n.importClause.namedBindings.elements.map((e) => (e.propertyName ?? e.name).text) : [];
      const bad =
        (mod === 'react-native' && names.some((x) => /^(Pressable|Touchable\w*)$/.test(x))) ||
        (mod === 'react-native-gesture-handler' && names.some((x) => /^(Pressable|Touchable\w*|RectButton|BaseButton|BorderlessButton)$/.test(x)));
      if (bad && !RAW_OK.has(file)) rawImports.push(`${file}: ${names.join(',')} from ${mod}`);
    }
    if (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) {
      const attrs = n.attributes.properties.filter(ts.isJsxAttribute);
      const names = attrs.map((a) => a.name.getText(sf));
      if (names.includes('onPress') || names.includes('onLongPress')) {
        const tag = n.tagName.getText(sf);
        const onPressText = attrs.find((a) => a.name.getText(sf) === 'onPress')?.initializer?.getText(sf) ?? '';
        pressSites.push({
          file,
          line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          tag,
          labeled: names.includes('testID') || names.includes('uiTarget') || SELF_LABELED.has(tag) || RAW_OK.has(file),
          thirdParty: tag.includes('.'),
          tracksSelf: onPressText.includes('trackUiClick('),
        });
      }
      const tid = attrs.find((a) => a.name.getText(sf) === 'testID');
      const init = tid?.initializer && ts.isJsxExpression(tid.initializer) ? tid.initializer.expression : undefined;
      if (init && ts.isTemplateExpression(init) && init.templateSpans.some((s) => FREE_TEXT.test(s.expression.getText(sf))) && !names.includes('uiTarget')) {
        freeTextIds.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1} ${init.getText(sf)}`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

it('순회 유효성 — 소스 100+ 파일, 누르는 자리 300+', () => {
  expect(FILES.length).toBeGreaterThan(100);
  expect(pressSites.length).toBeGreaterThan(300);
});

it('R1: 원시 Pressable·Touchable·제스처 버튼 import = components/Pressable(·Btn·PressScale)뿐', () => {
  expect(rawImports).toEqual([]);
});

it('R2: onPress/onLongPress가 붙은 모든 요소에 testID 또는 uiTarget — 누락 0', () => {
  expect(pressSites.filter((s) => !s.labeled).map((s) => `${s.file}:${s.line} <${s.tag}>`)).toEqual([]);
});

it('R3: testID 템플릿에 자유 텍스트 보간 0(그런 자리는 uiTarget 고정)', () => {
  expect(freeTextIds).toEqual([]);
});

it('R4: 예외 파일·누르는 텍스트는 trackUiClick 직접 호출', () => {
  for (const f of ['src/components/Btn.tsx', 'src/components/PressScale.tsx', 'src/components/Txt.tsx', 'src/components/Pressable.tsx']) {
    expect({ f, has: fs.readFileSync(f, 'utf8').includes('trackUiClick(') }).toEqual({ f, has: true });
  }
});

it('R6: 서드파티 네이티브 버튼(네임스페이스 태그 — components/Pressable 밖)은 onPress에서 trackUiClick 직접', () => {
  const third = pressSites.filter((s) => s.thirdParty);
  expect(third.length).toBeGreaterThan(0); // Apple 로그인 — 규칙이 실제로 무언가를 검사하는지
  expect(third.filter((s) => !s.tracksSelf).map((s) => `${s.file}:${s.line} <${s.tag}>`)).toEqual([]);
});

it('SELF_LABELED 공용 컴포넌트는 실제로 안쪽 Pressable에 testID가 있다(이름 사슬)', () => {
  const defs: Record<string, string> = {};
  for (const f of FILES) {
    const src = fs.readFileSync(f, 'utf8');
    for (const c of SELF_LABELED) if (new RegExp(`function ${c}\\b`).test(src)) defs[c] = f;
  }
  expect(Object.keys(defs).sort()).toEqual([...SELF_LABELED].sort());
});

it('R5: Gesture.Tap/LongPress = 사진 더블탭 확대 2곳뿐(버튼 아님)', () => {
  const hits = FILES.filter((f) => /Gesture\.(Tap|LongPress)\(/.test(fs.readFileSync(f, 'utf8')));
  expect(hits.sort()).toEqual(['src/components/PhotoViewer.tsx', 'src/features/scan/ScanResultOverlay.tsx']);
});

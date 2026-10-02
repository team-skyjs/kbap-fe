/**
 * KB-694 — jest가 앱과 같은 React Compiler 변환을 거치는지 잠근다(번역 경로 한정 — jest.config.js COMPILED_SOURCES).
 * 이게 꺼지면 "렌더 중 캐시 직접 읽기"가 컴파일러 메모이즈로 굳는 버그(번역 보기 무반응)를 jest가 다시 못 본다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { transformSync } from '@babel/core';

const cfg = require(path.join(process.cwd(), 'jest.config.js')) as { transform: Record<string, [string, Record<string, unknown>]> }; // eslint-disable-line @typescript-eslint/no-require-imports
const [pattern, [, compiledOpts]] = Object.entries(cfg.transform)[0];
const FILES = ['src/lib/data/useContentTranslation.ts', 'src/features/review/ReviewCellParts.tsx', 'src/components/TranslateButton.tsx'];

it.each(FILES)('%s — 첫 transform 규칙(컴파일러 on)에 걸리고, 실제 변환 결과에 컴파일러 런타임이 들어간다', (file) => {
  expect(new RegExp(pattern).test(path.join(process.cwd(), file))).toBe(true);
  const out = transformSync(fs.readFileSync(file, 'utf8'), { ...compiledOpts, filename: path.join(process.cwd(), file) })?.code ?? '';
  expect(out).toMatch(/react\/compiler-runtime/);
});

it('테스트 파일은 컴파일러 규칙에 안 걸린다(앱 번들과 동일 — jest.mock 팩토리 변환 사고 방지)', () => {
  expect(new RegExp(pattern).test(path.join(process.cwd(), 'src/features/review/__tests__/reviewTranslate689.test.tsx'))).toBe(false);
});

it('훅 소스 잠금 — 캐시는 useSyncExternalStore 구독으로만 읽는다(렌더 본문에서 getQueryData 직접 호출 0)', () => {
  const src = fs.readFileSync('src/lib/data/useContentTranslation.ts', 'utf8').replace(/\/\/[^\n]*/g, '');
  expect(src).toContain('useSyncExternalStore(subscribe, getSnapshot, getSnapshot)');
  const calls = src.match(/getQueryData\b/g) ?? [];
  expect(calls).toHaveLength(1); // getSnapshot 안 1곳뿐
  expect(src).toMatch(/const getSnapshot = React\.useCallback\(\(\) => qc\.getQueryData</);
});

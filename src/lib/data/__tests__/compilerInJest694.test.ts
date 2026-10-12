/**
 * KB-694 → KB-695 — jest가 앱과 같은 React Compiler 변환을 거치는지 잠근다(src 소스 전체 · 테스트 파일 제외 — jest.config.js COMPILED).
 * 이게 꺼지면 "렌더 중 바깥 가변 값 읽기"가 컴파일러 메모이즈로 굳는 버그(번역 무반응·OTA idle·NEW 배지)를 jest가 다시 못 본다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { transformSync } from '@babel/core';
import { useContentTranslation } from '@/lib/data/useContentTranslation';
import { useNetworkIdle } from '@/lib/ota/OtaAutoApplyHost';
import { useIsNewFood } from '@/lib/newFood';

const cfg = require(path.join(process.cwd(), 'jest.config.js')) as { transform: Record<string, [string, Record<string, unknown>]> }; // eslint-disable-line @typescript-eslint/no-require-imports
const [pattern, [, compiledOpts]] = Object.entries(cfg.transform)[0];
const abs = (f: string) => path.join(process.cwd(), f);

it.each(['src/lib/data/useContentTranslation.ts', 'src/features/review/ReviewCellParts.tsx', 'src/lib/ota/OtaAutoApplyHost.tsx', 'src/lib/newFood.ts', 'src/app/(tabs)/index.tsx'])(
  '%s — 첫 transform 규칙(컴파일러 on)에 걸리고, 그 규칙의 변환 결과에 컴파일러 런타임이 들어간다',
  (file) => {
    expect(new RegExp(pattern).test(abs(file))).toBe(true);
    const out = transformSync(fs.readFileSync(file, 'utf8'), { ...compiledOpts, filename: abs(file) })?.code ?? '';
    expect(out).toMatch(/react\/compiler-runtime/);
  },
);

it('jest가 **실제로 로드한** 모듈이 컴파일돼 있다(설정 문구가 아니라 결과 — preset 병합 순서가 바뀌어도 잡힌다)', () => {
  for (const fn of [useContentTranslation, useNetworkIdle, useIsNewFood]) expect(fn.toString()).toMatch(/\$\[\d+\]/);
});

it.each(['src/features/review/__tests__/reviewTranslate689.test.tsx', 'src/lib/a.test.ts', 'node_modules/x/src/a.js'])(
  '%s — 컴파일러 규칙에 안 걸린다(테스트 파일·node_modules — 앱 번들과 동일, jest.mock 팩토리·Probe 굳음 방지)',
  (file) => {
    expect(new RegExp(pattern).test(abs(file))).toBe(false);
  },
);

it('번역 훅 소스 잠금 — 캐시는 useSyncExternalStore 구독으로만 읽는다(렌더 본문에서 getQueryData 직접 호출 0)', () => {
  const src = fs.readFileSync('src/lib/data/useContentTranslation.ts', 'utf8').replace(/\/\/[^\n]*/g, '');
  expect(src).toContain('useSyncExternalStore(subscribe, getSnapshot, getSnapshot)');
  expect(src.match(/getQueryData\b/g) ?? []).toHaveLength(1); // getSnapshot 안 1곳뿐
  expect(src).toMatch(/const getSnapshot = React\.useCallback\(\(\) => qc\.getQueryData</);
});

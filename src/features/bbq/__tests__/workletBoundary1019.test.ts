/**
 * P-637 회귀: jest는 워크릿 경계를 못 잡는다(목이 JS로 실행). 그래서 실제 react-native-worklets 바벨 플러그인으로 변환한 코드를 본다.
 * 원인 사고: postprocess(..., t = TUNING) — 기본 인자는 this.__closure를 풀기 전 매개변수 스코프에서 평가돼
 * 워크릿 런타임에선 ReferenceError → catch가 삼켜 실기 추론 0(업데이트 5a917acf).
 */
import { transformSync } from '@babel/core';
import { readFileSync } from 'fs';
import * as model from '../bbqModel';

const FILES = ['src/features/bbq/bbqModel.ts', 'src/features/bbq/bbqDetector.ts', 'src/features/bbq/useBbqDetection.ts'];

function workletsOf(file: string): { name: string; code: string }[] {
  const out = transformSync(readFileSync(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    presets: ['@babel/preset-typescript'],
    plugins: [require.resolve('react-native-worklets/plugin')],
  })!.code!;
  return [...out.matchAll(/code: "((?:[^"\\]|\\.)*)"/g)].map((m) => {
    const code = JSON.parse(`"${m[1]}"`) as string;
    return { name: /^function (\w+)/.exec(code)?.[1] ?? '?', code };
  });
}

it('워크릿 매개변수 기본값이 클로저 이름을 참조하지 않는다(세 파일 전수)', () => {
  const bad: string[] = [];
  let n = 0;
  for (const f of FILES) {
    for (const w of workletsOf(f)) {
      n++;
      const params = /^function \w*\(([^)]*)\)/.exec(w.code)?.[1] ?? '';
      const closure = /const\{([^}]*)\}=this\.__closure/.exec(w.code)?.[1]?.split(',') ?? [];
      for (const c of closure) if (new RegExp(`=[^,]*\\b${c}\\b`).test(params)) bad.push(`${f} ${w.name}: ${c}`);
    }
  }
  expect(n).toBeGreaterThan(8); // 변환이 실제로 워크릿을 찾았는지
  expect(bad).toEqual([]);
});

it('변환된 postprocess를 클로저만 주고 따로 실행 = 결과가 나온다(워크릿 런타임 흉내)', () => {
  const w = workletsOf('src/features/bbq/bbqModel.ts').find((x) => x.name.startsWith('postprocess'))!;
  const fn = new Function(`return ${w.code}`)() as (...a: unknown[]) => model.Det[];
  const out = new Float32Array(8400 * 14);
  out.set([150, 0, 250, 100, 0.9]);
  const ctx = { __closure: { TUNING: model.TUNING, letterbox: model.letterbox, nmsByGroup: model.nmsByGroup, decode: model.decode, unletterbox: model.unletterbox } };
  const d = fn.call(ctx, 'o2o', out, 1080, 1920);
  expect(d).toHaveLength(1);
  expect(d[0]!.x1).toBeCloseTo(30);
});

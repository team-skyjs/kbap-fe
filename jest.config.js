/** Jest config — pure scan-logic unit tests (classifier / segmenter). */
const expoPreset = require('jest-expo/jest-preset');

const JS = '\\.[jt]sx?$';
const [babelJest, babelOpts] = expoPreset.transform[JS];

/**
 * KB-694: 앱 번들은 React Compiler(app.json experiments.reactCompiler)를 거치는데 jest-expo의 babel caller엔
 * `supportsReactCompiler`가 없어 jest는 컴파일러 없이 돌았다 → 렌더 중 캐시 직접 읽기를 컴파일러가 메모이즈한 버그가
 * jest만 통과했다. 아래 목록의 **소스 파일**은 앱과 같게 컴파일러를 거친다(테스트 파일은 안 거침 — 앱 번들과 동일).
 * ponytail: 목록 한정 — 전체로 켜면 번역 밖 5개 스위트가 실제 메모이즈 의심 실패(otaNetworkIdle·NEW 배지 24h·아바타 재시도·
 * useFoods 401·HeroGallery reduce motion)라 확인·수정과 함께 별도 발주로 전환한다(KB-694 PR 본문 표).
 */
const COMPILED_SOURCES = [
  'src/lib/data/useContentTranslation\\.ts',
  'src/features/review/ReviewCellParts\\.tsx',
  'src/components/TranslateButton\\.tsx',
];
const COMPILED = `(${COMPILED_SOURCES.join('|')})$`;

module.exports = {
  preset: 'jest-expo',
  transform: {
    // 먼저 매칭되는 패턴이 이긴다 — 목록 파일 = 컴파일러 on
    [COMPILED]: [babelJest, { ...babelOpts, caller: { ...babelOpts.caller, supportsReactCompiler: true } }],
    ...expoPreset.transform,
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/*.test.ts?(x)'],
};

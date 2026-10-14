/** Jest config — pure scan-logic unit tests (classifier / segmenter). */
const expoPreset = require('jest-expo/jest-preset');

const JS = '\\.[jt]sx?$';
const [babelJest, babelOpts] = expoPreset.transform[JS];

/**
 * KB-694 → KB-695: 앱 번들은 React Compiler(app.json experiments.reactCompiler)를 거치는데 jest-expo의 babel caller엔
 * `supportsReactCompiler`가 없어 jest는 컴파일러 없이 돌았다 → 렌더 중 바깥 가변 값 읽기를 컴파일러가 메모이즈한 버그가
 * jest만 통과했다(번역 무반응 KB-694 · OTA network idle · NEW 배지 KB-695).
 * **src의 소스 파일 전부**를 앱과 같게 컴파일러로 변환한다. 테스트 파일(`__tests__/`·`*.test.*`)은 제외 — 앱 번들도 안 거치고,
 * 거치면 jest.mock 팩토리 안 컴포넌트·`Probe({ hook })` 같은 테스트 구동 코드가 굳어 거짓 실패가 난다(mentorFeedback·useFoods401).
 * node_modules는 babel-preset-expo가 스스로 컴파일러에서 뺀다.
 */
const COMPILED = '^(?!.*(?:/__tests__/|/node_modules/|\\.test\\.)).*/src/.*\\.[jt]sx?$';

/**
 * KB-783: airbridge-react-native-sdk는 ESM(`export`)로만 배포 — 프리셋의 node_modules 변환 허용 목록에 더한다.
 * 실 SDK가 유닛에서도 로드되고, 네이티브 모듈(EventInteractor)이 없으니 스스로 no-op(앱의 웹·구 런타임과 같은 경로).
 * 프리셋 패턴 문자열이 바뀌면(업그레이드) 아래 assert가 깨져 알린다 — 조용히 변환 누락으로 수백 스위트가 죽는 것보다 낫다.
 */
const [presetIgnore, ...restIgnore] = expoPreset.transformIgnorePatterns;
const ESM_PKGS = 'airbridge-react-native-sdk';
if (!presetIgnore.endsWith('))')) throw new Error('jest-expo transformIgnorePatterns 형식이 바뀜 — ESM_PKGS 주입 위치 재확인');
const transformIgnorePatterns = [presetIgnore.replace(/\)\)$/, `|${ESM_PKGS}))`), ...restIgnore];

module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns,
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

// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // ── 래칫(2026-09-21, KB-602) ────────────────────────────────────────────
    // SDK 56 `eslint-config-expo`가 처음 켠 React Compiler 시대 룰들이다. lint 자체가
    // 그동안 동작하지 않아(eslint 미설치) 이 코드베이스에 한 번도 돈 적이 없고,
    // 켜자마자 **기존 위반 155건**(rules-of-hooks 61 · refs 35 · immutability 24 ·
    // set-state-in-effect 19 · globals 12 · preserve-manual-memoization 4)이 나왔다.
    //
    // 광고비가 도는 출시 앱에 155건 대량 리팩터를 한 번에 넣는 건 이익보다 위험이 커서,
    // **끄지 않고 warn으로 내려 계속 보이게** 둔다(`npm run lint`가 매번 세어 보여준다).
    // 기존 위반은 KB-603~으로 분할 소진하고, **신규 위반은 `npm run lint:changed`가
    // error로 막는다**(변경·신규 파일은 --max-warnings 0).
    //
    // 소진 우선순위: ① set-state-in-effect(실제 낭비 렌더·타이밍) ② rules-of-hooks
    // (특히 food/[id]/review.tsx — 훅 위 early return이 FLAGS 빌드 상수에만 기대고 있다)
    // ③ refs·immutability·globals·preserve-manual-memoization.
    // 소진이 끝난 룰은 이 블록에서 **지운다**(= error 복귀).
    rules: {
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
]);

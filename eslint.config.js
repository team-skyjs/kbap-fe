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
  {
    // ── 헌법 게이트 하드화(2026-09-26) ─────────────────────────────────────
    // 발주문마다 글로 실어 보내던 규칙을 CI 실패로 옮긴다(도입 시점 기존 위반 0 — error).
    // 판별 못 하는 건 여전히 리뷰 몫: useSubmitGuard 누락, false-safe 강등 경로.
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // 헌법: UI 이모지 0(SVG만). 국기는 예외(FlagEmoji, 헌법 v2.3.0) — regional indicator
          // 범위(D83C DDE6–DDFF)는 아래 범위에서 빠져 있다. 주석은 AST 노드가 아니라 안 걸린다.
          selector:
            "JSXText[value=/\\uD83C[\\uDF00-\\uDFFF]|\\uD83D[\\uDC00-\\uDEFF]|\\uD83E[\\uDD00-\\uDEFF]|[\\u2600-\\u27BF]/]",
          message: "UI 텍스트에 이모지 금지 — SVG 아이콘 사용(헌법). 국기는 FlagEmoji.",
        },
        {
          selector:
            "JSXAttribute > Literal[value=/\\uD83C[\\uDF00-\\uDFFF]|\\uD83D[\\uDC00-\\uDEFF]|\\uD83E[\\uDD00-\\uDEFF]|[\\u2600-\\u27BF]/]",
          message: "UI 속성에 이모지 금지 — SVG 아이콘 사용(헌법).",
        },
        {
          // 헌법: i18n 하드코딩 0. JSX 텍스트·속성·{'…'}의 한글만 잡는다(console.log·주석 제외).
          // 사장님 카드 한국어는 src/lib/order/orderCard.ts(.ts)라 이 규칙 밖.
          selector: ":matches(JSXText, JSXAttribute > Literal, JSXExpressionContainer > Literal)[value=/[가-힣]/]",
          message: "JSX에 한글 리터럴 금지 — i18n 키(t('…'))로. 사장님 카드 문구는 orderCard.ts.",
        },
      ],
    },
  },
  {
    // P-147: 회원 속성(provider·가입 상태·판정)은 서버 API가 정본 — 화면·기능 계층에서
    // Firebase providerData 읽기 금지. 정리·철회 유틸(src/lib/auth)만 허용.
    files: ["src/app/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          property: "providerData",
          message: "회원 속성 판별은 서버 profile이 정본(P-147). providerData는 src/lib/auth 유틸에서만.",
        },
      ],
    },
  },
]);

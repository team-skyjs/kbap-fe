// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

// ── 헌법 UI 카피 규칙(KB-644 → KB-664) ─────────────────────────────────────
// 헌법: UI 이모지 0(SVG만). 판정 = Unicode `Extended_Pictographic`(표준 이모지 속성 —
// 🟢 같은 도형·⚠️ 포함). 국기(regional indicator 쌍)는 이 속성에 없어 자동 예외
// (FlagEmoji, 헌법 v2.3.0). ✓·★·→ 같은 텍스트 기호도 속성 밖이라 통과한다(의도).
// keycap(1️⃣ = 숫자+VS16+U+20E3)은 구성 문자가 속성 밖이라 U+20E3을 따로 잡는다.
const EMOJI_ANY = "\\p{Extended_Pictographic}|\\u20E3";
// 승인 예외는 **글자별로 따로** 연다(Codex #215 2R·3R) — 각 예외의 정의된 용도를 그리는 전용 컴포넌트에서만.
// 큰 화면 파일(온보딩·음식 상세·프로필 수정)은 넣지 않는다 — 넣으면 그 화면의 아무 JSX에서나 통과한다.
// ① 맵기 🌶️(U+1F336) = 맵기 표시 컴포넌트. 👶는 여기서도 에러(슬라이더·고추 렌더러는 HOT/EXTREME까지 그린다).
//    기준 차이: 🌶️도 지금 사용처는 0(SVG)이지만 헌법이 "맵기 표시"에 승인한 글자이고 두 컴포넌트가 바로 그 맵기 표시
//    전용이라 미리 열어 둔다. 👶는 승인 범위가 특정 배지 하나라 그 컴포넌트가 생길 때 연다.
const EMOJI_EXCEPT_PEPPER = "(?!\\u{1F336})\\p{Extended_Pictographic}|\\u20E3";
const PEPPER_SURFACES = [
  "src/components/SpicePeppers.tsx",
  "src/components/SpiceLevelSlider.tsx",
];
// ② 아기 👶(U+1F476): 예외 **없음**(지금 쓰는 자리 0 — 배지 컴포넌트 없음·kidsBadge 키 미사용). 👶는 NONE/MILD
// "아이도 먹을 수 있음" 배지 전용 컴포넌트를 만들 때 그 파일 하나만 예외 목록에 추가한다(헌법 v2.3.1 승인 범위).
const EMOJI_MSG = "UI에 이모지 금지 — SVG 아이콘 사용(헌법). 국기는 FlagEmoji. 승인 예외는 맵기 🌶️만(SpicePeppers·SpiceLevelSlider). 👶는 NONE/MILD 배지 전용 컴포넌트를 만들 때 config에 추가.";
const HANGUL_MSG = "JSX에 한글 리터럴 금지 — i18n 키(t('…'))로. 사장님 카드 문구는 orderCard.ts.";
function uiCopyRules(emoji) {
  return [
    { selector: `:matches(JSXText, JSXAttribute > Literal, JSXExpressionContainer Literal)[value=/${emoji}/u]`, message: EMOJI_MSG },
    { selector: `JSXExpressionContainer TemplateElement[value.raw=/${emoji}/u]`, message: EMOJI_MSG },
    // 헌법: i18n 하드코딩 0. 주석·console.log(JSX 밖)는 AST 대상이 아니라 안 걸린다.
    // 사장님 카드 한국어는 src/lib/order/orderCard.ts(.ts)라 이 규칙 밖.
    { selector: ":matches(JSXText, JSXAttribute > Literal, JSXExpressionContainer Literal)[value=/[가-힣]/]", message: HANGUL_MSG },
    { selector: "JSXExpressionContainer TemplateElement[value.raw=/[가-힣]/]", message: HANGUL_MSG },
  ];
}

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
      // "react-hooks/rules-of-hooks" — KB-604(2026-09-30) 11건 소진 → error 복귀(recommended 기본)
      // KB-657 PR-3(2026-10-01): 렌더 중 최신값 ref 쓰기 19건 → useLayoutEffect 동기화. 잔여 = ① 제스처/팬 콜백 안의 ref 접근
      // 11건(PhotoViewer·useSheetSwipeDismiss·scan Pinch·SpiceLevelSlider PanResponder — 실행은 이벤트 시점, 빌더가 렌더 중이라
      // 컴파일러가 잡음. 워클릿 경계 = 실기 확인 필요, 변경 없음) ② onboarding footer 4건(ref를 읽는 콜백 advance를 담은
      // 일반 객체를 렌더 중 읽음 — 컴파일러 오염, 동작 무관) → warn 유지 · 래칫 기준값 = 15.
      "react-hooks/refs": "warn",
      // KB-657 PR-2(2026-10-01): 잔여 20건 = 전부 reanimated shared value 쓰기(`sv.value = withX(…)`, 정식 사용법 — 코드 변경 금지).
      // 룰에 제외 옵션이 없어 warn 유지 · 래칫 기준값 = 20(늘면 lint:changed가 잡는다).
      "react-hooks/immutability": "warn",
      // "react-hooks/set-state-in-effect" — KB-603(2026-09-30) 19건 소진 → error 복귀(recommended 기본)
      // "react-hooks/globals" — KB-657 PR-1(2026-09-30) 12건 소진 → error 복귀(recommended 기본)
      // "react-hooks/preserve-manual-memoization" — KB-657 PR-1(2026-09-30) 4건 소진 → error 복귀
    },
  },
  {
    // ── 헌법 게이트 하드화(2026-09-26, KB-644) ─────────────────────────────
    // 발주문마다 글로 실어 보내던 규칙을 CI 실패로 옮긴다(도입 시점 기존 위반 0 — error).
    // 판별 못 하는 건 여전히 리뷰 몫: useSubmitGuard 누락, false-safe 강등 경로.
    //
    // 잡는 위치(Codex #204 2R): JSX 텍스트 · JSX 속성 문자열 · JSX 표현식 **안의 모든** 문자열·
    // 템플릿 리터럴(`{'😀'}`, `{cond ? '한글' : x}`, `{`총 ${n}개`}`, `label={`…`}`).
    // 한계: JSX 밖 변수에 담았다가 넘기는 문자열(`const s = '한글'; <T>{s}</T>`)은 못 잡는다 —
    // 값 추적은 lint 범위 밖, 리뷰 몫.
    files: ["src/**/*.tsx"],
    // 테스트는 서버가 준 한국어 데이터(음식명·주소)를 픽스처로 JSX에 넣는다 — UI 카피가 아니다.
    ignores: ["**/__tests__/**"],
    rules: { "no-restricted-syntax": ["error", ...uiCopyRules(EMOJI_ANY)] },
  },
  {
    // KB-664(Codex #213 P2 → #215 2R·3R): AGENTS.md L22 승인 예외 중 맵기 🌶️만 맵기 표시 컴포넌트(PEPPER_SURFACES)에서
    // 허용. 👶는 예외 없음(위 상수 주석). 그 밖에선 계속 에러.
    // flat config는 같은 룰을 블록 단위로 **교체**하므로 한글 규칙까지 그대로 다시 싣는다(uiCopyRules 공유).
    files: PEPPER_SURFACES,
    ignores: ["**/__tests__/**"],
    rules: { "no-restricted-syntax": ["error", ...uiCopyRules(EMOJI_EXCEPT_PEPPER)] },
  },
  {
    // P-147: 회원 속성(provider·가입 상태·판정)은 서버 API가 정본 — Firebase providerData 읽기 금지.
    // 예외는 정리·철회 유틸(src/lib/auth)뿐(Codex #204 2R: src/lib 헬퍼 경유 우회 차단).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/auth/**", "**/__tests__/**"],
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

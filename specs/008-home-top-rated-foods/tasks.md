# Tasks: 홈 하단 "평점 높은 음식" 섹션 + 스캔 CTA

**Input**: `specs/008-home-top-rated-foods/` (plan · spec · research · data-model · contracts/home-top-rated.md · quickstart)

**Tests**: CLAUDE.md 완료 기준에 따라 포함. 검증·PR 태스크는 qa 몫이라 제외.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 워크트리 `npm ci` + 베이스라인 `npx jest --ci` 그린 확인

## Phase 2: Foundational (계약·어댑터 — 모든 스토리 선행)

- [X] T002 [P] `src/lib/api/foodListTypes.ts` `TopRatedFoodWire` · `src/lib/api/types.ts` `TopRatedFood`·`HomeResponse.topRated`
- [X] T003 `src/lib/api/foodAdapter.ts` `adaptTopRatedFood`
- [X] T004 `src/lib/data/useHome.ts` `HOME_API_VERSION='1.3'`·`HomeWire.topRatedFoods`·`topRated` 매핑 + `src/lib/mocks/foods.ts` `MOCK_HOME(_EMPTY).topRated`
- [X] T005 `src/lib/data/__tests__/homeTopRatedAdapter800.test.ts` — 부재/null → `[]`, null 세부 평점 유지, 기존 필드 동일, 헤더 1.3

## Phase 3: US3 — 홈 리뷰 피드 제거 (P2, US1·US2 의 화면 바탕)

- [X] T006 `src/app/(tabs)/index.tsx` — `useGlobalReviews`·칩·`HomeFeedItem`·`FeedCard`·`ModerationFlow`·다음 페이지 스켈레톤/에러·`['reviews','global']` 무효화·관련 스타일·import 제거
- [X] T007 `src/features/home/homeImpressions.tsx` `HomeSection` `top_rated` 추가·`reviews` 제거 + 상단 주석 · `src/lib/analytics.ts` 섹션 주석 · `homeImpressions784` 테스트의 `reviews` → `top_rated`

## Phase 4: US1 — 평점 높은 음식 섹션 (P1)

- [X] T008 `src/features/food/FoodCards.tsx` `TopRatedRow`(designer 스펙 반영)
- [X] T009 `src/app/(tabs)/index.tsx` 섹션 헤더(`home-top-rated-head`, 노출 노드) + FlatList `data=topRated`·`HomeTopRatedRow`(카드 노출·클릭 계측)

## Phase 5: US2 — 스캔 CTA (P1)

- [X] T010 `src/app/(tabs)/index.tsx` 푸터 `Btn testID="home-scan-cta"` → `router.navigate('/scan')` + 면책
- [X] T011 [P] `src/lib/i18n/*.json` 10개 `home.scanCta`

## Phase 6: 테스트 갱신

- [X] T012 `src/app/__tests__/homeTopRated800.test.tsx` 신설 — 행·"—"·빈 배열(헤더 부재·CTA 존재)·CTA → `/scan`·카드 탭 → `home_card_click{top_rated}`·`useGlobalReviews` 미호출
- [X] T013 기존 홈 테스트 갱신 — `homeFeed317` 삭제(피드 전용) · 소스 잠금 갱신: `field0910Kb512`(새로고침 3키·reviews 부재)·`feedback0908`(홈 ModerationFlow 부재)·`parityDsHome486`(chipRow 삭제)·`reviewKeyboard700`(홈 입력 화면 제외 13→12)·`signupPath576`(gate_review 홈 기대 삭제)·`uiClickCoverage784`(TopRatedRow 자체 testID). `badgeAnchor701`·`design4Home430`·`tabStates`·`prodFlagSurfaces436`·`profileReorder227`·`errorStates164` 의 `useGlobalReviews`/`ModerationFlow` 목은 무해(미사용)라 무변
- [X] T014 `npx tsc --noEmit` · `npx jest --ci` · `node ./scripts/lint-changed.mjs`

## Dependencies

T002 → T003 → T004 → T005 · T006 → T009 → T010 · T008 → T009 · T011 ∥ T007 · T012·T013 → T014

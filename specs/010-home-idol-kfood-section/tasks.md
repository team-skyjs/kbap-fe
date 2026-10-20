# Tasks: 홈 K-POP & K-FOOD 섹션 + 상세 아이돌 영상 티저

**Input**: `specs/010-home-idol-kfood-section/` (plan · spec · research · data-model · contracts/idol-pick.md · quickstart)

**Tests**: CLAUDE.md 완료 기준에 따라 포함. 검증·PR 태스크는 qa 몫이라 제외.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 워크트리 `npm ci` + 베이스라인 `npx tsc --noEmit` 그린 확인

## Phase 2: Foundational (계약·어댑터·계측 — 모든 스토리 선행)

- [X] T002 [P] `src/lib/api/types.ts` `IdolVideo`·`FoodDetail.idolVideo`·`HomeResponse.idolPicks` · `src/lib/api/foodDetailTypes.ts` `FoodDetailWire.idolVideo`
- [X] T003 `src/lib/api/foodAdapter.ts` `adaptIdolVideo` + `adaptFoodDetail.idolVideo`
- [X] T004 `src/lib/data/useHome.ts` `HOME_API_VERSION='1.4'`·`HomeWire.idolPickFoods`·`idolPicks` + `src/lib/mocks/foods.ts` `idolPicks: []`
- [X] T005 [P] `src/lib/analytics.ts` `home_idol_pick_list_view`·`food_idol_video_open` EVENTS·ALLOWED·표 주석 · `src/features/home/homeImpressions.tsx` `idol_pick`·`trackHomeCardClick` id 선택 인자
- [X] T006 [P] `src/components/icons.tsx` `IconQuestion`·`IconPlay`
- [X] T007 [P] `src/lib/i18n/*.json` 15키 × 10로케일

## Phase 3: US1 — 홈 배너 (P1)

- [X] T008 `src/features/home/IdolPosterCard.tsx` `IdolPhoto`(사진 + 물음표 폴백 — 배너·카드 공유)
- [X] T009 `src/features/home/IdolPickBanner.tsx` (콜라주·320pt 규격·Shimmer·0건 null·노출/클릭 계측·눌림 오버레이)
- [X] T010 `src/app/(tabs)/index.tsx` `afterRail` = 배너 → 큐레이션

## Phase 4: US2 — 목록 화면 (P1)

- [X] T011 `src/features/home/IdolPosterCard.tsx` `IdolPosterCard`(회원 배지·라벨 위험도·눌림 오버레이)
- [X] T012 `src/app/idol-picks.tsx` 다크 헤더·2열 그리드·로딩/오류/0건·포커스 계측·카드 → `/food/{id}?src=idol_pick`

## Phase 5: US3 — 상세 V1 카드 (P1)

- [X] T013 `src/features/food/IdolVideoCard.tsx` (계측 → openWebPage, CTA 눌림 색)
- [X] T014 `src/app/food/[id]/index.tsx` profileHint 다음 배치 + source 화이트리스트 `idol_pick`

## Phase 6: 테스트

- [X] T015 `src/features/home/__tests__/idolPick836.test.tsx` 신설 — 어댑터·배너·목록·V1·배치 잠금·15키
- [X] T016 기존 테스트 갱신 — 홈 버전 1.3 → 1.4(`fetchHome`·`homeApiVersion785`·`homeTopRatedAdapter800`), 배치 잠금(`curation796`), copy722 허용 목록 `idolPicks.sub`(오탐 사유 주석)
- [X] T017 `npx tsc --noEmit` · `npx jest --ci` · `node ./scripts/lint-changed.mjs`

## Dependencies

T002 → T003 → T004 · T005·T006·T007 병렬 · T008 → T009 → T010 · T008 → T011 → T012 · T013 → T014 · 전부 → T015·T016 → T017

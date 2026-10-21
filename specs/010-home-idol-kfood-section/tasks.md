# Tasks: 홈 K-POP & K-FOOD 섹션 + 상세 아이돌 영상 티저

**Input**: `specs/010-home-idol-kfood-section/` (plan · spec · research · data-model · contracts/idol-pick.md · quickstart)

**Tests**: CLAUDE.md 완료 기준에 따라 포함. 검증·PR 태스크는 qa 몫이라 제외.

> 2026-10-21 ② 설계 변경: 1차 커밋의 홈 1.4·`idolPicks`·상세 `idolVideo` 데이터 계층은 되돌렸다(T002). 이하가 현재 계획.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 워크트리 `npm ci` + 베이스라인 `npx tsc --noEmit` 그린 확인

## Phase 2: Foundational (계약·어댑터·계측 — 모든 스토리 선행)

- [X] T002 폐기 설계 되돌리기 — `useHome.ts`(1.3)·`types.ts`·`foodDetailTypes.ts`·`foodAdapter.ts`·`mocks/foods.ts`·홈 버전 테스트 3개를 develop 과 동일하게
- [X] T003 `src/lib/api/idolPickAdapter.ts` `IdolPick`·`IdolVideo`·`adaptIdolPicks`
- [X] T004 `src/lib/data/useIdolPicks.ts` `fetchIdolPicks`·`idolPicksKey`·`useIdolPicks`·`useIdolPickVideo`(enabled:false)
- [X] T005 [P] `src/lib/analytics.ts` `home_idol_pick_list_view`·`food_idol_video_open` EVENTS·ALLOWED·표 주석 · `src/features/home/homeImpressions.tsx` `idol_pick`·`trackHomeCardClick` id 선택 인자
- [X] T006 [P] `src/components/icons.tsx` `IconQuestion`·`IconPlay`
- [X] T007 [P] `src/lib/i18n/*.json` 15키 × 10로케일(배너 3키 count 없는 갱신본)

## Phase 3: US1 — 정적 홈 배너 (P1)

- [X] T008 `src/features/home/IdolPickBanner.tsx` (props 없음 · 번들 사진 3장 · 320pt 규격 · 노출/클릭 계측 · 눌림 오버레이)
- [X] T009 `src/app/(tabs)/index.tsx` `afterRail` = 배너 → 큐레이션

## Phase 4: US2 — 목록 화면 (P1)

- [X] T010 `src/features/home/IdolPosterCard.tsx` `IdolPhoto`(사진 + 물음표 폴백) · `IdolPosterCard`(회원 배지·라벨 위험도·눌림 오버레이)
- [X] T011 `src/app/idol-picks.tsx` useIdolPicks · useIsGuest · 다크 헤더 · 2열 그리드 · 로딩/오류/0건 · 포커스 계측 · 카드 → `/food/{id}?src=idol_pick`

## Phase 5: US3 — 상세 V1 카드 (P1)

- [X] T012 `src/features/food/IdolVideoCard.tsx` (계측 → openWebPage, CTA 눌림 색)
- [X] T013 `src/app/food/[id]/index.tsx` `useIdolPickVideo(id)` + profileHint 다음 배치 + source 화이트리스트 `idol_pick`

## Phase 6: 테스트

- [X] T014 `src/features/home/__tests__/idolPick836.test.tsx` — 어댑터·요청·홈/상세 무변경 잠금·정적 배너·목록·V1(캐시 없음 = 미호출)·무효화·15키
- [X] T015 기존 테스트 갱신 — 배치 잠금(`curation796`), copy722 허용 목록 `idolPicks.sub`(오탐 사유 주석), `foodDetailV2` 에 `useIdolPickVideo` 목(QueryClient 없이 렌더)
- [X] T016 `npx tsc --noEmit` · `npx jest --ci` · `node ./scripts/lint-changed.mjs`

## Dependencies

T002 → T003 → T004 · T005·T006·T007 병렬 · T008 → T009 · T010 → T011 · T004 → T011·T013 · T012 → T013 · 전부 → T014·T015 → T016

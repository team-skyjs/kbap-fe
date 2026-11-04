# Tasks: 음식 발견 푸시(FOOD_DISCOVERY) 탭 → 음식 상세

**Input**: `specs/012-food-discovery-push/` (spec · plan · contracts/push-data.md · quickstart)

**Tests**: 계획 테스트 포인트 포함. 검증·PR 태스크는 qa 몫이라 제외.

## Phase 1: Setup

- [X] T001 워크트리 `npm ci` (origin/develop 88c0d4fa 기반)

## Phase 2: US1 — 푸시 탭 (P1)

- [X] T002 [US1] `src/lib/push/pushAdapter.ts` `PUSH_TYPES` + `FOOD_DISCOVERY` · 채널 주석 4종
- [X] T003 [US1] `src/lib/push/pushAdapter.ts` `routeForNotificationData` FOOD_DISCOVERY case
- [X] T004 [P] [US1] `src/lib/analytics.ts` `push_open` 주석 허용값
- [X] T005 [US1] `src/lib/push/__tests__/pushAdapter192.test.ts` — isPushType·라우팅·탭 콜백 3번째 인자

## Phase 3: US2 — 알림함 (P1)

- [X] T006 [US2] `src/lib/api/notificationAdapter.ts` `foodId` 복원
- [X] T007 [US2] `src/app/notifications.tsx` 탭 라우팅에 `foodId`
- [X] T008 [US2] `useNotifications499`(toInboxItem foodId) · `inbox499`(행 탭 `/food/6`) 테스트

## Phase 4: 완료 기준

- [X] T009 `npx tsc --noEmit` · `npx jest --ci` · `node ./scripts/lint-changed.mjs`

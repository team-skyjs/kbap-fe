# Tasks: 홈·알림함 광고성 동의 바텀시트

**Input**: `specs/011-home-marketing-consent-sheet/` (spec · plan · research · data-model · contracts/notification-settings.md · quickstart)

**Tests**: 계획 §8 목록 포함. 검증·PR 태스크는 qa 몫이라 제외.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 워크트리 `npm ci` (origin/develop cf8684b5 기반)

## Phase 2: Foundational

- [X] T002 `src/lib/push/consent.ts` `MARKETING_CONSENT_PATCH` + 설정 화면 `confirmConsent` 가 상수 사용
- [X] T003 [P] `src/lib/analytics.ts` `push_consent_view` EVENTS·ALLOWED, `push_consent_response` 에 `surface`·action `confirm`
- [X] T004 [P] `src/lib/i18n/*.json` `push.consentPromptTitle`·`push.consentPromptBody` × 10 로케일 + `notifKeys497` REQUIRED_PUSH
- [X] T005 `src/lib/oneShotQueue.ts` `waitUntil` export(PackagedCoach 에서 이동)
- [X] T006 `src/features/push/marketingConsentPrompt.ts` — `localDateKey`·`shouldCheckHome`·`isUnconsented`·활성 플래그·`presentHomeMarketingConsent`
- [X] T007 `src/features/push/NotificationSheet.tsx` `consentSurface` prop · view(열릴 때 1회)·confirm·surface 계측 + 설정 화면 `consentSurface="settings"`
- [X] T008 `src/features/push/MarketingConsentSheet.tsx` — 시트 래퍼(확인 = PATCH → 권한 → 토큰, 실패 토스트) + `useMarketingConsentSheet` 상태 훅

## Phase 3: US1 — 홈 (P1)

- [X] T009 [US1] `src/app/(tabs)/index.tsx` 큐 스텝 `marketingConsent`(코치마크 뒤) + 블러 abort + 시트 렌더

## Phase 4: US2 — 알림함 (P1)

- [X] T010 [US2] `InboxMarketingConsent`(transitionEnd·포커스·덮개 대기) + `src/app/notifications.tsx` 회원 분기 마운트

## Phase 5: US3 — 상호 배제 (P2)

- [X] T011 [US3] `src/features/scan/ScanExitPrompts.tsx` 코치마크 체크에 OR + 띄우기 직전 재확인

## Phase 6: 테스트

- [X] T012 `src/features/push/__tests__/marketingConsent979.test.tsx` — 게이트 순수 함수·홈 스텝·재가입·확인·알림함·상호 배제·계측
- [X] T013 기존 테스트 갱신 — `notificationSheet497`(surface·confirm·view 기대값) · `inbox499`(게스트 마운트 0·회원 1) · `design4Home430`(알림함 프롬프트 스텁)
- [X] T014 `npx tsc --noEmit` · `npx jest --ci` · `node ./scripts/lint-changed.mjs`

## Dependencies

T002·T003·T004·T005 병렬 → T006 → T007 → T008 → T009·T010·T011 → T012·T013 → T014

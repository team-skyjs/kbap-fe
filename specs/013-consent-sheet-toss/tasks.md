# Tasks: 광고성 동의 시트 B안 + 홈 3시간 주기

**Input**: `specs/013-consent-sheet-toss/` (spec · plan · contracts/notification-settings.md)

**Tests**: 계획 §4 표 포함. 검증·PR 태스크는 qa 몫이라 제외.

## Phase 1: Setup

- [X] T001 워크트리 `npm ci` (origin/develop 6198c74a 기반)

## Phase 2: Foundational (계약)

- [X] T002 [P] `src/lib/push/consent.ts` `MARKETING_CONSENT_PATCH.activity = true`
- [X] T003 [P] `src/lib/analytics.ts` `push_pref_toggle` ALLOWED 에 `source`

## Phase 3: US1 — B안 시트 (P1)

- [X] T004 [US1] `src/features/push/NotificationSheet.tsx` consent 플랫 스타일(컨테이너·핸들·제목·본문·간격·버튼·나중에) + ConsentRow 원형 체크·chevron

## Phase 4: US2 — 홈 3시간 (P1)

- [X] T005 [US2] `src/features/push/marketingConsentPrompt.ts` `HOME_LAST_SHOWN_KEY`·`HOME_INTERVAL_MS`·`homeConsentDue`·되돌림 보정·캐시 생략·`homeChecked` 삭제
- [X] T006 [US2] `src/app/(tabs)/index.tsx` 포커스 중 AppState active 복귀 시 스텝 재추가 + 주석

## Phase 5: US3 — 확인 계측 (P2)

- [X] T007 [US3] `MarketingConsentSheet.tsx` confirm · `profile/notifications.tsx` confirmConsent 에 `push_pref_toggle` activity/source:consent

## Phase 6: 테스트

- [X] T008 `marketingConsent979.test.tsx` 게이트·홈 스텝·재가입·PATCH·계측 기대값 갱신 + 신규
- [X] T009 `notificationSheet497.test.tsx` (j) consent 신규 프레임·핸들 0·그림자 0 + primer 잠금 · (p) chevron 라벨 · 제목 3줄·surface2 없음
- [X] T010 `notificationSettings497.test.tsx` confirmConsent 이벤트 2건
- [X] T011 R-12 10개 로케일 제목 줄 수 실측
- [X] T012 DEVLOG 항목
- [X] T013 `npx tsc --noEmit` · `npx jest --ci` · `node ./scripts/lint-changed.mjs`

## Dependencies

T002·T003 → T004·T005 → T006·T007 → T008~T011 → T012 → T013

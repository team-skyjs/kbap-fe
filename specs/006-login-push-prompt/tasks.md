# Tasks: 첫 설치 로그인 화면 OS 알림 권한 즉시 요청 (spec 006 · KB-631)

**Input**: plan.md · research.md(R-1~R-8) · contracts/login-push-prompt.md · quickstart.md

## Phase 1 — 어댑터 (US1·US2 기반)

- [ ] T001 [RED] `src/lib/push/__tests__/loginPrompt631.test.ts` — 헬퍼 시퀀스·표식·생애주기·소스 잠금 (contracts §5)
- [ ] T002 [GREEN] `src/lib/push/pushAdapter.ts` — `promptPermissionOnFirstLogin()` · `applyPendingActivityDefault()` · `PENDING_KEY`
- [ ] T003 `pushProdGuard221.test.ts` — 플래그 off: 두 헬퍼 모듈 미접근·기록 0·PATCH 0

## Phase 2 — 배선 (US1 트리거 · US2 로그인 성공)

- [ ] T004 [RED] `src/app/__tests__/loginPushPrompt631.test.tsx` — entry=intro 1회 · returnTo 0 · 파라미터 없음 0
- [ ] T005 [GREEN] `src/app/login.tsx` 마운트 effect
- [ ] T006 [GREEN] `src/lib/auth/useSocialAuth.ts` exchange() 배선
- [ ] T007 `PushPrimerModal.tsx` 헤더 주석(후순위 경로) · `requestPermission` 주석

## Phase 3 — 검증·문서

- [ ] T008 `npx tsc --noEmit` 0 · `npx jest` 전체 통과
- [ ] T009 specs/001 US4·US6·research B안 "폐기됨(KB-631)" 표기 · PROGRESS.md 항목
- [ ] T010 커밋 · PR(develop) — 실기 D-1~D-12 전 OTA 게이트 명기

# Implementation Plan: 홈·알림함 광고성 동의 바텀시트

**Branch**: `feat/kb979-home-marketing-consent-sheet` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

## Summary

기존 `NotificationSheet variant="consent"` 를 새 문구로 감싼 `MarketingConsentSheet` 를 홈 modalQueue 스텝(코치마크 뒤, 하루 1회·런타임 1회)과 알림함(포커스마다, 전환 종료 뒤)에 붙인다. 확인 = 설정 화면과 같은 PATCH 상수 + `undetermined` 면 OS 권한 요청. 계측 surface·view·confirm 추가. 서버 변경 0.

## Technical Context

TypeScript · React Native 0.85 · Expo Router(native-stack) · TanStack Query · AsyncStorage · jest-expo. 네이티브 의존성 변경 0 → JS 만(OTA 가능).

## Constitution Check

- 서버 정본: 동의 여부는 GET 응답으로만 판정, 로컬엔 "띄운 날짜"(UX 상태)만 — PASS.
- 뮤테이션 버튼: NotificationSheet 의 `useSubmitGuard` + `Btn busy` 그대로 — PASS.
- 레이아웃 메트릭 불변: 기존 시트 무변경(문자열만) — PASS.
- i18n 10 로케일 패리티: 2키 × 10 + `notifKeys497` REQUIRED_PUSH 확장 — PASS.
- 이모지: 본문 👍 는 PRD 확정 문구(문자열 콘텐츠, UI 기호 아님) — 계획 그대로.
- 재가입 시나리오 테스트 포함 — PASS.

## Project Structure

```text
src/lib/push/consent.ts                     MARKETING_CONSENT_PATCH 추가
src/lib/oneShotQueue.ts                     waitUntil export(PackagedCoach 에서 이동)
src/features/coach/PackagedCoach.tsx        waitUntil import
src/features/push/marketingConsentPrompt.ts 신규 — 게이트·판정·홈 스텝·활성 플래그
src/features/push/MarketingConsentSheet.tsx 신규 — 시트 래퍼 + 상태 훅 + 알림함 프롬프트
src/features/push/NotificationSheet.tsx     consentSurface prop · view/confirm/surface 계측
src/app/(tabs)/index.tsx                    큐 스텝 marketingConsent + 블러 abort
src/app/notifications.tsx                   회원 분기에 InboxMarketingConsent
src/app/profile/notifications.tsx           공용 PATCH 상수 · consentSurface='settings'
src/features/scan/ScanExitPrompts.tsx       isMarketingConsentActive() 상호 배제(2지점)
src/lib/analytics.ts                        push_consent_view · surface
src/lib/i18n/*.json                         push.consentPromptTitle/Body
```

## Complexity Tracking

없음.

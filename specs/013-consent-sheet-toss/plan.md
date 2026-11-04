# Implementation Plan: 광고성 동의 시트 B안 + 홈 3시간 주기

**Branch**: `feat/kb987-consent-sheet-toss` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

## Summary

`NotificationSheet` 에 `flat = variant === 'consent'` 분기로 컨테이너·핸들·제목·본문·간격·버튼 높이·"나중에"만 B안 스타일을 고른다(primer 불변). `ConsentRow` 는 consent 전용이라 바로 원형 체크 + chevron 으로 교체. 홈 게이트는 `homeLastShownAt`(epoch ms) + `homeConsentDue` 순수 함수 + 되돌림 보정, 동의 캐시면 GET 생략, `homeChecked` 삭제. 홈 화면은 포커스 중 AppState `active` 복귀 때 같은 스텝을 큐에 다시 넣는다. PATCH 상수에 `activity: true`, 확인 시 `push_pref_toggle` source 계측.

## Technical Context

TypeScript · React Native 0.85 · Expo Router · TanStack Query · AsyncStorage · jest-expo. 네이티브 의존성·app.json 변경 0 → JS 만(OTA 가능).

## Research

- expo-router/react-navigation 은 AppState 복귀에 focus 를 다시 쏘지 않는다 → 홈 `useFocusEffect` 안에서 AppState `change` 구독(포커스 동안만), `active` 진입 시 `marketingConsent` 스텝을 다시 add(A-9).
- 되돌림 보정 선례: `src/lib/reviewPrompt.ts` `fixClockRewind`.
- 제목 축소 선례: `src/features/home/IdolPickBanner.tsx` `numberOfLines`+`adjustsFontSizeToFit`+`minimumFontScale 0.9`.

## Data Model

AsyncStorage `kbap.marketingConsent.homeLastShownAt` = `String(epochMs)` (UX 상태만, 동의 사실 저장 0). 구 키 `homeShownDate` 방치(A-4).

## Constitution Check

- 서버 정본: 동의 판정은 GET/react-query 캐시(서버 응답)만 — PASS.
- 뮤테이션 버튼: `useSubmitGuard` + `Btn busy` 유지 — PASS.
- 색만 변화: 체크 원 메트릭 동일 단언(497 (e)) — PASS.
- 기호 SVG: `IconCheck`·`IconChevron` — PASS. i18n 신규 키 0.
- 재가입·계정 전환: `queryClient.clear()` 경계 테스트 — PASS.

## Project Structure

```text
src/features/push/NotificationSheet.tsx      consent 플랫 스타일·ConsentRow
src/features/push/marketingConsentPrompt.ts  3시간 게이트·되돌림·캐시 생략
src/features/push/MarketingConsentSheet.tsx  확인 시 push_pref_toggle
src/app/(tabs)/index.tsx                     AppState 복귀 재판정
src/app/profile/notifications.tsx            confirmConsent 계측
src/lib/push/consent.ts                      activity: true
src/lib/analytics.ts                         push_pref_toggle source
tests: marketingConsent979 · notificationSheet497 · notificationSettings497
```

## Complexity Tracking

없음.

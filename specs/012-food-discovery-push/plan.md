# Implementation Plan: 음식 발견 푸시(FOOD_DISCOVERY) 탭 → 음식 상세

**Branch**: `feat/kb985-food-discovery-push` | **Date**: 2026-11-04 | **Spec**: `specs/012-food-discovery-push/spec.md`

## Summary

푸시 유형 상수 1개 추가, 라우팅 함수 case 1개, 알림함 어댑터 필드 1개·화면 인자 1개. 신규 파일·의존성·i18n 없음.

## Technical Context

TypeScript · React Native(Expo) · expo-router · jest-expo. 변경은 JS 만(OTA 가능).

## Constitution Check

헌법 파일이 템플릿 상태라 게이트 없음. `kbap-fe/CLAUDE.md` 불변 규칙: 서버 와이어 파싱은 어댑터에만(준수 — `notificationAdapter`), 문자열 i18n(신규 문자열 없음).

## Design

| 파일 | 변경 |
|---|---|
| `src/lib/push/pushAdapter.ts` | `PUSH_TYPES` + `FOOD_DISCOVERY`, `routeForNotificationData` case(REVIEW_REMINDER `orderId` 와 같은 숫자 규칙), 주석 "광고성 3종" → 4종 |
| `src/lib/api/notificationAdapter.ts` | `NotificationWire.foodId?`, `InboxItem.foodId?`, `toInboxItem` 문자열화 |
| `src/app/notifications.tsx` | `routeForNotificationData({ type, orderId, foodId })` |
| `src/lib/analytics.ts` | `push_open` 주석 허용값 목록 |

계약: `contracts/push-data.md` (계획 계약 표 그대로).

## Project Structure

기존 구조 유지. 테스트는 기존 파일(`pushAdapter192`·`useNotifications499`·`inbox499`)에 추가.

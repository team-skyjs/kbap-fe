# Feature Specification: iOS 푸시 썸네일 (Notification Service Extension)

**Feature Branch**: `feat/kb1009-ios-push-thumbnail-nse` · **Jira**: KB-1009 · **Status**: Implemented

## 배경

서버(kbap-server #551)는 푸시에 `richContent.image` + `mutableContent: true` 를 싣는다. Android 는 그대로 이미지가 붙지만 iOS 는 Notification Service Extension(NSE) 이 있어야 붙는다. kbap-fe 는 CNG(`ios/` gitignore)라 네이티브 타깃은 config plugin(`@bacons/apple-targets`)으로만 추가한다. `src/` 변경 없음.

## User Scenarios

### US1 — 이미지 있는 푸시에 썸네일 표시 (P1)
**Given** iOS 기기에 NSE 가 포함된 빌드 **When** `body._richContent.image` 에 https URL 이 있는 푸시 수신 **Then** 배너에 이미지 썸네일이 붙는다.

### US2 — 어떤 실패에도 알림 유실 없음 (P1)
**Given** 이미지 URL 없음·파싱 실패·다운로드 오류·HTTP 비 2xx·첨부 생성 실패·시간 만료 **Then** 원본 알림이 정확히 한 번 표시된다.

## Requirements

- **FR-001 (R-01)** `@bacons/apple-targets` `5.0.0` 정확 고정 설치, app.json plugins 에 추가.
- **FR-002 (R-02)** `targets/notification-service/` 에 `expo-target.config.js`(type notification-service, bundleIdentifier `.NotificationService`, deploymentTarget 16.4)·`Info.plist`·`NotificationService.swift`·`generated.entitlements`.
- **FR-003 (R-03)** `userInfo["body"]["_richContent"]["image"]` 를 내려받아 `UNNotificationAttachment` 로 첨부.
- **FR-004 (R-04)** 모든 실패 경로와 `serviceExtensionTimeWillExpire` 에서 contentHandler 정확히 1회.
- **FR-005 (R-05)** 첨부 확장자 = URL `pathExtension`, 비면 `jpg`.
- **FR-006 (R-06)** `extra.eas.build.experimental.ios.appExtensions` 에 `notificationservice` / `com.rocher.kbap.NotificationService` 1개 항목.
- **FR-007 (R-07)** `ios/`·`android/` 미커밋.
- **FR-008 (R-08)** `src/` diff 0, tsc·jest·lint 래칫·Android prebuild 회귀 없음.

## Success Criteria
- prebuild 후 Xcode 프로젝트에 `notificationservice` 타깃, 시뮬레이터 빌드 성공, `KBap.app/PlugIns/notificationservice.appex` 존재.
- 실기기 썸네일 표시는 사용자 확인(teamtest iOS + dev FOOD_DISCOVERY).

## Assumptions
- A-1: APNs 상 이미지 위치는 `body._richContent.image` (근거 expo/expo PR #36202). 틀리면 썸네일만 안 뜨고 알림은 원본대로.
- A-2: 확장 deploymentTarget 16.4 = 앱 최소.
- A-4: 확장은 Sentry·Firebase·App Group 미사용.

## Out of Scope
EAS 빌드·OTA·스토어 제출, Android, 서버, 인박스 썸네일, 로컬 알림 이미지, 캐싱·리사이즈, 계측.

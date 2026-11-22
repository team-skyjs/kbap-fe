# Tasks: iOS 푸시 썸네일 NSE

**Input**: `specs/014-ios-push-thumbnail-nse/` (spec · plan · contracts/apns-payload.md)

**Tests**: Swift 확장은 jest 범위 밖 — 로컬 prebuild·xcodebuild 시뮬레이터 빌드로 컴파일 검증. 검증·PR 태스크는 qa 몫이라 제외.

## Phase 1: Setup
- [X] T001 워크트리 `npm ci` (origin/develop 03272634 기반)
- [X] T002 `npm install --save-exact @bacons/apple-targets@5.0.0`, app.json plugins 끝에 추가

## Phase 2: US1·US2 — NSE 타깃 (P1)
- [X] T003 [P] `targets/notification-service/expo-target.config.js` (notification-service, `.NotificationService`, 16.4)
- [X] T004 [P] `targets/notification-service/Info.plist`·`generated.entitlements`
- [X] T005 `targets/notification-service/NotificationService.swift` 다운로드·첨부·실패 원본 전달·만료·1회 전달
- [X] T006 app.json `extra.eas.build.experimental.ios.appExtensions` 1개 항목

## Phase 3: 로컬 검증
- [X] T007 `npx expo config` appExtensions 1개 확인
- [X] T008 `npx expo prebuild --platform ios --clean` → `xcodebuild -list`·pbxproj grep·시뮬레이터 빌드·.appex 확인
- [X] T009 `npx expo prebuild --platform android --clean --no-install` 회귀
- [X] T010 `npx tsc --noEmit` · `npx jest --ci` · `node ./scripts/lint-changed.mjs` · `git status` ios/android 0줄

## Dependencies
T001 → T002 → T003·T004 → T005·T006 → T007 → T008 → T009 → T010

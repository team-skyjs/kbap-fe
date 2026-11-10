# Implementation Plan: iOS 푸시 썸네일 NSE

**Spec**: `spec.md` · **Contract**: `contracts/apns-payload.md`

## Technical Context
- Expo SDK 57 CNG, `ios/`·`android/` gitignore. 네이티브 타깃은 `@bacons/apple-targets@5.0.0` config plugin.
- 확장: Swift 5, iOS 16.4, Pod 의존 없음(`pods.rb` 없음 → `use_frameworks! static` 무관).
- 외부 의존 없음: `URLSession.shared.downloadTask` + `UNNotificationAttachment`.

## Constitution Check
- UI·i18n·서버 정본 규칙: 해당 없음(JS 변경 0).
- 배포: 네이티브 재빌드 필요, fingerprint 회전 정상, OTA 금지.

## Design
- `didReceive`: `mutableCopy` → `body._richContent.image` → `URL`. 하나라도 nil 이면 원본 즉시 전달.
- 다운로드 완료 핸들러 안에서 임시 파일을 `temporaryDirectory/UUID.ext` 로 move → attachment. 성공·실패 무관 끝에서 전달.
- `serviceExtensionTimeWillExpire`: task cancel + bestAttempt 전달.
- 정확히 1회: `deliver()` 가 lock 안에서 contentHandler 를 꺼내고 nil 로 비운 뒤 호출.
- app.json `appExtensions` 는 플러그인 자동 산출과 같은 값으로 명시(리뷰 가시성).

## 수동 단계 (머지 후 첫 iOS 빌드 전 1회)
새 번들 ID `com.rocher.kbap.NotificationService` 프로파일 생성: `eas credentials -p ios` 또는 대화형 `eas build -p ios` (teamtest·production).

# APNs payload 계약 (서버 → 앱, 기존 · 변경 없음)

| 항목 | 값 |
|------|-----|
| aps | `{"alert": {...}, "mutable-content": 1}` (서버 `mutableContent: true` → Expo 변환) |
| 이미지 위치 | `userInfo["body"]["_richContent"]["image"]` (String, https URL) — `richContent` 아님, 앞에 `_` |
| 근거 | expo/expo PR #36202 Swift. 공식 문서 미명시 → teamtest 실기기에서 최종 확인(A-1) |

EAS 서명 선언(app.json `extra.eas.build.experimental.ios.appExtensions`):

```json
[{ "targetName": "notificationservice", "bundleIdentifier": "com.rocher.kbap.NotificationService", "entitlements": {} }]
```

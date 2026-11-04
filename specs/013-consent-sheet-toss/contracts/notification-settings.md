# Contract — PATCH /api/notifications/settings (KB-987, 기존 엔드포인트)

변경 = 요청 body 에 이미 정의된 `activity` 를 추가로 싣는다. 경로·헤더(`X-API-Version` 앱 기본 1.1)·에러는 현행.

Request:
```json
{"activity": true, "news": {"consent": true, "privacyConsentVersion": 2, "receiveConsentVersion": 2, "enabled": true, "mealTime": true}}
```

Response (client.ts 가 `payload` 를 푼다):
```json
{"success": true, "payload": {"activity": true, "news": {"enabled": true, "mealTime": true, "privacyConsent": {"version": 2, "grantedAt": "2026-11-04T09:00:00Z"}, "receiveConsent": {"version": 2, "grantedAt": "2026-11-04T09:00:00Z"}}}, "message": null, "code": null}
```

Errors: `NOTIFICATION-001`(이 body 는 enabled 를 함께 켜 발생 0) · 401 · 네트워크/5xx = 홈·알림함 `notif.saveFailed` 토스트 후 닫기, 설정 = 낙관 롤백.

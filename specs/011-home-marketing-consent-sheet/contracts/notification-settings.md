# 계약 — 알림 설정 (기존, 변경 없음)

`client.ts` 가 봉투 `{ success, payload, message, code }` 를 풀고 `X-API-Version`(기본 1.1)·`X-Installation-Id` 를 붙인다. 게스트는 호출하지 않는다(401).

| ID | 메서드 경로 | 요청 | 응답 payload | 에러 |
|----|------------|------|--------------|------|
| R-02, R-06 | `GET /api/notifications/settings` | 없음 | 미동의: `{"activity":false,"news":{"enabled":false,"mealTime":false,"privacyConsent":null,"receiveConsent":null}}` · 동의: `{"activity":true,"news":{"enabled":true,"mealTime":true,"privacyConsent":{"version":2,"grantedAt":"2026-11-04T09:00:00"},"receiveConsent":{"version":2,"grantedAt":"2026-11-04T09:00:00"}}}` | 401 · 400 `COMMON-002` — 홈 = 조용히 skip(소모 0), 알림함 = 미노출 |
| R-04 | `PATCH /api/notifications/settings` | `{"news":{"consent":true,"privacyConsentVersion":2,"receiveConsentVersion":2,"enabled":true,"mealTime":true}}` (= `MARKETING_CONSENT_PATCH`, 설정 화면과 공용) | 위 "동의" 예시와 같은 전체 설정 | 400 `COMMON-002`·`NOTIFICATION-001`(이 body 에선 발생 안 함) · 401 · 네트워크 → 오류 토스트 후 닫기 |

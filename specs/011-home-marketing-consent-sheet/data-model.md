# Data model

- `kbap.marketingConsent.homeShownDate` (AsyncStorage, string `YYYY-MM-DD`, 기기 로컬) — 홈 시트를 실제로 띄운 날. 판정 `stored !== today`.
- 모듈 변수 `homeChecked: boolean` — JS 런타임당 홈 판정 소모. `sheetActive: boolean` — 동의 시트(홈·알림함) 표시 중.
- `NotificationSettings`(기존, `useNotificationSettings.ts`) — 미동의 = `!news.privacyConsent || !news.receiveConsent`.
- `MARKETING_CONSENT_PATCH`(신규 상수, `src/lib/push/consent.ts`) — 계약 R-04 body.

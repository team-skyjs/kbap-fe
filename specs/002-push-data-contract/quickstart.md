# Quickstart: KB-498 검증

## 사전 조건

- 브랜치 `feat/kb498-push-data-contract` 워크트리, `npm install` 완료.
- 계약: [contracts/push-notification-data.md](./contracts/push-notification-data.md) · 모델: [data-model.md](./data-model.md)

## 자동 검증 (완료 기준 = tsc 0 · jest 전체 통과)

```bash
npx tsc --noEmit
npx jest src/lib/push src/lib/notifications src/lib/i18n
npx jest   # 전체
```

기대 통과 스위트와 잠그는 시나리오:

| 스위트 | 잠그는 것 (스펙 참조) |
|--------|----------------------|
| `pushAdapter192` | 매핑 5종 + `UNKNOWN_FUTURE` + `NUDGE` = null (US1 1~8, FR-009) · foodId 숫자/문자열 동일 경로 · 탭 시 `onRoute(href, notificationId)` 전달, 부재 시 `undefined` (US3 1~2) · 콜드 스타트 응답 1회 전달 (US3 3) · `Platform.OS='android'`에서 `setNotificationChannelAsync('default', {importance: MAX})` 1회, `'ios'`에서 0회 (US4 1~2) |
| `pushProdGuard221` | 플래그 off = 채널 설정 포함 모듈 접근 0 (US4 3, FR-008) — 폭탄 목에 `setNotificationChannelAsync` 추가 |
| `inbox216` | SCAN_SUGGESTION·NEWS·MEAL_TIME 기록 시 titleKey/bodyKey 정확 · 같은 id 2회 = 1건 (US2 4) · 미지 유형 기록 0 (US2 5) · 저장분의 NUDGE 항목은 하이드레이트 후 사라짐 |
| `inboxKeys498` (신규) | 10로케일 `inbox` 키 집합 = ko와 일치 · 구 nudge/notice 키 잔존 0 · 신규 6키 비어 있지 않음 (FR-004·005, SC-002) |

## 수동 검증 (Android 실기기 — SC-004)

1. `expo-notifications` 포함 빌드(빌드18 이후) 설치, 푸시 권한 허용, 로그인.
2. **앱을 백그라운드로 보내거나 종료한 상태에서**(포그라운드 핸들러는 소리 없음 — 범위 밖) Expo push tool 또는 dev 서버에서 `channelId: "default"`, `priority: "high"`, `sound: "default"`, `data: { type: "MEAL_TIME", notificationId: 1 }` 발송.
3. 기대: 상단 헤드업 배너 + 소리. 탭 → 스캔 화면. 알림함에 "식사 시간" 1줄.
4. `data.type: "NUDGE"` 발송 → 탭 시 앱만 열림, 알림함 미기록.
5. iOS: 동일 발송 시 기존과 동일 동작(배너), 설정 앱의 알림 채널 항목 변화 없음.

## 배포 메모

- JS 전용 → OTA 가능. 발행은 예진 승인 후 별도 지시(CLAUDE.md 배포 게이트). 이 작업에서 `eas update` 실행 금지.
- 머지 순서: 알림 설정 화면 재편 작업보다 먼저(같은 10로케일 파일 충돌 방지 — spec Assumptions).

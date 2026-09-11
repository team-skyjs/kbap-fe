# Data Model: 푸시 data 계약 (KB-498)

## PushType (앱이 인식하는 유형 — 서버 enum과 동일)

| 값 | 탭 경로 | 광고성 | 알림함 키 |
|----|---------|--------|-----------|
| `HELPFUL` | `/profile/reviews` | 아니오 | `inbox.helpfulTitle/Body` (기존) |
| `SCAN_SUGGESTION` | `/scan` | 예 | `inbox.scanSuggestionTitle/Body` (신규, 구 nudge 문구 승계) |
| `REVIEW_REMINDER` | `/food/{foodId}/review` (foodId 없으면 없음) | 아니오 | `inbox.reminderTitle/Body` (기존) |
| `NEWS` | 없음 | 예 | `inbox.newsTitle/Body` (신규) |
| `MEAL_TIME` | `/scan` | 예 | `inbox.mealTimeTitle/Body` (신규) |

정확 일치만. `NUDGE`·`NOTICE`·소문자·공백 변형 = 미지 유형(경로 없음·기록 없음).

정의 위치: `src/lib/push/pushAdapter.ts` — `PUSH_TYPES` 상수 배열 · `PushType` · `isPushType()`.

## 푸시 알림 data (서버 → 앱, `notification.request.content.data`)

| 필드 | 타입 | 필수 | 비고 |
|------|------|------|------|
| `type` | `PushType` 문자열 | 예 | 미지 값은 무시 |
| `foodId` | `string \| number` | REVIEW_REMINDER만 | 경로 생성 시 문자열화 (`/food/7/review`) |
| `notificationId` | `number \| string` | 서버 푸시는 항상, 로컬 알림·구 서버는 없음 | 형 변환 없이 그대로 전달 |

로컬 리뷰 리마인더(`scheduleReviewReminder`)가 만드는 data는 `{ type: 'REVIEW_REMINDER', foodId }` — `notificationId` 없음(변경 없음, FR-010).

## InboxItem (기기 로컬 알림함, AsyncStorage `kbap.inbox.v1`)

```
id: string            // OS request.identifier — 중복 방지 키
titleKey: string      // i18n 키
bodyKey: string
at: string            // ISO
read: boolean
data: { type: PushType; foodId?: string }
```

변경점: `data.type` 유니온이 `PushType`으로 교체. 저장 포맷·키 불변.

**하이드레이트 규칙(신규)**: 저장분 중 `data.type`이 `KEYS`(5종) 키가 아닌 항목은 드롭(구 NUDGE/NOTICE 잔존 정리).

**기록 규칙**: `recordInboxNotification`은 `type`이 `KEYS` 키가 아니면 no-op. 같은 `id` 재기록 no-op(기존).

## 탭 콜백 (앱 내부, `addNotificationTapListener`)

```
onRoute(href: string, notificationId?: number | string) => void
```

- `href` = `routeForNotificationData(data)`가 non-null일 때만 호출(기존).
- `notificationId` = `data.notificationId` 그대로. 없으면 `undefined`.
- 콜드 스타트(`getLastNotificationResponseAsync`)도 같은 `emit` 경로. 같은 `request.identifier`는 1회만 전달(리스너와 이중 전달 차단).

## Android 알림 채널

| id | 유형 | name (i18n) | importance | sound |
|----|------|-------------|------------|-------|
| `activity` | HELPFUL · REVIEW_REMINDER | `notif.activityGroup` | `MAX` | `default` |
| `news` | SCAN_SUGGESTION · NEWS · MEAL_TIME | `notif.newsGroup` | `HIGH` | `default` |

`default` 채널은 만들지 않는다(중요도 생성 후 불변). 서버가 `default`로 보내면 expo 폴백 채널로 표시된다(기존 동작).

iOS: 호출 없음. 플래그 off: 호출 없음.

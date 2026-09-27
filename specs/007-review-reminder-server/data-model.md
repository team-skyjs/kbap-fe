# Data Model — 007 리뷰 리마인더 서버 전환

## 1. 푸시 data (REVIEW_REMINDER, 서버 PR #305)

| 필드 | 타입 | 필수 | 앱 처리 |
|------|------|------|---------|
| `type` | `'REVIEW_REMINDER'` | ✓ | `PUSH_TYPES` 정확 일치(무변) |
| `orderId` | int64 (JSON number; 직렬화 차이로 문자열 가능) | ✓ | `String()` 후 `/^\d+$/` 통과 시 `/profile/order/{orderId}`, 아니면 null |
| `notificationId` | number \| string | — | 탭 콜백 2번째 인자 그대로(무변, specs/002 §3) |
| ~~`foodId`~~ | — | 폐기 | 읽지 않음. 값이 와도 무시 |

예: `{ "type": "REVIEW_REMINDER", "orderId": 12, "notificationId": 456 }` → `('/profile/order/12', 456)`.

## 2. 알림함 항목 (GET /api/notifications · PATCH /api/notifications/{id}/read)

### 와이어 `NotificationWire`

| 필드 | 타입 | 변경 |
|------|------|------|
| `id` `title` `body` `receivedAt` `read` `type?` | (무변) | — |
| `orderId?` | number \| string \| null | **추가** — REVIEW_REMINDER만 값, 그 외 null. 구 응답엔 필드 자체 없음 |
| ~~`foodId?`~~ | — | **삭제** — 서버가 항상 null로 보내는 호환 필드, 타입에서 제거 |

### 도메인 `InboxItem`

| 필드 | 타입 | 변환 |
|------|------|------|
| `orderId?` | string | 와이어 `orderId != null` → `String()`; 아니면 undefined |
| ~~`foodId?`~~ | — | 삭제 |

탭: `routeForNotificationData({ type: item.type, orderId: item.orderId })` → href면 `openNotificationRoute`, null이면 알림함 유지(읽음 처리는 그대로).

## 3. 유형 → 착지 (이 작업 후 전체 표)

| 입력 | href | 비고 |
|------|------|------|
| `HELPFUL` | `/profile/reviews` | 무변 |
| `SCAN_SUGGESTION` · `MEAL_TIME` | `/(tabs)` (스택 리셋) | 무변 |
| `REVIEW_REMINDER` + `orderId` 12 / `'12'` | `/profile/order/12` | **변경** — navigate(같은 화면 재사용·id 갱신) |
| `REVIEW_REMINDER` + orderId 없음 / `'abc'` / `-1` / `1.5` / `''` | `null` | **변경** — 오착지 금지 |
| `REVIEW_REMINDER` + `foodId` 7만 (구 로컬 알림 잔존) | `null` | **변경** — 음식 상세 분기 삭제 |
| `NEWS` · 미지 · 구 이름 | `null` | 무변 |

## 4. 삭제 표면

| 위치 | 삭제 항목 |
|------|-----------|
| `src/lib/push/pushAdapter.ts` | `REMINDERS_KEY` · `REVIEW_REMINDER_SECONDS` · `getReminderMap` · `setReminderMap` · `scheduleReviewReminder` · `cancelReviewReminder` |
| `src/features/order/FlippedOrderCard.tsx` | import · done 탭 안 `target` 계산·`scheduleReviewReminder` 호출 |
| `src/app/food/[id]/review.tsx` | import · `cancelReviewReminder(id)` |
| `src/lib/i18n/*.json` (10) | `push.reviewReminderTitle` · `push.reviewReminderBody` |
| AsyncStorage `kbap.push.reminders.v1` | 코드만 삭제, 기기 잔존 값은 정리 안 함(고아) |

## 5. 무변 표면

`ensureChannels`(activity·news) · `addNotificationTapListener` · 콜드 스타트 1회 전달 · `openNotificationRoute` · `_layout.tsx` 배선 · `profile/order/[id].tsx`(B안) · `useOrders`·`OrderItem.ready`.

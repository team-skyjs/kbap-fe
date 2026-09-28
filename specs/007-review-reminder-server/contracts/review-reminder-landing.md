# Contract — 리뷰 리마인더 착지·삭제 (007)

## 1. `routeForNotificationData(data)` — `src/lib/push/pushAdapter.ts`

시그니처 무변: `(data: unknown) => string | null`. 입력 타입 힌트 `{ type?: string; orderId?: string | number }` (foodId 제거).

| 입력 | 반환 |
|------|------|
| `{type:'REVIEW_REMINDER', orderId:12}` | `'/profile/order/12'` |
| `{type:'REVIEW_REMINDER', orderId:'12'}` | `'/profile/order/12'` |
| `{type:'REVIEW_REMINDER'}` | `null` |
| `{type:'REVIEW_REMINDER', orderId:'abc'}` · `-1` · `1.5` · `''` · `null` | `null` |
| `{type:'REVIEW_REMINDER', foodId:7}` | `null` |
| 그 외 유형 | specs/005 계약 그대로 |

규칙: `String(orderId)`가 `/^\d+$/`에 맞을 때만 경로. 숫자 변환·트림·대소문자 정규화 없음.

탭 콜백 `(href, notificationId)`: `{type:'REVIEW_REMINDER', orderId:12, notificationId:456}` → `('/profile/order/12', 456)`. 콜드 스타트 1회 전달 무변.

## 2. `notificationAdapter.ts`

```ts
export interface NotificationWire { id: number; title: string; body: string; receivedAt: number; read: boolean; type?: string; orderId?: number | string | null; }
export interface InboxItem { id: number; title: string; body: string; at: string; read: boolean; type?: string; orderId?: string; }
```

`toInboxItem`: `orderId: w.orderId != null ? String(w.orderId) : undefined`. `foodId` 필드 없음(와이어에 와도 무시).

## 3. `notifications.tsx` `open(n)`

`if (!n.read) markRead.mutate(n.id); const href = routeForNotificationData({ type: n.type, orderId: n.orderId }); if (href) openNotificationRoute(router, href);` — 구조 무변, 인자만 교체.

## 4. 삭제 계약(재도입 방지)

| 파일 | 포함하면 안 되는 문자열 |
|------|------------------------|
| `src/lib/push/pushAdapter.ts` | `scheduleNotificationAsync` · `cancelScheduledNotificationAsync` · `kbap.push.reminders` · `REVIEW_REMINDER_SECONDS` |
| `src/features/order/FlippedOrderCard.tsx` | `scheduleReviewReminder` |
| `src/app/food/[id]/review.tsx` | `cancelReviewReminder` |
| `src/lib/i18n/*.json` ×10 | 키 `push.reviewReminderTitle` · `push.reviewReminderBody` |

## 5. 테스트 계약

| 파일 | 변경 |
|------|------|
| `pushAdapter192` | 예약/취소·재예약·권한 없음 케이스 삭제 · 매핑 리마인더 → §1 표 6행 · 리스너 r1~r3·콜드 data를 `orderId`로, 기대 `/profile/order/…` |
| `pushProdGuard221` | `scheduleReviewReminder`·`cancelReviewReminder` 호출·`REVIEW_REMINDER_SECONDS` 잠금 삭제 |
| `pushSurfaces192` | 목의 3항목·타입 유니온 항목 삭제 · 카드 테스트 = `onDone` 호출만 · 취소 소스 잠금 → `not.toContain('cancelReviewReminder')` |
| `orderHistory252` | `beforeModal` 리마인더 기대 삭제 · `afterModal` not.toContain은 유지 가능(무해) |
| `modalSerialize267` · `reviewEditCompose521` | pushAdapter 목에서 삭제된 export 항목 제거 |
| `inbox499` | 항목 3 `orderId:'12'` → `mockNavigate('/profile/order/12')` |
| `useNotifications499` | 어댑터 ① `orderId` 변환·`NEWS orderId:null → undefined` |
| `reviewReminderServer500` (신규) | §4 삭제 계약 전부 + 매핑 `foodId`만 → null |

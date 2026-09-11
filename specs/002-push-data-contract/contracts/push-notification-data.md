# Contract: 푸시 알림 데이터 (서버 → 앱) · 탭 콜백 (앱 내부)

정본 = BE Swagger(dev https://dev.kbap.site/swagger-ui). 아래는 2026-09-11 확정분의 FE 소비 관점 요약.

## 1. Expo Push 메시지 (서버가 보내는 것)

```json
{
  "to": "ExponentPushToken[...]",
  "title": "(광고) 오늘 외식하세요?",
  "body": "... 수신거부: 설정 > 알림",
  "data": { "type": "SCAN_SUGGESTION", "notificationId": 456 },
  "sound": "default",
  "priority": "high",
  "channelId": "news"
}
```

- `title`·`body`: 토큰 등록 시 보고한 `lang`으로 서버가 결정. 광고성 유형은 "(광고)" 접두·수신거부 안내 서버 부착. **앱은 가공하지 않는다.**
- `data.type`: `HELPFUL | SCAN_SUGGESTION | REVIEW_REMINDER | NEWS | MEAL_TIME`.
- `data.foodId`: `REVIEW_REMINDER`만. 숫자 또는 문자열.
- `data.notificationId`: 기기 단위 알림 히스토리 id. 항상 포함(서버 발송분). 숫자(직렬화 차이로 문자열 가능).
- `channelId`: 유형별 — HELPFUL·REVIEW_REMINDER → `activity`, SCAN_SUGGESTION·NEWS·MEAL_TIME → `news`. 앱이 Android에서 이 두 채널을 만든다(activity MAX·news HIGH). `default`는 앱에 없어 폴백 채널(조용함)로 떨어진다. BE 반영: KB-469·470·471 DoD, KB-474 문서화, KB-468 코멘트(2026-09-12).

## 2. 앱 동작 계약

| 입력 `data` | `routeForNotificationData` | 알림함 기록 | 탭 콜백 2번째 인자 |
|-------------|----------------------------|-------------|--------------------|
| `{type:'HELPFUL', notificationId:1}` | `/push-landing?type=HELPFUL` (임시) | `inbox.helpful*` | `1` |
| `{type:'SCAN_SUGGESTION'}` | `/push-landing?type=SCAN_SUGGESTION` (임시) | `inbox.scanSuggestion*` | `undefined` |
| `{type:'MEAL_TIME', notificationId:4}` | `null` (콜백은 `(null, 4)`로 호출) | `inbox.mealTime*` | `4` |
| `{type:'REVIEW_REMINDER', foodId:7}` | `/food/7` (음식 상세) | `inbox.reminder*` (foodId `'7'`) | — |
| `{type:'REVIEW_REMINDER'}` | `null` (콜백 `(null, id)`) | 기록됨 | — |
| `{type:'NEWS', notificationId:3}` | `null` (콜백 `(null, 3)`) | `inbox.news*` | `3` |
| `{type:'NUDGE'}` / `{type:'NOTICE'}` / `{type:'helpful'}` | `null` (콜백 `(null, id)`) | 기록 안 됨 | — |
| `undefined` / `{}` | `null` | 기록 안 됨 | — |
| `{type:'REVIEW_REMINDER', foodId:7, notificationId:'9'}` | `/food/7` | 기록됨 | `'9'` (문자열 그대로) |

## 3. `addNotificationTapListener` (앱 내부 API)

```ts
export function addNotificationTapListener(
  onRoute: (href: string | null, notificationId?: number | string) => void,
): () => void
```

- 탭마다 항상 호출. 이동 없는 유형은 `href = null` — 루트 레이아웃은 `if (href) router.push(href)`로 가드(2026-09-12, Codex 지적 반영).
- Android(`Platform.OS === 'android'`)에서 리스너 등록 시 `setNotificationChannelAsync('activity', { name: t('notif.activityGroup'), importance: MAX, sound: 'default' })` · `('news', { name: t('notif.newsGroup'), importance: HIGH, sound: 'default' })` 각 1회. 실패 무시.
- `FLAGS.pushEnabled === false` 또는 모듈 로드 실패: 채널 설정 포함 expo-notifications 호출 0, no-op 해제 함수 반환.

## 4. i18n 키 (10로케일 `inbox` 네임스페이스)

추가: `scanSuggestionTitle` `scanSuggestionBody` `newsTitle` `newsBody` `mealTimeTitle` `mealTimeBody`
제거: `nudgeTitle` `nudgeBody` `noticeTitle` `noticeBody`
유지: `title` `empty` `emptyBody` `markAllRead` `helpfulTitle` `helpfulBody` `reminderTitle` `reminderBody` `newBadge`

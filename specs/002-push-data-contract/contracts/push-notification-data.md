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
  "channelId": "default"
}
```

- `title`·`body`: 토큰 등록 시 보고한 `lang`으로 서버가 결정. 광고성 유형은 "(광고)" 접두·수신거부 안내 서버 부착. **앱은 가공하지 않는다.**
- `data.type`: `HELPFUL | SCAN_SUGGESTION | REVIEW_REMINDER | NEWS | MEAL_TIME`.
- `data.foodId`: `REVIEW_REMINDER`만. 숫자 또는 문자열.
- `data.notificationId`: 기기 단위 알림 히스토리 id. 항상 포함(서버 발송분). 숫자(직렬화 차이로 문자열 가능).
- `channelId: "default"`: 앱이 Android에서 같은 id로 채널을 MAX 중요도로 설정한다.

## 2. 앱 동작 계약

| 입력 `data` | `routeForNotificationData` | 알림함 기록 | 탭 콜백 2번째 인자 |
|-------------|----------------------------|-------------|--------------------|
| `{type:'HELPFUL', notificationId:1}` | `/profile/reviews` | `inbox.helpful*` | `1` |
| `{type:'SCAN_SUGGESTION'}` | `/scan` | `inbox.scanSuggestion*` | `undefined` |
| `{type:'MEAL_TIME'}` | `/scan` | `inbox.mealTime*` | — |
| `{type:'REVIEW_REMINDER', foodId:7}` | `/food/7/review` | `inbox.reminder*` (foodId `'7'`) | — |
| `{type:'REVIEW_REMINDER'}` | `null` (콜백 미호출) | 기록됨 | — |
| `{type:'NEWS'}` | `null` | `inbox.news*` | — |
| `{type:'NUDGE'}` / `{type:'NOTICE'}` / `{type:'helpful'}` | `null` | 기록 안 됨 | — |
| `undefined` / `{}` | `null` | 기록 안 됨 | — |
| `{type:'HELPFUL', notificationId:'9'}` | `/profile/reviews` | 기록됨 | `'9'` (문자열 그대로) |

## 3. `addNotificationTapListener` (앱 내부 API)

```ts
export function addNotificationTapListener(
  onRoute: (href: string, notificationId?: number | string) => void,
): () => void
```

- 기존 호출부 `(href) => router.push(href)` 그대로 유효.
- Android(`Platform.OS === 'android'`)에서 리스너 등록 시 `setNotificationChannelAsync('default', { name: 'Default', importance: AndroidImportance.MAX, sound: 'default' })` 1회. 실패 무시.
- `FLAGS.pushEnabled === false` 또는 모듈 로드 실패: 채널 설정 포함 expo-notifications 호출 0, no-op 해제 함수 반환.

## 4. i18n 키 (10로케일 `inbox` 네임스페이스)

추가: `scanSuggestionTitle` `scanSuggestionBody` `newsTitle` `newsBody` `mealTimeTitle` `mealTimeBody`
제거: `nudgeTitle` `nudgeBody` `noticeTitle` `noticeBody`
유지: `title` `empty` `emptyBody` `markAllRead` `helpfulTitle` `helpfulBody` `reminderTitle` `reminderBody` `newBadge`

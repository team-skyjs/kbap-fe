# Contract — KB-985 (01_cto_plan.md 계약 표 그대로)

## Expo 푸시 `data` (서버 → 앱)

```json
{ "type": "FOOD_DISCOVERY", "foodId": 6, "notificationId": 98123 }
```

- `type` string, 정확히 `FOOD_DISCOVERY`. `foodId` number(int64, 필수). `notificationId` number(필수).
- Android channelId `news`. 제목·본문은 서버 렌더(예 ko: `(광고) 🌟 삼계탕 드셔보셨어요?`).
- FE: `foodId` 가 없거나 숫자가 아니면 이동 없이 앱만 연다(읽음 처리는 수행).

## `GET /api/notifications` (기존 — FOOD_DISCOVERY 행의 `foodId` 만 변경)

```json
{ "success": true, "payload": [ { "id": 98123, "type": "FOOD_DISCOVERY", "orderId": null, "foodId": 6, "title": "(광고) 🌟 삼계탕 드셔보셨어요?", "body": "어린 닭 한 마리의 뱃속에 찹쌀, 인삼, 대추 등을 넣고 푹 끓인 보양식\n수신거부: 프로필 > 알림 설정", "receivedAt": 1793750400000, "read": false } ], "message": null, "code": null }
```

다른 유형 행은 `foodId: null`. `PATCH /api/notifications/{id}/read` 응답 항목 스키마 동일.

## `push_open` (Amplitude)

`type` 허용값 = `HELPFUL | SCAN_SUGGESTION | REVIEW_REMINDER | NEWS | MEAL_TIME | FOOD_DISCOVERY`. 미지 유형은 속성 생략.

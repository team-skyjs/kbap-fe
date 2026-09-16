# Contract: 알림함 API (서버 → 앱) · KB-499

정본 = BE Swagger(dev https://dev.kbap.site/swagger-ui, 2026-09-16 조회). 아래는 FE 소비 관점 요약. 이전 초안(커서 페이징·전체 읽음·미읽음 수)은 **만들지 않는다**(KB-467 결정).

## 공통

- 인증: JWT 필수(게스트 401). 앱은 회원 확정(`useSession() === true`) 상태에서만 호출한다.
- 헤더(공용 클라이언트 `src/lib/api/client.ts`가 전 요청 자동 첨부 — 추가 코드 0):
  `X-Installation-Id`(필수, 토큰 등록과 같은 값 — 누락·공백·36자 초과 400) · `X-API-Version: 1.1` · `X-OS-Version` · `X-App-Version` · `Accept-Language` · `Authorization: Bearer`.
- 봉투: `{ success: boolean, payload, message?, code? }` — 클라이언트가 `payload`를 벗겨 반환(`api.get<T>` 기존 동작).
- 범위: **기기(installation) 단위**. 같은 회원의 다른 기기 알림·읽음은 보이지 않는다.

## GET /api/notifications — 최근 7일 목록

- 파라미터: 없음.
- 응답 `payload: NotificationResponse[]` — 회원 본인 + 요청 기기, 최근 168시간, **id 내림차순(최신순)**, 전부.

```json
[
  { "id": 456, "title": "(광고) 오늘 외식하세요?", "body": "… 수신거부: 설정 > 알림", "receivedAt": 1789540000000, "read": false }
]
```

| 필드 | 타입 | 필수 |
|------|------|------|
| `id` | int64 | ✓ |
| `title` | string | ✓ (발송 시점 기기 언어 저장분, 앱 가공 0) |
| `body` | string | ✓ |
| `receivedAt` | int64 epoch **ms** | ✓ |
| `read` | boolean | ✓ |

`readAt` 없음. 오류: 400(헤더 불량) · 401(비회원).

**확장 요청분(2026-09-16, clarify Q2 → BE kbap-16 전달, dev 배포 대기)** — 목록·읽음 응답 항목 공통:

| 필드 | 타입 | 필수 | 의미 |
|------|------|------|------|
| `type` | string | ✓(배포 후) | 푸시 `data.type`과 같은 enum: `HELPFUL` `SCAN_SUGGESTION` `REVIEW_REMINDER` `NEWS` `MEAL_TIME`. 구 행은 저장 문자열 그대로 가능(앱은 미지 유형 = 이동 없음) |
| `foodId` | int64, nullable | — | `REVIEW_REMINDER`만 값, 그 외 null |

X-API-Version 불변(가산 필드). 앱 어댑터는 두 필드를 **옵션**으로 읽어 배포 전 응답에서도 동작한다(이동만 비활성).

## PATCH /api/notifications/{notificationId}/read — 읽음 처리

- 본문 없음. **멱등** — 이미 읽은 항목도 200.
- 응답 `payload: NotificationResponse`(갱신 항목, `read: true`).
- 404 `NOTIFICATION-002`: 타인·다른 기기·부재 알림(구분 없음). 7일 지난 알림은 정상 처리(200).
- 앱 호출 지점: 알림함 항목 탭(미읽음만; 탭 후 `type`·`foodId`로 푸시 탭과 같은 이동) · 푸시 탭(`data.notificationId`, 회원 기기만).

## 사용하지 않는 것

`GET /api/notifications/settings`·`PATCH …/settings`(KB-497 기존) · `PUT /api/notifications/tokens`(KB-496 기존) — 이 작업 무관. `POST /api/admin/notifications/test-push`(관리자, `{ memberId }`) — 실기 검증용, 앱 호출 0.

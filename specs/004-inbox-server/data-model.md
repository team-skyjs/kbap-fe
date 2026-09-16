# Data Model: 알림함 서버 전환 (KB-499)

2026-09-16 clarify 반영: 응답 `type`·`foodId`(BE 확장 요청, dev 배포 대기) · 게이트 문맥 엔티티 삭제(로그인 직행) · zh 일 단위 문구 공백.

## 1. 엔티티

### NotificationWire (서버 응답 항목 — Swagger `NotificationResponse`)

| 필드 | 타입 | 필수 | 의미 |
|------|------|------|------|
| `id` | number (int64) | ✓ | 알림 행 id. 기기 단위. 푸시 `data.notificationId`와 같은 값 |
| `title` | string | ✓ | 발송 시점 기기 언어로 저장된 제목(앱 가공 0) |
| `body` | string | ✓ | 본문(광고성은 "(광고)"·수신거부 안내 서버 부착) |
| `receivedAt` | number (epoch ms) | ✓ | 도착 시각 |
| `read` | boolean | ✓ | 이 기기에서 읽음 여부 |
| `type` | string | ✓(BE 배포 후) | 푸시 `data.type`과 같은 enum `HELPFUL SCAN_SUGGESTION REVIEW_REMINDER NEWS MEAL_TIME`. 구 행은 저장 문자열 그대로 가능. **배포 전 응답엔 없음 — 앱은 옵션으로 읽는다** |
| `foodId` | number \| string \| null | — | `REVIEW_REMINDER`만 값, 그 외 null. 직렬화 차이로 문자열 가능(푸시 규약과 동일) |

`readAt` 없음.

### InboxItem (앱 도메인 — `notificationAdapter.toInboxItem`)

| 필드 | 타입 | 규칙 |
|------|------|------|
| `id` | number | 와이어 그대로 |
| `title` | string | 그대로 |
| `body` | string | 그대로 |
| `at` | string (ISO 8601) | `new Date(receivedAt).toISOString()`. `receivedAt`이 유한수가 아니면 현재 시각(방금 전 표기) |
| `read` | boolean | 그대로 |
| `type` | string \| undefined | 와이어 `type` 그대로(없으면 undefined). 검증은 `routeForNotificationData`가 함(미지 = 이동 없음) |
| `foodId` | string \| undefined | 와이어 `foodId`가 null/undefined가 아니면 `String()`; 아니면 undefined |

기존 `InboxItem`(`titleKey/bodyKey/data`)과 필드가 다르다 — 화면의 `t(item.titleKey)` 2곳이 서버 문자열로 바뀌고, 이동 입력은 `{ type: item.type, foodId: item.foodId }`.

### 목록 (query `['notifications']`)

- 값: `InboxItem[]`, 서버 순서(id 내림차순 = 최신순) 그대로. 클라 정렬·필터 0.
- 범위: 회원 본인 + 요청 기기(X-Installation-Id) + 최근 168시간.
- 활성: `useSession() === true`. 게스트·미확정 = 비활성(`data` undefined).
- 캐시 수명: `staleTime 0`. 계정 경계 `queryClient.clear()`로 소멸.

### 미읽음 수 (파생)

`unread = items.filter(i => !i.read).length` — `useUnreadCount()`가 `select`로 계산. 쿼리 비활성이면 0. 헤더 배지는 `> 0`이면 기존 "NEW" 필(개수 텍스트 아님 — clarify Q1 확정, KB-430 표시 무변).

## 2. 상태 전이

### 항목 탭 (낙관 읽음 + 이동)

```
[unread] --tap--> [read (낙관, PATCH 진행)] --200--> [read (서버 확정)] --onSettled--> invalidate
                                          --error--> [unread (스냅샷 복원, 세대 일치 시만)] --onSettled--> invalidate
[read]   --tap--> (읽음 변화 없음, 요청 0)
어느 경우든 탭 직후: href = routeForNotificationData({type, foodId}); href면 router.push(href), null이면 알림함 유지
```

- 롤백 조건: `ctx.gen === currentGen()`. 뮤테이션 중 로그아웃·계정 전환이 있었으면 복원하지 않는다.
- 404(`NOTIFICATION-002`)도 error 경로. 이후 invalidate가 서버 값을 가져온다.
- 이동은 읽음 결과를 기다리지 않는다(spec US3 ③ "화면 이동은 그대로 진행").

### 푸시 탭 (`onPushTapped(notificationId)`)

```
탭 → hasBeSession()? ── false → 종료(이동만)
                     └─ true → PATCH read (실패 무시) → invalidate → (기존) href 있으면 이동
```

### 화면 상태

```
!FLAGS.notificationCenter ─────────────────→ <Redirect href="/" />
useIsGuest() true ─────────────────────────→ <Redirect href="/login?returnTo=%2Fnotifications" /> (목록 렌더 0)
그 외:
  isError && !data ────────────────────────→ [에러 블록 + 재시도(refetch) + 뒤로]
  isPending(fetch 중 또는 세션 미확정) ─────→ [SkeletonInbox]
  data.length === 0 ───────────────────────→ [EmptyBlock inbox.empty]
  data.length > 0 ─────────────────────────→ [FlatList 행: title·body·timeAgo(at)·unread 배경/점]
```

로그인 복귀: 로그인 화면이 `returnTo`로 `router.replace('/notifications')` → 세션 true → 목록 렌더. 로그인 화면 뒤로 = 종 아이콘이 있던 탭(Redirect가 replace라 백스택에 알림함 없음).

### 무효화 트리거

앱 시작(마운트) · AppState `active` · 푸시 수신(포그라운드) · 알림센터 잔존분 조회(부팅) · 푸시 탭 · 읽음 onSettled · 화면 재진입(staleTime 0).

## 3. 상대 시각 규칙 (`timeAgo(at, t)` — 기존 함수)

`mins = floor((now - at) / 60_000)`

| 조건 | 키 | ko | en |
|------|----|----|----|
| `mins < 1` (미래 포함) | `community.justNow` | 방금 전 (변경) | Just now |
| `1 ≤ mins < 60` | `community.minsAgo {count}` | {{count}}분 전 | {{count}}m ago |
| `1 ≤ hours < 24` (`hours = floor(mins/60)`) | `community.hoursAgo {count}` | {{count}}시간 전 | {{count}}h ago |
| `hours ≥ 24` (`days = floor(hours/24)`) | `reviews.daysAgo {count}` | {{count}}일 전 | {{count}}d ago |

경계 9종(SC-002): 59s→방금 전 · 60s→1분 전 · 59m→59분 전 · 60m→1시간 전 · 23h→23시간 전 · 24h→1일 전 · 47h→1일 전 · 48h→2일 전 · +5m(미래)→방금 전.

## 4. i18n 키 증감 (10로케일 동일)

| 네임스페이스 | 제거 | 추가 | 변경 |
|------|------|------|------|
| `inbox` | `markAllRead` `helpfulTitle` `helpfulBody` `reminderTitle` `reminderBody` `scanSuggestionTitle` `scanSuggestionBody` `newsTitle` `newsBody` `mealTimeTitle` `mealTimeBody` | — | — |
| `community` | — | — | ko `justNow` "방금"→"방금 전" |
| `reviews` | — | — | zh-Hans·zh-Hant `daysAgo` "{{count}} 天前"→"{{count}}天前" |

신설 키 없음(게이트 시트 폐기). 유지: `inbox.title` `inbox.empty` `inbox.emptyBody` `inbox.newBadge` · `community.minsAgo/hoursAgo` · `reviews.daysAgo`.

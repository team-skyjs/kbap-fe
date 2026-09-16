# Quickstart: 알림함 서버 전환 검증 (KB-499)

계약은 [contracts/notifications-api.md](./contracts/notifications-api.md), 앱 내부 계약은 [contracts/inbox-ui.md](./contracts/inbox-ui.md), 상태 전이는 [data-model.md](./data-model.md). 2026-09-16 clarify 반영(항목 탭 이동·게스트 로그인 직행·모두 읽음 제거·zh 공백).

## 0. 전제

- 브랜치 `feat/kb499-inbox-server`(워크트리), base develop. `npm install` 완료.
- dev BE: `EXPO_PUBLIC_BE_BASE=https://dev.kbap.site`. 실기 검증 회원 = 앱 알림 설정에서 **소식 동의 2종 + 소식 수신 ON**(관리자 테스트 발송이 NEWS 유형이라 동의 없으면 `sent=0` — KB-499 코멘트 9/11).
- **BE 응답 확장(`type`·`foodId`) dev 배포 여부**를 Swagger `NotificationResponse`에서 먼저 확인한다. 미배포면 §3의 항목 탭 이동 항목은 "검증 불가"로 기재하고 나머지를 진행한다.

## 1. 유닛 (구현 중 반복)

```bash
npx jest src/lib/data/__tests__/useNotifications499 src/app/__tests__/inbox499 src/features/community/__tests__/timeAgo499 src/lib/i18n/__tests__/inboxKeys498 src/app/__tests__/design4Home430 src/app/__tests__/homeFeed317
```

기대 케이스(각 스위트가 잠그는 버그):

1. **어댑터** — `{id:1,title,body,receivedAt:1789540000000,read:false}` → `at === '2026-09-16T…Z'`(ISO), 나머지 동일, `type`·`foodId` undefined. `receivedAt: NaN` → `at`이 유효 ISO(현재 시각). `{…, type:'REVIEW_REMINDER', foodId: 7}` → `foodId === '7'`; `foodId: null` → undefined.
2. **목록·파생** — `api.get` 목 3건(read f/f/t) → `useInbox().data.length 3`, `useUnreadCount() === 2`, 순서 서버 그대로.
3. **세션 게이트** — 세션 `null`·`false`: `api.get` 호출 0, `useUnreadCount() === 0`. `true`로 전환 시 fetch 1회.
4. **낙관·롤백** — 미읽음 탭 → 즉시 `read true`·배지 −1 → PATCH reject → **그 항목만** `read false`·배지 원복, GET 0. PATCH resolve → 응답 항목으로 교체, GET 0. 연달아 탭(A 실패·B 성공 / 둘 다 실패)에서 서로 간섭 0(Codex #163).
5. **세대 가드(계정 생애주기)** — 뮤테이션 진행 중 `bumpSessionGen()` + `qc.clear()` → PATCH reject 시 캐시에 `prev`가 되살아나지 않는다(`getQueryData === undefined`).
6. **읽은 항목 탭** — `mutate` 0회.
7. **onPushTapped** — `hasBeSession` true + id 7 → `api.patch('/api/notifications/7/read')` 1회 + invalidate. `'9'`(문자열) → 9. 게스트(false) → patch 0·invalidate 0. id 없음 → 0.
8. **헤더 단언(DoD)** — 실클라이언트 + fetch 목(`installationId204` 방식): `fetchNotifications()`·`markNotificationRead(3)` 각 URL(`…/api/notifications`, `…/api/notifications/3/read`, PATCH)과 `X-Installation-Id` 헤더 값.
9. **화면 3상태** — `isPending` → `skeleton-inbox` 있고 `inbox-*` 행 0 · `isError` → `query-error-block`, 재시도 탭 = `refetch` 1회 · `data []` → `notif-empty`.
10. **행 렌더·탭** — `title/body` 서버 문자열 그대로(`t()` 미경유), `at` 5분 전 → "5분 전"(ko). 미읽음 행 탭 → `mutate(id)` 1회. 이동: `type:'REVIEW_REMINDER', foodId:'7'` → `router.push('/food/7')` 1회 · `type` 없음 → push 0 · `type:'NEWS'` → push 0 · 읽은 행 탭 → `mutate` 0·이동은 유형대로.
11. **게스트 게이트** — `useIsGuest` true → `Redirect` 렌더(href `/login?returnTo=%2Fnotifications`), `inbox-*`·`skeleton-inbox`·`SubHeader` 0. `useUnreadCount` 0. `AuthGateSheet` 문자열이 `notifications.tsx`에 부재.
12. **프레임 불변** — `inbox-n1`(unread)·`inbox-n2`(read) flatten 스타일에서 `backgroundColor` 제거 후 `toEqual`.
13. **소스 잠금** — `src/` 전체 grep: `notifications/inbox` `kbap.inbox` `recordInboxNotification` `markAllInboxRead` 0. `notifications.tsx`에 `AuthGateSheet`·`inbox-mark-all`·`relativeDate` 부재, `routeForNotificationData`·`timeAgo` 존재. 기존 잠금 유지: `deleteEmpty329`·`parityDsHome486` 리터럴.
14. **timeAgo 경계 9종** — 59s→방금 전 · 60s→1분 전 · 59m→59분 전 · 60m→1시간 전 · 23h→23시간 전 · 24h→1일 전 · 47h→1일 전 · 48h→2일 전 · 미래 5m→방금 전 (`Date.now` 고정, ko 리소스 실값).
15. **i18n 패리티** — 10로케일 `inbox` 키 집합 == ko(4키) · 제거 11키 부재 · `community.justNow/minsAgo/hoursAgo`·`reviews.daysAgo` 비어 있지 않음(`{{count}}` 포함) · ko `community.justNow === '방금 전'` · zh-Hans·zh-Hant `reviews.daysAgo`에 공백 없음(`/^\{\{count\}\}天前$/`). `gate.*` 신설 키 없음.

## 2. 전체 게이트 (PR 전)

```bash
npx tsc --noEmit          # 0 오류
npx jest                  # 전체 통과 (기준 직전: 209스위트 1423/1423 — inbox216 삭제·신규 3 반영해 개수 갱신)
grep -rn "notifications/inbox\|kbap.inbox\|recordInboxNotification\|markAllInboxRead" src   # 0건 (SC-007)
```

## 3. dev 실기 (DoD — PR 본문에 결과 기재)

1. dev 빌드 로그인(회원 A, 기기 1). 프로필 > 알림에서 소식 동의·수신 ON. 종 아이콘 배지 없음(알림 0) 확인.
2. `POST /api/admin/notifications/test-push { memberId: A }` (관리자 세션, Swagger UI) 1회 — **앱 포그라운드**. 배너 도착 → 헤더 배지 NEW → 알림함 진입: 1건, 제목·본문 = 푸시 문자열, "방금 전".
3. 앱 **종료** 후 테스트 발송 1회 → 앱 재실행 → 배지 NEW → 알림함 2건 최신순(SC-001). 이후 몇 분 뒤 재진입 → "N분 전".
4. 항목 탭 → 즉시 강조 해제·배지 감소(1건 남으면 NEW 유지, 0건이면 소멸). Swagger `GET /api/notifications`로 `read:true` 확인. BE 확장 배포 후: NEWS 항목 탭 = 알림함 유지, 리마인더 항목(주문 후 서버 발송분) 탭 = 음식 상세 이동. 미배포면 "이동 검증 불가" 기재.
5. 앱 백그라운드에서 테스트 발송 → 푸시 **탭**으로 진입 → 알림함에서 해당 항목 이미 읽음·배지 반영(FR-009).
6. 비행기 모드 → 알림함 진입 → 오프라인 안내 + 재시도 → 해제 후 재시도 탭 → 목록 복귀.
7. 게스트(로그아웃) → 종 아이콘 탭 → 로그인 화면 직행(알림함 한 순간도 미표시), 배지 없음 → 뒤로 = 종 아이콘이 있던 탭 → 다시 종 → 로그인 완료 → 알림함 열림.
8. 기기 2대(같은 회원, 언어 다르게) — 각 기기에 자기 언어 알림만, 기기 1 읽음이 기기 2에 반영되지 않음(SC-006, 계약상 기기 단위).
9. 로그아웃·다른 계정 로그인 직후 알림함/배지에 이전 계정 값 없음(FR-011).

## 4. 발행

이 작업은 코드·테스트·PR까지. OTA 발행은 예진 승인 후 별도(JS-only라 fingerprint 회전 없음 — 발행 시 ota-* 스킬 절차).

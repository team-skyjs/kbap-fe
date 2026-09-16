# Research: 알림함 서버 전환 + 도착 시각 상대 표기 (KB-499)

Technical Context에 NEEDS CLARIFICATION은 없었다(스택·의존성·테스트 전부 기존). 계약 정본은 dev Swagger(2026-09-16 조회)이며 Jira KB-499 본문·KB-498 계약 문서와 일치한다. 아래는 설계 결정 12건. **2026-09-16 /speckit-clarify 5문항 반영**: R-3(응답 `type`·`foodId` 추가 요청)·R-5(항목 탭 이동 복구)·R-8(게이트 시트 → 로그인 직행)·R-10(zh 공백·게이트 키 없음).

## R-1. 데이터 계층 — react-query 훅 1파일, 로컬 스토어 삭제

- **Decision**: `src/lib/notifications/inbox.ts`(AsyncStorage `kbap.inbox.v1`·`useSyncExternalStore`)를 **삭제**하고 `src/lib/data/useNotifications.ts`를 신설한다. `useQuery(['notifications'])` 1개가 목록·배지의 단일 소스. `staleTime: 0`(설정 훅 `useNotificationSettings`와 동일 — 화면 진입마다 서버 재확인). 내보내기: `NOTIFICATIONS_KEY` · `fetchNotifications` · `markNotificationRead(id)` · `useInbox()`(쿼리 결과) · `useUnreadCount()`(`select`로 `read===false` 개수 파생) · `useMarkRead()`(낙관 뮤테이션) · `invalidateNotifications()`(공유 queryClient) · `onPushTapped(notificationId)`.
- **Rationale**: 미읽음 수 엔드포인트가 없어(KB-467 결정) 배지는 목록 파생이 유일한 방법이며, 파생은 `select`로 같은 쿼리를 공유해 요청 1회. 헤더 3곳은 import 경로 1줄만 바뀐다. 선례 훅(`useNotificationSettings.ts`)과 같은 골격이라 리뷰 부담 최소.
- **Alternatives considered**: 기존 파일 경로를 유지하며 내부만 교체 — "notifications/inbox = 로컬 목" 주석·플래그 설명·SC-007(로컬 기록 코드 잔존 0)과 어긋나고, 레포 관례(데이터 훅 = `src/lib/data/`)에도 맞지 않아 기각. `useInfiniteQuery` — 페이징 없음(계약 확정)이라 기각.

## R-2. 쿼리 활성 조건 — `useSession() === true`

- **Decision**: 목록 쿼리 `enabled`는 `useSession() === true`(회원 확정)만. 게스트(`false`)·부팅 미확정(`null`) 모두 요청 0, `useUnreadCount()` = 0.
- **Rationale**: Jira는 `!useIsGuest()`를 제안했으나 `useIsGuest`는 미확정(null)을 "게스트 아님"으로 취급해 콜드 스타트 게스트 기기에서 401 요청이 한 번 나간다. 401은 `handleUnauthorized`가 토큰 없음이면 무해하게 넘기지만 요청 자체가 불필요하다. 세션 스토어는 동기 `useSyncExternalStore`(P-205)라 경계 전환 즉시 리렌더된다. 유닛에서도 기본 세션 null → 헤더를 렌더하는 기존 스위트가 실제 GET을 치지 않는다(R-11 파급 축소).
- **Alternatives considered**: `!useIsGuest()` — 위 사유로 기각. `hasBeSession()`(비동기) — 훅 안에서 쓰기 번거롭고 세션 스토어가 이미 같은 사실을 동기 제공.

## R-3. 어댑터 — 와이어 5필드 → `InboxItem`, 시각은 ISO 문자열 `at`

- **Decision**: `src/lib/api/notificationAdapter.ts` 신설. `NotificationWire { id:number; title; body; receivedAt:number(epoch ms); read:boolean; type?:string; foodId?:number|string|null }` → `InboxItem { id:number; title; body; at:string(ISO); read; type?:string; foodId?:string }`. `receivedAt`이 유한수가 아니면 현재 시각으로 대체(`// ponytail:` 주석 — "방금 전"으로 보이며 목록 전체가 깨지지 않게). `type`·`foodId`는 **clarify Q2로 BE에 추가 요청한 필드**(2026-09-16, dev 배포 대기) — 어댑터는 없으면 `undefined`로 통과시키고, `foodId`는 `String()`으로 정규화(푸시 데이터 규약과 동일).
- **Rationale**: 기존 `InboxItem.at`이 ISO 문자열이라 R-4의 `timeAgo(iso, t)` 시그니처를 건드리지 않는다. 어댑터 파일 분리는 레포 관례(`src/lib/api/*Adapter.ts` 9개)와 Jira DoD("어댑터 변환 유닛") 준수. `type`·`foodId`를 옵션으로 두어 BE 배포 전·후 어느 응답이든 깨지지 않는다(배포 전 = 이동 없음).
- **Alternatives considered**: 훅 파일에 인라인 — 관례·DoD 어긋남. `receivedAt: Date` 보관 — 캐시에 Date 객체, `timeAgo` 시그니처 변경 필요. 기각.

## R-4. 상대 시각 — 기존 `timeAgo` 재사용, ko `justNow`만 "방금 전"

- **Decision**: `src/features/community/parts.tsx`의 `timeAgo(iso, t)`를 그대로 import한다. 4단계(`community.justNow` / `community.minsAgo` / `community.hoursAgo` / `reviews.daysAgo`)가 spec FR-004와 정확히 일치하고 키는 10로케일 전부 존재. 내림·24~47h=1일·미래(음수 분 → `< 1` → 방금)까지 충족. 변경은 **ko.json `community.justNow` "방금" → "방금 전"** 1줄(스펙 문구). 화면의 `relativeDate`(reviews.today 기반, 당일 전부 "오늘")는 삭제.
- **Rationale**: 사다리 2단 — 이미 있는 헬퍼. 커뮤니티 글 화면도 같은 문구를 쓰게 되는데 "방금"→"방금 전"은 의미 동일·자연스러운 통일. 나머지 9로케일의 justNow("Just now"·"たった今" 등)는 이미 "방금 전" 의미.
- **Alternatives considered**: `inbox.justNow` 등 알림 전용 키 4종×10로케일 신설 — 중복. 기각. `timeAgo`를 `src/lib/`로 이동 — 호출부 3곳 변경만 늘고 이득 없음. 기각. 복수형(`_one/_other`) 도입 — 기존 키가 축약·수량어 표기로 단복수 문제를 회피(en "3m ago")하고 있어 불필요.
- **테스트**: `src/features/community/__tests__/timeAgo499.test.ts` — 경계 9종(59s·60s·59m·60m·23h·24h·47h·48h·미래) `Date.now` 고정.

## R-5. 항목 탭 = 읽음 + 푸시 탭과 같은 이동 · "모두 읽음" 제거 (clarify Q2·Q3, 2026-09-16 개정)

- **1차 결정(폐기)**: 서버 응답에 `type`·`data`가 없어 "읽음만, 이동 없음"으로 잡았다.
- **Decision**: clarify Q2에서 종한이 BE 확장을 택했다 — BE가 `GET /api/notifications`·`PATCH …/read` 응답 항목에 `type`(푸시 `data.type`과 같은 enum)·`foodId`(REVIEW_REMINDER만, 그 외 null)를 추가한다(요청 프롬프트 전달 2026-09-16, dev 배포 후 Swagger 재확인). 항목 탭 = `if (!item.read) markRead.mutate(item.id)` → `const href = routeForNotificationData({ type: item.type, foodId: item.foodId }); if (href) router.push(href)`. 유형이 없거나 미지 유형이면 `routeForNotificationData`가 `null`을 돌려 알림함에 머문다(FR-008 개정). 전체 읽음 엔드포인트가 없으므로 헤더 trailing "모두 읽음"(`inbox-mark-all`·`inbox.markAllRead`)은 제거(Q3 확정). 이미 읽은 항목 탭은 뮤테이션 없이 이동만(FR-007 ④).
- **Rationale**: 푸시 탭과 알림함 탭이 같은 함수(`routeForNotificationData`)를 쓰므로 이동 규칙 SSOT 1곳(착지 결정 변경 시 한 곳만 수정). BE 배포 전에도 FE는 머지 가능 — 필드가 없으면 자동으로 이동 없음.
- **Alternatives considered**: 제목 문자열 매칭으로 유형 추정 — 언어별 문자열이라 불가. 클라 반복 PATCH로 "모두 읽음" 흉내 — N요청·부분 실패 상태 혼선. 기각.
- **의존**: BE 응답 확장 dev 배포. 미배포 상태로 실기하면 항목 탭 이동은 검증 불가(읽음만 검증).

## R-6. 읽음 뮤테이션 — 낙관·롤백·세션 세대 가드

- **Decision**: `useMutation(markNotificationRead)`. `onMutate`: `cancelQueries` + 스냅샷 + 해당 id `read:true`로 `setQueryData`, `{prev, gen: currentGen()}` 반환. `onSuccess`: 응답 항목으로 그 id만 교체. `onError`: `gen === currentGen()`일 때만 스냅샷 복원. `onSettled`: `invalidateNotifications()`(FR-010 "읽음 처리 후 재조회"). `useSubmitGuard` 미사용(멱등 낙관 토글 — CLAUDE.md 예외·훅 주석 명시).
- **Rationale**: 설정 훅과 같은 형식. 세대 가드는 계정 전환 중 롤백이 이전 계정 목록을 캐시에 되살리는 것을 막는다(P-147 계열 — Codex #150 P1과 같은 결함 유형). 404(`NOTIFICATION-002`: 타 기기·부재)도 롤백 후 재조회로 서버 값이 정본이 된다.
- **Alternatives considered**: 응답 무시하고 invalidate만 — 낙관 깜빡임 가능. 세대 가드 생략 — 위 결함 재발. 기각.

## R-7. 무효화 시점 5곳

| 시점 | 배선 | 비고 |
|------|------|------|
| 앱 시작 | 탭 헤더의 `useUnreadCount()` 마운트 → 첫 fetch | 추가 코드 0 |
| 포그라운드 복귀 | `src/app/_layout.tsx` 기존 `AppState` 리스너(`app_opened` 트래킹 자리)에 `invalidateNotifications()` 1줄 | 공유 훅 신설 안 함 |
| 포그라운드 푸시 수신·알림센터 잔존분·탭 진입 | `pushAdapter.addNotificationTapListener`의 `record()`를 `invalidateNotifications()` 지연 require로 교체(유형 검사 제거 — 어떤 푸시든 목록 재조회) | 기존 lazy-require 슬롯 그대로 |
| 푸시 탭 | `_layout.tsx` 콜백 `(href, notificationId)` → `onPushTapped(notificationId)` 후 기존 `if (href) router.push` | 2번째 인자는 KB-498에서 이미 전달 중·현재 폐기되던 값 |
| 읽음 처리 후 | 뮤테이션 `onSettled` | R-6 |
| 화면 재진입 | `staleTime: 0` + 헤더 옵저버가 쿼리를 살려 두므로 화면 마운트 = refetch | 추가 코드 0 |

- **Decision**: 위 표대로. 게스트/미확정은 쿼리가 비활성이라 invalidate가 no-op.
- **`onPushTapped(id)`**: `await hasBeSession()`(콜드 스타트엔 세션 스토어가 null일 수 있어 토큰 기반 비동기 판정 — `registerPushToken`과 같은 방식) → false면 종료(게스트 = 이동만, FR-009) → `markNotificationRead(id)` 실패 무시 → `invalidateNotifications()`. 7일 지난 알림도 서버가 처리(Jira 계약).

## R-8. 게스트 = 로그인 화면 직행 (clarify Q5, 2026-09-16 개정)

- **1차 결정(폐기)**: `AuthGateSheet` 신규 문맥 `notifications` + `gate.notifTitle/Sub` 10로케일.
- **Decision**: `src/app/notifications.tsx`에서 `useIsGuest()`면 `<Redirect href={`/login?returnTo=${encodeURIComponent('/notifications')}`} />`(플래그 Redirect 다음 줄). 시트·문구·`AuthGateSheet` 변경 0. 헤더 3곳 `onBell` 무변.
- **Rationale**: 종한 결정 "비회원이 종 아이콘을 누르면 로그인 화면으로 이동". 로그인 화면은 이미 `returnTo`를 받아 완료 시 `router.replace(returnTo)`하므로 알림함 복귀 배선 0. `Redirect`는 replace라 히스토리가 `[탭, 로그인]`이 되어 로그인 화면의 뒤로 가기(`canGoBack` 가드)가 종 아이콘이 있던 탭으로 돌아간다. 라우트 가드 1곳이라 딥링크도 방어.
- **Alternatives considered**: 헤더 3곳 `onBell`에서 게스트 분기 — 배선 3곳·딥링크 미방어. `AuthGateSheet` — 결정으로 폐기. `router.push('/login')` — 백스택에 알림함 빈 화면이 남음. 기각.
- **부팅 미확정(null)**: 게스트 아님으로 취급 → 스켈레톤(쿼리 `isPending`, fetch 없음). 세션 확정 후 자연 전환.

## R-9. 화면 상태 3종 + 프레임 불변

- **Decision**: `isError && !data` → `QueryErrorBlock(error, onRetry=refetch, onGoBack)` / `isPending` → `SkeletonInbox`(신설, `Skeleton.tsx`에 P-287 프리미티브로 행 3개: 패딩 16·바 3줄·헤어라인 — 실제 행 골격 미러) / 그 외 `FlatList`(빈 상태 = 기존 `EmptyBlock` 인라인 센터 구조 유지). 행은 `title`(서버 문자열)·`body`·`timeAgo(item.at)`. unread 스타일은 `rowUnread`(배경색만) + 고정 `dotSlot` 그대로.
- **Rationale**: CLAUDE.md "원격 데이터 표면 = 스켈레톤 기본 + 실패 폴백 필수", spec FR-013·SC 빈 목록 위장 금지. 기존 `SkeletonList`는 배너+썸네일 골격이라 시프트가 커 부적합. 소스 잠금 유닛 2개(`deleteEmpty329`: `items.length === 0 && { flexGrow: 1 }`·`justifyContent: 'center'`~`notif-empty` / `parityDsHome486`: `title: { fontSize: 15, fontWeight: '700'`)를 깨지 않도록 해당 리터럴 유지.
- **프레임 불변 유닛**: 읽음/미읽음 두 행의 flatten 스타일에서 `backgroundColor`를 제외한 나머지가 동일함을 단언(P-138① 방식).

## R-10. i18n 정리

- **Decision**: 10로케일 `inbox` 네임스페이스에서 죽는 키 11개 제거 — `markAllRead` + `helpfulTitle/Body`·`reminderTitle/Body`·`scanSuggestionTitle/Body`·`newsTitle/Body`·`mealTimeTitle/Body`. 유지: `title`·`empty`·`emptyBody`·`newBadge`. 신설 키 **없음**(게이트 시트 폐기 — R-8). 변경: ko `community.justNow` "방금"→"방금 전" · zh-Hans/zh-Hant `reviews.daysAgo` "{{count}} 天前"→"{{count}}天前"(clarify Q4 A+, 분·시간 문구와 공백 통일). `inboxKeys498.test.ts`를 갱신(REQUIRED 축소·제거 키 부재·상대 시각 4키 10로케일 존재·ko justNow·zh 공백 0).
- **Rationale**: 서버 문자열 사용으로 앱이 문구 키로 제목을 만들지 않는다(FR-002). 로컬 리마인더 알림 본문은 `push.reviewReminderTitle/Body`를 써서(pushAdapter 확인) `inbox.reminder*` 제거가 안전. 죽은 키 방치는 "빈 제목" 회귀 탐지 유닛의 의미를 흐린다. 10로케일 상대 시각 4키 검토(Q4): 9로케일 justNow는 이미 "방금 전" 의미, 축약형이라 복수 굴절 문제 없음 — ko 1줄·zh 공백 2줄만 변경.
- **Alternatives considered**: 키 보존 — SC-007 정신(로컬 기록 잔존 0)과 어긋남. 기각.

## R-11. 테스트 파급

- **삭제**: `src/lib/notifications/__tests__/inbox216.test.ts`(로컬 스토어 스위트 — FR-015).
- **갱신**: `src/app/__tests__/design4Home430.test.tsx`(`jest.mock('@/lib/notifications/inbox')` → `@/lib/data/useNotifications`, 목 항목을 `{id:number,title,body,at,read}`로) · `src/app/__tests__/homeFeed317.test.tsx`(같은 목 경로) · `src/lib/i18n/__tests__/inboxKeys498.test.ts`(R-10).
- **신규**: `src/lib/data/__tests__/useNotifications499.test.tsx`(어댑터·목록·미읽음 파생·세션별 비활성·낙관/롤백/세대 가드·`onPushTapped` 회원/게스트·실클라이언트 fetch 목으로 두 요청의 URL+`X-Installation-Id` 단언) · `src/app/__tests__/inbox499.test.tsx`(스켈레톤·에러 재시도·빈·목록·탭=뮤테이션+유형별 이동/유형 없으면 이동 0·게스트 로그인 Redirect·프레임 불변·소스 잠금: `notifications/inbox`·`kbap.inbox`·`markAllRead`·`AuthGateSheet` 부재) · `src/features/community/__tests__/timeAgo499.test.ts`(R-4).
- **파급 예측**: 삭제된 모듈을 `jest.mock`하는 스위트는 "Cannot find module"로 즉시 실패하므로 위 2개는 필수. 헤더를 렌더하는 나머지 스위트는 세션 null → 쿼리 비활성이라 GET 0(R-2)·기존 `QueryClientProvider` 보유(홈·리뷰 피드는 이미 react-query 사용). 정본은 `npx jest` 전체 실행.

## R-12. 범위 밖으로 남기는 것

- 로컬 리뷰 리마인더 예약/발화(KB-500, 할 일) — 발화 시 알림함 기록만 사라지고 OS 알림은 그대로. 서버 행이 없어 알림함엔 안 보인다(spec Assumptions).
- 기기 AsyncStorage `kbap.inbox.v1` 잔존 데이터 — 읽는 코드가 없으니 무해(수 KB). 마이그레이션·삭제 코드 넣지 않음(spec Edge Cases).
- `src/app/(tabs)/community.tsx`의 미사용 `IconBell` import·`bell` 스타일, `inbox.emptyBody` 미사용 키 — 이 티켓과 무관.
- 알림함 열람·항목 탭 계측 이벤트 — spec 요구 없음. `QueryErrorBlock`의 `error_state_view`만 자동.
- BE 응답 `type`·`foodId` 추가 자체(BE 작업, kbap-16). FE는 필드 유무 양쪽에서 동작.

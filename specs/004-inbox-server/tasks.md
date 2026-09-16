# Tasks: 알림함 서버 전환 + 도착 시각 상대 표기 (KB-499)

**Input**: Design documents from `/specs/004-inbox-server/` — plan.md · spec.md(Clarifications 2026-09-16 5문항 반영) · research.md(R-1~R-12) · data-model.md · contracts/notifications-api.md · contracts/inbox-ui.md · quickstart.md

**Tests**: 포함 — spec FR-015(로컬 스위트 대체)·SC-002~008 + CLAUDE.md 완료 기준("신규 로직엔 그 버그를 정확히 잡는 테스트 동반"). 각 스토리에서 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다.

**Organization**: 스토리별 페이즈. US1(서버 목록)·US2(상대 시각)·US3(읽음·배지·이동)·US4(게스트 → 로그인 직행). 전부 JS 변경, 새 의존성 0. **외부 의존 1**: BE가 목록·읽음 응답에 `type`·`foodId`를 추가(요청 전달 2026-09-16, dev 배포 대기). FE는 필드 유무 양쪽에서 동작하므로 배포 전에도 머지 가능.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능(다른 파일·미완 태스크 의존 없음)
- **[Story]**: US1~US4
- 경로는 레포 루트 기준 `src/…`

## Path Conventions

단일 레포 mobile-app. 데이터 훅 `src/lib/data/`, 와이어 어댑터 `src/lib/api/*Adapter.ts`, 화면 `src/app/`, 테스트는 각 디렉터리 `__tests__/`. 로케일 `src/lib/i18n/{ko,en,ja,zh-Hans,zh-Hant,vi,id,th,ru,es}.json`.

---

## Phase 1: Setup (공용 조각 — 서로 독립)

**Purpose**: 스토리들이 공유하는 작은 조각을 먼저 놓는다. 기존 코드 동작 무변(가산만).

- [X] T001 [P] `src/lib/api/notificationAdapter.ts` 신설 — `export interface NotificationWire { id: number; title: string; body: string; receivedAt: number; read: boolean; type?: string; foodId?: number | string | null }` · `export interface InboxItem { id: number; title: string; body: string; at: string; read: boolean; type?: string; foodId?: string }` · `export function toInboxItem(w: NotificationWire): InboxItem` — `at = new Date(w.receivedAt).toISOString()`, `Number.isFinite(w.receivedAt)`가 아니면 `new Date().toISOString()`(`// ponytail:` 주석 — 목록 전체가 RangeError로 깨지지 않게, "방금 전" 표기) · `type: w.type` 그대로(검증은 `routeForNotificationData`) · `foodId: w.foodId != null ? String(w.foodId) : undefined`. 헤더 주석: 계약 출처(dev Swagger `NotificationResponse`) + `type`·`foodId`는 BE 확장 요청분(2026-09-16, 배포 전엔 없음)이라 옵션.
- [X] T002 [P] `src/components/Skeleton.tsx`에 `export function SkeletonInbox()` 추가 — `<View testID="skeleton-inbox">` 안에 행 3개: 각 행 `padding: 16, gap: 6, borderBottomWidth: 1, borderBottomColor: '#EAEBEE'`, 내용 `SkBar w="60%" h={12}` · `SkBar w="90%" h={10}` · `SkBar w="30%" h={10}` (기존 P-287 프리미티브 `SkBar` 재사용, 새 스타일 결정 없음). 배럴 `src/components/index.ts`엔 추가하지 않고 화면에서 직접 import.
- [X] T003 [P] 로케일 10파일 `src/lib/i18n/{ko,en,ja,zh-Hans,zh-Hant,vi,id,th,ru,es}.json` 갱신 — ① `inbox`에서 11키 제거: `markAllRead helpfulTitle helpfulBody reminderTitle reminderBody scanSuggestionTitle scanSuggestionBody newsTitle newsBody mealTimeTitle mealTimeBody` (유지: `title empty emptyBody newBadge`) ② ko `community.justNow` "방금" → "방금 전" ③ zh-Hans·zh-Hant `reviews.daysAgo` "{{count}} 天前" → "{{count}}天前"(공백 제거). **신설 키 없음**(게이트 시트 폐기). JSON 유효성은 `node -e` 루프로 10파일 `JSON.parse` 확인.

---

## Phase 2: Foundational (차단 선행 — 로컬 스토어 → 서버 훅 교체)

**Purpose**: 헤더 3곳·푸시 배선이 의존하는 데이터 훅을 만들고 로컬 스토어를 걷어낸다. 이 페이즈가 끝나면 tsc 0·기존 스위트 그린 상태여야 한다.

**⚠️ CRITICAL**: T004 완료 전엔 T005~T009 착수 금지(import 대상 부재).

- [X] T004 `src/lib/data/useNotifications.ts` 신설 (contracts/inbox-ui.md §2 그대로) — `export const NOTIFICATIONS_KEY = ['notifications'] as const` · `fetchNotifications(): Promise<InboxItem[]>` = `api.get<NotificationWire[]>('/api/notifications')` → `.map(toInboxItem)` · `markNotificationRead(id: number): Promise<InboxItem>` = `api.patch<NotificationWire>(\`/api/notifications/${id}/read\`)` → `toInboxItem` · `useInbox()` = `useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: fetchNotifications, staleTime: 0, enabled: useSession() === true })` · `useUnreadCount(): number` = 같은 옵션 + `select: (l) => l.filter((i) => !i.read).length`, `data ?? 0` · `useMarkRead()` = `useMutation({ mutationFn: markNotificationRead, onMutate(id) { void qc.cancelQueries({queryKey}); const prev = qc.getQueryData<InboxItem[]>(key); if (prev) qc.setQueryData(key, prev.map(i => i.id === id ? {...i, read: true} : i)); return { prev, gen: currentGen() } }, onSuccess(res, _id, ctx) { if (ctx && ctx.gen === currentGen()) qc.setQueryData(key, (cur?: InboxItem[]) => cur?.map(i => i.id === res.id ? res : i)) }, onError(_e, _id, ctx) { if (ctx?.prev && ctx.gen === currentGen()) qc.setQueryData(key, ctx.prev) }, onSettled() { invalidateNotifications(qc) } })` · `invalidateNotifications(qc: QueryClient = sharedQueryClient)` = `void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })` · `onPushTapped(notificationId?: number | string): Promise<void>` = id null이면 return; `const id = Number(notificationId)`; NaN이면 return; `if (!(await hasBeSession())) return;` `try { await markNotificationRead(id) } catch { /* 404·네트워크 비치명 */ }` `invalidateNotifications()`. import: `@/lib/api/client`(api) · `@/lib/queryClient` · `@/lib/auth/useSession`(useSession) · `@/lib/auth/beTokens`(currentGen) · `@/lib/auth/beAuth`(hasBeSession) · `@/lib/api/notificationAdapter`. 헤더 주석: 서버 정본(P-147)·기기 단위·미읽음 = 파생(NEW 필)·`useSubmitGuard` 예외(멱등 낙관 토글) 사유.
- [X] T005 [P] 헤더 3곳 import 경로 교체(각 1줄, 사용 코드 무변) — `src/app/(tabs)/index.tsx:38` · `src/app/(tabs)/food.tsx:15` · `src/features/community/ReviewFeed.tsx:33`: `import { useUnreadCount } from '@/lib/data/useNotifications';`
- [X] T006 [P] `src/lib/push/pushAdapter.ts` `addNotificationTapListener` — 내부 `record()`를 `bump()`로 교체: 인자 무시, `try { (require('@/lib/data/useNotifications') as typeof import('@/lib/data/useNotifications')).invalidateNotifications() } catch {}`. `recordInboxNotification` 호출·`foodId` 추출·유형 검사 제거. 호출 3곳(`emit` 내부·`addNotificationReceivedListener`·`getPresentedNotificationsAsync`)은 `bump()`로. 주석 "P-289 발화 기록" → "KB-499 서버 목록 재조회 트리거(수신·잔존분·탭)". `routeForNotificationData`·`isPushType` export **유지**(알림함 항목 탭이 재사용).
- [X] T007 [P] `src/app/_layout.tsx` — ① 기존 `AppState.addEventListener('change', (st) => { if (st === 'active') track(EVENTS.app_opened); })`를 `if (st === 'active') { track(EVENTS.app_opened); invalidateNotifications(); }`로 ② 푸시 탭 콜백 `push.addNotificationTapListener((href, notificationId) => { void onPushTapped(notificationId); if (href) router.push(href as Href); })`. import `{ invalidateNotifications, onPushTapped } from '@/lib/data/useNotifications'`(정적 import — 훅 파일은 expo-notifications를 로드하지 않음).
- [X] T008 [P] 로컬 스토어 삭제 — `git rm src/lib/notifications/inbox.ts src/lib/notifications/__tests__/inbox216.test.ts`(디렉터리 소멸) · `src/lib/flags.ts:111-114` `notificationCenter` 주석의 "목록 데이터는 로컬 목(notifications/inbox.ts) — BE 알림 목록 계약 오면 그 파일 한 곳 스왑"을 "목록·배지 = 서버 `GET /api/notifications`(KB-499, `lib/data/useNotifications`)"로 교체.
- [X] T009 [P] 기존 스위트 목 경로 갱신 — `src/app/__tests__/homeFeed317.test.tsx:63` → `jest.mock('@/lib/data/useNotifications', () => ({ useUnreadCount: () => 0 }))` · `src/app/__tests__/design4Home430.test.tsx:106-115` → `jest.mock('@/lib/data/useNotifications', () => ({ useUnreadCount: () => 2, useInbox: () => ({ data: [ { id: 1, read: false, title: 'A', body: 'a', at: new Date().toISOString() }, { id: 2, read: true, title: 'B', body: 'b', at: new Date().toISOString() } ], isPending: false, isError: false, error: null, refetch: jest.fn() }), useMarkRead: () => ({ mutate: jest.fn() }) }))` + 케이스 ③의 `inbox-n1/n2`·`unread-n1/n2` → `inbox-1/2`·`unread-1/2`. 이 파일이 `@/lib/auth/useSession`을 목하지 않으면 `useIsGuest: () => false, useSession: () => true`로 목 추가(게스트 Redirect 미발동).

**Checkpoint**: `npx tsc --noEmit` 0 · `npx jest src/app/__tests__/design4Home430 src/app/__tests__/homeFeed317 src/lib/push/__tests__/pushAdapter192` 그린. `notifications.tsx`는 구 import로 컴파일 오류 상태 — 즉시 T013으로 진행(T013을 이 체크포인트 앞으로 당겨도 됨).

---

## Phase 3: User Story 1 — 회원이 알림함에서 서버 목록을 본다 (Priority: P1) 🎯 MVP

**Goal**: 알림함이 `GET /api/notifications` 결과를 최신순으로 서버 문자열 그대로 보여준다. 로딩 스켈레톤·실패 재시도·빈 상태·재조회 5시점.

**Independent Test**: `api.get` 목 3건으로 화면 렌더 → 행 3개·제목/본문 서버 문자열 · pending → 스켈레톤 · reject → 에러 블록+재시도 · `[]` → 빈 상태. 실기: 관리자 테스트 발송 2건(1건 앱 종료 중) → 알림함 2건 최신순(quickstart §3-2·3).

### Tests for User Story 1

- [X] T010 [P] [US1] `src/lib/data/__tests__/useNotifications499.test.tsx` 신설 — 하네스는 `useNotificationSettings497.test.tsx`와 동일(`QueryClientProvider`, `api` 목, `afterEach` 언마운트·clear). `jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: jest.fn() }))` · 세션은 `initSessionState/_resetSessionForTest`(`@/lib/auth/useSession`)로 제어. 케이스: ① 어댑터 — `toInboxItem({id:1,title:'t',body:'b',receivedAt:1789540000000,read:false})` = `{id:1,title:'t',body:'b',at:new Date(1789540000000).toISOString(),read:false}`(`type`·`foodId` undefined); `receivedAt: NaN` → `at`이 `Date.parse` 가능; `{…, type:'REVIEW_REMINDER', foodId: 7}` → `type:'REVIEW_REMINDER', foodId:'7'`; `foodId: null` → undefined ② 목록·파생 — 세션 true, `api.get` → 3건(read f/f/t): `useInbox().data.length === 3` 순서 그대로, `useUnreadCount() === 2`, `api.get` 호출 1회(`'/api/notifications'`) ③ 세션 게이트 — 세션 null·false 각각: `api.get` 0회, `useUnreadCount() === 0`; null → `initSessionState(true)` 전환 후 fetch 1회 ④ 헤더 단언(DoD) — `jest.isolateModules` + `jest.doMock('@/lib/installationId', …'uuid-fixed-0001')` + 실 `@/lib/api/client` + `global.fetch` 목(`installationId204.test.ts:52-69` 방식): `fetchNotifications()` → URL 끝 `/api/notifications`·GET·`X-Installation-Id === 'uuid-fixed-0001'`; `markNotificationRead(3)` → URL 끝 `/api/notifications/3/read`·`method: 'PATCH'`·같은 헤더. (US3 케이스는 T017에서 같은 파일에 추가.)
- [X] T011 [P] [US1] `src/app/__tests__/inbox499.test.tsx` 신설 — `Notifications` 화면 렌더 하네스(react-test-renderer + `QueryClientProvider`; `jest.mock('@/lib/data/useNotifications')`로 `useInbox/useUnreadCount/useMarkRead` 목, `jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockGuest, useSession: () => true }))`, `expo-router` 목 `{ useRouter: () => ({ push, back }), Redirect: (p) => React.createElement('Redirect', p) }`, `@/lib/flags` `notificationCenter: true`). 케이스: ① `isPending` → `skeleton-inbox` 1·`inbox-` 행 0·`notif-empty` 0 ② `isError && !data` → `query-error-block` 1, 재시도(`common.retry` 텍스트 Pressable) 탭 → `refetch` 1회 ③ `data: []` → `notif-empty` 1 ④ `data` 2건 → `inbox-1`·`inbox-2`, 제목/본문 텍스트가 서버 문자열 리터럴(`'서버 제목'`)로 렌더(`t()` 미경유) ⑤ 소스 잠금 — `src/app/notifications.tsx`에 `notifications/inbox`·`markAllInboxRead`·`inbox-mark-all`·`relativeDate`·`AuthGateSheet` 부재, `timeAgo`·`routeForNotificationData` import 존재. (US2·US3·US4 케이스는 T015·T018·T021에서 추가.)
- [X] T012 [P] [US1] `src/lib/i18n/__tests__/inboxKeys498.test.ts` 갱신 — 헤더 주석에 KB-499 개정 기록. `REQUIRED = ['title','empty','emptyBody','newBadge']` · `OLD_KEYS`에 제거 11키 추가(`nudge*`·`notice*` 유지) · `AD_KEYS` 케이스 삭제(키 소멸) · 신규 케이스: 10로케일 `community.justNow`·`community.minsAgo`·`community.hoursAgo`·`reviews.daysAgo`가 비어 있지 않은 문자열 + `minsAgo/hoursAgo/daysAgo`에 `{{count}}` 포함 · ko `community.justNow === '방금 전'` · zh-Hans·zh-Hant `reviews.daysAgo`가 `/^\{\{count\}\}天前$/` 일치 · 10로케일 `gate`에 `notifTitle`·`notifSub` **부재**(신설 금지 잠금).

### Implementation for User Story 1

- [X] T013 [US1] `src/app/notifications.tsx` 재작성(US1 범위) — import: `useInbox` from `@/lib/data/useNotifications` · `timeAgo` from `@/features/community/parts` · `QueryErrorBlock, EmptyBlock` from `@/components/StateBlock` · `SkeletonInbox` from `@/components/Skeleton` · `type InboxItem` from `@/lib/api/notificationAdapter` · `routeForNotificationData` from `@/lib/push/pushAdapter`(유지 — T020에서 사용). 제거: 구 `markAllInboxRead/markInboxRead/useInbox`, `relativeDate` 함수, `TFn` 타입, `SubHeader trailing`(모두 읽음), `styles.markAll`. 본문: `const { data, isPending, isError, error, refetch } = useInbox(); const items = data ?? [];` → `FLAGS.notificationCenter` Redirect 유지 → `<View style={styles.root}><SubHeader title={t('inbox.title')} onBack={() => router.back()} />{isError && !data ? <QueryErrorBlock error={error} onRetry={() => void refetch()} onGoBack={() => router.back()} /> : isPending ? <SkeletonInbox /> : <FlatList data={items} keyExtractor={(n) => String(n.id)} contentContainerStyle={[styles.list, items.length === 0 && { flexGrow: 1 }]} renderItem=… ListEmptyComponent={기존 인라인 센터 + EmptyBlock testID="notif-empty"} />}</View>`. 행: `testID={\`inbox-${item.id}\`}`, `<Text style={styles.title} numberOfLines={1}>{item.title}</Text>` · `<Text style={styles.body} numberOfLines={2}>{item.body}</Text>` · `<Text style={styles.when}>{timeAgo(item.at, t)}</Text>` · `dotSlot`/`dot`/`rowUnread` 기존 유지. **리터럴 보존**(소스 잠금 유닛): `items.length === 0 && { flexGrow: 1 }` · `justifyContent: 'center'`가 `notif-empty` 앞 200자 안 · `title: { fontSize: 15, fontWeight: '700'`. 헤더 주석을 "서버 정본(KB-499) — 목록 GET·기기 단위·항목 탭 = 읽음 + routeForNotificationData(type·foodId, BE 확장분)" 로 교체(러프·로컬 목 문구 제거). 탭 핸들러는 `onPress={() => open(item)}`로 두고 `open`은 T020에서 채운다(이 단계 임시 `const open = (_n: InboxItem) => {}`).

**Checkpoint**: `npx jest src/lib/data/__tests__/useNotifications499 src/app/__tests__/inbox499 src/lib/i18n/__tests__/inboxKeys498` 그린(US1 케이스) · `npx tsc --noEmit` 0. 실기(dev): quickstart §3-1~3.

---

## Phase 4: User Story 2 — 도착 시각 상대 표기 (Priority: P1)

**Goal**: 각 행의 시각이 "방금 전 / N분 전 / N시간 전 / N일 전"(내림, 미래 = 방금 전)으로 10로케일에서 보인다. 구현은 기존 `timeAgo` 재사용(T013에서 배선) + 문구 3줄(T003) — 이 페이즈는 규칙 잠금.

**Independent Test**: `Date.now` 고정 후 경계 9종 입력 → 기대 문구(SC-002). 화면 유닛에서 `at` = 5분 전 → "5분 전".

### Tests for User Story 2

- [X] T014 [P] [US2] `src/features/community/__tests__/timeAgo499.test.ts` 신설 — `jest.spyOn(Date, 'now').mockReturnValue(T0)`; `t`는 ko.json을 직접 로드해 `{{count}}` 치환하는 최소 구현(또는 `@/lib/i18n` 초기화 후 `i18n.getFixedT('ko')`). 9경계: `T0-59s`→'방금 전' · `-60s`→'1분 전' · `-59m`→'59분 전' · `-60m`→'1시간 전' · `-23h`→'23시간 전' · `-24h`→'1일 전' · `-47h`→'1일 전' · `-48h`→'2일 전' · `+5m`(미래)→'방금 전'. 추가 2: en `-60s`→'1m ago' · zh-Hans `-48h`→'2天前'(공백 없음).
- [X] T015 [P] [US2] `src/app/__tests__/inbox499.test.tsx`에 케이스 추가 — `at = new Date(Date.now() - 5*60_000).toISOString()` 항목 → 행 안에 `community.minsAgo` 결과(테스트 i18n 목이 키를 반환하면 `'community.minsAgo'` + `{count: 5}` 호출 단언, 실 리소스면 `'5분 전'`).

### Implementation for User Story 2

- [X] T016 [US2] 검증만 — `src/features/community/parts.tsx` `timeAgo` 무변 확인(시그니처 `(iso: string, t)`), T003의 ko `community.justNow`·zh `reviews.daysAgo` 반영 확인, 기존 호출부 스위트(`reviewFeed179`, `src/app/community/post/[id]` 관련) 그린 확인. 변경 필요 시에만 수정.

**Checkpoint**: `npx jest src/features/community/__tests__/timeAgo499 src/app/__tests__/inbox499` 그린.

---

## Phase 5: User Story 3 — 읽음 처리(기기 단위)·배지·항목 탭 이동 (Priority: P1)

**Goal**: 항목 탭 = 즉시 읽음 표시·미읽음 −1(0이면 NEW 소멸)·`PATCH …/read`, 실패 시 원복, 그리고 `routeForNotificationData({type, foodId})`로 푸시 탭과 같은 이동(유형 없으면 알림함 유지). 읽은 항목 재탭 = 요청 0·이동은 유형대로. 푸시 탭 진입 시 해당 알림 읽음 처리. 읽음/미읽음 행 프레임 불변.

**Independent Test**: 훅 유닛 — 미읽음 2 → 탭 → 1·read true → PATCH reject → 2·read false. 화면 — 미읽음 행 탭 → `mutate(id)` 1회; `type:'REVIEW_REMINDER', foodId:'7'` → `router.push('/food/7')`; `type` 없음 → push 0. 실기: quickstart §3-4·5.

### Tests for User Story 3

- [X] T017 [P] [US3] `src/lib/data/__tests__/useNotifications499.test.tsx`에 케이스 추가 — ⑤ 낙관·롤백: 목록 2건(f/f) 로드 후 `mutate(1)` → 즉시 `useUnreadCount() === 1`·항목1 `read true` → `api.patch` deferred reject → `until(unread===2)`·`read false` → `api.get` 2회째(invalidate) ⑥ 성공: deferred resolve `{id:1,…,read:true}` → 항목 교체·`api.get` 재호출 ⑦ 세대 가드: `mutate(1)` 진행 중 `bumpSessionGen()`(`@/lib/auth/beTokens`) + `qc.clear()` → reject → `qc.getQueryData(NOTIFICATIONS_KEY) === undefined`(prev 미복원) ⑧ `onPushTapped`: `hasBeSession` true + `7` → `api.patch('/api/notifications/7/read')` 1회 + `api.get` 재호출; `'9'` → `/9/read`; `hasBeSession` false → patch 0·get 0; `undefined`·`'abc'` → 0.
- [X] T018 [P] [US3] `src/app/__tests__/inbox499.test.tsx`에 케이스 추가 — ⑨ 미읽음 행(`type: undefined`) 탭 → `mutate(1)` 1회, `router.push` 0회 ⑩ 읽은 행 탭 → `mutate` 0회 ⑪ 이동: `{id:3, read:false, type:'REVIEW_REMINDER', foodId:'7'}` 탭 → `mutate(3)` 1회 + `router.push('/food/7')` 1회; `{type:'NEWS'}` → push 0; `{type:'HELPFUL'}` → push 1회(`routeForNotificationData`가 돌려주는 현행 href — 하드코딩 대신 함수 호출값과 비교) ⑫ 프레임 불변: `StyleSheet.flatten(byId('inbox-1').props.style)`·`inbox-2` 각각에서 `backgroundColor` 삭제 후 `toEqual`; `unread-1` 존재·`unread-2` 부재; `inbox-1` 스타일에 `rgba(255,113,52,0.05)`(primaryTint) 포함 ⑬ 소스 잠금: `src/app/_layout.tsx`에 `onPushTapped(`·`invalidateNotifications()` 문자열 존재.
- [X] T019 [P] [US3] `src/lib/push/__tests__/pushAdapter192.test.ts` 확인·보강 — 기존 `onRoute(href, notificationId)` 케이스 유지. 추가 1: `jest.doMock('@/lib/data/useNotifications', () => ({ invalidateNotifications: jest.fn() }))` 후 수신 리스너·탭 응답·`getPresentedNotificationsAsync` 경로에서 `invalidateNotifications` 호출 ≥1, `recordInboxNotification` 문자열이 `src/lib/push/pushAdapter.ts`에 부재(소스 잠금).

### Implementation for User Story 3

- [X] T020 [US3] `src/app/notifications.tsx` 탭 배선 — `const markRead = useMarkRead();` · `const open = (n: InboxItem) => { if (!n.read) markRead.mutate(n.id); const href = routeForNotificationData({ type: n.type, foodId: n.foodId }); if (href) router.push(href as Href); };` 주석: "type·foodId = BE 확장분(clarify Q2) — 없거나 미지 유형이면 routeForNotificationData가 null → 알림함 유지. 이동은 읽음 응답을 기다리지 않는다(US3 ③)".
- [X] T021 [US3] T007 배선 재확인 — `_layout.tsx` 콜백이 `notificationId`를 `onPushTapped`로 넘기고 `AppState active`에서 `invalidateNotifications()`가 호출되는지 소스 확인(T018 ⑬이 잠금).

**Checkpoint**: `npx jest src/lib/data/__tests__/useNotifications499 src/app/__tests__/inbox499 src/lib/push/__tests__/pushAdapter192` 그린. 실기: 탭 → 강조 해제·배지 감소, Swagger GET `read:true`; 푸시 탭 진입 → 해당 항목 읽음; BE 확장 배포 시 리마인더 항목 탭 → 음식 상세.

---

## Phase 6: User Story 4 — 게스트는 로그인 화면으로 직행 (Priority: P2)

**Goal**: 게스트가 `/notifications`에 도달하면 알림함을 한 순간도 렌더하지 않고 로그인 화면으로 `Redirect`. 로그인 완료 = 알림함 복귀(기존 `returnTo`), 로그인 화면 뒤로 = 종 아이콘이 있던 탭. 게스트 배지 0(R-2로 이미 충족). 시트·문구 신설 없음.

**Independent Test**: `useIsGuest` true → `Redirect` 렌더(href `/login?returnTo=%2Fnotifications`), `inbox-`·`skeleton-inbox`·`SubHeader` 0. 훅: 세션 false → `useUnreadCount() === 0`(T010 ③). 실기 quickstart §3-7.

### Tests for User Story 4

- [X] T022 [P] [US4] `src/app/__tests__/inbox499.test.tsx`에 케이스 추가 — `mockGuest = true` → 트리에 `Redirect` 1개, `props.href === '/login?returnTo=%2Fnotifications'`; `inbox-`·`skeleton-inbox`·`query-error-block`·`notif-empty` 0; `SubHeader` 미렌더(`inbox.title` 텍스트 0) · `mockGuest = false` 복귀 시 목록 렌더 · 소스 잠금: `notifications.tsx`에 `AuthGateSheet` 부재, `returnTo` 존재.
- [X] T023 [P] [US4] `src/app/login.tsx` 확인만 — `useLocalSearchParams<{ returnTo }>`(L113)·성공 시 `router.replace(returnTo ?? '/(tabs)')`(L176)·백버튼 `canGoBack` 가드가 그대로인지 확인. 변경 0(기존 배선 재사용). 확인 결과를 PROGRESS 항목에 1줄.

### Implementation for User Story 4

- [X] T024 [US4] `src/app/notifications.tsx` 게스트 가드 — `const isGuest = useIsGuest();`(훅 호출은 `useInbox`·`useMarkRead` 뒤·early return 앞) → `FLAGS.notificationCenter` Redirect 바로 다음 줄에 `if (isGuest) return <Redirect href={\`/login?returnTo=${encodeURIComponent('/notifications')}\` as Href} />;`. import `useIsGuest` from `@/lib/auth/useSession`(`Redirect`·`Href`는 이미 import). 주석: "KB-499 clarify Q5 — 게스트 = 로그인 직행(시트 없음). Redirect = replace라 뒤로 = 종 아이콘 탭. 라우트 가드 1곳(헤더 3곳 onBell 무변·딥링크 방어)".

**Checkpoint**: `npx jest src/app/__tests__/inbox499` 전체 그린. 실기: 게스트 종 탭 → 로그인 화면 → 뒤로 = 탭 → 로그인 → 알림함.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: 전체 게이트·기록·PR. 발행은 하지 않는다(예진 승인 후 별도).

- [X] T025 전체 게이트 — `npx tsc --noEmit`(0) · `npx jest`(전체 그린; 스위트/케이스 수 기록) · `grep -rn "notifications/inbox\|kbap.inbox\|recordInboxNotification\|markAllInboxRead" src` 0건(SC-007) · `grep -rn "notifTitle\|notifSub" src/lib/i18n` 0건 · `git status`로 `src/lib/notifications/` 디렉터리 소멸 확인.
- [X] T026 [P] `PROGRESS.md` 말미에 항목 추가 — `## 알림함 서버 전환 + 상대 시각 (2026-09-16, KB-499 — Spec Kit 4호 \`specs/004-inbox-server\`)` · clarify 5문항 결정(NEW 필 유지 · 항목 탭 이동 = BE `type`·`foodId` 확장 요청 · 모두 읽음 제거 · ko justNow+zh 공백 · 게스트 로그인 직행) · 데이터(어댑터·훅·무효화 5시점·`enabled = useSession()===true`) · i18n(11키 제거·문구 3줄) · 테스트(삭제 1·갱신 4·신규 3, `tsc 0 · jest N스위트 M/M`) · `- [ ] BE 응답 type·foodId dev 배포 확인 후 항목 탭 이동 실기` · `- [ ] dev 실기(quickstart §3) 미실시` · `- [ ] draft PR`. 리뷰 포인트: ① 커뮤니티 "방금"→"방금 전" 공유 문구 ② `enabled = useSession()===true`(Jira 제안 `!useIsGuest` 대비) ③ 항목 탭 이동이 BE 배포 전엔 비활성.
- [X] T027 [P] 범위 밖 확인만 — `src/app/(tabs)/community.tsx` 미사용 `IconBell` import·`bell` 스타일, `inbox.emptyBody` 미사용 키, `AuthGateSheet.tsx`: **건드리지 않음**(research R-12).
- [X] T028 BE 계약 재확인 — dev Swagger `NotificationResponse`에 `type`·`foodId`가 올라왔는지 확인(`curl -s https://dev.kbap.site/v3/api-docs | python3 -c …`). 올라왔으면 `contracts/notifications-api.md` "배포 대기" 문구를 배포일로 갱신하고 실기 §3-4 이동 항목 수행; 아니면 PR 본문에 "이동은 BE 배포 후 활성" 명기.
- [ ] T029 dev 실기 검증 — quickstart §3 1~9 수행(검증 회원 소식 동의 ON 선행, 관리자 `POST /api/admin/notifications/test-push { memberId }`), 결과를 PROGRESS 항목·PR 본문에 기재. 기기 2대 확인 불가 시 "미확인"으로 명시.
- [ ] T030 PR — `open-draft-pr` 스킬 절차로 draft PR(base `develop`). 제목은 Jira 키 없이 `feat(push): 알림함 서버 전환·상대 시각·게스트 로그인 직행` 형식, 본문에 `Jira: KB-499` 줄·spec 경로·clarify 5결정·실기 결과·BE 의존(`type`·`foodId`)·리뷰 포인트 3·발행 미실시 명기. Jira 상태 전환·완료 선언 금지.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 의존 없음 — T001~T003 전부 병렬.
- **Phase 2 (Foundational)**: T004는 T001 필요. T005~T009는 T004 뒤 병렬. Phase 2 완료가 모든 스토리를 차단.
- **Phase 3 (US1)**: Phase 2 뒤. T010~T012 병렬(테스트 먼저) → T013.
- **Phase 4 (US2)**: T003·T013 뒤. T014·T015 병렬 → T016.
- **Phase 5 (US3)**: T013 뒤. T017~T019 병렬 → T020 → T021.
- **Phase 6 (US4)**: T013 뒤. T022·T023 병렬 → T024.
- **Phase 7**: 전 스토리 뒤. T026·T027 병렬, T025 → T028 → T029 → T030.

### User Story Dependencies

- **US1**: Foundational만. 화면 골격을 만들어 US2·US3·US4가 같은 파일(`notifications.tsx`)에 배선을 얹는다.
- **US2**: 구현은 T003(문구 3줄)+T013(timeAgo 배선)으로 이미 충족 — 규칙 잠금 테스트. US1 뒤.
- **US3**: 훅(T004)은 Foundational에서 완성. 화면 탭 배선(T020)만 US1 화면 뒤. 이동 실기는 BE 배포(T028) 의존.
- **US4**: 화면 가드(T024)만 US1 화면 뒤. 로그인 화면 배선은 기존 재사용(T023 확인만).

### Within Each User Story

- 테스트를 먼저 작성해 실패 확인 → 구현 → 그린.
- 같은 파일(`notifications.tsx`·`inbox499.test.tsx`·`useNotifications499.test.tsx`)에 여러 스토리가 케이스를 추가하므로 스토리 간 병렬은 파일 충돌 주의 — 순차(US1→US2→US3→US4) 권장.

### Parallel Opportunities

- Phase 1: T001·T002·T003 동시.
- Phase 2: T004 뒤 T005·T006·T007·T008·T009 동시(파일 전부 다름).
- Phase 3: T010·T011·T012 동시(파일 3개).
- Phase 5: T017·T018·T019 동시.
- Phase 6: T022·T023 동시.

---

## Parallel Example: Phase 2 (T004 완료 후)

```bash
Task: "헤더 3곳 import 경로 교체 — (tabs)/index.tsx · (tabs)/food.tsx · ReviewFeed.tsx"
Task: "pushAdapter.ts record() → bump()/invalidateNotifications 지연 require"
Task: "_layout.tsx AppState active 무효화 + onPushTapped 배선"
Task: "inbox.ts·inbox216 삭제 + flags.ts 주석"
Task: "design4Home430·homeFeed317 목 경로·형태 갱신"
```

## Parallel Example: Phase 3 (US1 테스트)

```bash
Task: "useNotifications499.test.tsx — 어댑터(type·foodId 포함)·목록·세션 게이트·헤더 단언"
Task: "inbox499.test.tsx — 3상태·행 렌더·소스 잠금"
Task: "inboxKeys498.test.ts — REQUIRED 축소·제거 키·time 키 패리티·zh 공백·gate 신설 없음"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 → Phase 2(로컬 스토어 제거·훅) → Phase 3(US1 화면).
2. **STOP and VALIDATE**: tsc 0 · US1 스위트 그린 · dev 실기 quickstart §3-1~3(앱 종료 중 발송분 표시 = SC-001).
3. 이 시점에 배지·푸시 탭 읽음은 훅 레벨로 이미 동작(T004·T007) — 화면 탭 읽음/이동(US3)·게스트 Redirect(US4)만 남는다.

### Incremental Delivery

1. US1 → US2(규칙 잠금, 코드 변화 거의 0) → US3(탭 배선 + 유닛) → US4(Redirect 1줄 + 유닛).
2. 각 체크포인트마다 `npx jest <해당 스위트>` + tsc.
3. Phase 7에서 전체 jest·SC-007 grep·PROGRESS·BE 계약 재확인·실기·draft PR. 발행 없음.

---

## Notes

- clarify 5결정(2026-09-16): NEW 필 유지 · 항목 탭 = 읽음 + `routeForNotificationData(type, foodId)`(BE 확장 대기) · 모두 읽음 제거 · ko "방금 전" + zh 공백 · 게스트 로그인 직행(시트 없음).
- 쿼리 활성은 `useSession() === true`(R-2) — Jira 본문의 `!useIsGuest()`와 다르다. PR 리뷰 포인트로 명기.
- FE는 `type`·`foodId` 유무 양쪽에서 동작 — BE 배포 전 머지 가능, 배포 전엔 항목 탭 이동만 비활성.
- `useSubmitGuard` 미사용은 멱등 낙관 토글 예외(CLAUDE.md) — 훅 주석에 사유 명기.
- 소스 잠금 유닛이 요구하는 리터럴(`deleteEmpty329`·`parityDsHome486`)을 T013에서 그대로 유지.
- 삭제된 모듈을 `jest.mock`하던 스위트 2개(T009)를 빠뜨리면 "Cannot find module"로 전체 jest 실패.
- OTA 발행·Jira 전환·완료 선언 금지. 실기 미실시 항목은 `- [ ]`로 남긴다.

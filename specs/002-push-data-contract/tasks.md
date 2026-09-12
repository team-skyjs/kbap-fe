# Tasks: 푸시 알림 데이터 계약 반영 — 유형 개명·신설, 알림 id 전달, Android 알림 채널

**Input**: Design documents from `/specs/002-push-data-contract/`

**Prerequisites**: plan.md · spec.md · research.md(R1~R6) · data-model.md · contracts/push-notification-data.md · quickstart.md

**Tests**: 포함. CLAUDE.md 완료 기준 "신규 로직엔 그 버그를 정확히 잡는 테스트 동반"이 요구. 각 스토리는 테스트 먼저(실패 확인) → 구현 순.

**Organization**: 스토리별 페이즈. 소스는 `src/lib/push/pushAdapter.ts`·`src/lib/notifications/inbox.ts`·로케일 10개뿐 — 신규 소스 파일 0, 신규 테스트 파일 1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·미완 태스크 의존 없음 → 병렬 가능
- **[Story]**: US1~US4 (spec.md)

## Path Conventions

단일 Expo 앱. 소스 `src/`, 테스트는 각 모듈 옆 `__tests__/`. 경로는 레포 루트 기준.

---

## Phase 1: Setup

**Purpose**: 워크트리에 의존성이 없다(plan.md 주의 항목). 검증 도구를 쓸 수 있게 한다.

- [X] T001 워크트리 루트에서 `npm install` 실행 후 `npx tsc --noEmit`·`npx jest src/lib/push` 가 현재 코드로 통과하는지 확인 (기준선)
- [X] T002 `node_modules/expo-notifications/build/NotificationChannelManager.d.ts`에서 `setNotificationChannelAsync(channelId, channel)` 시그니처와 `AndroidImportance.MAX` 존재를 확인하고 research.md R4의 "로컬 대조 못 함" 문장을 확인 결과로 갱신

---

## Phase 2: Foundational

**Purpose**: US1·US2가 함께 쓰는 유형 정의(R1). 이 뒤에야 스토리 작업 시작.

- [X] T003 `src/lib/push/pushAdapter.ts` 딥링크 섹션 상단에 `export const PUSH_TYPES = ['HELPFUL', 'SCAN_SUGGESTION', 'REVIEW_REMINDER', 'NEWS', 'MEAL_TIME'] as const;` · `export type PushType = (typeof PUSH_TYPES)[number];` · `export function isPushType(v: unknown): v is PushType` (`typeof v === 'string' && PUSH_TYPES.includes(v)` — 정확 일치, trim·대소문자 정규화 없음) 추가. 헤더 주석에 "유형 enum 정본 = 서버(BE Swagger), 여기 한 곳만" 한 줄
- [X] T004 `src/lib/notifications/inbox.ts` 에 `import type { PushType } from '@/lib/push/pushAdapter';` 추가하고 `InboxItem.data.type` 유니온을 `PushType`으로 교체, `recordInboxNotification`의 `entry.type` 타입도 따라감 (런타임 import 아님 — 어댑터가 inbox를 지연 require하므로 순환 금지)

**Checkpoint**: `npx tsc --noEmit` 실행 — `KEYS` 맵(NUDGE/NOTICE 키 잔존)과 어댑터 `record()`의 캐스팅에서 오류가 나는 것이 정상. 다음 페이즈가 해소한다.

---

## Phase 3: User Story 1 — 다섯 유형 탭 → 맞는 화면 (Priority: P1) 🎯 MVP

**Goal**: `routeForNotificationData`가 5종 매핑을 정확히 하고 NUDGE·미지 유형은 null.

**Independent Test**: `npx jest src/lib/push/__tests__/pushAdapter192.test.ts` — 매핑 케이스 전부 통과.

### Tests for User Story 1

- [X] T005 [US1] `src/lib/push/__tests__/pushAdapter192.test.ts` 의 "딥링크 매핑" 케이스를 계약표(contracts §2) 기준으로 교체: `HELPFUL`→`/profile/reviews` · `SCAN_SUGGESTION`→`/scan` · `MEAL_TIME`→`/scan` · `REVIEW_REMINDER`+`foodId:'7'`→`/food/7/review` · `REVIEW_REMINDER`+`foodId:7`(숫자)→`/food/7/review` · `REVIEW_REMINDER` foodId 없음→null · `NEWS`→null · `NUDGE`→null · `NOTICE`→null · `'helpful'`(소문자)→null · `'HELPFUL '`(공백)→null · `UNKNOWN_FUTURE`→null · `undefined`→null. 실행해 NUDGE·SCAN_SUGGESTION·MEAL_TIME 케이스가 실패하는지 확인

### Implementation for User Story 1

- [X] T006 [US1] `src/lib/push/pushAdapter.ts` `routeForNotificationData` switch 교체: `case 'HELPFUL'` 유지 · `case 'SCAN_SUGGESTION': case 'MEAL_TIME': return '/scan';` · `case 'REVIEW_REMINDER'` 유지 · `case 'NEWS': return null;`(주석: 알림함 열람용, 이동 없음) · `default: return null`. `'NUDGE'` 케이스 삭제. 시그니처 `(data: unknown) => string | null` 불변(알림함 화면 소비)
- [X] T007 [US1] `src/lib/push/pushAdapter.ts` `addNotificationTapListener` 내부 `record()`의 `d.type as 'REVIEW_REMINDER' | 'HELPFUL' | 'NUDGE' | 'NOTICE'` 캐스팅을 `isPushType(d.type)` 가드로 교체 — 가드 실패 시 return(기록 안 함). `npx tsc --noEmit` 0 확인, T005 통과 확인

**Checkpoint**: US1 독립 검증 완료. 알림함 화면(`src/app/notifications.tsx`)은 무수정으로 5종 경로를 그대로 얻는다.

---

## Phase 4: User Story 2 — 알림함에 다섯 유형이 올바른 문구로 (Priority: P1)

**Goal**: `inbox.ts` KEYS 5종 + 미지 유형 미기록 + 구 잔존 드롭, 10로케일 키 교체.

**Independent Test**: `npx jest src/lib/notifications src/lib/i18n/__tests__/inboxKeys498.test.ts` 통과.

### Tests for User Story 2

- [X] T008 [P] [US2] `src/lib/notifications/__tests__/inbox216.test.ts` 에 케이스 추가: ① `SCAN_SUGGESTION`·`NEWS`·`MEAL_TIME` 각각 기록 시 `titleKey/bodyKey`가 `inbox.scanSuggestionTitle/Body`·`inbox.newsTitle/Body`·`inbox.mealTimeTitle/Body` ② `type: 'NUDGE' as never`·`'NOTICE' as never`·`'helpful' as never` 기록 → 목록 0건 ③ AsyncStorage `kbap.inbox.v1`에 `[{id:'old',titleKey:'inbox.nudgeTitle',bodyKey:'inbox.nudgeBody',at:'2026-09-01T00:00:00Z',read:false,data:{type:'NUDGE'}}, {id:'ok',...,data:{type:'HELPFUL'}}]` 를 미리 넣고 `_resetInboxForTest({ rehydrate: true })`(T011에서 추가 — `hydrated=false·hydrating=null`) 뒤 `await hydrateInbox()` 후 `fetchInbox()`가 `ok` 1건만 반환 ④ 기존 소스 잠금 케이스에 `expect(src).not.toContain("'NUDGE'")`·`not.toContain("'NOTICE'")` 추가
- [X] T009 [P] [US2] `src/lib/i18n/__tests__/inboxKeys498.test.ts` 신규 — `notifKeys497.test.ts` 패턴 복제: LOCALES 10개 · `inbox` 네임스페이스 키 집합이 ko와 일치 · REQUIRED = `['title','empty','emptyBody','markAllRead','helpfulTitle','helpfulBody','reminderTitle','reminderBody','scanSuggestionTitle','scanSuggestionBody','newsTitle','newsBody','mealTimeTitle','mealTimeBody','newBadge']` 전부 비어 있지 않은 string · OLD = `['nudgeTitle','nudgeBody','noticeTitle','noticeBody']` 어느 로케일에도 없음 · 광고성 6키(scanSuggestion·news·mealTime)에 `(광고)`·`(Ad)`·`수신거부` 문자열 미포함(FR-006 — 서버 부착). 실행해 실패 확인

### Implementation for User Story 2

- [X] T010 [US2] `src/lib/notifications/inbox.ts` `recordInboxNotification`: KEYS 맵을 `HELPFUL`·`REVIEW_REMINDER`(기존) + `SCAN_SUGGESTION:{inbox.scanSuggestionTitle/Body}`·`NEWS:{inbox.newsTitle/Body}`·`MEAL_TIME:{inbox.mealTimeTitle/Body}` 로 교체(`NUDGE`·`NOTICE` 삭제). 진입 가드 `if (!entry.id || !isPushType(entry.type) || items.some(...)) return;` — `isPushType`는 `import { isPushType } from '@/lib/push/pushAdapter'` 런타임 import가 필요하므로 R1 결정 갱신: **순환 회피를 위해 `PUSH_TYPES`·`PushType`·`isPushType` 정의를 `inbox.ts`가 아니라 어댑터에 두되, inbox는 `PUSH_TYPES`를 직접 쓰지 않고 `KEYS` 맵의 키 존재(`entry.type in KEYS`)로 가드한다** (KEYS가 곧 5종 집합 — 별도 import 0)
- [X] T011 [US2] `src/lib/notifications/inbox.ts` `hydrateInbox`: `if (Array.isArray(parsed)) items = parsed.filter((n) => typeof n?.data?.type === 'string' && n.data.type in KEYS)` — KEYS를 모듈 상수로 승격(함수 밖 `const KEYS: Record<PushType, {...}>`). 주석 `// KB-498: 구 NUDGE/NOTICE 잔존 드롭(호환 변환 없음 — 스펙)`. `_resetInboxForTest(opts?: { rehydrate?: boolean })` — `rehydrate`면 `hydrated=false; hydrating=null`(기존 호출부 무인자 동작 불변)
- [X] T012 [P] [US2] `src/lib/i18n/ko.json` `inbox` 블록: `nudgeTitle/nudgeBody/noticeTitle/noticeBody` 삭제 → `scanSuggestionTitle: "오늘 외식하세요?"` `scanSuggestionBody: "주문 전에 메뉴를 스캔해 보세요"`(구 nudge 문구 승계) · `mealTimeTitle: "식사 시간이에요"` `mealTimeBody: "메뉴판을 스캔하면 내 기피 재료를 바로 확인할 수 있어요"` · `newsTitle: "K-Bap 소식"` `newsBody: "새 기능과 이벤트 안내를 확인하세요"`. 기존 ko `nudge*` 실제 문구를 먼저 읽고 그 값을 scanSuggestion*에 옮긴다
- [X] T013 [P] [US2] `src/lib/i18n/en.json` 동일 교체 — `scanSuggestion*` = 기존 `nudge*` 값 이동(`"Eating out today?"`/`"Scan the menu before you order."`), `mealTimeTitle: "Time to eat"` `mealTimeBody: "Scan the menu to check your ingredients to avoid right away."`, `newsTitle: "K-Bap news"` `newsBody: "See what's new: features and events."`
- [X] T014 [P] [US2] `src/lib/i18n/ja.json`·`zh-Hans.json`·`zh-Hant.json`·`vi.json` 동일 교체 — 각 로케일의 기존 `nudge*` 값을 `scanSuggestion*`로 이동, `mealTime*`·`news*`는 ko/en 의미로 번역
- [X] T015 [P] [US2] `src/lib/i18n/id.json`·`th.json`·`ru.json`·`es.json` 동일 교체(T014와 같은 규칙)
- [X] T016 [US2] `npx jest src/lib/notifications src/lib/i18n` 통과 + `npx tsc --noEmit` 0 확인. `grep -rn "nudgeTitle\|noticeTitle" src/` 결과 0

**Checkpoint**: US1+US2 = 서버 5종 푸시가 도착·탭 모두 정상. OTA 후보 상태.

---

## Phase 5: User Story 3 — 탭 콜백에 서버 알림 id 전달 (Priority: P2)

**Goal**: `onRoute(href, notificationId?)` 통로. 읽음 호출은 하지 않는다.

**Independent Test**: pushAdapter192의 탭 구독 케이스에서 2번째 인자 검증.

### Tests for User Story 3

- [X] T017 [US3] `src/lib/push/__tests__/pushAdapter192.test.ts` "알림 탭 구독" 케이스 확장: ① `data:{type:'HELPFUL', notificationId: 456}` → `onRoute` 호출 인자 `['/profile/reviews', 456]` ② `notificationId: '9'`(문자열) → `['/profile/reviews', '9']` 그대로(숫자 변환 없음) ③ `notificationId` 없음 → `onRoute.mock.calls[0]`이 `['/profile/reviews', undefined]` (`toHaveBeenCalledWith('/profile/reviews', undefined)`) ④ `getLastNotificationResponseAsync`가 `{notification:{request:{identifier:'cold',content:{data:{type:'MEAL_TIME',notificationId:7}}}}}` 를 resolve하면 `onRoute`가 `['/scan', 7]`로 정확히 1회 ⑤ `data:{type:'NEWS', notificationId:3}` → `onRoute` 미호출 ⑥ 같은 `identifier:'cold'`가 `getLastNotificationResponseAsync` resolve와 응답 리스너 양쪽으로 들어와도 `onRoute` 정확히 1회(콜드 스타트 이중 전달 차단, US3-3) ⑦ identifier 없는 응답(로컬 알림·구 서버)은 차단 없이 매번 전달. 실행해 ①②④⑥ 실패 확인

### Implementation for User Story 3

- [X] T018 [US3] `src/lib/push/pushAdapter.ts` `addNotificationTapListener` 시그니처를 `onRoute: (href: string, notificationId?: number | string) => void` 로 변경. `emit`에서 `const data = resp?.notification.request.content.data as { notificationId?: number | string } | undefined; const href = ...; if (href) onRoute(href, data?.notificationId);` — 형 변환 없음. 그 앞에 `const routed = new Set<string>()`(리스너 클로저) + `const id = resp?.notification.request.identifier; if (id) { if (routed.has(id)) return; routed.add(id); }` — 콜드 스타트에서 마지막 응답 조회와 리스너가 같은 탭을 이중 전달하는 것 차단. JSDoc에 "2번째 인자 = 서버 알림 id(기기 단위). 읽음 처리는 후속(KB-499/서버 알림함)" 한 줄
- [X] T019 [US3] `src/app/_layout.tsx` 150행 호출부 `(href) => router.push(href as Href)` 는 **수정하지 않는다** — `npx tsc --noEmit` 0 으로 호환 확인만. pushAdapter192의 기존 레이아웃 소스 잠금(`registerPushToken()` 2회) 여전히 통과 확인

**Checkpoint**: 후속 작업은 `(href, id) => { router.push(href); if (id != null) markServerRead(id) }` 한 줄로 이어진다.

---

## Phase 6: User Story 4 — Android 헤드업 채널 (Priority: P2)

**Goal**: 리스너 등록 시 Android에서만 `default` 채널 MAX 1회. iOS·플래그 off = 호출 0.

**Independent Test**: pushAdapter192(android/ios 분기) + pushProdGuard221(폭탄 목) 통과 + 실기기 quickstart §수동 검증.

### Tests for User Story 4

- [X] T020 [P] [US4] `src/lib/push/__tests__/pushAdapter192.test.ts`: `mockNotifications`에 `setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined)`·`AndroidImportance: { MAX: 5 }` 추가. 신규 케이스 ① `jest.replaceProperty(Platform, 'OS', 'android')` 후 `addNotificationTapListener(() => {})` → `setNotificationChannelAsync`가 `('default', expect.objectContaining({ name: 'Default', importance: 5, sound: 'default' }))` 로 1회 ② `Platform.OS = 'ios'` → 0회 ③ android에서 `setNotificationChannelAsync.mockRejectedValueOnce(new Error('x'))` 여도 반환값이 함수이고 `addNotificationResponseReceivedListener`는 여전히 호출됨(부팅 무영향). `afterEach(() => jest.restoreAllMocks())`로 원복. 실행해 ①③ 실패 확인
- [X] T021 [P] [US4] `src/lib/push/__tests__/pushProdGuard221.test.ts` 폭탄 목에 `get setNotificationChannelAsync() { return boom(); }`·`get AndroidImportance() { return boom(); }` 추가, `react-native` 목의 `Platform.OS`를 `'android'`로 바꿔 "채널 설정 포함 접근 0" 을 실측(기존 "알림 탭 리스너 = 구독 0" 케이스가 그대로 잠근다). 실행해 통과 유지 확인(플래그 off라 require 전에 반환)

### Implementation for User Story 4

- [X] T022 [US4] (2026-09-12 개정: default 1채널 → activity MAX·news HIGH 2채널, 이름 i18n) `src/lib/push/pushAdapter.ts` `addNotificationTapListener` try 블록 첫 줄에 추가: `if (Platform.OS === 'android') { void N.setNotificationChannelAsync('activity', { name: i18n.t('notif.activityGroup'), importance: MAX, sound: 'default' }); void N.setNotificationChannelAsync('news', { name: i18n.t('notif.newsGroup'), importance: HIGH, sound: 'default' }); }` — await 없음(부팅 지연 0), 주석 `// KB-498: 서버 channelId 'default' 대응 — MAX = 헤드업+소리. 멱등(재호출 = 갱신). iOS 무동작`. `npx jest src/lib/push` 통과 + `npx tsc --noEmit` 0

**Checkpoint**: 자동 검증 전부 통과. 실기기 검증은 Polish에서.

---

## Phase 7: Polish & Cross-Cutting

- [X] T023 [P] `src/lib/push/pushAdapter.ts` 헤더 주석에 KB-498 한 줄(유형 5종·notificationId 통로·Android 채널) 추가, `src/lib/notifications/inbox.ts` 헤더의 "로컬 알림만" 서술을 "서버 푸시+로컬 리마인더 발화 기록"으로 갱신
- [X] T024 [P] `PROGRESS.md` 에 KB-498 항목 추가(관례): 변경 파일·테스트·OTA 가능(JS 전용)·발행은 승인 대기
- [X] T025 전체 검증: `npx tsc --noEmit` 0 · `npx jest` 전체 통과 · `git diff --stat`으로 변경 파일이 plan.md Source Code 목록(소스 2 + 로케일 10 + 테스트 4 + PROGRESS)과 일치하는지 확인 — 화면 파일(`src/app/**`) 변경 0
- [X] T026 quickstart.md §수동 검증 — Android 실기기 헤드업·소리·탭 경로·NUDGE 무동작·iOS 무변화 확인. 실기기가 없으면 결과란에 "미실시 — 발행 전 필수" 로 명기하고 PR 본문에 그대로 적는다(자기 완료 선언 금지) — **결과: 미실시 — 발행 전 필수(2026-09-11, 실기기 없음; PROGRESS·PR 본문 명기)**
- [X] T027 커밋·PR: `open-draft-pr` 스킬 규약(제목 `feat(push): …`, Jira 키는 브랜치·본문 `Jira:` 줄만). OTA 발행 명령은 실행하지 않는다(예진 승인 게이트)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: 즉시
- **Foundational (P2)**: T001 뒤. T003 → T004 순서(타입 import 대상이 먼저)
- **US1 (P3)** · **US2 (P4)**: 둘 다 Foundational 뒤. US1과 US2는 파일이 다르다(어댑터 vs inbox+로케일) → 병렬 가능. 단 T007(어댑터 record 가드)과 T010(inbox 가드)은 같은 미지-유형 요건을 양쪽에서 잠근다 — 둘 다 해야 US2 시나리오 5가 성립
- **US3 (P5)**: T006·T007 뒤(같은 `emit` 함수를 만짐)
- **US4 (P6)**: US3 뒤(같은 `addNotificationTapListener` try 블록) — 충돌 회피용 순서, 논리 의존 없음
- **Polish (P7)**: 전부 뒤

### User Story Dependencies

- **US1**: Foundational만
- **US2**: Foundational만 (US1과 독립 검증 가능 — inbox 테스트는 어댑터를 import하지 않음)
- **US3**: US1 (routeForNotificationData 5종이 있어야 MEAL_TIME 콜드스타트 케이스 성립)
- **US4**: 독립 — 순서는 파일 충돌 회피용

### Parallel Opportunities

- T008 ‖ T009 ‖ T012~T015 (테스트 2파일 + 로케일 10파일, 전부 다른 파일)
- T020 ‖ T021 (테스트 파일 2개)
- T023 ‖ T024
- 1인 작업이면 순서대로 T001→T027. 로케일 10파일은 한 커밋으로 묶는다(notifKeys 계열 테스트가 집합 일치를 보므로 부분 커밋 = 빨간 테스트)

---

## Parallel Example: User Story 2

```bash
# 테스트 2개 먼저(실패 확인):
Task: "T008 inbox216.test.ts 신규 3유형·미지·잔존 드롭 케이스"
Task: "T009 inboxKeys498.test.ts 신규"
# 로케일 10개 동시:
Task: "T012 ko.json" / "T013 en.json" / "T014 ja·zh-Hans·zh-Hant·vi" / "T015 id·th·ru·es"
# 그 뒤 순차:
Task: "T010 KEYS 5종 + 가드" → "T011 hydrate 필터" → "T016 검증"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

둘 다 P1이고 서버가 이미 새 유형을 보낸다 — 하나만 하면 "탭은 되는데 알림함이 비거나" 그 반대. US1+US2를 MVP로 묶는다.

1. T001~T004 (기반)
2. T005~T007 (US1) → `npx jest src/lib/push`
3. T008~T016 (US2) → `npx jest src/lib/notifications src/lib/i18n`
4. **STOP·검증**: tsc 0 · 전체 jest. 여기서 OTA 후보.

### Incremental Delivery

5. T017~T019 (US3, 통로만) → 후속 읽음 처리 작업 착수 가능
6. T020~T022 (US4) → Android 실기기 확인 필요 항목
7. T023~T027 (마무리·PR)

---

## Notes

- 유형 정의는 어댑터 한 곳. inbox는 `KEYS` 키 존재로 가드(런타임 순환 0) — T010에서 R1 세부를 이렇게 확정
- `NUDGE`/`NOTICE` 문자열은 소스 어디에도 남기지 않는다(테스트 `not.toContain` 잠금). 테스트 파일의 "null 기대" 케이스만 예외
- 포그라운드 핸들러 `shouldPlaySound: false`는 범위 밖 — 건드리지 않는다(research R4)
- `REMINDERS_KEY`·`scheduleReviewReminder` 무변경(FR-010)
- 자기 완료 선언 금지 — 실기기 미검증이면 PR에 명기

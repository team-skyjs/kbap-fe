# Research: 푸시 data 계약 반영 (KB-498)

Technical Context에 NEEDS CLARIFICATION은 없다. 아래는 구현 방식 결정 6건.

## R1. 유형 정의 위치

- **Decision**: `pushAdapter.ts`에 `PUSH_TYPES = ['HELPFUL','SCAN_SUGGESTION','REVIEW_REMINDER','NEWS','MEAL_TIME'] as const`, `PushType`, `isPushType(v): v is PushType` 정의. `inbox.ts`는 `import type { PushType }`만 하고, 런타임 가드는 자기 `KEYS` 맵의 키 존재(`typeof t === 'string' && t in KEYS`)로 한다 — 어댑터를 런타임 import하면 api client·beAuth·react-query가 inbox 테스트에 딸려 들어온다.
- **Rationale**: 현재 두 파일이 각자 리터럴 유니온을 중복 선언한다(`'HELPFUL' | 'REVIEW_REMINDER' | 'NUDGE' | 'NOTICE'` 2벌). 한 곳으로 모으면 다음 개명 때 한 줄. 어댑터가 inbox를 지연 `require`하므로 inbox→adapter는 type-only import여야 런타임 순환이 없다.
- **Alternatives**: 별도 `src/lib/push/types.ts` — 파일 1개 더. 현재 두 파일 외 소비자가 없어 기각.

## R2. `routeForNotificationData` 확장

- **Decision**: switch 5 케이스. SCAN_SUGGESTION·MEAL_TIME → `/scan`, NEWS → `null`, 나머지 기존. `default: null` 유지 → NUDGE·NOTICE·대소문자 변형은 자동으로 무동작(FR-001·엣지 "정확 일치").
- **Rationale**: 시그니처 `(data: unknown) => string | null` 유지 — 알림함 화면(`app/notifications.tsx`)이 그대로 소비.
- **Alternatives**: 유형→경로 맵 객체 — switch와 같은 길이, 기각.

## R3. notificationId 전달 통로

- **Decision**: 콜백 시그니처를 `onRoute(href: string, notificationId?: number | string)`로 확장. `emit`에서 `data.notificationId`를 그대로(형 변환 없이) 두 번째 인자로 넘긴다. 없으면 `undefined`. 콜드 스타트는 `getLastNotificationResponseAsync`와 응답 리스너가 같은 탭을 둘 다 전달할 수 있으므로 `emit`에 `request.identifier` 기준 `Set` 중복 차단 한 줄을 둔다(스펙 US3-3 "1회 전달" 보장).
- **Rationale**: 루트 레이아웃의 `(href) => router.push(href)`는 추가 인자를 무시하므로 무수정 호환(FR-003). 문자열로 와도 강제 변환 안 함(엣지 케이스 — 후속 읽음 처리 작업이 판단).
- **Alternatives**: 객체 인자 `{ href, notificationId }` — 호출부 수정 필요. `routeForNotificationData`가 튜플 반환 — 알림함 화면까지 바뀜. 둘 다 기각.

## R4. Android 채널 설정

- **Decision**: `addNotificationTapListener` try 블록 안에서 `Platform.OS === 'android'`일 때만 `void N.setNotificationChannelAsync('default', { name: 'Default', importance: N.AndroidImportance.MAX, sound: 'default' }).catch(() => {})`. 결과를 기다리지 않는다.
- **Rationale**: 리스너 등록이 앱 생애 1회(루트 레이아웃 effect)라 "1회 설정" 요건과 자연히 일치. `loadNotifications()` 이후 호출이므로 플래그 off = 호출 0(FR-008). `setNotificationChannelAsync`는 멱등(같은 id 재호출 = 갱신). 실패는 catch로 삼켜 부팅 무영향(엣지). 서버 발송이 `channelId: "default"`·`priority: high`·`sound: default`라 채널만 맞추면 헤드업이 뜬다. API: `setNotificationChannelAsync(channelId, channel: NotificationChannelInput)` · `AndroidImportance.MAX` — SDK 38부터 안정 API(BE 가이드 §Android 채널도 동일 호출 권장). 로컬 d.ts 대조 완료(expo-notifications 56.0.23): `setNotificationChannelAsync(channelId, NotificationChannelInput)` — `name`·`importance` 필수, `sound?: string | null`, `AndroidImportance.MAX = 7`.
- **주의**: 포그라운드 핸들러의 `shouldPlaySound: false`는 앱이 앞에 있을 때 동작이며 이 작업 범위 밖(스펙은 도착 배너·소리를 채널로 다룸). 변경하지 않는다.
- **Alternatives**: `app.json` 플러그인 설정 — 네이티브 변경이라 OTA 불가. 별도 `initPushChannels()` export — 호출부 추가 필요. 둘 다 기각.

## R5. 알림함 미지 유형 처리

- **Decision**: `KEYS` 맵을 모듈 상수로 승격하고, `recordInboxNotification` 진입에서 `entry.type in KEYS` 아니면 return. `hydrateInbox`에서 저장분을 `filter(n => typeof n?.data?.type === 'string' && n.data.type in KEYS)`로 걸러 구 NUDGE/NOTICE 잔존 항목을 드롭. 테스트용 `_resetInboxForTest({ rehydrate: true })`가 `hydrated=false·hydrating=null`을 열어 재하이드레이트를 검증한다.
- **Rationale**: 현재 `record()`는 `d.type as ...` 캐스팅이라 미지 유형이 `KEYS[type]` undefined → titleKey 없는 빈 항목으로 쌓인다(US2 시나리오 5 위반). 하이드레이트 필터는 한 줄로, 구 키가 제거된 뒤 알림함에 `inbox.nudgeTitle` 같은 키 문자열이 그대로 노출되는 것을 막는다. 스펙 "구 이름 호환 처리 안 함"과 일치(변환이 아니라 폐기).
- **Alternatives**: 잔존 항목을 SCAN_SUGGESTION으로 마이그레이션 — 스펙이 호환 금지. 기각.

## R6. i18n 키 교체 및 패리티 테스트

- **Decision**: 10로케일 `inbox` 블록에서 `noticeTitle/Body`·`nudgeTitle/Body` 제거, `scanSuggestionTitle/Body`·`newsTitle/Body`·`mealTimeTitle/Body` 추가. 신규 테스트 `inboxKeys498.test.ts`가 `notifKeys497` 패턴 그대로 inbox 키 집합 일치 + 구 키 잔존 0을 잠근다.
- **Rationale**: FR-004·FR-005. 기존 497 테스트는 notif·push 네임스페이스만 본다.
- **문구 원칙**: 광고성 3종은 "(광고)"·수신거부 안내를 넣지 않는다(서버가 푸시 본문에 붙임 — FR-006; 알림함 로컬 문구는 유형 설명용 요약). ko 기준 — 스캔 제안 "오늘 외식하세요? / 주문 전에 메뉴를 스캔해 보세요"(구 nudge 문구 재사용), 식사 시간 "식사 시간이에요 / 메뉴판을 스캔하면 내 기피 재료를 바로 확인할 수 있어요", 소식 "K-Bap 소식 / 새 기능과 이벤트 안내를 확인하세요". 기존 `nudge` 문구는 `scanSuggestion`으로 키만 옮겨 번역 재사용(10로케일 이미 존재).
- **Alternatives**: 서버 문자열을 알림함에 저장 — 후속 작업(서버 알림함 전환) 범위. 기각.

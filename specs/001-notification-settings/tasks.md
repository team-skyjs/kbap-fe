# Tasks: 알림 설정 2그룹 재편 + 서버 정본화 (KB-497)

**Input**: `specs/001-notification-settings/` — plan.md · spec.md · research.md · data-model.md · contracts/notification-settings-api.md · quickstart.md
**Branch**: `feat/kb497-notification-settings`
**Tests**: 포함 — CLAUDE.md 완료 기준(tsc 0 · jest 전체 통과 · 신규 로직엔 그 버그를 정확히 잡는 테스트 동반). 각 스토리는 테스트 → 구현 순.
**결정 반영(2026-09-11)**: 홈 통합 표면(A안) 제외 · 온보딩 프라이머 제거 · 표면은 하단 시트 1종 · 설정 화면 동의는 식사 시간 토글 → 시트 · 토큰 등록 로그인 뒤(KB-543) · 설정 (회원, 기기) 단위·스키마 동일·기본값 전부 false(KB-544, 버전 헤더 값 미정).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능(다른 파일, 미완 태스크 의존 없음)
- **[Story]**: US1(설정 서버 정본) · US2(식사 시간 토글 → 동의 시트) · US3(게스트 배제) · US4(온보딩 직후 표면 없음) · US5(OS 권한 배너) · US6(스캔 프라이머 시트)

## Path Conventions

Expo/RN 단일 프로젝트. 소스 `src/`, 테스트는 인접 `__tests__/` (예: `src/lib/push/__tests__/`). 관례: 소스 잠금 테스트 = 파일을 읽어 문자열 존재/부재 검사(`openExternal541.test.ts` 방식), 스타일 메트릭 비교 = P-138①.

---

## Phase 1: Setup

**Purpose**: 상수·URL·버전 헤더 자리 마련. 기존 코드 무변경.

- [X] T001 [P] `src/lib/push/consent.ts` 신설: `export const PRIVACY_CONSENT_VERSION = 1`, `export const RECEIVE_CONSENT_VERSION = 1`(정수 1~65535, 문구 개정 시 증가 주석), `export const NOTIF_SETTINGS_API_VERSION: string | null = null`(KB-544 새 X-API-Version 값 — 확정 전 null = 헤더 미전송·현행 회원 단위 레거시 사용, 주석에 BE 규약 "앱 릴리스 번호" 기재), `export function consentUrl(kind: 'privacy' | 'receive'): string`(LEGAL_URLS 매핑).
- [X] T002 [P] `src/lib/legalText.ts`의 `LEGAL_URLS`에 `marketingPrivacy: 'https://team-skyjs.github.io/kbap-legal/marketing-privacy.html'`, `marketingReceive: 'https://team-skyjs.github.io/kbap-legal/marketing-receive.html'` 추가(as const 유지, `LegalDoc` 타입 자동 확장 — `fetchLegalText` 호출측 영향 없음 확인).
- [X] T003 [P] i18n 10파일(`src/lib/i18n/{ko,en,ja,zh-Hans,zh-Hant,vi,id,th,ru,es}.json`) `notif.*` 키 교체: 제거 `helpful, helpfulSub, reminder, reminderSub, nudge, nudgeSub, marketing, marketingSub, night, nightSub` / 추가·변경 `activityGroup="내 활동 알림", activity="활동 알림", activitySub="리뷰 반응 · 식사 후 리뷰 작성", newsGroup="K-Bap 소식", news="소식 알림", newsSub="이벤트·새 기능 소식 (광고성)", mealTime="식사 시간 알림", mealTimeSub="점심·저녁 메뉴 스캔 알림 (광고성)", consentStatus="광고성 수신 동의 · {{date}} · v{{version}}", viewFull="전문 보기", readFailed, osOff="기기 설정에서 알림이 꺼져 있어요.", osOffCta="기기 설정 열기"`(섹션 설명·하단 안내문 키 없음 — Codex 리라이트 2026-09-11). `push.*`: `primerTitle="리뷰 알림을 받을까요?", primerBody="스캔한 메뉴, 1시간 뒤 리뷰 작성을 알려드려요.", primerYes="알림 켜기", primerLater="나중에", consentSheetTitle="K-Bap 소식을 받을까요?", consentSheetBody="이벤트·새 기능 소식을 광고성 알림으로 보내요.", privacyConsent="마케팅 목적 개인정보 수집·이용 동의 (선택)", receiveConsent="광고성 정보 수신 동의 (선택)", consentConfirm="동의하고 알림 켜기"`(힌트 문구 없음 — 종한이 피그마에서 삭제, 9/11). 한국어는 위 값 그대로(피그마 시안 1·2·3 일치), 나머지 9개 언어는 초벌 번역(검수 표시 주석 없음 — 파일 형식상 불가 → PR 본문에 검수 요청). `push.primerTitle/primerBody/primerYes/primerLater`는 시트가 재사용하므로 유지.
- [X] T004 [P] `src/lib/i18n/__tests__/notifKeys497.test.ts` 신설: 10로케일 JSON을 읽어 `notif`·`push` 네임스페이스 키 집합이 ko와 완전히 일치하고, 구 키(`notif.helpful`, `notif.reminder`, `notif.nudge`, `notif.marketing`, `notif.night`) 가 어느 로케일에도 없음을 단언 (SC-007).

---

## Phase 2: Foundational (Blocking)

**Purpose**: 서버 정본 데이터 층 + 로컬 설정 코드 제거 + 토큰 등록 세션 가드. 모든 스토리가 의존.

- [X] T005 `src/lib/data/__tests__/useNotificationSettings497.test.tsx` 신설(구현 전 작성, 실패 확인): (a) GET `/api/notifications/settings` 응답이 그대로 캐시(`['notifSettings']`)에 들어감 (b) `patch({activity:true})` → 캐시 즉시 `activity:true`(낙관) → 서버 응답 전체로 교체 (c) PATCH 실패 시 캐시가 스냅샷으로 롤백되고 `error` 노출 (d) 두 PATCH 연속 발사 후 첫 응답이 늦게 도착하면 무시되고 마지막 응답만 반영(seq) (e) `NOTIF_SETTINGS_API_VERSION`이 문자열이면 두 요청에 `X-API-Version` 헤더가 그 값으로 실리고 null이면 헤더 오버라이드 없음 (f) `queryClient.clear()`(계정 전환) 후 캐시 없음. api client는 `jest.mock('@/lib/api/client')`.
- [X] T006 `src/lib/data/useNotificationSettings.ts` 신설: 타입 `NotificationSettings = { activity: boolean; news: { enabled: boolean; mealTime: boolean; privacyConsent: {version:number; grantedAt:string} | null; receiveConsent: {version:number; grantedAt:string} | null } }`, `NotificationSettingsPatch = { activity?: boolean; news?: { enabled?: boolean; mealTime?: boolean; privacyConsentVersion?: number; receiveConsentVersion?: number } }`. `export const NOTIF_SETTINGS_KEY = ['notifSettings'] as const`. `useNotificationSettings()` = `useQuery({queryKey, queryFn: GET, staleTime: 0})`. `useUpdateNotificationSettings()` = `useMutation` — `onMutate`: 스냅샷 + 예측값 적용(activity/mealTime 반전, `news.enabled:true` 예측 = `{enabled:true, mealTime:true, consents:{version, grantedAt: now}}`) + 모듈 `seq` 증가 후 컨텍스트에 보관; `onError`: 스냅샷 복원; `onSuccess`: `ctx.seq === latestSeq`일 때만 `setQueryData(응답)`. 요청 헤더: `NOTIF_SETTINGS_API_VERSION`이 있으면 `{headers:{'X-API-Version': …}}` (P-153 `RequestOpts.headers`). T005 통과 확인.
- [X] T007 `src/lib/push/__tests__/pushAdapter192.test.ts` 갱신 + `src/lib/push/__tests__/tokenGuard543.test.ts` 신설: (a) `hasBeSession` mock false → `registerPushToken()` 호출 시 `api.put` 0회 (b) true + 권한 granted → PUT 1회, 본문 키가 정확히 `{token, platform, lang}`이고 `settings` 키 없음, `lang === apiLang()` (c) PUT이 401 reject 해도 `registerPushToken()`은 resolve(비치명) (d) `scheduleReviewReminder`는 `queryClient.getQueryData(['notifSettings'])?.activity !== true`면 예약 0회. 기존 `getPushSettings/savePushSettings` 관련 it 블록 삭제.
- [X] T008 `src/lib/push/pushAdapter.ts` 수정: `PushSettings`·`DEFAULT_PUSH_SETTINGS`·`getPushSettings`·`savePushSettings`·`SETTINGS_KEY` 삭제. `registerPushTokenInner` 첫 줄에 `if (!(await hasBeSession())) return;`(import `@/lib/auth/beAuth`). `scheduleReviewReminder`의 `settings.reviewReminder` 게이트를 `queryClient.getQueryData<NotificationSettings>(NOTIF_SETTINGS_KEY)?.activity === true`로 교체(import `@/lib/queryClient` — 실제 경로는 `grep -rn "export const queryClient" src/lib`로 확인). 헤더 주석의 "3종" 설명을 2그룹(활동/소식)으로 갱신. T007 통과 확인.
- [X] T009 `src/lib/push/guestConsent.ts` 삭제 + `src/lib/push/__tests__/`에서 guestConsent 테스트 파일 삭제(`grep -rln guestConsent src`로 전수 확인 — `notifications.tsx`·`guestProfile311.test.ts` 참조는 US3에서 정리).
- [X] T010 `src/lib/auth/useSocialAuth.ts`: `onSignedIn(exch.newMember)`·`onSignedIn(res.newMember)` 직전에 `void registerPushToken()` 1회 추가(import `@/lib/push/pushAdapter`, `FLAGS.pushEnabled` 게이트는 pushAdapter 내부 `loadNotifications`가 담당하므로 호출측 조건 불필요). `src/lib/auth/__tests__/loginTokenRegister543.test.ts` 신설: 소셜 로그인 성공 경로에서 `registerPushToken`이 정확히 1회 호출됨(소스 잠금 + mock 호출 카운트).
- [X] T011 `src/features/push/__tests__/sourceLock497.test.ts` 신설(소스 잠금): `src/` 전체에서 `kbap.push.settings.v1`, `guestConsent`, `getPushSettings`, `savePushSettings` 문자열 0건; `src/app/_layout.tsx`에 `languageChanged` 리스너 → `registerPushToken` 배선 존재(FR-019).

**Checkpoint**: 데이터 훅·토큰 가드 준비. tsc는 US1 화면 재작성 전까지 `notifications.tsx`에서 실패할 수 있음 — Phase 3을 바로 이어서 진행.

---

## Phase 3: User Story 1 — 이 기기의 알림 설정을 서버에 저장하고 같은 값을 본다 (P1) 🎯 MVP

**Goal**: 설정 화면을 서버 정본·2그룹(활동 푸시 / K-Bap 소식의 식사 시간 알림)으로 재작성. 낙관 반영·롤백·스켈레톤·재시도.

**Independent Test**: 회원으로 설정 화면 진입 → 서버 값 표시 → 활동 푸시 토글 → 즉시 반전·PATCH → 화면 재진입 시 유지. 네트워크 차단 시 원복 + 실패 배너.

- [X] T012 [US1] `src/app/profile/__tests__/notificationSettings497.test.tsx` 신설(구현 전): mock `useNotificationSettings`/`useUpdateNotificationSettings`/`getPermissionStatus`. (a) `isLoading` → `notif-skeleton` 렌더, 스위치 testID 0개 (b) `isError` → `notif-read-error` 배너, 탭 시 `refetch` 1회 (c) 데이터 → `notif-activity` 스위치 = `activity`, `notif-news` 스위치 = `news.enabled`, `notif-mealtime` 스위치 = `news.mealTime`이며 `!news.enabled`면 비활성(행 opacity·탭 무동작), `news.enabled`일 때만 `notif-consent-status` 캡션(날짜·버전) 표시 (d) 활동 토글 탭 → `mutate({activity: !cur})` 1회 (e) mutation `isError` → `notif-save-failed` 배너 (f) 그룹 라벨 렌더: `notif.activityGroup`, `notif.newsGroup`(섹션 설명 텍스트 없음).
- [X] T013 [US1] `src/app/profile/__tests__/notificationSettingsMetrics497.test.tsx` 신설: `Switch` on/off, 식사 시간 행 활성/비활성, 캡션 유무 상태의 `StyleSheet.flatten` 메트릭(width·height·padding·borderWidth·borderRadius) 동일 단언(P-151, SC-008). 색·opacity만 차이 허용.
- [X] T014 [US1] `src/app/profile/notifications.tsx` 재작성: 헤더 주석 갱신(2그룹·서버 정본·KB-497). 게스트 분기는 임시로 `<Redirect href="/" />`(US3에서 AuthGateSheet로 교체). 회원: `useNotificationSettings()` → `isLoading` = `Shimmer` 2행(testID `notif-skeleton`), `isError` = 재시도 배너(`notif.readFailed`, testID `notif-read-error`, onPress `refetch`), 데이터 = 흰 배경(카드 사각형·섹션 설명 없음 — 시안 1·1b) 그룹 2개: ① 헤딩 `notif.activityGroup`, 행 `notif.activity`/`activitySub` + `Switch`(testID `notif-activity`) ② 헤딩 `notif.newsGroup`, 행 `notif.news`/`newsSub` + `Switch`(testID `notif-news`), hair, 행 `notif.mealTime`/`mealTimeSub` + `Switch`(testID `notif-mealtime`, `!news.enabled`면 행 opacity 0.4 + `disabled`), `news.enabled`면 아래 캡션 `notif.consentStatus`(두 동의 중 최근 grantedAt→날짜, receiveConsent.version) + `notif.viewFull` 링크(`openWebPage(consentUrl('receive'))`, testID `notif-consent-status`). 활동 토글 = `mutate({activity: !s.activity})`. 식사 시간 토글 = `news.enabled`일 때만 `mutate({news:{mealTime: !s.news.mealTime}})`. 소식 토글은 US2에서 배선(이 단계에선 ON→OFF만 `mutate({news:{enabled:false}})`, OFF→ON은 no-op). 저장 실패 배너 `notif.saveFailed`(testID `notif-save-failed`, mutation.isError). OS 배너·AppState 재조회는 기존 코드 유지. `ToggleRow`/`Switch` 컴포넌트는 기존 것 유지(프레임 불변). T012·T013 통과 확인.
- [X] T015 [US1] `src/features/push/__tests__/pushSurfaces192.test.tsx`·`src/app/__tests__/modalSerialize267.test.tsx`의 `getPushSettings/savePushSettings` mock 제거 및 관련 it 갱신(설정 화면 관련 단언은 T012로 이관). `npx tsc --noEmit` 0 오류 · `npx jest` 통과 확인.

**Checkpoint**: 설정 화면이 서버 정본으로 동작. 광고성 동의 흐름(US2) 전이라 식사 시간 토글은 동의된 기기에서만 동작.

---

## Phase 4: User Story 2 — 식사 시간 알림 토글로 광고성 소식을 켜고 끈다 (P1)

**Goal**: 하단 시트 컴포넌트 1종 신설(프라이머/동의 겸용). 「소식 알림」 OFF→ON = 시트, 둘 다 체크 + 확인 = `news.enabled:true` + 버전 2종, 「소식 알림」 ON→OFF = `news.enabled:false`. 「식사 시간 알림」은 소식 ON일 때만 `news.mealTime` 토글.

**Independent Test**: 소식 꺼진 회원이 「소식 알림」 탭 → 시트(확인 비활성) → 하나 체크(비활성 유지) → 둘 체크 → 확인 → PATCH `{news:{enabled:true, privacyConsentVersion:1, receiveConsentVersion:1}}` → 소식·식사 시간 ON + 캡션. 「식사 시간 알림」 OFF → `{news:{mealTime:false}}`, 캡션 유지. 「소식 알림」 OFF → `{news:{enabled:false}}`, 식사 시간 비활성·캡션 사라짐.

- [X] T016 [P] [US2] `src/features/push/__tests__/notificationSheet497.test.tsx` 신설(구현 전): `NotificationSheet` (a) `variant="primer"`: 제목·본문·`push.primerYes`·`push.primerLater` 렌더, 체크 행 없음, 확인 탭 → `onConfirm({})` (b) `variant="consent"`: 체크 2행(testID `consent-privacy`, `consent-receive`) + 각 `viewFull` 링크 → `openWebPage(consentUrl(kind))` 1회, 확인 버튼은 둘 다 체크 전 `disabled`(탭해도 onConfirm 0회), 둘 다 체크 후 탭 → `onConfirm({privacy:true, receive:true})` 1회 (c) 「나중에」/스크림 탭 → `onClose` 1회, onConfirm 0회 (d) 확인은 `useSubmitGuard` 경유 — 더블탭 시 onConfirm 1회 (e) 체크 전후 체크박스 컨테이너 메트릭 동일(P-151).
- [X] T017 [P] [US2] `src/features/push/NotificationSheet.tsx` 신설: `AuthGateSheet`/`ActionSheet` 골격(Modal fade + 스크림 + 하단 시트, `useSheetSwipeDismiss`) 재사용. props `{ open, variant: 'primer' | 'consent', title, body, confirmLabel, onConfirm(consents?: {privacy:boolean; receive:boolean}) => Promise<void> | void, onClose }`. consent 변형: 체크 행 2개(`IconCheck` SVG, 미체크는 같은 크기 투명 아이콘 슬롯 — 프레임 불변), 라벨 `push.privacyConsent`/`push.receiveConsent`, `notif.viewFull` 링크(힌트 문구 없음), 확인 `Btn busy`(`useSubmitGuard`) — 둘 다 체크 전 `disabled`(색·opacity만). primer 변형: 아이콘 없음(시안 2), 제목/본문/확인/나중에. 시안: 피그마 3번(consent)·2번(primer). T016 통과.
- [X] T018 [US2] `src/app/profile/__tests__/notificationSettings497.test.tsx`에 US2 케이스 추가: (a) `news.enabled=false`에서 `notif-news` 탭 → mutate 0회 + `NotificationSheet` open(variant consent) (b) 시트 onConfirm({privacy:true,receive:true}) → `mutate({news:{enabled:true, privacyConsentVersion:PRIVACY_CONSENT_VERSION, receiveConsentVersion:RECEIVE_CONSENT_VERSION}})` 1회 + 시트 닫힘 (c) 시트 onClose → mutate 0회, 스위치 OFF 유지 (d) `news.enabled=true`에서 `notif-news` 탭 → `mutate({news:{enabled:false}})` (e) `news.enabled=true`에서 `notif-mealtime` 탭 → `mutate({news:{mealTime: !cur}})` (f) `news.enabled=false`에서 `notif-mealtime` 탭 → mutate 0회·시트 0회(비활성) (g) PATCH 실패(400 NOTIFICATION-001 포함) → 롤백 + `notif-save-failed`.
- [X] T019 [US2] `src/app/profile/notifications.tsx` 소식·식사 시간 토글 배선: 위 (a)~(f) 분기 + `NotificationSheet variant="consent"` 렌더(`push.consentSheetTitle`/`consentSheetBody`/`consentConfirm`), `track(EVENTS.push_pref_toggle, {key:'news'|'mealTime', on})`. T018 통과.
- [X] T020 [US2] `src/app/profile/__tests__/notificationSettings497.test.tsx`에 계정 생애주기 케이스: `queryClient.clear()` 후 리마운트 시 refetch 1회 + 이전 계정 값 미표시(스켈레톤 경유). 소스 잠금: `notifications.tsx`에 `AsyncStorage` import 0건.

**Checkpoint**: US1+US2 = 설정 화면 완성(시안 1·1b·3).

---

## Phase 5: User Story 6 — 스캔 후 리뷰 알림 문의(프라이머 시트) 유지 (P2)

**Goal**: 스캔 결과 프라이머를 `PushPrimerModal`(가운데 모달) → `NotificationSheet variant="primer"`로 교체. 수락 = 기록 → OS 권한 → 허용 시 토큰 등록(세션 가드는 pushAdapter) + 회원이면 `activity:true` PATCH. 코치마크 직렬화 유지.

**Independent Test**: 프라이머 기록 없는 기기, 첫 스캔 결과 → 시트 → 「알림 켜기」 → `markPrimerResult('accepted')` → `requestPermission` → granted → `registerPushToken` → (회원) PATCH `{activity:true}`. 게스트는 PATCH 0회.

- [X] T021 [US6] `src/features/push/__tests__/pushSurfaces192.test.tsx` 갱신: 프라이머 케이스를 시트 기준으로 — (a) 수락 순서 `markPrimerResult → requestPermission → registerPushToken → (hasBeSession) patch({activity:true})` (b) 거절 = `markPrimerResult('declined')`만, OS 팝업 0 (c) 게스트(hasBeSession false) 수락 → OS 팝업은 뜨되 PATCH 0회 (d) 권한 denied → PATCH 0회 (e) `scan.tsx` 소스 잠금: `NotificationSheet` 사용 + `maybeShowPrimer`가 코치마크 닫힘 뒤에만 호출(기존 KB-377 단언 유지) (f) `onboarding/index.tsx`에 `PushPrimerModal`·`NotificationSheet`·`getPrimerResult` 참조 0건.
- [X] T022 [US6] `src/features/push/PushPrimerModal.tsx` → 내부를 `NotificationSheet variant="primer"` 래퍼로 교체(파일명·export `PushPrimerModal`·props `{open, onDone, surface:'scan'}` 유지해 호출측 diff 최소; `surface` 타입에서 `'onboarding'` 제거). accept: 기존 순서 유지 + `if (granted && (await hasBeSession())) await patchNotificationSettings({activity:true})` — 훅 밖 호출용으로 `useNotificationSettings.ts`에 `export async function patchNotificationSettings(patch)` 추가하되 **T006의 모듈 seq 카운터를 공유**해 응답이 최신 요청일 때만 `setQueryData`(프라이머 응답 지연 중 사용자가 설정에서 끈 값을 되돌리지 않음 — spec Edge 마지막 항목). T021에 해당 케이스 단언 추가. T021 통과.
- [X] T023 [US6] `src/app/onboarding/index.tsx`: `pushPrimer` 상태·`PushPrimerModal` 렌더·`getPrimerResult` 분기·import 삭제 → 제출 성공 시 항상 `router.replace('/(tabs)')` (US4/FR-013). `src/app/__tests__/modalSerialize267.test.tsx` 관련 단언 갱신.

---

## Phase 6: User Story 3 — 게스트는 알림 설정에 들어갈 수 없다 (P2)

**Goal**: 프로필 탭 게스트 분기의 알림 설정 행 제거 + 설정 화면 게스트 = `AuthGateSheet`.

**Independent Test**: 게스트 프로필 탭에 알림 설정 행 없음. 딥링크 진입 시 `AuthGateSheet`만 렌더, 스위치 0개. 로그인 완료 후 복귀 시 서버 값 표시.

- [X] T024 [P] [US3] `src/app/__tests__/guestProfile311.test.ts` 갱신: 게스트 분기 소스에 `profile/notifications` 링크 0건(회원 분기 1건), `notifications.tsx`에서 `guestConsent` 참조 0건·`AuthGateSheet` 사용 1건. `src/app/profile/__tests__/notificationSettings497.test.tsx`에 게스트 케이스: `useIsGuest` true → `AuthGateSheet` open, `notif-activity`/`notif-mealtime` 0개, `useNotificationSettings` 미호출(또는 `enabled:false`).
- [X] T025 [US3] `src/app/(tabs)/profile.tsx` 게스트 분기(첫 번째 `MenuRow label={t('notif.title')}`, 약 161행)의 알림 설정 행 제거. 회원 분기(약 326행)는 유지.
- [X] T026 [US3] `src/app/profile/notifications.tsx` 게스트 분기를 `saved.tsx` 선례대로 `<View style={styles.root}><SubHeader …/><AuthGateSheet context="profile" open onClose={() => router.back()} /></View>`로 교체. `useNotificationSettings`는 `enabled: !isGuest`로 게스트 요청 0. T024 통과.

---

## Phase 7: User Story 5 — OS 알림 꺼짐 배너 (P3)

**Goal**: 기존 동작 유지 검증(시안 1 상단 배너 — 흰 배경 위 연회색 블록).

- [X] T027 [US5] `src/app/profile/__tests__/notificationSettings497.test.tsx`에 케이스: `getPermissionStatus` = 'denied' → `notif-os-off` 배너, 탭 → `Linking.openSettings` 1회; AppState 'active' → `getPermissionStatus` 재호출 + `registerPushToken` 호출(기존 KB-496 단언 이관).
- [X] T028 [US5] `src/app/profile/notifications.tsx` 배너 스타일을 시안대로(테두리·그림자 없음, `C.surface` 배경) 조정 — 메트릭 유닛(T013)에 배너 포함.

---

## Phase 8: User Story 4 — 온보딩 직후 표면 없음 (P2)

- [X] T029 [US4] `src/app/onboarding/__tests__/`(기존 온보딩 테스트 파일 — `grep -rln "pushPrimer\|PushPrimerModal" src/app/onboarding src/app/__tests__`로 특정)에서 프라이머 단언 제거 + "제출 성공 → `router.replace('/(tabs)')` 즉시 호출, 프라이머 모달 미렌더" 단언 추가 (T023 구현 검증).

---

## Phase 9: Polish & Cross-Cutting

- [X] T030 [P] `PROGRESS.md`에 KB-497 항목 추가: 결정 요약(시트 통일·홈 표면 제외·설정 (회원,기기) 단위·KB-543/544 의존·기본값 false), 남은 외부 의존(kbap-legal 전문 페이지 2개, KB-544 버전 값, 9개 언어 문구 검수, "나중에" 쿨다운 후속 티켓).
- [X] T031 [P] `specs/001-notification-settings/quickstart.md` §1 목록을 실제 테스트 파일명으로 갱신.
- [X] T032 `npx tsc --noEmit` 0 · `npx jest` 전체 통과 · `git diff --stat`으로 네이티브 소스(패키지·app.json·config plugin) 변경 0 확인.
- [ ] T033 quickstart §2·§3·§5 실기 시나리오(dev BE) 수행 — §4 기기별 독립은 KB-544 배포 후로 명시. 결과를 PR 본문에 기록. PR: `open-draft-pr` 스킬, 제목 `feat(push): 알림 설정 2그룹 재편 + 서버 정본화`, 본문 `Jira: KB-497` + 검수 요청(9개 언어·kbap-legal 페이지). Jira 전환 금지.

---

## Dependencies & Execution Order

- **Phase 1 (T001–T004)**: 서로 병렬. 의존 없음.
- **Phase 2 (T005–T011)**: T005→T006, T007→T008, T009는 T008 후, T010·T011은 T008 후 병렬. 모든 스토리의 전제.
- **US1 (T012–T015)**: Phase 2 후. T012·T013 병렬 → T014 → T015.
- **US2 (T016–T020)**: US1 후. T016·T017 병렬 → T018 → T019 → T020.
- **US6 (T021–T023)**: T017(NotificationSheet) 후. US1과 독립(병렬 가능).
- **US3 (T024–T026)**: US1 후. T024 → T025·T026 병렬.
- **US5 (T027–T028)**: US1 후.
- **US4 (T029)**: T023 후.
- **Polish (T030–T033)**: 전부 후.

### 병렬 예시
- Phase 1: T001 ∥ T002 ∥ T003 ∥ T004.
- US2 시작과 동시에 US6 T021·T022(T017 완료 시점부터).
- US3·US5는 US1 완료 직후 US2와 병렬.

## Implementation Strategy

- **MVP = Phase 1 + 2 + US1**: 설정 화면이 서버 정본으로 동작(활동 푸시 토글·스켈레톤·롤백). 이 시점에 tsc/jest 녹색 유지.
- **2차 = US2 + US6**: 시트 컴포넌트 1종으로 동의·프라이머 완성, 온보딩 프라이머 제거.
- **3차 = US3·US5·US4 + Polish**: 게스트 배제, 배너, 정리, PR.
- KB-544 배포 전에는 `NOTIF_SETTINGS_API_VERSION = null`로 회원 단위 레거시에 붙어 동작 — 값 확정 시 상수 1줄.

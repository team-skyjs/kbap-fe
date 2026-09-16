# Research: 푸시 탭 착지 화면 확정 (KB-573)

Phase 0 산출물. 스펙의 NEEDS CLARIFICATION 1건과 구현 선택지를 코드·라이브러리 소스 읽기로 해소했다.

## R-1. 스캔 제안(SCAN_SUGGESTION) 착지 — 홈 탭 (스토리 4 · FR-003, 종한 확정 2026-09-16 /speckit-clarify)

- **Decision**: `'/(tabs)'` — 식사 시간과 동일 매핑·동일 이동(R-2). 플랜 초안의 기본값 `/scan`은 폐기.
- **Rationale**: 종한 확정. 홈에 스캔 진입점·최근 주문이 있어 광고성 유도 2종(식사 시간·스캔 제안)의 출발점을 하나로 둔다. 스캔 화면 직행은 카메라 권한·촬영 맥락이 갑작스럽다.
- **Alternatives considered**: `/scan` 직행(알림 의도 직결, 9/11 원안) — 종한이 홈 선택. 임시 화면 유지 — 스토리 3 불가. 기각.

## R-2. 홈 착지의 이동 방식 — 스택 리셋 + 탭 점프 (FR-001 · AS 1.3)

- **Decision**: 홈(MEAL_TIME·SCAN_SUGGESTION)은 href `'/(tabs)'`(앱 관습 — login·onboarding·scan-order가 같은 문자열)로 표현하고, 이동은 `if (router.canDismiss()) router.dismissAll(); router.navigate('/(tabs)')`. 스택 리셋(뒤로 가기 대상 없음)은 종한 확정(clarify Q2).
- **Rationale**: expo-router 56.2의 StackRouter(`node_modules/expo-router/build/react-navigation/routers/StackRouter.js` NAVIGATE 케이스)는 getId가 없을 때 **대상 name이 현재 최상단과 다르면 새로 push**한다(`pop` 페이로드 없음). 즉 `/profile/reviews` 위에서 `push('/(tabs)')`·`navigate('/(tabs)')` 모두 (tabs)를 한 장 더 쌓는다 → AS 1.3 위반. `dismissAll`(POP_TO_TOP)로 루트 스택을 `[(tabs)]`로 만든 뒤 `navigate('/(tabs)')`하면 `findDivergentState`가 탭 내비게이터에서 분기(다른 탭이면 JUMP_TO index, 이미 index면 무동작). `src/lib/nav.ts`의 `resetToOnboarding`·`scan-order.tsx`가 같은 dismissAll 선행 패턴.
- **Alternatives considered**: `dismissTo('/(tabs)')`(POP_TO) — 이미 (tabs) 최상단이고 다른 탭일 때 분기가 탭 내비게이터로 잡혀 POP_TO를 처리하지 못한다(TabRouter 미지원). `replace('/(tabs)')` — 탭 내비게이터 REPLACE 미지원으로 루트 스택 REPLACE로 튀어 tabs 재마운트. 기각.

## R-3. 이동 헬퍼 1곳 + 나머지 경로는 `navigate` (FR-005 · 엣지 "두 번 쌓이지 않음")

- **Decision**: `src/lib/nav.ts`에 `openNotificationRoute(router, href)` 추가. `'/(tabs)'`면 R-2, 그 외는 `router.navigate(href)`. 호출부 2곳(`app/_layout.tsx` 탭 콜백 · `app/notifications.tsx` 알림함 항목 탭)이 `router.push` 대신 이 헬퍼를 쓴다.
- **Rationale**: `routeForNotificationData`는 순수 매핑(문자열)으로 유지하고 "어떻게 가는가"는 헬퍼 1곳. 호출부가 이미 2곳이라 각자 dismissAll을 박으면 P-168류 중복 구현. `navigate`는 대상 name이 **현재 최상단과 같으면 재사용**(파라미터 갱신)이라 HELPFUL 2건 연속 탭에도 `/profile/reviews`가 두 장 쌓이지 않는다(clarify Q3 — 권고안 채택). 같은 알림 2회 탭은 어댑터의 `routed` Set(identifier)이 이미 차단.
- **Consequence**: REVIEW_REMINDER는 push→navigate로 바뀐다 — `/food/7` 최상단에서 `/food/9` 탭 시 새 화면을 쌓지 않고 같은 화면의 `id` 파라미터만 갱신(`food/[id]/index.tsx`는 `useLocalSearchParams`로 id를 읽어 쿼리 키가 바뀜). 푸시 탭 맥락에선 적절하지만 실기 확인 항목(quickstart D-6).
- **Alternatives considered**: 호출부 `push` 유지 + 홈만 특수 처리 — 문자열 분기가 호출부 2곳에 중복. 헬퍼에서 홈만 특수 처리하고 나머지는 push — 중복 스택 방지가 빠진다. 기각.

## R-4. 콜드 스타트 — 탭 리스너 등록을 부트 게이트(entryChecked) 뒤로 (FR-005 · 엣지 "시작 시퀀스 뒤 착지")

- **Decision**: `_layout.tsx` 푸시 배선 effect를 `if (!FLAGS.pushEnabled || !entryChecked) return;` + deps `[router, entryChecked]`로 게이트.
- **Rationale**(소스 읽기 기반 — 실기 미관측): 현재는 RootLayout 마운트 즉시 리스너를 달고 `getLastNotificationResponseAsync`(콜드 스타트 탭 응답, ms 단위 즉시 해소)를 조회한다. 그런데 `<Stack>`은 `entryChecked`(스플래시 게이트 최소 1200ms) 뒤에야 렌더된다. expo-router는 이동을 `routingQueue`에 넣고 `useImperativeApiEmitter`의 effect에서 `getNavigateAction`을 호출하는데, 첫 줄 `store.assertIsReady()`가 내비게이터 미마운트면 **throw**("Attempted to navigate before mounting the Root Layout component…", `build/global-state/store.js:127`). effect 안의 throw = 앱 크래시(또는 이동 유실). 로그인 리다이렉트 effect가 `entryChecked`를 기다리는 것과 같은 이유(P-041/P-217 "판별 전 리다이렉트 금지"). 게이트를 두면 순서가 스플래시 → Stack 마운트 → (fresh면 /login replace) → 리스너 등록 → 마지막 응답 조회 → 착지로 직렬화된다.
- **Consequence**: Android 채널 2종 설정·포그라운드 발화 기록 리스너도 entryChecked 뒤로 밀린다 — 무해(채널은 발송 전 1회면 되고, 발화분은 `getPresentedNotificationsAsync` 회수가 있다). 온보딩 미완료는 강제 게이트가 아니라 배너(`ResumeOnboardingBanner`)·로그인 직후 `resetToOnboarding`뿐이라 푸시 착지와 충돌하지 않는다.
- **Alternatives considered**: 어댑터 안에서 지연·재시도 — 어댑터가 부트 상태를 몰라야 한다(단일 관문 원칙). 기각.

## R-5. 임시 화면 제거 범위 (FR-006 · SC-003)

- **Decision**: 삭제 = `src/app/push-landing.tsx` · `push.landingTbdTitle`/`push.landingTbdBody` 10로케일. 교체 = `routeForNotificationData` HELPFUL·SCAN_SUGGESTION·MEAL_TIME case. 잠금 = pushAdapter192 매핑 테스트 기대값 교체 + 10로케일 `push.landingTbd*` 부재 루프(기존 `inboxKeys498` 스타일 fs 로드) + 어댑터 소스에 `push-landing` 문자열 0 (remoteImageSkeleton207식 소스 잠금 1건).
- **Rationale**: 참조는 grep으로 확인한 4곳(어댑터·화면·로케일·테스트)뿐. `notifications.tsx`는 매핑 함수를 호출만 하므로 무수정(헤더 주석은 이미 "HELPFUL→내 리뷰").

## R-6. 문서 갱신 (FR-009)

- **Decision**: `specs/002-push-data-contract/spec.md`(개요 단락·AS 1·2·5·FR-002)와 `contracts/push-notification-data.md` §2 표를 이 결정으로 갱신. specs/002 `research.md`는 당시 기록이라 손대지 않는다. PROGRESS.md에 KB-573 항목 추가. 메모리 `push-tap-landing-decisions` 갱신(SCAN_SUGGESTION 기본값·확인 대기).

## R-7. 알림함 화면 동승

- **Decision**: 로컬 알림함(`app/notifications.tsx`, 플래그 `notificationCenter`)도 같은 매핑·같은 헬퍼를 탄다. 서버 알림함 전환은 별도 작업(스펙 Assumptions)이지만 현 화면이 이미 `routeForNotificationData`를 재사용하므로 자동 동승 — 홈 착지는 알림함 화면을 dismissAll로 걷어내야 하므로 헬퍼 경유가 필수.

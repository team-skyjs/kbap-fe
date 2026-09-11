# Research: 알림 설정 2그룹 재편 + 서버 정본화 (KB-497)

2026-09-11. 코드·dev Swagger 실측 기반. 각 항목 = Decision / Rationale / Alternatives.

## R1. 동의 전문 표시 방식 (spec FR-009)

- **Decision**: 로그인 화면 약관 링크 선례(`login.tsx` — `openWebPage(LEGAL_URLS.terms|privacy)`)를 따라 **kbap-legal 정적 페이지를 인앱 브라우저로 연다**. `LEGAL_URLS`에 `marketingPrivacy`·`marketingReceive` 2개 추가. 로케일 대응은 페이지 쪽 책임(kbap-legal 레포, FE 범위 밖).
- **Rationale**: 앱 내 10로케일 전문 번역·번들 부담 0. 이미 두 곳(로그인·프로필 안전고지)이 같은 방식. KB-541로 정보성 링크 = `openWebPage` 원칙 확정.
- **Alternatives**: 온보딩 약관 스텝의 `fetchLegalText` → 플레인텍스트 바텀시트(P-080). 동의 표면이 모달 위라 시트 중첩(KB-377 교착 계열) 위험 → 기각. 앱 내 i18n 전문 내장 → 번역·개정 비용 → 기각.
- **Open**: kbap-legal에 두 페이지가 아직 없음. URL은 `https://team-skyjs.github.io/kbap-legal/marketing-privacy.html` / `marketing-receive.html`로 정하고 페이지 생성은 종한/spec 레포에 요청(FE 구현 차단 아님 — 상수 1곳).

## R2. 설정 정본 데이터 층

- **Decision**: `src/lib/data/useNotificationSettings.ts` — react-query `useQuery({queryKey:['notifSettings']})` + `useMutation`(PATCH). 낙관 갱신은 `onMutate`에서 캐시 스냅샷·즉시 반영, `onError` 롤백, `onSuccess`는 **모듈 seq 카운터로 최신 요청일 때만** 서버 전체 응답으로 캐시 교체. `staleTime: 0`, 화면 진입마다 refetch.
- **Rationale**: 레포의 데이터 훅 관례(useMe/useHome/useBookmarks) 그대로. 별도 스토어·컨텍스트 불필요. 연타 레이스(spec Edge)는 seq 비교 한 줄로 해결.
- **Alternatives**: 화면 로컬 useState + api 직접 호출(현행 게스트 동의 방식) → 계정 전환 시 캐시 무효화·프라이머와 화면 간 상태 공유가 안 됨 → 기각. zustand 등 신규 의존 → 금지(ladder 5).
- **계정 생애주기**: 로그아웃/계정 전환 시 기존 `queryClient.clear()`(온보딩 제출) 경로가 캐시를 비운다. 로그아웃 경로에 `['notifSettings']` 포함 여부는 구현 시 `removeQueries` 1줄로 보강.

## R3. 동의 획득 시점 (2026-09-11 확정: 홈 표면 제외)

- **Decision**: 온보딩 제출 직후 프라이머 모달 제거(`onboarding/index.tsx`의 `pushPrimer` 상태·`PushPrimerModal` 렌더·`getPrimerResult` 분기 삭제 → 항상 `router.replace('/(tabs)')`). 홈에는 아무 표면도 추가하지 않는다. OS 권한 요청은 스캔 결과 프라이머(시트) 1곳.
- **Rationale**: UX 리서치(대안 B) + 종한 결정. 구현 최소.

## R4. 표면 = 하단 시트 1종 (2026-09-11 종한 결정 — 2·3·4번 시트 통일)

- **Decision**: 가운데 모달(`PushPrimerModal`, P-162 문법) 대신 **하단 시트 컴포넌트 1종** `NotificationSheet`(components/ActionSheet·useSheetSwipeDismiss 관례)로 세 표면을 구현한다. props로 `variant: 'primer' | 'consent'` + 옵션 동의 체크 2행. (a) 스캔 후 프라이머 = `primer`(제목·본문·「알림 켜기」·「나중에」), (b) 설정 화면 식사 시간 토글 → `consent`(체크 2 + 전문 링크 + 「동의하고 알림 켜기」는 둘 다 체크 시 활성), (c) A안 홈 표면(채택 시) = `primer` + 체크 2행. 프라이머 수락 = 기록 → OS 권한 → 허용 시 토큰 등록 → 회원이면 PATCH `activity:true`. 기존 `PushPrimerModal`은 시트로 교체(파일명 유지 여부는 구현 시 — 테스트 pushSurfaces192 갱신).
- **Rationale**: 모바일 소프트 애스크·법정 동의의 표준은 하단 시트(엄지 도달·OS 알림창과 구분·긴 문구 수용). 피그마 시안 「KB-497 알림 설정 시안」 2·3·4번 확정.
- **제약 유지**: 스캔 화면은 코치마크와 **직렬화**(KB-377 iOS 프레젠테이션 교착) — 시트로 바꿔도 동시 present 금지 로직 그대로.
- **게스트**: 스캔 프라이머는 게스트도 본다. OS 권한만 얻고 토큰 등록·PATCH는 세션 있을 때만(KB-543).

## R4b. 설정 화면 동의 시트 (2026-09-11 종한 결정)

- **Decision (9/11 최종)**: 설정 화면에 동의 체크 행을 두지 않는다. 「소식 알림」(`news.enabled`) 토글 OFF→ON 탭 시 동의 시트(체크 2개 + 전문 링크 + 「동의하고 알림 켜기」/「나중에」)를 띄운다. 「식사 시간 알림」은 하위 토글 — 소식 OFF면 비활성(탭 무동작). 확인 = PATCH `{news:{enabled:true, PV, RV}}` → 응답으로 소식·식사 시간 ON. 소식 ON→OFF = PATCH `{news:{enabled:false}}`(이 기기만; 원장 철회는 서버 규칙). 식사 시간 토글 = PATCH `{news:{mealTime: !cur}}`(소식 ON일 때만 조작 가능 — **식사 시간 OFF는 동의 철회 아님**, 9/11 종한 정정). 캡션(동의 일시·버전·전문 보기)은 `news.enabled`일 때만.
- **표면 구현**: 기존 `ActionSheet`/`useSheetSwipeDismiss` 관례(components/)의 바텀시트로. 홈/스캔 프라이머(모달)와 별개 컴포넌트 — 프라이머는 OS 권한 전용으로 남는다.
- **Rationale**: 법정 동의를 토글 옆 상시 체크로 노출하면 화면이 무겁고, 동의 시점이 불명확. 시트는 "켜려는 순간"에만 동의를 받아 맥락이 분명하고 UX 리서치 B안(별도 시트)과 일치.
- **Alternatives**: 상시 체크 행(초안) → 기각. 토글 없이 "소식 받기" 버튼 → 토글 관례 깨짐 → 기각.

## R5. 로컬 설정 코드 제거 범위와 로컬 리마인더

- **Decision**: `pushAdapter.ts`에서 `PushSettings`·`DEFAULT_PUSH_SETTINGS`·`getPushSettings`·`savePushSettings`·`SETTINGS_KEY` 삭제. `guestConsent.ts` 삭제. `scheduleReviewReminder`는 `settings.reviewReminder` 대신 **react-query 캐시의 `activity`**(`queryClient.getQueryData(['notifSettings'])?.activity === true`)로 게이트 — 캐시 없음 = 예약 안 함(보수적).
- **Rationale**: KB-500(로컬 리마인더 폐기)은 BE KB-469 대기라 이번엔 삭제하지 않되, 삭제된 로컬 설정을 읽는 경로는 남길 수 없다. 서버 `activity`가 "리뷰 리마인더 통합" 의미라 정확히 대응.
- **Alternatives**: 리마인더를 이번에 통째로 제거 → KB-500 범위 침범. 리마인더 항상 예약 → 서버 설정 무시(P-147 위배).

## R6. 토큰 `lang` 전송 + 등록 시점(로그인 뒤)

- **Decision (lang)**: 구현 변경 없음. `registerPushToken` → `sendTokenToServer({token, platform, lang: apiLang()})`, `_layout.tsx`가 앱 시작·언어 변경(`onLang`)·AppState active(설정 화면)에서 호출. 유닛으로 잠금: (a) PUT 본문 `lang === apiLang()` (b) `_layout.tsx` 소스에 언어 변경 리스너 → `registerPushToken` 배선.
- **Decision (시점, BE 통보 2026-09-11)**: `registerPushTokenInner`에 `if (!(await hasBeSession())) return;` 가드 1줄 추가 — 앱 시작·언어 변경·AppState·프라이머 경로 전부가 이 함수를 지나므로 호출측 변경 없이 게스트 요청 0. 로그인 성공 = `beAuth.exchangeLogin` 성공 직후(또는 `useSocialAuth` 성공 분기) `registerPushToken()` 1회 추가.
- **Rationale**: 유일 관문(pushAdapter)에 가드를 두는 것이 호출측 5곳 수정보다 작고 회귀가 없다. 프라이머 수락 흐름은 게스트여도 OS 권한은 얻어두고(iOS 1회성) 등록만 로그인 뒤로 미룬다.
- **Alternatives**: 호출측마다 게스트 분기 → 누락 위험. 게스트 토큰 등록 유지 → BE가 거부(회원 전용)하므로 불가.

## R7. 게스트 배제 방식

- **Decision**: `profile.tsx` 게스트 분기의 알림 설정 행 제거(회원 분기만 유지). `notifications.tsx`는 `isGuest`면 `saved.tsx` 선례대로 `<SubHeader/> + <AuthGateSheet context="profile" open onClose={router.back}/>`만 렌더.
- **Rationale**: 이중 방어(진입점 + 라우트) 선례 그대로. 신규 컴포넌트 0.

## R8. i18n 키 정리

- **Decision**: `notif.*` 제거: helpful/helpfulSub/reminder/reminderSub/nudge/nudgeSub/night/nightSub/marketing/marketingSub. 추가: `notif.activity`·`activitySub`·`newsTitle`·`newsSub`·`privacyConsent`·`receiveConsent`·`mealTime`·`mealTimeSub`·`viewFull`·`readFailed`. `push.homeTitle`·`homeBody`·`homeNewsHint` 추가. 10로케일 동시 편집, 한국어 문구는 spec 문구 기준(별도 검수 대상). 키 집합 일치 유닛 추가(현재 notif/push 네임스페이스 parity 테스트 없음).
- **Rationale**: FR-010/011, SC-007. 비한국어 문구는 구현 시 초벌 번역 후 검수 요청.

## R9. 프레임 불변 검증

- **Decision**: Switch(on/off)·ConsentRow 체크박스(checked/unchecked)·mealTime 행(enabled/disabled)의 `StyleSheet.flatten` 메트릭(width/height/padding/border/radius) 비교 유닛. P-138① 방식.

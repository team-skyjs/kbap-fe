# Research: 첫 설치 로그인 화면 OS 알림 권한 즉시 요청 (spec 006 · KB-631)

모든 항목은 코드·dev Swagger(2026-09-22 조회, X-API-Version 1.0/1.1/2.0 동일) 실측 기반. NEEDS CLARIFICATION 잔여 0.

## R-1. "첫 설치 첫 표시" 판별 = `/login?entry=intro`

- **Decision**: 로그인 화면(`src/app/login.tsx`)의 마운트 effect에서 `entry === 'intro' && returnTo == null`일 때만 요청한다. 새 센티널·플래그 없음.
- **Rationale**: `entry=intro`는 루트 레이아웃이 `cleanupIfFreshInstall()===true`(설치 센티널 `kbap.installed.v1` 부재) → `gateSplash` 해소 → `entryChecked` 뒤 `router.replace('/login?entry=intro')` 할 때만 붙는다(`_layout.tsx:129`, `loginEntry.ts` "intro는 호출측이 명시할 때만"). 즉 이 값 하나가 스펙의 세 조건(첫 설치 · 스플래시 게이트 해소 뒤 · 로그인 화면 실제 렌더 뒤)을 이미 담고 있다. 세션 만료·게스트 CTA·게이트·탈퇴·로그아웃 복귀는 전부 `entry=other|gate_*|profile`이라 자동 제외(FR-006). 기존 사용자 업데이트는 센티널이 있어(2026-07-15 이후 전 빌드) fresh=false → intro 아님(US3 AS4).
- **Alternatives**: ① `_layout.tsx`의 replace 직후 호출 — 로그인 화면 커밋 전이라 FR-001 "실제 렌더 뒤" 위반 소지. ② 별도 AsyncStorage 키 "loginPrompted" — 프라이머 기록(R-2)이 같은 역할을 하므로 중복. ③ `useFocusEffect` — 게이트 복귀 재포커스마다 재평가되나 프라이머 기록 가드로 무해, 그래도 마운트 1회가 더 단순.

## R-2. 응답 기록 = 기존 프라이머 기록 `kbap.push.prompted.v1` 재사용

- **Decision**: 팝업 결과를 `markPrimerResult('accepted'|'declined')`로 남긴다. 스캔 결과 시트(`scan.tsx maybeShowPrimer`: `getPrimerResult()==null`일 때만 표시)는 코드 변경 없이 자연 생략(FR-003, US3 AS1·2).
- **Rationale**: 스펙 Key Entity "알림 안내 응답 기록 — 로그인 팝업·스캔 시트가 공유". 기존 저장소가 정확히 그 의미.
- **Alternatives**: 신규 키 — 시트 쪽 조건문을 고쳐야 해 diff가 커진다. 기각.

## R-3. 요청 시퀀스 — 어댑터 헬퍼 1개 `promptPermissionOnFirstLogin()`

- **Decision**: `src/lib/push/pushAdapter.ts`에 추가. 순서: `FLAGS.pushEnabled`/모듈 없음 → 즉시 반환(기록 0) → `getPrimerResult()!=null` → 반환(FR-002) → `getPermissionStatus()`: `unavailable` → 반환(기록 0, 후순위 경로 유지) · `undetermined` → `requestPermission()`(기존 함수 = `push_permission` 계측 그 자리, FR-008) → 상태 재조회 → `granted`/`denied`만 기록. 이미 `granted`/`denied`(재설치, OS 기억)면 요청 없이 기록만(US1 AS6 — 팝업 미표시 시 계측 이벤트도 0). 모듈 스코프 in-flight 프로미스로 중복 호출 합치기(Edge "결과 처리 1회").
- **Rationale**: 예외 경로를 결과로 오기록하지 않기 위해 `requestPermission()`의 boolean이 아니라 **재조회한 상태**로 기록한다(기존 함수는 예외도 false). 서버 요청 0(FR-004) — 어댑터의 토큰 등록은 이 헬퍼가 호출하지 않는다.
- **Alternatives**: `PushPrimerModal.accept` 재사용 — 프라이머 계측(`push_primer_response`)·토큰 등록·PATCH가 묶여 있어 게스트 화면에 부적합. 기각.

## R-4. 활동 알림 기본값(`activity`) — 스펙 누락 사항, 로그인 성공 직후 1회 PATCH

- **Finding**: dev Swagger `GET/PATCH /api/notifications/settings` — "설정을 만진 적 없는 기기는 모든 토글이 `false`… `activity` 기본 `false`". 지금은 스캔 프라이머 수락 경로만 `patchNotificationSettings({activity:true})`를 보낸다(`PushPrimerModal.tsx:38`, 유일 호출처). 로그인 팝업이 프라이머를 대체하면 **OS 허용 회원도 activity=false로 남아 활동 푸시(HELPFUL·리마인더) 0건** — US2 "푸시를 받을 수 있는 상태"가 토큰만으로는 성립하지 않는다.
- **Decision**: 로그인 팝업 결과가 `granted`이면 기기 로컬에 **1회성 대기 표식** `kbap.push.activityDefaultPending.v1`을 남기고, 로그인 성공 직후(`useSocialAuth.exchange`의 `registerPushToken()` 옆) 어댑터 헬퍼 `applyPendingActivityDefault()`가 표식이 있을 때만 `PATCH {activity:true}` 후 표식을 지운다(실패도 지움 — 최악은 설정 화면에서 직접 켬, 프라이머와 동일 정책). 세션 없음·플래그 off = no-op.
- **Rationale**: 표식 없이 "프라이머 accepted면 매 로그인마다 PATCH"는 사용자가 끈 값을 되돌린다(계정 전환·재로그인). 표식은 회원 속성이 아니라 "이 기기에서 기본값을 아직 안 적용함"이라는 기기 사실이라 P-147(서버 정본) 위배가 아니다. 프라이머와 같은 순서(토큰 → PATCH)·같은 seq 보호(`patchNotificationSettings`).
- **Spec 반영**: FR-010으로 spec.md에 추가(이 플랜에서 발견). US2 AS1의 "푸시를 받을 수 있는 상태"에 활동 알림 켜짐이 포함된다.
- **Alternatives**: ① BE가 토큰 등록 시 activity 기본 true — BE 변경, 범위 밖. ② 신규 회원(newMember)만 PATCH — 재설치한 기존 회원(9/22 실측의 실제 케이스)이 빠진다. 기각.

## R-5. 팝업과 스플래시 페이드 겹침 — 수용

- **Decision**: 추가 지연 없음. `entry=intro` replace는 `entryChecked` 뒤이고 AnimatedSplash는 그 시점부터 페이드아웃만 남는다. OS 팝업은 네이티브 알럿이라 RN 오버레이 위에 뜬다.
- **Rationale**: 스펙 Edge의 금지 조건은 "게이트(세션 복구·잔존 정리) 전"이며 이는 만족. 실기 D-1에서 시각 확인, 거슬리면 `InteractionManager.runAfterInteractions` 1줄로 후속.

## R-6. 테스트 전략

- 어댑터 유닛(신규 `loginPrompt631.test.ts`): 헬퍼 시퀀스 6케이스(미결정→요청→기록·기허용→요청0·기거부→요청0·기록 있음→요청0·unavailable→기록0·요청 예외→기록0) + in-flight 합치기 + `applyPendingActivityDefault` 3케이스(표식 있음→PATCH 1+삭제·없음→0·세션 없음→0) + 생애주기(재설치=AsyncStorage 초기화→재요청 / 계정 전환=표식 소진 후 PATCH 0).
- 로그인 화면 유닛(`loginCollageMarquee` 목 패턴 재사용): `entry=intro` → 헬퍼 1회 · `entry=intro&returnTo` → 0 · 파라미터 없음 → 0.
- 소스 잠금: `useSocialAuth.ts`에 `applyPendingActivityDefault` 배선 문자열 · `login.tsx`에 `entry === 'intro'` 조건 · `pushProdGuard221`에 신규 헬퍼 2개 추가(플래그 off = 모듈 미접근·PATCH 0).
- 기존 스위트 무변 기대: pushSurfaces192(프라이머 순서)·notificationSheet497·sourceLock497.

## R-7. 문서 정리

- specs/001 US4·US6(첫 스캔 우선·B안)에 "폐기됨(KB-631, spec 006)" 주석 1줄씩. research.md B안 라인 동일. PROGRESS.md KB-631 항목. `PushPrimerModal.tsx` 헤더 주석 "진입점 = 스캔 결과 직후 1회" → "후순위(로그인 팝업 미경유 기기)"로 갱신.

## R-8. 왜 OS 결정이 선행돼야 하는가 — 설정 탭 토글이 실효되는 조건 (종한 9/22 보강)

- **Finding**: 알림 설정 화면(`profile/notifications.tsx`)은 OS 상태가 `undetermined`이면 배너 없이 토글이 살아 있다. 토글은 서버에 저장되지만 OS 권한이 없어 토큰이 등록되지 않으므로(`registerPushToken`: status!=='granted' → 스킵) 실제 푸시는 0건 — "토글은 켰는데 안 온다"의 원인. `denied`면 배너 + 토글 흐림·조작 불가, OS 설정에서 켜고 복귀하면 AppState active 재조회로 토글이 살아나고 토큰이 등록된다.
- **Decision**: 이 플랜의 로그인 팝업으로 첫 설치 기기는 로그인 전에 반드시 `granted`/`denied` 중 하나가 되어 `undetermined` 채 설정 탭에 도달하는 경로가 사라진다. 허용 = 로그인 성공 직후 토큰 등록 + activity 기본값 적용(R-4) → 소식·광고성 토글이 켜는 즉시 실효. 거부 = 배너가 OS 설정으로 안내. 설정 화면 코드는 무변(FR-009).
- **잔여**: 이 빌드 이전에 설치한 기존 사용자는 `undetermined`가 남을 수 있다 — 후순위 경로(스캔 시트·설정 배너 KB-618) 몫이며 이 플랜 범위 밖.

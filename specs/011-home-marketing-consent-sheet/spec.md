# Feature Specification: 홈·알림함 광고성 동의 바텀시트

**Feature Branch**: `feat/kb979-home-marketing-consent-sheet`

**Created**: 2026-11-04

**Status**: Draft

**Input**: "마케팅(광고성) 수신에 동의하지 않은 로그인 회원에게 콜드 스타트 후 첫 홈 진입(하루 1회)과 알림함 진입(매번)에 기존 광고성 동의 바텀시트(`NotificationSheet variant="consent"`)를 새 문구로 띄운다. 서버·API 변경 없음 (Jira KB-979)." — 출처 `_workspace/kb979-home-marketing-consent-sheet/01_cto_plan.md` FE 절(R-01~R-11)·API 계약 표·가정 A-1~A-9. 디자인 = 기존 시트 그대로(제목·본문 문자열만 신규).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 홈에서 하루 한 번 동의를 권한다 (Priority: P1)

미동의 회원은 앱을 새로 켜고 홈에 처음 들어왔을 때(그날 아직 안 봤으면) 가공식품 코치마크가 끝난 뒤 동의 시트를 본다. 확인하면 설정 화면과 같은 동의가 기록되고, OS 권한을 아직 안 물었으면 그때 묻는다.

**Independent Test**: 홈 큐 스텝 `presentHomeMarketingConsent` 를 목 GET·스토리지·세션으로 구동.

**Acceptance Scenarios**:

1. **Given** 미동의 회원·오늘 미노출, **When** 콜드 스타트 후 홈 포커스, **Then** 시트 1회 + 오늘 날짜 기록.
2. **Given** 같은 런타임에서 홈 재포커스, **Then** GET 0·시트 0.
3. **Given** 저장 날짜 == 오늘(나중에 후 재시작 포함), **Then** GET 0·시트 0. 저장 날짜가 어제·미래면 판정 진행.
4. **Given** 게스트·세션 미확정, **Then** GET 0·소모 0.
5. **Given** 동의 회원, **Then** 시트 0·날짜 기록 0(런타임 플래그만 소모).
6. **Given** GET 실패·타임아웃·블러(abort), **Then** 시트 0·소모 0.
7. **Given** 코치마크 스텝이 떠 있음, **Then** 동의 시트는 코치마크가 완전히 닫힌 뒤.
8. **Given** 시트 확인, **Then** PATCH body == 설정 화면 동의 body · 권한 `undetermined` 면 OS 요청 → 허용 시 토큰 등록 · 그 외 권한은 OS 팝업 0 · PATCH 실패 = 상단 오류 토스트 후 닫기(OS 팝업 0).
9. **Given** 시트가 떠 있는 채 홈 블러, **Then** 시트 닫힘 + 큐 해제, 그날 재노출 없음.

---

### User Story 2 - 알림함 진입마다 동의를 권한다 (Priority: P1)

미동의 회원은 알림함에 들어올 때마다(자식 화면에서 돌아올 때 포함) push 전환이 끝난 뒤 동의 시트를 본다.

**Independent Test**: 알림함 렌더 + navigation `transitionEnd` 이벤트 모의.

**Acceptance Scenarios**:

1. **Given** 게스트, **Then** 로그인 Redirect·설정 GET 0.
2. **Given** 미동의 회원, **When** `transitionEnd {closing:false}` 전, **Then** 시트 0. 후 = 시트 1. `closing:true` 는 무시.
3. **Given** 동의 회원, **Then** 시트 0.
4. **Given** 블러 → 재포커스(+transitionEnd), **Then** 다시 1회.
5. **Given** 다른 덮개(Modal 등)가 떠 있음, **Then** 풀릴 때까지 대기.

---

### User Story 3 - 다른 일회성 표면과 겹치지 않는다 (Priority: P2)

동의 시트가 떠 있는 동안 스캔 종료 넛지·리뷰 유도(ScanExitPrompts)는 건너뛴다.

**Acceptance Scenarios**:

1. **Given** 동의 시트 활성, **When** 스캔 화면이 닫힘, **Then** 넛지·리뷰 유도 0(빈도 판정은 다음 스캔).

### Edge Cases

- 탈퇴→재가입(서버 null): 이전 동의 이력과 무관하게 다시 대상 — 로컬 동의 캐시 없음.
- 같은 날 같은 기기에서 계정 전환: 홈 시트는 그날 안 뜬다(날짜 키 기기 단위, A-2). 알림함 무관.
- 시계 되돌림(저장 날짜가 미래): 통과.
- 스토리지 오류: 안 띄움.
- OS 권한 `denied`: 동의 PATCH 는 기록, OS 팝업 0(A-6).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (R-01): 홈 게이트 = JS 런타임당 1회 AND 기기 로컬 날짜(YYYY-MM-DD) ≠ 저장 날짜.
- **FR-002** (R-02·R-09): 게이트 통과 회원만 `GET /api/notifications/settings` — 미동의 = `privacyConsent == null || receiveConsent == null`. 서버 값이 정본(로컬 동의 캐시 금지).
- **FR-003** (R-03): 홈 modalQueue 스텝 `marketingConsent` 를 `packagedCoach` 뒤에. 블러 = 대기 폐기 + 떠 있는 시트 닫기.
- **FR-004** (R-04): 확인 = 설정 화면과 바이트 동일한 PATCH(공용 상수) → `undetermined` 면 OS 권한 요청 → 허용 시 토큰 등록.
- **FR-005** (R-05): 날짜는 시트를 실제로 띄운 순간 기록. "나중에"(스크림·드래그·백버튼) 후 그날 홈 미노출.
- **FR-006** (R-06): 알림함은 미동의 회원에게 포커스마다, native-stack `transitionEnd {closing:false}` 뒤에 open(InteractionManager 금지).
- **FR-007** (R-07): 제목 `push.consentPromptTitle`·본문 `push.consentPromptBody` 10 로케일. 동의 행·확인·나중에 라벨은 기존 키.
- **FR-008** (R-08): `push_consent_view {surface}` 신규(열릴 때마다 1회) · `push_consent_response` 에 `surface` + action `confirm`. surface = home|inbox|settings.
- **FR-009** (R-10): 동의 시트 활성 중 ScanExitPrompts 넛지·리뷰 유도 건너뜀, 다른 덮개가 있으면 동의 시트가 대기.

### Key Entities

- AsyncStorage `kbap.marketingConsent.homeShownDate` — 기기 로컬 날짜 문자열 1개.
- 모듈 상태: `homeChecked`(런타임 소모) · `sheetActive`(동의 시트 표시 중).

## Success Criteria *(mandatory)*

- **SC-001**: 위 수용 시나리오 전부 jest 로 고정(R-11).
- **SC-002**: 설정 화면·홈·알림함 PATCH body 가 같은 상수에서 나온다.
- **SC-003**: tsc 0 · jest 전체 통과 · lint-changed 0.

## Assumptions

계획 A-1~A-9 그대로. 요약: 콜드 스타트 = JS 런타임 시작(OTA reload 포함) · 날짜 키 기기 단위 · 날짜는 실제 노출 시 기록 · 홈 블러 = 나중에와 동일(추가 계측 없음) · PATCH 실패 = 토스트 후 닫기 · `denied` 도 PATCH 기록 · `confirm` action 추가 · 알림함은 자식 화면 복귀에도 재노출 · 사전 체크 유지(PR 리뷰 포인트).

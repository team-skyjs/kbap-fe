# Feature Specification: 광고성 동의 시트 토스 스타일(B안) + 홈 3시간 주기

**Feature Branch**: `feat/kb987-consent-sheet-toss`

**Created**: 2026-11-04

**Status**: Draft

**Input**: "KB-979 광고성 동의 바텀시트(`NotificationSheet` consent 변형 — 홈·알림함·설정 공용)를 토스 스타일 B안으로 바꾸고, 홈 노출 주기를 '콜드 스타트 + 하루 1회'에서 '마지막 노출 후 3시간'으로 바꾸며, 확인 시 활동 알림(`activity`)도 함께 켠다. BE 변경 없음 (Jira KB-987)." — 출처 `_workspace/kb987-consent-sheet-toss/01_cto_plan.md` R-01~R-12·계약 표·가정 A-1~A-9. 디자인 = 확정 B안(Figma `Y6LTZdrUxqu69jnvYWsvoA` 14487-1333).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 플랫한 B안 동의 시트 (Priority: P1)

미동의 회원은 홈·알림함·설정에서 흰 플랫 시트(그림자·핸들 없음)에 큰 제목(최대 3줄), 체크 원 2행 + 전문 보기 chevron, 높이 56 알약 버튼, 회색 "나중에"를 본다. OS 권한 사전 안내(primer)는 바뀌지 않는다.

**Independent Test**: `NotificationSheet` 를 variant 별로 렌더해 스타일 단언.

**Acceptance Scenarios**:

1. **Given** consent 변형, **Then** 컨테이너 pt36·pb34·ph24·상단 라운드 24·그림자 키 없음·핸들 0.
2. **Given** primer 변형, **Then** pt10·pb34·ph20·라운드 24·gap12·그림자·핸들 1(현행 그대로).
3. **Given** consent 제목, **Then** `numberOfLines=3`·`adjustsFontSizeToFit`·24/32 Bold, 10개 로케일에서 3줄 이내·잘림 0.
4. **Given** 체크 on↔off, **Then** 원 22·보더 1.5·라운드 불변, 색(primary↔line2)만 바뀐다(P-151).
5. **Given** chevron 탭, **Then** 전문 페이지 + `full_text` 이벤트, `accessibilityLabel = notif.viewFull`.
6. **Given** 동의 영역, **Then** `surface2` 회색 박스 없음.
7. **Given** 기존 시트 로직(등장·스와이프·체크·고정 슬롯 안내·제출 가드·계측), **Then** 변화 없음.

### User Story 2 - 홈 3시간 주기 (Priority: P1)

미동의 회원은 홈 포커스(탭 전환·백그라운드 복귀 포함) 때 마지막 노출 후 3시간이 지났으면 시트를 다시 본다.

**Acceptance Scenarios**:

1. **Given** 저장값 없음, **Then** 판정(GET) 후 미동의면 시트 1 + `homeLastShownAt = now` 기록.
2. **Given** 마지막 노출 2:59:59 전, **Then** GET 0·시트 0. **Given** 3:00:00 이상, **Then** 판정 1(런타임 리셋 없이).
3. **Given** 저장값이 미래(시계 되돌림), **Then** 시트 0 + 저장값을 now 로 보정.
4. **Given** 게스트·세션 미확정·pushEnabled off·스토리지 오류, **Then** GET 0·기록 0.
5. **Given** 동의 회원, **Then** 시트 0·기록 0, 같은 세션 두 번째 포커스는 캐시로 GET 0, 인증 경계(`queryClient.clear()`) 후엔 다시 GET.
6. **Given** GET 실패·블러, **Then** 기록 0(다음 포커스 재판정).
7. **Given** 홈이 포커스된 채 백그라운드 → 전경, **Then** 같은 판정 스텝이 한 번 더 큐에 들어간다.

### User Story 3 - 확인 = 활동 알림도 ON + 계측 (Priority: P2)

**Acceptance Scenarios**:

1. **Given** 확인(홈·알림함·설정), **Then** PATCH body = `contracts/notification-settings.md` 의 body(`activity: true` 포함).
2. **Given** 확인 탭, **Then** `push_pref_toggle {key:'activity', on:true, source:'consent'}` 1건(PATCH 직전, 이미 ON 이어도). 설정 화면은 기존 `news on:true` 1건과 함께 2건.
3. **Given** sanitize, **Then** `push_pref_toggle` 이 `source` 를 통과시킨다.

### Edge Cases

- 업데이트 직후 구 날짜 키(`homeShownDate`)는 무시 — 첫 홈 포커스에 한 번 더 뜰 수 있다(A-4).
- 탈퇴→재가입·계정 전환: 캐시가 비워져 서버 GET 이 정본(재가입 null = 다시 대상).

## Requirements *(mandatory)*

- **FR-001**: consent 변형만 B안 스타일, primer 픽셀 불변 (R-01, A-8).
- **FR-002**: 제목 24/32 Bold 3줄·네이티브 축소 하한 0.8(큰글씨 ×1.3 실측), 본문 15/22 ink3 (R-02).
- **FR-003**: 체크 원(22·1.5 보더, 색만 변화) + 라벨 + chevron 링크(≥44pt) (R-03).
- **FR-004**: `Btn` minHeight 56(알약 유지), "나중에" 15 ink3 높이 48 (R-04, A-1).
- **FR-005**: 시트 로직·설정 화면은 코드 변경 없이 그대로 (R-05, R-06, R-09).
- **FR-006**: 홈 게이트 = `homeLastShownAt` epoch, 3시간, 되돌림 보정, 실제 노출 시에만 기록 (R-07).
- **FR-007**: 게이트 미통과·동의 캐시 = GET 0 (R-08, A-6).
- **FR-008**: `MARKETING_CONSENT_PATCH.activity = true` (R-10).
- **FR-009**: 확인 시 `push_pref_toggle` activity/source:consent 1건 (R-11, A-3).
- **FR-010**: 10개 로케일 제목 3줄 이내 (R-12).

## Success Criteria

- tsc 0 · jest 전체 통과 · lint-changed 0.
- R-12: 10개 로케일 consent 제목 줄 수 실측 결과를 보고에 남긴다.

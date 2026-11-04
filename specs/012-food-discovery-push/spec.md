# Feature Specification: 음식 발견 푸시(FOOD_DISCOVERY) 탭 → 음식 상세

**Feature Branch**: `feat/kb985-food-discovery-push`

**Created**: 2026-11-04

**Status**: Draft

**Input**: "서버가 새 광고성 푸시 유형 `FOOD_DISCOVERY` 를 보낸다. data 는 `{ type: "FOOD_DISCOVERY", foodId: number, notificationId: number }` 다. 앱은 이 유형을 알려진 유형으로 인정해 `push_open` 에 `type` 을 싣고, 푸시 탭과 알림함 행 탭 모두 음식 상세 `/food/{foodId}` 로 보낸다. `foodId` 가 없거나 숫자가 아니면 이동하지 않는다(읽음 처리는 기존대로)." (Jira KB-985) — 출처 `_workspace/kb985-food-discovery-push/01_cto_plan.md` FE 절(R-13~R-15)·API 계약 표·가정 A1·A2. 디자인 = 없음(신규 화면·문자열 0, 문구는 서버 렌더).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 음식 발견 푸시를 탭하면 그 음식 상세가 열린다 (Priority: P1)

마케팅 동의 회원이 "🌟 삼계탕 드셔보셨어요?" 푸시를 탭하면 앱이 열리며 삼계탕 상세 화면으로 간다. 탭은 `push_open {type: FOOD_DISCOVERY}` 로 계측되고 알림은 읽음 처리된다.

**Independent Test**: `routeForNotificationData` 순수 함수 + 탭 리스너 목.

**Acceptance Scenarios**:

1. **Given** data `{type:'FOOD_DISCOVERY', foodId: 6, notificationId: 98123}`, **When** 탭, **Then** 경로 `/food/6`, 콜백 인자 `('/food/6', 98123, 'FOOD_DISCOVERY')`.
2. **Given** `foodId: '6'`(문자열 숫자), **Then** `/food/6`.
3. **Given** `foodId` 없음·`'abc'`·`-1`·`1.5`·`''`, **Then** 경로 null(앱만 열림, 읽음 처리는 기존 경로대로 수행).
4. **Given** `isPushType('FOOD_DISCOVERY')`, **Then** true → `push_open` 의 `type` 속성 포함.

---

### User Story 2 - 알림함의 음식 발견 행을 탭해도 같은 상세로 간다 (Priority: P1)

알림함(최근 7일)에서 FOOD_DISCOVERY 행을 탭하면 미읽음이면 읽음 처리하고 `/food/{foodId}` 로 이동한다(푸시 탭과 같은 규칙).

**Independent Test**: `toInboxItem` + 알림함 렌더 탭.

**Acceptance Scenarios**:

1. **Given** 와이어 `{type:'FOOD_DISCOVERY', foodId: 6}`, **Then** `InboxItem.foodId === '6'`.
2. **Given** 와이어 `foodId: null`(그 외 유형), **Then** `foodId` undefined.
3. **Given** FOOD_DISCOVERY 미읽음 행, **When** 탭, **Then** 읽음 뮤테이션 1 + navigate `/food/6`.

### Edge Cases

- 구 앱(이 변경 전): FOOD_DISCOVERY 는 미지 유형 → 이동 없음·`type` 속성 생략. 깨지지 않는다.
- 64비트 id: 문자열로 보존(정밀도 손실 없음) — REVIEW_REMINDER `orderId` 와 같은 규칙.
- 다른 유형에 `foodId` 가 와도 무시(REVIEW_REMINDER `foodId` 무동작 유지).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (R-13)**: `PUSH_TYPES` 에 `'FOOD_DISCOVERY'` 를 추가한다. `push_open.type` 허용값에 포함된다.
- **FR-002 (R-14)**: `routeForNotificationData` 는 `FOOD_DISCOVERY` 에 대해 `foodId` 가 `^\d+$` 이면 `/food/{foodId}`, 아니면 null 을 반환한다.
- **FR-003 (R-15)**: 알림함 어댑터는 `foodId` 를 문자열로 복원하고, 알림함 행 탭은 `type·orderId·foodId` 로 같은 라우팅 함수를 쓴다.

### Key Entities

- 푸시 data / 알림함 항목: `type`, `orderId?`, `foodId?`(신규 사용, FOOD_DISCOVERY 만 값).

## Success Criteria *(mandatory)*

- **SC-001**: 위 수용 시나리오 전부 jest 로 고정.
- **SC-002**: `tsc` 0 · `jest` 전체 통과 · `lint-changed` 0.

## Assumptions

- 서버가 경로(`href`) 대신 `foodId` 를 보낸다(KB-573 "매핑은 FE 소유", 계획 A1).
- 음식 상세 화면 `src/app/food/[id]/index.tsx` 는 기존 그대로(게스트 처리 포함).
- i18n 신규 키 없음, 네이티브 변경 없음(OTA 가능).

# Feature Specification: 홈 하단 "평점 높은 음식" 섹션 + 스캔 CTA

**Feature Branch**: `feat/kb800-home-top-rated-foods`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "홈 하단 리뷰 무한 스크롤 피드를, 홈 API `topRatedFoods`(X-API-Version 1.3)로 그리는 '평점 높은 음식' 최대 20행 섹션과 '스캔하러 가기' CTA로 교체한다 (Jira KB-800). 리뷰 탭은 건드리지 않는다." — 출처 `_workspace/kb800-home-top-rated-foods/01_cto_plan.md` FE 절(R-06~R-13)·API 계약 C-01.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 홈에서 평점 높은 음식을 한눈에 본다 (Priority: P1)

여행자는 홈을 끝까지 내려 "리뷰가 많고 평점이 높은 음식" 최대 20개를 행 목록으로 본다. 각 행에서 사진·위험도·이름·총평점(리뷰 수)·맛/음식 나오는 속도/친절도 세부 평점을 읽고, 탭하면 음식 상세로 간다.

**Why this priority**: 끝없는 개별 리뷰 대신 음식 단위로 요약된 신뢰 신호를 주는 것이 이번 변경의 핵심 가치.

**Independent Test**: 홈 응답에 `topRatedFoods` 2건을 넣고 홈을 렌더 → 섹션 헤더와 행 2개, 세부 평점, 탭 시 음식 상세 이동 확인.

**Acceptance Scenarios**:

1. **Given** 홈 응답에 평점 음식 N(1~20)건, **When** 홈을 연다, **Then** 섹션 헤더와 N개 행이 서버 순서대로 보인다.
2. **Given** 어떤 음식의 속도·친절도 평점이 없음(null), **When** 그 행을 본다, **Then** 해당 줄은 빈 별 5개와 "—"로 표시된다.
3. **Given** 행이 보인다, **When** 탭한다, **Then** 그 음식 상세(`src=home`)로 이동하고 카드 클릭 계측이 `top_rated` 섹션으로 기록된다.

---

### User Story 2 - 섹션 끝에서 바로 스캔하러 간다 (Priority: P1)

목록을 다 본 사용자는 섹션 끝 "스캔하러 가기" 버튼으로 스캔 화면에 간다. 평점 음식이 0건이어도 버튼은 보인다.

**Why this priority**: 홈 → 스캔 전환(KR2)을 측정·유도하는 진입점.

**Independent Test**: 빈 배열 응답에서 홈 렌더 → 섹션 헤더 부재·CTA 존재, CTA 탭 → `/scan` 이동.

**Acceptance Scenarios**:

1. **Given** 평점 음식 0건, **When** 홈을 연다, **Then** 섹션(헤더 포함)은 없고 CTA와 면책 문구만 보인다.
2. **Given** CTA가 보인다, **When** 탭한다, **Then** 스캔 화면으로 이동하고 `ui_click`(target `home-scan-cta`)이 전송된다.

---

### User Story 3 - 홈이 리뷰 피드를 더 이상 부르지 않는다 (Priority: P2)

홈은 리뷰 목록 API를 호출하지 않고, 칩·다음 페이지 로딩·재시도·신고 시트가 사라진다. 리뷰 탭 피드는 그대로다.

**Independent Test**: 홈 렌더 시 전역 리뷰 피드 훅 호출 0회, 당겨서 새로고침이 리뷰 캐시를 무효화하지 않음.

**Acceptance Scenarios**:

1. **Given** 홈 진입, **When** 렌더·스크롤 끝 도달, **Then** 리뷰 목록 요청 0건, 다음 페이지 UI 없음.
2. **Given** 리뷰 탭, **When** 진입, **Then** 기존 피드 동작 무변.

### Edge Cases

- 구 서버(키 부재)·`null` 배열 → 빈 섹션(숨김) + CTA.
- `overallRating`/`taste` 가 null(계약상 오지 않지만 방어) → 별 비활성 + "—".
- 리뷰 기능 플래그 off → 섹션 숨김, CTA 는 노출.
- 홈 로딩 중 → 기존 홈 스켈레톤만(섹션 전용 스켈레톤 없음). 홈 에러 → 기존 에러 블록.
- 한국어명이 표시명과 같으면 한국어명 줄 생략.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (R-07)**: 홈 요청은 버전 1.3 을 보내고, 응답의 평점 음식 목록을 순서 그대로 화면 모델로 바꾼다. 목록 부재·null → 빈 목록. 세부 평점 null 은 null 로 유지.
- **FR-002 (R-08)**: 각 행은 썸네일+개인 기준 위험도 리본, 표시명(2줄), 한국어명(다를 때), 총평점 별+숫자(리뷰 수), 세부 3줄(라벨+별 5개+소수 1자리 또는 "—"), 오른쪽 chevron 을 보인다. 국기 없음.
- **FR-003 (R-08)**: 행 탭 = 음식 상세 이동 + `home_card_click{section:'top_rated', position, food_id}`.
- **FR-004 (R-09)**: 목록이 비면 섹션(헤더 포함) 미렌더. 무한 스크롤·다음 페이지·재시도 UI 없음.
- **FR-005 (R-10)**: 섹션 아래 "스캔하러 가기" CTA(로딩 중 제외 항상 노출) → 스캔 화면. 그 아래 기존 면책.
- **FR-006 (R-11)**: 새 문구 키 `home.scanCta` 10개 로케일.
- **FR-007 (R-12)**: 홈 섹션 계측 값에 `top_rated` 추가(섹션·카드 노출·클릭), `reviews` 제거. 이벤트명 무변.
- **FR-008 (R-06)**: 홈에서 리뷰 피드 조회·칩·다음 페이지 스켈레톤/에러·신고 플로우·새로고침의 리뷰 캐시 무효화 제거.
- **FR-009 (R-13)**: 리뷰 탭 피드 코드 무변.

### Key Entities

- **평점 음식(TopRatedFood)**: 기존 음식 요약 카드 + 맛·속도·친절도·총평점(각 0~5 소수 1자리, null 가능).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 홈 진입 시 리뷰 목록 요청 0건.
- **SC-002**: 평점 음식 응답 N건 → 화면 행 N개(최대 20), 순서 일치.
- **SC-003**: 빈 응답에서 섹션 헤더 0, CTA 1.
- **SC-004**: CTA 탭 100% 스캔 화면 도달, 클릭 이벤트 1건.

## Assumptions

- 계약 C-01(01_cto_plan.md) 그대로 — BE 진행 중이라 JSON 예시 기준으로 어댑터 작성.
- 섹션은 리뷰 기능 플래그를 따르고 CTA 는 무관(CTO A-8).
- 시각 세부(간격·폰트·chevron·별 크기)는 디자이너 스펙(02_designer_spec.md) 수신 후 반영.
- 비영어 로케일 CTA 문구는 CTO 표 값(카피 조정은 PR 리뷰).

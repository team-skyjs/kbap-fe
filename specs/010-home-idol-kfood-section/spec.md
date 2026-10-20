# Feature Specification: 홈 K-POP & K-FOOD 섹션(배너·목록) + 음식 상세 아이돌 영상 티저

**Feature Branch**: `feat/kb836-home-idol-kfood-section`

**Created**: 2026-10-21

**Status**: Draft

**Input**: "아이돌이 먹은 한국 음식을 홈 배너 → 전용 목록 → 음식 상세 대표 영상으로 잇는다 (Jira KB-836)." — 출처 `_workspace/kb836-home-idol-kfood-section/01_cto_plan.md`(2026-10-21 ② 아키텍처 변경 반영) FE 절(R-01·R-02·R-05~R-14·R-17·R-21·R-22, 결정 D1~D6·D9·D11)·API 계약 C-1, 화면 정본 `02_designer_spec.md`(Figma 확정안 node 14359-2309, 데이터 출처는 계획 우선), 문구 정본 `01_copy_list.md` 갱신본(배너 count 없음).

> 설계 변경(사용자 결정 2026-10-21): 이 기능은 **전용 API `GET /api/foods/idol-picks` 하나**로만 만든다. 홈·상세 API 와 FE 홈·상세 데이터 계층은 바꾸지 않는다(홈 1.3 유지). 홈 배너는 정적, 상세 카드는 목록 쿼리 캐시에서 영상을 찾는다.

> 법무 잠금: 아이돌·그룹 이름, 영상 제목, 썸네일, 인물 사진, 플랫폼명(YouTube/TikTok)은 화면 문구·접근성 라벨·코드·테스트 픽스처에 쓰지 않는다. platform 은 계측 속성으로만 남긴다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 홈에서 K-POP & K-FOOD 배너를 보고 목록으로 간다 (Priority: P1)

광고로 들어온 여행자는 홈 인기 음식 레일 바로 아래에서 "아이돌이 먹던 그 음식, 나도 한 입?" 다크 배너(번들 음식 사진 콜라주 + 물음표)를 보고, 탭해 전용 목록으로 간다.

**Why this priority**: 광고 문구와 같은 헤드라인으로 유입자를 붙잡는 진입점.

**Independent Test**: 배너 렌더 → 네트워크 요청 0, 사진 3장·헤드라인·"음식 둘러보기", 탭 → `/idol-picks` + 클릭 계측.

**Acceptance Scenarios**:

1. **Given** 홈(Popular·Saved·Food 어느 탭이든), **Then** 인기 레일 아래·큐레이션 위에 배너가 항상 보인다(정적 — 데이터·로딩·0건 분기 없음, 음식 수 표시 없음).
2. **Given** 배너가 보인다, **When** 탭한다, **Then** `/idol-picks` 로 이동하고 `home_card_click{section:'idol_pick', position:0}` 이 전송된다(food_id 없음).

---

### User Story 2 - 목록에서 음식을 골라 상세로 간다 (Priority: P1)

사용자는 `/idol-picks` 다크 헤더 아래 2열 3:4 포스터 그리드(서버 순서)에서 음식을 골라 상세로 간다. 회원은 카드에 개인 위험도 배지가 보인다.

**Independent Test**: 목록 API 3건 → 카드 3장 + 빈 셀 1, 게스트 배지 0, 카드 탭 → `/food/{id}?src=idol_pick`.

**Acceptance Scenarios**:

1. **Given** 회원, **When** 목록을 연다, **Then** 각 카드 좌상단에 위험도 배지가 있고 접근성 라벨 끝에 위험도가 붙는다.
2. **Given** 게스트, **Then** 배지가 없다.
3. **Given** 카드, **When** 탭, **Then** 상세(`src=idol_pick`)로 가고 상세 진입 계측 source 는 `idol_pick` 이다.
4. **Given** 로딩/오류(캐시 없음)/0건, **Then** 각각 Shimmer 6칸 / 오류 블록 + 다시 시도 / 빈 안내.
5. **Given** 화면 포커스, **Then** `home_idol_pick_list_view{count}` 가 매 포커스마다 전송된다.

---

### User Story 3 - 상세에서 "어떤 아이돌이 먹었을까?" 카드로 영상을 연다 (Priority: P1)

목록에서 들어온 음식 상세의 헤더 블록 아래에 다크 티저 카드가 있고, 탭하면 대표 영상 1개가 인앱 브라우저로 바로 열린다. 영상은 목록 쿼리 캐시에서 찾는다(상세 API 무변경).

**Independent Test**: 목록 캐시에 그 foodId 항목(video YOUTUBE) → 카드 렌더, 탭 → 계측 `{food_id, platform:'youtube', video_position:0}` + `openWebPage(url)`. 캐시 없음 → 카드 없음, 목록 API 호출 0.

**Acceptance Scenarios**:

1. **Given** 목록 캐시에 이 음식 있음, **Then** profileHint 다음·디바이더 위에 카드(위험 요약 행보다 아래).
2. **Given** 캐시 없음(딥링크·검색 직진입·앱 재시작) 또는 이 음식 없음, **Then** 카드·래퍼·여백 없음.
3. **When** 탭, **Then** 확인 모달 없이 계측 후 인앱 브라우저로 연다. 실패 시 기존 링크 실패 토스트.
4. 화면·접근성 라벨에 플랫폼명이 없다.

### Edge Cases

- 목록 API 를 모르는 구 서버 → 목록 화면 오류 블록(배너는 정적이라 보인다). BE 먼저 배포.
- 알 수 없는 platform·빈 url 항목 → 어댑터가 버린다.
- 포스터 사진 URL 없음·로드 실패 → ink + 물음표(이름·배지 유지). 배너는 번들 사진이라 실패 없음.
- 폭 < 360 → 콜라주 축소 규격(80×100, 높이 120, 물음표 48).
- 목록 홀수 개수 → 마지막 행 빈 셀(padOddGrid).
- 캐시 있는 상태에서 백그라운드 실패 → 목록 유지(오류 표시 없음).
- 기피 성분 변경 → useMe 의 전면 무효화가 목록 쿼리도 덮는다(추가 코드 없음).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (R-17)**: 전용 목록 요청 `GET /foods/idol-picks?lang=`(기본 헤더). 항목 = 음식 요약 + `video{url, platform}` → 요약 카드 + `video{url, platform: youtube|tiktok}`. 알 수 없는 platform·빈 url 항목 제외. 홈·상세 데이터 계층 무변경.
- **FR-002 (D3)**: 상세 카드 영상 = 목록 쿼리 캐시만 구독해 foodId 로 찾음. 상세 진입으로 목록 API 미호출.
- **FR-003 (R-01·R-05·R-08)**: 정적 홈 배너(디자인 스펙 화면 1 규격, 번들 사진 3장) — 위치·320pt 규격·단일 버튼·눌림 색만.
- **FR-004 (R-06·R-07)**: 목록 화면(화면 2) — 다크 헤더, 2열 포스터, 회원(useIsGuest false)만 위험도 배지, 칩 필터 없음, 로딩·오류·0건.
- **FR-005 (R-10·R-11·R-14)**: 상세 V1 카드(화면 3) — 탭 = 계측 → 인앱 브라우저. 확인 단계·진입 모션 없음.
- **FR-006 (R-09·R-13·R-22)**: 계측 — `home_section_view`/`home_card_click` section=`idol_pick`(클릭 id 없음), `food_detail_view` source=`idol_pick`, `home_idol_pick_list_view{count}`, `food_idol_video_open{food_id, platform, video_position}`(URL 금지).
- **FR-007 (R-02·R-12)**: 문구 15키 × 10로케일. 플랫폼명·"PICK"·이모지·`{{count}}` 없음. `opensIn` 키 없음.
- **FR-008 (R-21)**: 신규 SVG `IconQuestion`·`IconPlay`(텍스트 "?" 금지).

### Key Entities

- **IdolVideo**: `{ url, platform: 'youtube' | 'tiktok' }` — platform 은 계측 전용.
- **IdolPick**: `FoodCard & { video: IdolVideo }`(서버 화제성 순서).

## Success Criteria *(mandatory)*

- **SC-001**: 배너 렌더 시 네트워크 요청 0.
- **SC-002**: 목록 N건 응답 → 카드 N장(순서 일치). 상세 진입 시 목록 요청 0.
- **SC-003**: 배너 클릭 계측에 food_id·collection_key 0.
- **SC-004**: 영상 열기 계측에 URL 0, 화면·라벨에 플랫폼명 0.
- **SC-005**: 배너·포스터·V1 카드 눌림 전후 레이아웃 메트릭 동일.

## Assumptions

- 계약 C-1(01_cto_plan.md) 그대로 — BE 진행 중이라 JSON 예시 기준으로 어댑터 작성.
- 상세 카드는 목록 캐시가 있을 때만 뜬다 — 딥링크·검색·다른 목록 직진입, 앱 재시작·gcTime 만료 뒤엔 매핑 음식이어도 카드 없음(D3, 사용자 결정).
- 배너 사진 = 번들 dish-05 잡채·dish-03 구운 소고기·dish-12 갈비탕(인물 없음, 시드 제외 5종·닮은꼴 아님 — 근거 research R-3).
- 이벤트 이름은 레포 도메인 접두 잠금(analyticsNaming215)에 따라 `idol_pick_list_view` → `home_idol_pick_list_view`, `idol_video_open` → `food_idol_video_open`(속성·시점은 계획 그대로, cto 통보).
- 비영어·비한국어 8개 로케일 문구는 en 기준 번역 — 번역 검수 필요.
- en `idolPicks.sub`("…check the ingredients and find the video link.")는 "재료 검색 약속 금지" 잠금(copy722)에 오탐 — 확정 문구라 허용 목록에 추가.

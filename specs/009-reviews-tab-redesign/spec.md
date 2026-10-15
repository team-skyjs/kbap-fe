# Feature Specification: 리뷰 탭 개편 — 사진 중심 카드 + 리뷰 상세

**Feature Branch**: `feat/kb802-reviews-tab-redesign` (spec `009-reviews-tab-redesign`)
**Created**: 2026-10-16
**Status**: Ready
**Input**: `_workspace/kb802-reviews-tab-redesign/` 00_prd · 01_cto_plan(R-04~R-16, 계약 C-1·C-2) · 02_designer_spec(정본 수치) · Jira KB-802

## User Scenarios & Testing

### User Story 1 — 사진으로 훑는 리뷰 카드 (P1)

리뷰 탭 사용자는 작성자 줄·음식 칩(영문명 + 한국어 부제)·peek 캐러셀·평점 3줄·"도움돼요 (n)"·"리뷰 읽기 ›" 만 있는 카드를 본다. 본문은 보이지 않는다.

**Independent Test**: 리뷰 탭을 열고 사진 0·1·3장 리뷰가 각각 236pt / 481pt 카드로 보이는지 확인.

**Acceptance Scenarios**:
1. **Given** 사진 3장 리뷰, **When** 카드 렌더, **Then** 311×233 사진 가로 캐러셀 + "1/3" 배지(현재 장에만), 페이지 점·자동 넘김 없음.
2. **Given** 사진 1장, **Then** 335×233 단일 사진, 배지 없음.
3. **Given** 사진 0장, **Then** 사진 영역·gap 없음, 본문 미렌더.
4. **Given** 속도·친절 미입력(0), **Then** 그 줄은 빈 별 5개 + "—"(숨기지 않음).
5. **Given** `food.koreanName` null(lang=ko·구서버), **Then** 칩은 영문명 1줄, 높이 48 유지.

### User Story 2 — 카드 탭 → 리뷰 상세 (P1)

카드·사진·"리뷰 읽기" 탭은 `/review/{id}?photo={i}` 로 이동한다. 이동 전에 리스트 항목을 상세 캐시에 넣어 상세가 즉시 완성 렌더되고, 단건 API 로 백그라운드 갱신된다. 음식 칩 탭은 음식 상세(`?src=feed`).

**Acceptance Scenarios**:
1. **Given** 리스트에서 2번째 사진을 보고 있음, **When** 사진 탭, **Then** 상세 캐러셀이 2번째 장에서 시작.
2. **Given** 딥링크 `kbap://review/42`(캐시 없음), **Then** 스켈레톤 → 단건 로드 후 렌더.
3. **Given** 단건이 `REVIEW-001`, **Then** "삭제되었거나 볼 수 없는 리뷰예요" + 리스트 캐시에서 그 항목 제거.
4. **Given** 5xx·오프라인, **Then** QueryErrorBlock + 재시도.

### User Story 3 — 상세에서 Helpful·⋯ (P2)

상세에서 Helpful 을 토글하면 리스트로 돌아갔을 때 수가 같다(실패 시 양쪽 롤백). ⋯ 는 내 리뷰 = 수정/삭제(삭제 성공 시 뒤로), 타인 = 신고/차단(차단 시 뒤로 + 피드 재조회), 탈퇴 작성자 = 신고만. 게스트 Helpful = 로그인 게이트.

### Edge Cases
- 셀 재사용: 캐러셀은 리뷰 id key 로 첫 장 리셋.
- 사진 로드 실패: `C.surface2` + `IconGallery` 폴백(음식 기본 이미지 금지).
- `FLAGS.reviewsLiveEnabled` off: 상세 네트워크 0(시드만, 없으면 notFound).
- 상세 쿼리 키에 언어 없음(A-8).

## Requirements

### Functional Requirements
- **FR-001** (R-04): 어댑터가 `food.koreanName` → `Review.foodNameKo`(null 가능) 매핑, 단건 `GET /api/reviews/{id}?lang=` fetch.
- **FR-002** (R-04): `useReview(id)` 키 `['reviews','detail',id]`, staleTime 0.
- **FR-003** (R-05): `ReviewTabCard` — 디자인 스펙 화면 ① 규격. FeedCard 는 `ReviewAuthorLine` 추출 외 무변.
- **FR-004** (R-06): `ReviewPhotoCarousel` — snapToInterval 319, decelerationRate fast, disableIntervalMomentum, 배지 현재 장만, 실패 폴백.
- **FR-005** (R-07): 카드 탭 = setQueryData 시드 → `review_card_open{target,photo_count}` → push.
- **FR-006** (R-08~R-10): `app/review/[id].tsx` 상세 골격·상태·⋯.
- **FR-007** (R-11·R-12): Helpful 낙관 반영·롤백이 상세 키 포함, 작성·수정·삭제 무효화에 상세 키 포함, REVIEW-001 시 전역 피드 캐시에서 제거.
- **FR-008** (R-13): 상세 발 음식 진입 `?src=review_detail` 허용.
- **FR-009** (R-14): 딥링크 `review/:id`.
- **FR-010** (R-15): 신규 i18n 키 10 로케일.
- **FR-011** (R-16): `review_card_view{photo_count,position,review_id}` — 홈 KB-784 판정(50%↑·스크롤 정지·포커스당 1회), 광고 행 제외.

### Key Entities
- **Review**: 기존 + `foodNameKo?: string | null`.

## Success Criteria
- **SC-001**: 사진 카드 481pt·사진 없음 236pt(장수 무관 동일 높이 — 유닛으로 메트릭 잠금).
- **SC-002**: 리스트→상세 진입 시 스켈레톤 없이 첫 프레임 완성 렌더.
- **SC-003**: 상세 Helpful 토글 후 리스트 캐시 수 일치.
- **SC-004**: tsc 0 · jest 전체 통과 · lint-changed 0.

## Assumptions
- 필드명은 designer·리더 지시대로 `foodNameKo`(계획 문구 `foodKoreanName` 과 같은 의미).
- 음식 칩 높이는 designer 정본대로 부제 유무와 무관 48.
- `reviews.photoCount` 는 배지 "{{index}}/{{total}}" 와 캐러셀 접근성 값에 쓴다.
- 상세 헤더는 `SubHeader`(trailing 슬롯) — 스크롤 반응형 불필요.

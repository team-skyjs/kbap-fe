# Tasks: 리뷰 탭 개편 — 사진 중심 카드 + 리뷰 상세

**Input**: `specs/009-reviews-tab-redesign/` (plan · spec · data-model · contracts/review-detail.md)
**Tests**: CLAUDE.md 완료 기준에 따라 포함. 검증·PR 태스크는 qa 몫이라 제외.

## Phase 1: Setup
- [X] T001 워크트리 `npm ci` + 베이스라인 `npx jest --ci`

## Phase 2: Foundational (계약·데이터)
- [X] T002 `reviewAdapter.ts` `ReviewFoodWire.koreanName` + `adaptReview.foodKoreanName` · `types.ts` `Review.foodKoreanName`
- [X] T003 `useFoodReviews.ts` `fetchReview`·`useReview`(키 `['reviews','detail',id]`, staleTime 0, 플래그 off = 네트워크 0)
- [X] T004 `useReviewMutations.ts` 상세 키: `flipLikeCaches`·`currentMyLike`·`findCachedReview`·`useInvalidateReviews` + `removeReviewFromFeeds`
- [X] T005 [P] `src/lib/data/__tests__/reviewDetail802.test.ts` — 어댑터 매핑·부재 폴백, fetchReview 경로, Helpful 상세↔피드 동기화·롤백, 무효화, 피드 제거

## Phase 3: US1 — 카드 (P1)
- [X] T006 `ReviewPhotoCarousel.tsx` + 순수 산식 `snapOffset`·`snapIndex`
- [X] T007 `ReviewCellParts.tsx` `ReviewAuthorLine` 추출(FeedCard 사용) · `ReviewFoodChip` · `ReviewRatingLines` · `ReviewBody expanded`
- [X] T008 `ReviewTabCard.tsx`
- [X] T009 [P] `src/features/review/__tests__/reviewTabCard802.test.tsx` — 캐러셀 0/1/2/3장·배지·snap 산식·실패 폴백, 카드 높이 메트릭 481/236 불변(부제 유무·평점 0)·본문 미렌더

## Phase 4: US2 — 탭 → 상세 (P1)
- [X] T010 `ReviewFeed.tsx` 카드 교체 · 시드 · `review_card_open` · push
- [X] T011 `app/review/[id].tsx` + `SkeletonReviewDetail`
- [X] T012 `analytics.ts` `review_card_open` · `food/[id]` source `review_detail` · `deeplink.ts` `review/:id`
- [X] T013 [P] `src/app/__tests__/reviewDetail802.test.tsx` — 시드 즉시 렌더·스켈레톤·REVIEW-001 notFound+피드 제거·5xx 에러·⋯ 배선·사진 탭 PhotoViewer · 피드 카드 탭 시드+push+이벤트 · 딥링크

## Phase 5: US3·R-16 — 노출 계측
- [X] T014 `homeImpressions.tsx` Target `review` · `analytics.ts` `review_card_view` · ReviewFeed tracker 배선
- [X] T015 [P] 노출 테스트 — 50% 미만·스크롤 중·같은 포커스 재전송 없음·재포커스·광고 행 제외

## Phase 6: 마감
- [X] T016 i18n 10 로케일
- [X] T017 기존 테스트 갱신(ReviewFeed 소스 잠금 등)
- [X] T018 `npx tsc --noEmit` · `npx jest --ci` · `node ./scripts/lint-changed.mjs`

## Dependencies
T002 → T003 → T004 → T005 · T006·T007 → T008 → T010 → T011 · T012 ∥ T016 · T014 → T015 · 전부 → T018

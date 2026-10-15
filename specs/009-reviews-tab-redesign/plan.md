# Implementation Plan: 리뷰 탭 개편 — 사진 중심 카드 + 리뷰 상세

**Branch**: `feat/kb802-reviews-tab-redesign` (spec `009-reviews-tab-redesign`) | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)
**Input**: spec.md · `_workspace/kb802-reviews-tab-redesign/01_cto_plan.md`(R-04~R-16, C-1·C-2) · `02_designer_spec.md` · Jira KB-802

## Summary

어댑터에 `food.koreanName → foodNameKo` 와 단건 `fetchReview` 를 더하고 `useReview`(키 `['reviews','detail',id]`, staleTime 0)를 만든다. 리뷰 탭 `ReviewFeed` 의 `FeedCard` 를 신규 `ReviewTabCard`(작성자 줄 · `ReviewFoodChip` · `ReviewPhotoCarousel` · 평점 3줄 · 하단 줄)로 바꾸고, 카드 탭은 상세 캐시 시드 → `review_card_open` → `/review/{id}?photo=` push. 상세 `app/review/[id].tsx` 를 되살리되 단건 쿼리를 정본으로 둔다(KB-307 재발 방지). Helpful·무효화 캐시 경로에 상세 키를 더하고, 노출 계측은 홈 `ImpressionTracker` 에 `review` 대상 종류를 더해 재사용한다. 순수 JS(네이티브 무변).

## Technical Context

**Language/Version**: TypeScript · React 19 · React Native · Expo(expo-router)
**Primary Dependencies**: @tanstack/react-query · i18next · expo-image(RemoteImage/CardPhoto 경유)
**Storage**: N/A
**Testing**: jest-expo · @testing-library/react-native(기존 문법)
**Target Platform**: iOS/Android
**Project Type**: mobile-app
**Constraints**: OTA 가능. BE C-1 미배포 서버에서 단건은 실패 → 리스트 진입은 시드로 렌더, 백그라운드 갱신 실패는 데이터가 있으면 무시(에러 블록은 데이터 없을 때만).
**Scale/Scope**: 소스 ~12파일 + 로케일 10 + 테스트 신규 4

## Constitution Check

*`.specify/memory/constitution.md` 미기입 템플릿 → 실효 게이트는 kbap-fe CLAUDE.md 불변 규칙.*

| 규칙 | 적용 | 판정 |
|------|------|------|
| 서버 와이어 파싱은 어댑터만 | `adaptReview`·`fetchReview`(data 훅) | PASS |
| 뮤테이션 버튼 useSubmitGuard | 신규 뮤테이션 버튼 없음(Helpful 낙관 토글 예외·삭제는 ModerationFlow 기존) | PASS |
| 상태 변화는 색만 | 카드 눌림 = 배경색만 · 평점 미입력 = 같은 자리 빈 별 + "—" · 부제 null 이어도 칩 48 → 메트릭 유닛 | PASS |
| 원격 이미지 스켈레톤+폴백 | 캐러셀 = RemoteImage + 전용 폴백, 칩 썸네일 = CardPhoto | PASS |
| 기호는 SVG | IconChevron·IconMore·IconGallery·Star | PASS |
| i18n 10 로케일 | 신규 키 13개 | PASS |

## Project Structure

```text
src/lib/api/reviewAdapter.ts · types.ts          # foodNameKo
src/lib/data/useFoodReviews.ts                   # fetchReview · useReview · REVIEW_DETAIL_KEY
src/lib/data/useReviewMutations.ts               # 상세 키 동기화 · removeReviewFromFeeds
src/features/review/ReviewCellParts.tsx          # ReviewAuthorLine(추출) · ReviewFoodChip · ReviewRatingLines · ReviewBody expanded
src/features/review/ReviewPhotoCarousel.tsx      # 신규
src/features/review/ReviewTabCard.tsx            # 신규
src/features/review/FeedCard.tsx                 # ReviewAuthorLine 사용(시각 무변)
src/features/community/ReviewFeed.tsx            # 카드 교체·시드·계측·노출
src/features/home/homeImpressions.tsx            # Target kind 'review'
src/app/review/[id].tsx                          # 신규 상세
src/components/Skeleton.tsx                      # SkeletonReviewDetail
src/lib/analytics.ts · deeplink.ts · app/food/[id]/index.tsx
src/lib/i18n/*.json
```

## Decisions (research)

- **캐러셀 스냅 산식**: `snapOffset(i,n,W) = min(319·i, max(0, 32 + 319·n − W))`, `snapIndex(x,n) = clamp(round(x/319), 0, n−1)`. `getItemLayout` 오프셋을 끝 클램프 값으로 줘 `initialScrollIndex` 가 마지막 장에서 콘텐츠 밖으로 넘어가지 않게 한다.
- **사진 실패 폴백**: `CardPhoto` 는 음식 기본 이미지로 강등하므로 `RemoteImage` + `onError` 로 `surface2` + `IconGallery`.
- **구분선**: 카드 높이 481/236 에 넣지 않으려고 절대 위치 1px.
- **상세 헤더**: `SubHeader` trailing 슬롯(스크롤 반응형 불필요 — designer 판단 위임).
- **REVIEW-001**: 쿼리 `retry` 는 전역 `shouldRetry`(4xx 미재시도) 그대로, 에러 effect 에서 전역 피드 캐시 제거.
- **노출 계측**: `ImpressionTracker` 의 Target 에 `review` 종류 추가(키 = 리뷰 id) — 판정 로직 무변.

# Implementation Plan: 홈 하단 "평점 높은 음식" 섹션 + 스캔 CTA

**Branch**: `feat/kb800-home-top-rated-foods` (spec 디렉터리 `008-home-top-rated-foods`) | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: spec.md · `_workspace/kb800-home-top-rated-foods/01_cto_plan.md`(R-06~R-13, 계약 C-01) · Jira KB-800

## Summary

`fetchHome` 의 `X-API-Version` 을 1.3 으로 올리고 `payload.topRatedFoods` 를 `HomeResponse.topRated` 로 어댑트한다(`adaptTopRatedFood` = `adaptMenuSummary` + 세부 평점 4개, null 유지). 홈 화면 하단의 `useGlobalReviews` 무한 피드(칩·다음 페이지 스켈레톤/에러·`ModerationFlow`·리뷰 캐시 무효화)를 지우고, 같은 `Animated.FlatList` 의 `data` 를 `topRated` 로 바꿔 `TopRatedRow`(FoodCards.tsx 신규) 를 그린다. 푸터에 `Btn` CTA(`/scan`) + 기존 면책. 계측 `HomeSection` 에 `top_rated` 추가·`reviews` 제거. 순수 JS.

## Technical Context

**Language/Version**: TypeScript · React Native · Expo(expo-router)

**Primary Dependencies**: @tanstack/react-query(useHome 무변 구조) · i18next · react-native-reanimated(FlatList 유지)

**Storage**: N/A

**Testing**: jest-expo · react-test-renderer(기존 홈 테스트 문법)

**Target Platform**: iOS/Android

**Project Type**: mobile-app

**Performance Goals**: 홈 하단 리뷰 페이지 요청 0(감소). 최대 20행 FlatList.

**Constraints**: OTA 가능(네이티브 무변). BE 1.3 미배포 서버는 헤더를 거절 → FE 릴리스는 BE 배포 후(계획 명시). 리뷰 탭(ReviewFeed·useFoodReviews) diff 0.

**Scale/Scope**: 소스 ~8파일 + 로케일 10 + 테스트(갱신 다수·신규 1)

## Constitution Check

*`.specify/memory/constitution.md` 미기입 템플릿 → 실효 게이트는 kbap-fe CLAUDE.md 불변 규칙.*

| 규칙 | 적용 | 판정 |
|------|------|------|
| 서버 와이어 파싱은 어댑터만 | `adaptTopRatedFood`(foodAdapter) · `fetchHome` | PASS |
| 원격 이미지 = CardPhoto | `TopRatedRow` 썸네일 CardPhoto | PASS |
| 기호는 SVG | chevron = 기존 아이콘 세트, 별 = Stars | PASS |
| i18n 10 로케일 패리티 | `home.scanCta` | PASS |
| 뮤테이션 버튼 가드 | CTA 는 네비게이션(뮤테이션 아님) | N/A |
| 선택/상태 = 색만 | 상태 토글 없음 | N/A |
| 위험도 false-safe 금지 | `personalRisk(f.risk, hasR)` 기존 규칙 | PASS |
| tsc 0 · jest 전체 · lint-changed 0 | quickstart | PASS(구현 후 실행) |

## Project Structure

```text
src/lib/api/foodListTypes.ts      # TopRatedFoodWire
src/lib/api/types.ts              # TopRatedFood · HomeResponse.topRated
src/lib/api/foodAdapter.ts        # adaptTopRatedFood
src/lib/data/useHome.ts           # HOME_API_VERSION 1.3 · topRated
src/lib/mocks/foods.ts            # MOCK_HOME(_EMPTY).topRated
src/features/food/FoodCards.tsx   # TopRatedRow
src/features/home/homeImpressions.tsx · src/lib/analytics.ts(주석)
src/app/(tabs)/index.tsx          # 피드 제거 · 섹션 · CTA
src/lib/i18n/*.json (10)          # home.scanCta
```

**Structure Decision**: 기존 파일 확장만. 새 모듈 0.

## Complexity Tracking

없음.

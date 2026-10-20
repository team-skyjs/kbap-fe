# Implementation Plan: 홈 K-POP & K-FOOD 섹션 + 상세 아이돌 영상 티저

**Branch**: `feat/kb836-home-idol-kfood-section` (spec 디렉터리 `010-home-idol-kfood-section`) | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md)

**Input**: spec.md · `_workspace/kb836-home-idol-kfood-section/01_cto_plan.md`(FE 절, 계약 C-1·C-2, D1~D9) · `02_designer_spec.md` · `01_copy_list.md` · Jira KB-836

## Summary

`fetchHome` 의 `X-API-Version` 을 1.4 로 올리고 `idolPickFoods` 를 `HomeResponse.idolPicks`(adaptMenuSummary)로, 상세 `idolVideo` 를 `adaptIdolVideo`(대문자 → 소문자, 미지 값 null)로 어댑트한다. 홈 `afterRail` 에 `IdolPickBanner → CurationSection`, 신규 라우트 `/idol-picks`(useHome 캐시 재사용 + `IdolPosterCard` 그리드), 상세 `Registered` profileHint 다음에 `IdolVideoCard`. 계측 2종 신규 + 홈 섹션 `idol_pick` + 상세 source `idol_pick`. SVG 2종, 15키 × 10로케일. 순수 JS.

## Technical Context

**Language/Version**: TypeScript · React Native · Expo(expo-router)

**Primary Dependencies**: @tanstack/react-query(useHome 재사용) · expo-linear-gradient · expo-status-bar · expo-web-browser(openWebPage) · react-native-svg — 전부 기설치

**Storage**: N/A

**Testing**: jest-expo · react-test-renderer

**Target Platform**: iOS/Android

**Project Type**: mobile-app

**Performance Goals**: 새 요청 경로 0(목록 = 홈 캐시). 목록 최대 29개 FlatList.

**Constraints**: OTA 가능(네이티브 무변). BE 1.4 미배포 서버는 홈 400 → FE 릴리스는 BE 배포 후.

**Scale/Scope**: 신규 4파일 + 수정 ~10파일 + 로케일 10 + 테스트 신규 1·갱신 6

## Constitution Check

*`.specify/memory/constitution.md` 미기입 템플릿 → 실효 게이트는 kbap-fe CLAUDE.md 불변 규칙.*

| 규칙 | 적용 | 판정 |
|------|------|------|
| 서버 와이어 파싱은 어댑터만 | `adaptIdolVideo`·`fetchHome` | PASS |
| 서버 사실은 서버가 정본 | 목록 배지 = `home.authenticated === true` | PASS |
| 원격 이미지 = RemoteImage/CardPhoto | `IdolPhoto` = RemoteImage + 물음표 폴백 | PASS |
| 기호는 SVG | IconQuestion·IconPlay | PASS |
| 상태 변화는 색만 + 메트릭 비교 유닛 | 배너·포스터·V1 눌림 = opacity/색, 유닛 동반 | PASS |
| i18n 10 로케일 패리티 | 15키 | PASS |
| 외부 링크 = openWebPage(`void Linking.*` 금지) | V1 카드 | PASS |
| 뮤테이션 가드 | 뮤테이션 없음 | N/A |
| tsc 0 · jest 전체 · lint-changed 0 | quickstart | PASS |

## Project Structure

```text
src/lib/api/types.ts · foodDetailTypes.ts · foodAdapter.ts   # IdolVideo · idolPicks · adaptIdolVideo
src/lib/data/useHome.ts · src/lib/mocks/foods.ts             # 1.4 · idolPicks
src/lib/analytics.ts · src/features/home/homeImpressions.tsx # 이벤트 2 · idol_pick · id 선택 인자
src/components/icons.tsx                                     # IconQuestion · IconPlay
src/features/home/IdolPickBanner.tsx · IdolPosterCard.tsx     # 신규
src/app/idol-picks.tsx                                       # 신규 라우트(스택 자동 등록)
src/features/food/IdolVideoCard.tsx                          # 신규
src/app/(tabs)/index.tsx · src/app/food/[id]/index.tsx       # 배치 · source
src/lib/i18n/*.json (10)
```

**Structure Decision**: 화면별 신규 컴포넌트 3 + 라우트 1. 사진 폴백(`IdolPhoto`)은 포스터 카드 파일에서 export 해 배너와 공유.

## Complexity Tracking

없음.

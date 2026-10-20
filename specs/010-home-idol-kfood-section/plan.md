# Implementation Plan: 홈 K-POP & K-FOOD 섹션 + 상세 아이돌 영상 티저

**Branch**: `feat/kb836-home-idol-kfood-section` (spec 디렉터리 `010-home-idol-kfood-section`) | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md)

**Input**: spec.md · `_workspace/kb836-home-idol-kfood-section/01_cto_plan.md`(FE 절, 계약 C-1, D1~D6·D9·D11) · `02_designer_spec.md` · `01_copy_list.md` 갱신본 · Jira KB-836

## Summary

전용 쿼리 `useIdolPicks()`(`['idolPicks', lang]`, `GET /foods/idol-picks?lang=`, 기본 헤더)와 어댑터 `adaptIdolPicks`(요약 + video, platform 소문자, 미지 항목 제외)를 추가한다. 목록 화면 `/idol-picks` 는 이 쿼리만, 상세 V1 카드는 `useIdolPickVideo(foodId)`(같은 키·enabled:false — 캐시만)로 그린다. 홈 배너는 정적(번들 사진 3장, props 없음)으로 `afterRail` 에 큐레이션 앞. 홈·상세 데이터 계층(useHome 1.3·foodAdapter) 무변경. 계측 2종 신규 + 홈 섹션 `idol_pick` + 상세 source `idol_pick`. SVG 2종, 15키 × 10로케일. 순수 JS.

## Technical Context

**Language/Version**: TypeScript · React Native · Expo(expo-router)

**Primary Dependencies**: @tanstack/react-query · expo-linear-gradient · expo-status-bar · expo-web-browser(openWebPage) · react-native-svg — 전부 기설치

**Storage**: react-query 캐시(`['idolPicks', lang]`)

**Testing**: jest-expo · react-test-renderer · 실제 QueryClient

**Target Platform**: iOS/Android

**Project Type**: mobile-app

**Performance Goals**: 배너 네트워크 0. 상세 진입 시 목록 요청 0. 목록 최대 29개 FlatList.

**Constraints**: OTA 가능(네이티브 무변, 번들 사진은 기존 asset 재사용). 목록 API 미배포 서버 → 목록 오류 블록 → FE 릴리스는 BE 배포 후.

**Scale/Scope**: 신규 6파일(어댑터·훅·배너·포스터·목록·V1 카드) + 수정 ~6파일 + 로케일 10 + 테스트 신규 1·갱신 3

## Constitution Check

*`.specify/memory/constitution.md` 미기입 템플릿 → 실효 게이트는 kbap-fe CLAUDE.md 불변 규칙.*

| 규칙 | 적용 | 판정 |
|------|------|------|
| 서버 와이어 파싱은 어댑터만 | `idolPickAdapter.ts` | PASS |
| 서버 사실은 서버가 정본 | 위험도 = 서버 요약 값, 배지 노출 = useIsGuest(세션) | PASS |
| 원격 이미지 = RemoteImage/CardPhoto | 포스터 `IdolPhoto` = RemoteImage + 물음표 폴백. 배너는 번들(RN Image, login.tsx 선례) | PASS |
| 기호는 SVG | IconQuestion·IconPlay | PASS |
| 상태 변화는 색만 + 메트릭 비교 유닛 | 배너·포스터·V1 눌림 = opacity/색, 유닛 동반 | PASS |
| i18n 10 로케일 패리티 | 15키 | PASS |
| 외부 링크 = openWebPage | V1 카드 | PASS |
| 뮤테이션 가드 | 뮤테이션 없음 | N/A |
| tsc 0 · jest 전체 · lint-changed 0 | quickstart | PASS |

## Project Structure

```text
src/lib/api/idolPickAdapter.ts                               # 신규 — IdolPick · IdolVideo · adaptIdolPicks
src/lib/data/useIdolPicks.ts                                 # 신규 — useIdolPicks · useIdolPickVideo · idolPicksKey
src/lib/analytics.ts · src/features/home/homeImpressions.tsx # 이벤트 2 · idol_pick · id 선택 인자
src/components/icons.tsx                                     # IconQuestion · IconPlay
src/features/home/IdolPickBanner.tsx · IdolPosterCard.tsx     # 신규
src/app/idol-picks.tsx                                       # 신규 라우트(스택 자동 등록)
src/features/food/IdolVideoCard.tsx                          # 신규
src/app/(tabs)/index.tsx · src/app/food/[id]/index.tsx       # 배치 · 캐시 훅 · source
src/lib/i18n/*.json (10)
```

**Structure Decision**: 전용 쿼리·어댑터 1쌍. 홈·상세 데이터 계층에 손대지 않는다.

## Complexity Tracking

없음.

# Implementation Plan: 푸시 탭 착지 화면 확정 — MEAL_TIME→홈, HELPFUL→내 리뷰, 임시 push-landing 제거

**Branch**: `feat/kb573-push-landing` (spec 디렉터리 `005-push-tap-landing`) | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-push-tap-landing/spec.md` · Jira KB-573

## Summary

푸시 탭 착지를 확정한다: 식사 시간(MEAL_TIME)→홈 탭, 리뷰 좋아요(HELPFUL)→내 리뷰 목록, 스캔 제안(SCAN_SUGGESTION)→홈 탭(식사 시간과 동일, 종한 확정 9/16). 리마인더·소식·미지 유형은 기존 유지. 매핑은 `routeForNotificationData` case 3줄 교체, "어떻게 가는가"는 `src/lib/nav.ts`에 헬퍼 1개(홈 = 스택 리셋 + 탭 점프, 그 외 = navigate)를 두고 호출부 2곳이 `router.push` 대신 그것을 쓴다. 콜드 스타트 탭은 루트 레이아웃의 푸시 배선 effect를 `entryChecked` 뒤로 게이트해 Stack 마운트 전 이동(expo-router throw)을 막는다. 임시 화면 `push-landing.tsx`와 10로케일 `push.landingTbd*` 키를 지운다. 전부 JS 변경 — 소스 4파일 + 로케일 10 + 삭제 1 + 테스트, 신규 모듈 없음(헬퍼는 기존 nav.ts에 추가).

## Technical Context

**Language/Version**: TypeScript ~6.0 · React Native 0.85 · Expo SDK 56 · expo-router ~56.2 (RN7 계열 StackRouter 포크 내장)

**Primary Dependencies**: expo-notifications ~56.0(어댑터 지연 require 1곳, 무변) · expo-router `useRouter`(`navigate`·`dismissAll`·`canDismiss`) · i18next

**Storage**: N/A — AsyncStorage 스키마 무변

**Testing**: jest 29 + jest-expo · 기존 pushAdapter192 확장 · nav 헬퍼 유닛 신규 · 로케일/소스 잠금 1건

**Target Platform**: iOS/Android (Expo 앱). 플랫폼 분기 없음

**Project Type**: mobile-app (단일 레포, `src/` 하위)

**Performance Goals**: N/A — 부팅 경로 변화 = 푸시 리스너 등록이 entryChecked 뒤로 이동(추가 비용 0)

**Constraints**: OTA 배포 가능(네이티브·config plugin 무변) · 어댑터 단일 관문·순수 매핑 함수 유지 · 호출부 `if (href)` 가드·`notificationId` 2번째 인자 계약(specs/002 §3) 무변 · 서버 data 형식 무변(FR-007)

**Scale/Scope**: 소스 4파일(`pushAdapter.ts`·`nav.ts`·`_layout.tsx`·`notifications.tsx`) + 로케일 10 + 삭제 1(`push-landing.tsx`) + 테스트 2~3 + 문서(specs/002 2파일·PROGRESS.md)

## Constitution Check

*GATE: `.specify/memory/constitution.md`는 미기입 템플릿이라 실효 게이트는 프로젝트 CLAUDE.md 불변 규칙이다.*

| 규칙 | 적용 | 판정 |
|------|------|------|
| tsc 0 · jest 전체 통과 · 신규 로직에 그 버그를 잡는 테스트 동반 | 매핑 7+케이스(SC-001) · 헬퍼(홈 = dismissAll→navigate 순서, canDismiss false 분기, 그 외 navigate·push 0) · 로케일 키 부재·소스 잠금(SC-003) | PASS — quickstart §1 |
| 서버가 아는 사실은 서버가 정본 | 착지 매핑은 앱 소유(스펙 Assumptions), 서버 data 형식·유형 enum 무변. 회원 여부 판별은 내 리뷰 화면의 기존 `useIsGuest`(서버 세션 기반) 게이트에 위임 — 착지 로직이 판단하지 않음 | PASS |
| 계정 생애주기 유닛 상비 | 게이팅 로직 변경 없음(게스트 게이트는 기존 화면 것 재사용). 실기 D-7(게스트 잔존 알림 탭)로 커버 | N/A(유닛)·실기 |
| API 뮤테이션 버튼 공용 제출 가드 | 뮤테이션 버튼 없음 | N/A |
| OTA 게이트 커밋 동승 금지 · 배포 게이트(예진 승인) | 코드·테스트까지. 발행 별도 지시. 콜드 스타트 게이트(R-4)는 실기 확인 후 발행 항목으로 PR에 명기 | 준수 |
| 선택/상태 변화 프레임 불변 | UI 변경 없음(화면 삭제뿐) | N/A |
| 위험도 false-safe 금지 | 무관 | N/A |
| 기호 텍스트 렌더 금지 · 원격 이미지 스켈레톤 | 무관 | N/A |
| Jira 전환·자기 완료 선언 금지 | 하지 않음 | 준수 |

**Post-design 재검토**: Phase 1 설계 후 신규 위반 없음. 신규 파일 = 테스트만. 추상화 추가 = `openNotificationRoute` 1함수(호출부 2곳 공유 — 단일 구현 인터페이스 아님).

## Project Structure

### Documentation (this feature)

```text
specs/005-push-tap-landing/
├── plan.md              # 이 파일
├── research.md          # Phase 0 — 결정 R-1~R-7 (SCAN_SUGGESTION=홈·홈 이동 방식·헬퍼·콜드 스타트 게이트·제거 범위·문서·알림함 동승)
├── data-model.md        # Phase 1 — 유형→착지 표 · 이동 의도 · 진입 경로 · 제거 표면
├── quickstart.md        # Phase 1 — 정적·유닛 명령 + 실기 D-1~D-10
├── contracts/
│   └── push-tap-landing.md   # routeForNotificationData 표 · openNotificationRoute · 호출부 · 제거 · 테스트 계약
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 산출 (여기서 만들지 않음)
```

### Source Code (repository root)

```text
src/lib/push/pushAdapter.ts                 # routeForNotificationData — MEAL_TIME·SCAN_SUGGESTION '/(tabs)' · HELPFUL '/profile/reviews'. 주석의 push-landing 언급 제거
src/lib/nav.ts                              # + openNotificationRoute(router, href): '/(tabs)' = canDismiss→dismissAll→navigate, 그 외 navigate
src/app/_layout.tsx                         # 푸시 배선 effect: entryChecked 게이트 + deps · 콜백 router.push → openNotificationRoute
src/app/notifications.tsx                   # open(n): router.push → openNotificationRoute
src/app/push-landing.tsx                    # 삭제
src/lib/i18n/{ko,en,ja,zh-Hans,zh-Hant,vi,id,th,ru,es}.json
                                            # push.landingTbdTitle · push.landingTbdBody 삭제
src/lib/push/__tests__/pushAdapter192.test.ts   # 매핑 기대값 교체(3케이스) · 구독 테스트 '/profile/reviews' · MEAL_TIME ('/(tabs)', 4)
src/lib/__tests__/nav573.test.ts                # (신규) 헬퍼 4케이스 + 로케일 landingTbd 부재 + 어댑터 소스 push-landing 0 + push-landing.tsx 부재
specs/002-push-data-contract/spec.md            # 개요·AS 1·2·5·FR-002 갱신
specs/002-push-data-contract/contracts/push-notification-data.md   # §2 표 착지 열 갱신
PROGRESS.md                                     # KB-573 항목
```

**Structure Decision**: 어댑터 단일 관문·순수 매핑 함수 구조 유지. 내비게이션 방식은 기존 `nav.ts`(온보딩 스택 리셋 헬퍼가 이미 있는 곳)에 헬퍼 1개 추가 — 호출부 2곳이 같은 함수를 타므로 홈의 dismissAll이 한 곳에만 산다. 화면 파일은 삭제 1·호출 1줄 교체 2.

## Complexity Tracking

위반 없음 — 기입 불필요.

## 확정 사항 (2026-09-16 /speckit-clarify)

- SCAN_SUGGESTION 착지 = 홈 탭(식사 시간과 동일). 홈 착지 = 스택 리셋(뒤로 가기 대상 없음). 서로 다른 알림 연속 탭 = 맨 위 같은 화면이면 재사용(권고안 채택). 미확정 없음.

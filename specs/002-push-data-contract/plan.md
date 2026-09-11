# Implementation Plan: 푸시 알림 데이터 계약 반영 — 유형 개명·신설, 알림 id 전달, Android 알림 채널

**Branch**: `feat/kb498-push-data-contract` (spec 디렉터리 `002-push-data-contract`) | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-push-data-contract/spec.md` · Jira KB-498

## Summary

서버 푸시 data 계약(2026-09-11 확정)을 앱에 반영한다. 유형 5종(HELPFUL·SCAN_SUGGESTION·REVIEW_REMINDER·NEWS·MEAL_TIME)으로 딥링크 매핑·알림함 문구 키·10로케일을 교체하고, 탭 콜백에 서버 `notificationId`를 두 번째 인자로 흘리며, Android에서 `default` 채널을 최고 중요도로 1회 설정한다. 전부 JS 변경 — 기존 파일 3개(`pushAdapter.ts`·`inbox.ts`·로케일 10개) + 테스트. 신규 모듈 없음.

## Technical Context

**Language/Version**: TypeScript ~6.0 · React Native 0.85 · Expo SDK 56 (expo-router)

**Primary Dependencies**: expo-notifications ~56.0 (어댑터 지연 require 1곳만) · i18next · AsyncStorage

**Storage**: AsyncStorage `kbap.inbox.v1`(알림함 로컬 영속, 기존) — 스키마 변경 없음(type 유니온만 교체)

**Testing**: jest 29 + jest-expo · 기존 스위트 pushAdapter192 · pushProdGuard221 · inbox216 · notifKeys497 확장

**Target Platform**: iOS/Android (Expo 앱). 채널 설정은 Android 전용 분기

**Project Type**: mobile-app (단일 레포, `src/` 하위)

**Performance Goals**: N/A — 부팅 경로에 비동기 호출 1건(채널 설정, 결과 대기 없음) 추가뿐

**Constraints**: OTA 배포 가능해야 함(네이티브 변경 0 · expo-notifications 정적 import 0 · 플래그 off 시 호출 0). 기존 루트 레이아웃 호출부 `(href) => router.push(href)` 무수정 호환

**Scale/Scope**: 소스 2파일 + 로케일 10파일 + 테스트 4파일. 화면 코드 무변

## Constitution Check

*GATE: `.specify/memory/constitution.md`는 미기입 템플릿이라 실효 게이트는 프로젝트 CLAUDE.md 불변 규칙이다.*

| 규칙 | 적용 | 판정 |
|------|------|------|
| tsc 0 · jest 전체 통과 · 신규 로직에 그 버그를 잡는 테스트 동반 | 매핑 5종+미지+NUDGE 무동작 · notificationId 전달/부재 · 채널 설정 android-only · 미지 유형 미기록 · 10로케일 키 패리티 각각 유닛 | PASS (Phase 1 quickstart에 명시) |
| 서버가 아는 사실은 서버가 정본 | 유형 enum·notificationId·(광고) 접두는 서버값 그대로 — 앱 가공 0 (FR-006) | PASS |
| expo-notifications 정적 import 금지(OTA 안전) | 채널 설정도 `loadNotifications()` 뒤 `N.setNotificationChannelAsync` 호출 — prodGuard221 폭탄 목에 getter 추가로 잠금 | PASS |
| API 뮤테이션 버튼 공용 제출 가드 | 뮤테이션 버튼 없음 | N/A |
| 선택/상태 변화 프레임 불변 | UI 변경 없음 | N/A |
| 위험도 false-safe 금지 | 무관 | N/A |
| 배포 게이트(OTA 발행은 예진 승인 후) | 이 작업은 코드·테스트까지. 발행은 별도 지시 | 준수 |
| Jira 전환 금지 | 하지 않음 | 준수 |

**Post-design 재검토**: Phase 1 설계 후 신규 위반 없음. 신규 파일 = 테스트 1개(inboxKeys498)뿐.

## Project Structure

### Documentation (this feature)

```text
specs/002-push-data-contract/
├── plan.md              # 이 파일
├── research.md          # Phase 0 — 결정 6건
├── data-model.md        # Phase 1 — PushType · 푸시 data · InboxItem
├── quickstart.md        # Phase 1 — 검증 시나리오
├── contracts/
│   └── push-notification-data.md   # 서버→앱 data 계약 + 앱 내부 탭 콜백 계약
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 산출 (여기서 만들지 않음)
```

### Source Code (repository root)

```text
src/lib/push/pushAdapter.ts                 # PUSH_TYPES·PushType·isPushType 정의 / routeForNotificationData 5종 / 탭 콜백 2번째 인자 notificationId + identifier 중복 차단 / Android 채널 1회
src/lib/notifications/inbox.ts              # InboxItem.data.type = PushType(type-only import) / KEYS 5종 모듈 상수 / record·하이드레이트 시 KEYS 키 존재 가드(미지 유형 드롭) / _resetInboxForTest rehydrate 옵션
src/lib/i18n/{ko,en,ja,zh-Hans,zh-Hant,vi,id,th,ru,es}.json
                                            # inbox.nudge*·notice* 제거 → scanSuggestion*·news*·mealTime* 추가
src/lib/push/__tests__/pushAdapter192.test.ts   # 매핑 7케이스 · notificationId 전달 · 채널(android/ios) 확장
src/lib/push/__tests__/pushProdGuard221.test.ts # 폭탄 목에 setNotificationChannelAsync 추가
src/lib/notifications/__tests__/inbox216.test.ts # 신규 3유형 기록 · 미지 유형 미기록 · 잔존 NUDGE 하이드레이트 드롭
src/lib/i18n/__tests__/inboxKeys498.test.ts     # (신규) inbox 키 10로케일 패리티 + 구 키 잔존 0
```

**Structure Decision**: 기존 어댑터 단일 관문 구조 유지. 유형 정의는 `pushAdapter.ts` 한 곳(`inbox.ts`는 `import type`으로 소비 — 런타임 순환 없음). 화면(`app/notifications.tsx`·`app/_layout.tsx`)은 무수정.

## Complexity Tracking

위반 없음 — 기입 불필요.

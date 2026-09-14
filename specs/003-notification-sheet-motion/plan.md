# Implementation Plan: 알림 시트 슬라이드 업·드래그/스크림 탭 닫힘 모션 + 알림 문구 중간점→슬래시

**Branch**: `feat/kb553-sheet-motion` (spec 디렉터리 `003-notification-sheet-motion`) | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-notification-sheet-motion/spec.md` · Jira KB-553

## Summary

`NotificationSheet`(primer·consent)를 앱의 다른 바텀시트 3곳과 같은 골격으로 바꾼다: `Modal animationType="slide"`(등장 슬라이드 업 + 스크림/나중에/백버튼 닫힘의 슬라이드 다운) + 공용 훅 `useSheetSwipeDismiss`(핸들·제목 드래그 → 임계 통과 시 아래로 퇴장 후 `onClose`, 미만 = 스프링 복귀) + Modal 내부 `GestureHandlerRootView` + 딤 전용 레이어. props·testID·호출부 2곳은 무변. 별도로 ko·ja·zh-Hans·zh-Hant 로케일 5키의 중간점을 슬래시로 교체한다. 전부 JS 변경 — 소스 1파일 + 로케일 4파일 + 테스트 2파일. 신규 모듈·의존성 0. 제스처 변경이므로 PR 전 iOS·Android 실기 확인이 게이트.

## Technical Context

**Language/Version**: TypeScript ~6.0 · React Native 0.85.3 · Expo SDK 56 (expo-router)

**Primary Dependencies**: react-native-reanimated 4.3.1 · react-native-gesture-handler ~2.31.1 (둘 다 기설치·공용 훅이 이미 사용) · react-i18next

**Storage**: N/A (로컬 상태 = 시트 pending 체크 2종, 기존)

**Testing**: jest 29 + jest-expo · react-test-renderer · 기존 스위트 `notificationSheet497`(갱신) · `notifKeys497`(확장) · `sheetSwipeDismiss490`(훅 계약, 무변 참조)

**Target Platform**: iOS/Android (Expo 앱). 안드 = Modal 별도 네이티브 루트(자체 GestureHandlerRootView)

**Project Type**: mobile-app (단일 레포, `src/` 하위)

**Performance Goals**: 드래그 추종 60fps — 훅이 shared value + `useAnimatedStyle`로 UI 스레드에서 transform만 갱신(기존 계약). 콜백은 `runOnJS(true)`(워클릿 0)

**Constraints**: OTA 배포 가능(네이티브 변경 0) · P-151 프레임 불변(모션 = transform/opacity만) · P-337 제스처 영역 = 핸들+제목 · 호출부 무수정(props 계약 고정) · 발행은 예진 승인·실기 확인 후

**Scale/Scope**: `src/features/push/NotificationSheet.tsx` 1파일 · 로케일 JSON 4파일(ko·ja·zh-Hans·zh-Hant — 나머지 6개는 중간점 없음) · 테스트 9파일(케이스 추가 2 + 시트를 렌더하는 화면 스위트 7의 RNGH 표면 목 보강 — research R-8 실측: `onFinalize` 누락 5·목 부재 2). 화면·훅 코드 무변

## Constitution Check

*GATE: `.specify/memory/constitution.md`는 미기입 템플릿이라 실효 게이트는 프로젝트 CLAUDE.md 불변 규칙이다.*

| 규칙 | 적용 | 판정 |
|------|------|------|
| tsc 0 · jest 전체 통과 · 신규 로직에 그 버그를 잡는 테스트 동반 | 제스처 배선(임계 통과→onClose 1회·미만→0회)·제스처 영역 한정(체크 행·확인이 GestureDetector 밖)·`animationType="slide"`+RootView 소스 잠금·프레임 메트릭 전후 동일·5키×10로케일 중간점 0 — 각각 유닛 | PASS (quickstart에 명시) |
| 선택/상태 변화는 색만 — 프레임 불변(P-151) | 시트 스타일 메트릭 무변, 추가되는 건 `transform: translateY`·딤 `opacity`만. 체크박스 메트릭 유닛(e) 유지 + 시트 컨테이너 메트릭 유닛 추가 | PASS |
| 제스처·워클릿 코드는 실기기 확인 후 발행 | 공용 훅은 `runOnJS(true)`·완료 콜백 `'worklet'` 지시자 기존 충족. 이 기능은 훅을 수정하지 않음. 그래도 제스처 배선 변경 → iOS·Android dev client 확인이 PR 게이트(DoD) | 준수 — quickstart §3 |
| API 뮤테이션 버튼은 공용 제출 가드 | 확인 버튼 `useSubmitGuard`+`Btn busy` 기존 유지, 유닛(d) 유지 | PASS |
| 기호를 텍스트로 렌더해 아이콘 대용 금지 | 체크 아이콘은 기존 `IconCheck` SVG. 슬래시는 문장 부호(카피)이며 아이콘 대용 아님 | N/A |
| 서버가 아는 사실은 서버가 정본 | 서버 상태 무관(모션·카피) | N/A |
| 원격 이미지 스켈레톤 | 이미지 없음 | N/A |
| 배포 게이트(OTA 발행은 예진 승인 후) | 이 작업은 코드·테스트·PR까지. 발행 별도 지시 | 준수 |
| Jira 전환 금지 | 하지 않음 | 준수 |

**Post-design 재검토**: Phase 1 설계 후 신규 위반 없음. 신규 파일 0(테스트도 기존 스위트에 케이스·목 추가). 새 의존성 0. 공용 훅 수정 0.

## Project Structure

### Documentation (this feature)

```text
specs/003-notification-sheet-motion/
├── spec.md              # /speckit-specify 산출(2026-09-14, 메인 체크아웃 세션)
├── plan.md              # 이 파일
├── research.md          # Phase 0 — 결정 7건
├── data-model.md        # Phase 1 — 시트 상태 전이 · 문구 키
├── quickstart.md        # Phase 1 — 검증 시나리오(유닛·실기)
├── contracts/
│   └── notification-sheet-ui.md   # 컴포넌트 props·testID·제스처 영역·i18n 키 계약
└── tasks.md             # Phase 2 (/speckit-tasks — 이 커맨드가 만들지 않음)
```

### Source Code (repository root)

```text
src/
├── features/push/
│   ├── NotificationSheet.tsx                 # 수정 — Modal slide + 훅 배선 + RootView + 딤 레이어
│   ├── PushPrimerModal.tsx                   # 무변(호출부)
│   └── __tests__/notificationSheet497.test.tsx   # 갱신 — RNGH/reanimated 목 보강 + (g)~(j) 추가
├── components/
│   ├── useSheetSwipeDismiss.ts               # 무변(공용 훅, 재사용)
│   └── __tests__/sheetSwipeDismiss490.test.tsx   # 무변(훅 계약 참조)
├── app/profile/notifications.tsx             # 무변(호출부)
└── lib/i18n/
    ├── ko.json · ja.json · zh-Hans.json · zh-Hant.json   # 수정 — 5키 중간점→슬래시
    ├── en/es/id/ru/th/vi.json                # 무변(중간점 없음)
    └── __tests__/notifKeys497.test.ts        # 확장 — 5키×10로케일 중간점 0
```

**Structure Decision**: 기존 단일 레포 `src/` 구조 그대로. 신규 파일 없음 — 선례 시트 3곳(`LegalSheet`·`TagPickerSheet`·`OrderDishPickerSheet`)과 같은 골격을 `NotificationSheet` 1파일에 이식한다.

## Complexity Tracking

위반 없음 — 기재 사항 없음.

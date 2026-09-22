# Implementation Plan: 첫 설치 로그인 화면에서 OS 알림 권한 즉시 요청

**Branch**: `feat/kb631-login-push-prompt` (spec 디렉터리 `006-login-push-prompt`) | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-login-push-prompt/spec.md` · Jira KB-631

## Summary

첫 설치 첫 실행에서 로그인 화면이 뜨는 순간 앱 프라이머 없이 OS 알림 권한 팝업을 1회 요청한다(카메라 권한과 같은 방식). 판별은 이미 존재하는 첫 설치 경로 `router.replace('/login?entry=intro')`(설치 센티널 → 스플래시 게이트 해소 → entryChecked) 하나에 얹어 로그인 화면 마운트 effect에서 어댑터 헬퍼 1개를 부른다. 결과는 기존 프라이머 기록 `kbap.push.prompted.v1`에 남겨 첫 스캔 안내 시트가 코드 변경 없이 생략된다. 게스트 시점이라 서버 요청 0, 토큰 등록은 기존 로그인 성공 직후 경로가 그대로 담당. 플랜 단계에서 발견한 누락 1건: 서버 `activity` 토글 기본값이 false라(dev Swagger) 프라이머 시트를 건너뛰면 OS 허용 회원도 활동 푸시가 0건 — 허용 시 기기 로컬 1회성 대기 표식을 남기고 로그인 성공 직후 `PATCH {activity:true}` 1회로 메운다(FR-010 추가). 전부 JS — 소스 3파일 + 테스트 3 + 주석/문서, 신규 모듈 없음.

## Technical Context

**Language/Version**: TypeScript ~6.0 · React Native 0.85 · Expo SDK 56 · expo-router ~56.2

**Primary Dependencies**: expo-notifications ~56.0(어댑터 지연 require 1곳, 무변) · @react-native-async-storage/async-storage(기존) · TanStack Query(`patchNotificationSettings` 기존)

**Storage**: AsyncStorage — 기존 키 `kbap.push.prompted.v1` 재사용 + 신규 키 `kbap.push.activityDefaultPending.v1`(기기 사실, 클린업 목록 제외). 서버 스키마 무변

**Testing**: jest 29 + jest-expo · 어댑터 유닛 신규 · 로그인 화면 유닛 신규(loginCollageMarquee 목 재사용) · pushProdGuard221 확장 · 소스 잠금

**Target Platform**: iOS/Android (Expo 앱). 플랫폼 분기 없음 — Android 12 이하는 OS 상태가 곧바로 granted라 요청 없이 기록

**Project Type**: mobile-app (단일 레포, `src/` 하위)

**Performance Goals**: N/A — 로그인 화면 마운트에 AsyncStorage 읽기 1회 + 권한 조회 1회 추가(비차단)

**Constraints**: OTA 가능(네이티브 무변) · 어댑터 단일 관문·화면 정적 import 금지(expo-notifications) 유지 · 서버 정본(P-147) — 응답 기록·대기 표식은 기기 사실만 · 로그인 화면 서버 요청 0(FR-004) · 계측은 기존 `push_permission` 그 자리(FR-008)

**Scale/Scope**: 소스 3파일(`pushAdapter.ts`·`login.tsx`·`useSocialAuth.ts`) + 주석 1(`PushPrimerModal.tsx`) + 테스트 3 + 문서(spec 006 FR-010·specs/001 폐기 표기·PROGRESS.md)

## Constitution Check

*GATE: `.specify/memory/constitution.md`는 미기입 템플릿이라 실효 게이트는 프로젝트 CLAUDE.md 불변 규칙이다.*

| 규칙 | 적용 | 판정 |
|------|------|------|
| tsc 0 · jest 전체 통과 · 신규 로직에 그 버그를 잡는 테스트 동반 | 헬퍼 시퀀스 9행 + in-flight + 대기 표식 3 + 로그인 화면 트리거 3 + 플래그 off 확장 (contracts §5) | PASS — quickstart §1 |
| 서버가 아는 사실은 서버가 정본 (P-147) | 회원 속성 판별 없음. 응답 기록·대기 표식은 "이 기기에서 물었는가/기본값을 적용했는가"라는 기기 사실. `activity` 값 자체는 서버 PATCH 응답으로만 캐시(기존 seq 보호) | PASS |
| 계정 생애주기 유닛 상비 | 재설치(스토리지 초기화 → 재요청·OS 기억 시 요청 0) · 계정 전환(표식 소진 후 두 번째 로그인 PATCH 0) 유닛 포함 (contracts §5) · 실기 D-8·D-10 | PASS |
| API 뮤테이션 버튼 공용 제출 가드 | 버튼 없음(마운트 트리거·로그인 성공 훅) | N/A |
| OTA 게이트 커밋 동승 금지 · 배포 게이트(예진 승인) · production OTA 금지 | 코드·테스트까지. 실기 D-1~D-5 전 OTA 게이트 커밋으로 PR에 명기 | 준수 |
| 선택/상태 변화 프레임 불변 | UI 변경 없음(OS 팝업뿐) | N/A |
| 위험도 false-safe 금지 · 기호 텍스트 렌더 · 원격 이미지 스켈레톤 | 무관 | N/A |
| Jira 전환·자기 완료 선언 금지 | 하지 않음 | 준수 |

**Post-design 재검토**: Phase 1 설계 후 신규 위반 없음. 신규 파일 = 테스트 2. 추상화 추가 = 어댑터 함수 2개(각 호출부 1곳 — 관문 규약상 어댑터 밖에 둘 수 없음). 신규 저장 키 1개는 R-4 누락 보정에 필요(대안 기각 사유 research.md).

## Project Structure

### Documentation (this feature)

```text
specs/006-login-push-prompt/
├── plan.md              # 이 파일
├── research.md          # Phase 0 — R-1~R-7 (트리거·기록 재사용·헬퍼 시퀀스·activity 기본값 누락·스플래시 겹침·테스트·문서)
├── data-model.md        # Phase 1 — 엔티티 4 · 상태 전이 2 · 불변식
├── quickstart.md        # Phase 1 — 정적·유닛 명령 + 실기 D-1~D-10 + 발행 게이트
├── contracts/
│   └── login-push-prompt.md   # 어댑터 API 2 · 조건표 · 호출부 배선·잠금 문자열 · 저장 키 · 테스트 계약
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 산출 (여기서 만들지 않음)
```

### Source Code (repository root)

```text
src/lib/push/pushAdapter.ts                 # + promptPermissionOnFirstLogin() · applyPendingActivityDefault() · PENDING 키 · requestPermission 주석 갱신
src/app/login.tsx                           # 마운트 effect: entry==='intro' && returnTo==null → promptPermissionOnFirstLogin()
src/lib/auth/useSocialAuth.ts               # exchange(): registerPushToken() 옆 applyPendingActivityDefault()
src/features/push/PushPrimerModal.tsx       # 헤더 주석: 진입점 = 후순위(로그인 팝업 미경유 기기) — 동작 무변
src/lib/push/__tests__/loginPrompt631.test.ts        # (신규) 헬퍼 2개 + 생애주기 + 소스 잠금
src/app/__tests__/loginPushPrompt631.test.tsx        # (신규) 로그인 화면 트리거 3케이스
src/lib/push/__tests__/pushProdGuard221.test.ts      # 플래그 off 확장(헬퍼 2개)
specs/006-login-push-prompt/spec.md         # FR-010 추가(플랜 발견분)
specs/001-notification-settings/{spec,research}.md   # US4·US6·B안에 "폐기됨(KB-631)" 표기
PROGRESS.md                                 # KB-631 항목
```

**Structure Decision**: 단일 모바일 앱 레포, 기존 `src/` 구조. 신규 모듈 없음 — 어댑터(유일 관문)에 함수 2개, 호출부 각 1줄.

## Complexity Tracking

> 위반 없음. 신규 저장 키 1개는 R-4(서버 activity 기본 false) 보정에 필요하며 대안(매 로그인 PATCH · BE 변경 · newMember 한정)은 research.md에서 기각.

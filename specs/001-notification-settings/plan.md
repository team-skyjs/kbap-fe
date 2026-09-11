# Implementation Plan: 알림 설정 2그룹 재편 + 서버 정본화 (KB-497)

**Branch**: `feat/kb497-notification-settings` (spec dir `001-notification-settings`) | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-notification-settings/spec.md`

## Summary

알림 설정의 정본을 기기 로컬(AsyncStorage 3토글 + 게스트 동의 저장소)에서 서버(`GET/PATCH /api/notifications/settings`, 회원×기기)로 옮기고, 화면을 「활동 푸시」 1토글 + 「K-Bap 소식」(동의 2종 체크 + 식사 시간 알림) 2그룹으로 재편한다. 온보딩 직후 프라이머는 제거하고 OS 권한 요청은 스캔 후 프라이머(하단 시트) 1곳만 둔다. 광고성 동의는 설정 화면의 식사 시간 토글 → 하단 시트에서 받는다. 게스트는 알림 설정에서 배제(AuthGateSheet). 토큰 `lang` 전송은 이미 구현되어 있어 유닛으로 잠근다.

기술 접근: react-query `useQuery`/`useMutation`(낙관 갱신 + 롤백 + 최신 응답만 반영) 훅 1개, 동의 버전 상수 모듈 1개, **하단 시트 컴포넌트 1종**(프라이머·동의 겸용)으로 `PushPrimerModal` 교체, 설정 화면 재작성(동의는 식사 시간 토글 → 시트), 로컬 설정 코드 삭제, 토큰 등록 세션 가드(KB-543). 설정 API는 KB-544 후 회원×기기 단위(스키마 동일, 버전 헤더 상수 1곳).

## Technical Context

**Language/Version**: TypeScript 5 · React Native (Expo SDK, expo-router) — 기존 레포 그대로
**Primary Dependencies**: @tanstack/react-query v5(설정 조회·뮤테이션), react-i18next(10로케일), expo-notifications(pushAdapter 지연 require 경유만), AsyncStorage(프라이머 노출 기록만 잔존)
**Storage**: 서버 정본(BE). 기기 로컬은 `kbap.push.prompted.v1`(표면 노출 기록)만. `kbap.push.settings.v1`·`kbap.guestNotif.v1.*`는 제거(읽지 않음, 마이그레이션 없음)
**Testing**: jest + @testing-library/react-native, 기존 관례(소스 잠금 테스트·스타일 메트릭 비교 P-138①)
**Target Platform**: iOS/Android (Expo). OTA 가능 범위(네이티브 변경 0 — fingerprint 회전 없음)
**Project Type**: mobile-app (단일 FE 레포)
**Performance Goals**: 토글 → 화면 반영 즉시(낙관), 서버 확정 ≤ 2s(기본 타임아웃 15s 내 실패 시 롤백)
**Constraints**: CLAUDE.md 불변 규칙 — 서버 정본, 프레임 불변(P-151), 로딩 스켈레톤+실패 폴백, SVG 아이콘만, 공용 제출 가드(낙관 토글은 예외), Jira 전환 금지
**Scale/Scope**: 화면 1 재작성 · 컴포넌트 1 확장 · 훅 1 신설 · 모듈 1 삭제 · 진입점 3(온보딩·홈·스캔) 배선 · i18n 10파일 키 정리

## Constitution Check

`.specify/memory/constitution.md`는 미작성 템플릿이다. 이 레포의 실효 헌법은 `CLAUDE.md` 불변 규칙이므로 그것을 게이트로 쓴다.

| 게이트 | 판정 | 근거 |
|---|---|---|
| 서버가 아는 사실은 서버가 정본 (P-147) | PASS | 설정·동의 전부 서버 응답으로 표시. 로컬 설정 저장소 제거. |
| 계정 생애주기 유닛 상비 | PASS(계획) | 계정 전환 시 `['notifSettings']` 캐시 무효화 유닛 + 로컬 저장소 미참조 소스 잠금. |
| API 뮤테이션 = 공용 제출 가드 | PASS | 토글/체크 = 낙관 멱등류(예외 허용, 연타는 seq 가드). 홈 동의 표면 확인 버튼·프라이머 = `useSubmitGuard` + `Btn busy`(기존). |
| 선택/상태 변화는 색만 — 프레임 불변 (P-151) | PASS(계획) | Switch·체크박스·비활성 행 = 색·opacity만. 메트릭 비교 유닛 동반. |
| 원격 데이터 표면 = 스켈레톤 + 실패 폴백 | PASS | pending=Shimmer, error=재시도 배너, 스위치 미렌더. |
| 기호 텍스트 렌더 금지 | PASS | 체크 = `IconCheck` SVG. |
| 완료 기준 tsc 0 · jest 통과 · 버그 정확히 잡는 테스트 | PASS(계획) | tasks에 테스트 선행. |
| OTA/빌드 게이트 | N/A | 이 작업은 발행 없음(KB-501에서). |

Post-design 재점검(Phase 1 후): 위반 없음. 신규 추상화 0(훅 1개는 react-query 관례상 최소 단위).

## Project Structure

### Documentation (this feature)

```text
specs/001-notification-settings/
├── plan.md              # 이 파일
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── notification-settings-api.md   # Phase 1 — BE 계약 실측 + 가정
└── tasks.md             # /speckit-tasks 산출(여기서 만들지 않음)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (tabs)/profile.tsx            # 알림 설정 진입 행 — 회원에게만
│   ├── onboarding/index.tsx          # 프라이머 모달 제거(홈 직행)
│   ├── scan.tsx                      # 스캔 프라이머 = 시트로 교체(직렬화 로직 유지)
│   └── profile/notifications.tsx     # 재작성: 2그룹 + 서버 정본 + AuthGateSheet
├── features/push/
│   ├── NotificationSheet.tsx         # 신규: 하단 시트 1종(primer / consent)
│   ├── PushPrimerModal.tsx           # NotificationSheet 래퍼로 교체(export·props 유지 — 호출측 호환)
│   └── __tests__/pushSurfaces192.test.tsx (갱신) + 신규 테스트
├── lib/
│   ├── data/useNotificationSettings.ts   # 신규: GET/PATCH 훅(낙관·롤백·seq)
│   ├── push/
│   │   ├── pushAdapter.ts            # PushSettings/get/savePushSettings/SETTINGS_KEY 삭제, 토큰 등록 hasBeSession 가드
│   │   ├── consent.ts                # 신규: 동의 버전 상수 + 전문 URL (guestConsent.ts 대체)
│   │   └── guestConsent.ts           # 삭제
│   ├── auth/beAuth.ts (또는 useSocialAuth.ts)   # 로그인 성공 직후 registerPushToken 1회
│   ├── legalText.ts                  # LEGAL_URLS에 marketingPrivacy/marketingReceive 추가
│   └── i18n/*.json (10)              # notif.* 키 교체, push.home* 키 추가
```

**Structure Decision**: 기존 레이아웃 그대로. 신규 파일은 훅 1(`lib/data/` 관례 — useMe/useHome과 동일 위치), 상수 모듈 1(`lib/push/`). 삭제 1(`guestConsent.ts`).

## Complexity Tracking

위반 없음 — 표 불필요.

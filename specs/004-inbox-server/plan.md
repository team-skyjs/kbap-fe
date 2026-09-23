# Implementation Plan: 알림함 서버 전환 + 도착 시각 상대 표기

**Branch**: `feat/kb499-inbox-server` (spec 디렉터리 `004-inbox-server`) | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-inbox-server/spec.md` · Jira KB-499 · 계약 정본 dev Swagger(2026-09-16 조회)

## Summary

기기 로컬 알림함(`src/lib/notifications/inbox.ts`, AsyncStorage `kbap.inbox.v1`)을 삭제하고 서버 목록 `GET /api/notifications`(최근 7일·최신순·기기 단위) 하나를 react-query 훅 `src/lib/data/useNotifications.ts`로 읽는다. 헤더 종 배지는 같은 쿼리에서 `read===false` 개수를 파생(미읽음 엔드포인트 없음). 항목 탭은 `PATCH /api/notifications/{id}/read` 낙관 처리(실패 롤백·세션 세대 가드) 후 푸시 탭과 같은 `routeForNotificationData`로 이동(BE가 응답에 `type`·`foodId`를 추가하기로 함 — clarify Q2, dev 배포 대기; 필드 없으면 이동 없음). 푸시 탭은 이미 전달되는 `notificationId`로 읽음 처리 후 기존 이동. 무효화는 앱 시작·포그라운드 복귀·푸시 수신/탭·읽음 후 5곳. 도착 시각은 기존 `timeAgo`(커뮤니티) 재사용으로 "방금 전/N분 전/N시간 전/N일 전"(ko justNow·zh 공백 2줄만 수정 — Q4). 게스트는 라우트 가드 1곳에서 로그인 화면으로 `Redirect`(시트 없음 — Q5). "모두 읽음" 제거(전체 읽음 계약 없음 — Q3). 배지는 기존 NEW 필 유지(Q1). 전부 JS 변경 — 신규 2파일(훅·어댑터) + 스켈레톤 함수 1 + 수정 7파일 + 로케일 10파일 + 테스트(삭제 1·갱신 3·신규 3). 새 의존성 0.

## Technical Context

**Language/Version**: TypeScript ~6.0.3 · React Native 0.85.3 · Expo SDK 56 (expo-router)

**Primary Dependencies**: @tanstack/react-query ^5.101 (기설치·공유 `queryClient`) · react-i18next · expo-notifications(기존 어댑터 경유, 직접 호출 추가 0)

**Storage**: 서버 정본(회원+기기 단위 `notification` 행). 로컬 저장 0 — `kbap.inbox.v1` 읽기/쓰기 코드 삭제. 캐시 = react-query `['notifications']`(계정 경계 `queryClient.clear()`로 소멸)

**Testing**: jest 29 + jest-expo · react-test-renderer · `QueryClientProvider` 하네스(선례 `useNotificationSettings497`) · 실클라이언트 fetch 목(선례 `installationId204`)

**Target Platform**: iOS/Android (Expo 앱). 웹 무관

**Project Type**: mobile-app (단일 레포, `src/` 하위)

**Performance Goals**: 목록 요청은 화면·배지가 공유하는 쿼리 1개. 무효화는 이벤트 시점만(초 단위 타이머 0). 상대 시각은 렌더 시점 계산

**Constraints**: OTA 배포 가능(네이티브 변경 0) · P-151 프레임 불변(읽음/미읽음 = 배경색·점 색만) · X-Installation-Id는 공용 클라이언트가 전 요청 자동 첨부(추가 코드 0) · `useSubmitGuard` 예외 = 멱등 낙관 토글(읽음) · 발행은 예진 승인 후

**Scale/Scope**: 7일 이내 전부 한 번에(수십 건) · 화면 1 · 헤더 3곳 import 1줄 · 로케일 10(키 제거 11·문구 수정 3줄) · 테스트 7파일 · BE 의존 1(응답 `type`·`foodId` dev 배포)

## Constitution Check

*GATE: `.specify/memory/constitution.md`는 미기입 템플릿이라 실효 게이트는 프로젝트 CLAUDE.md 불변 규칙이다.*

| 규칙 | 적용 | 판정 |
|------|------|------|
| 서버가 아는 사실은 서버가 정본(P-147) | 목록·읽음·배지 전부 서버 응답 파생. 로컬 판별 0. 롤백은 세션 세대 일치 시만(계정 전환 잔존 차단) | PASS |
| 계정 생애주기 유닛 상비 | 로그아웃/전환 = `queryClient.clear()`+세션 false → 배지 0·목록 소멸 유닛, 뮤테이션 중 세대 변경 시 롤백 무시 유닛 | PASS (quickstart §1-2) |
| API 뮤테이션 버튼은 공용 제출 가드 | 항목 탭 읽음 = 멱등 낙관 토글 → 명시 예외. 그 외 뮤테이션 버튼 없음("모두 읽음" 제거) | PASS(예외 해당) |
| 선택/상태 변화는 색만 — 프레임 불변(P-151) | 행 메트릭 무변, unread = `rowUnread` 배경 + 고정 슬롯 점. 두 행 스타일 비교 유닛 | PASS |
| 원격 데이터 표면 = 스켈레톤 기본 + 실패 폴백 | `SkeletonInbox` · `QueryErrorBlock` 재시도 · `EmptyBlock` | PASS |
| 기호 텍스트 렌더 금지 | 신규 기호 없음(점 = View, 아이콘 = 기존 SVG) | N/A |
| 위험도 false-safe 금지 | 위험도 표시 무관 | N/A |
| tsc 0 · jest 전체 통과 · 신규 로직에 그 버그를 잡는 테스트 | 어댑터·파생·낙관/롤백·게이트·경계값 9종·프레임·소스 잠금 각 유닛 | PASS (quickstart) |
| Jira 전환 금지 · 자기 완료 선언 금지 | 하지 않음 | 준수 |
| 배포 게이트(발행은 예진 승인) | 코드·테스트·PR까지. dev 실기 확인은 DoD(관리자 테스트 발송) | 준수 |
| 제스처·워클릿 | 해당 없음 | N/A |

**Post-design 재검토**: Phase 1 설계 후 신규 위반 없음. 신규 소스 파일 2(훅·어댑터) + `Skeleton.tsx` 함수 1 추가. 새 의존성 0. 공용 컴포넌트 변경 0(clarify 후 `AuthGateSheet` 수정 소멸). 2026-09-16 clarify 5문항 반영 후에도 게이트 판정 동일.

## Project Structure

### Documentation (this feature)

```text
specs/004-inbox-server/
├── spec.md              # /speckit-specify 산출(2026-09-16)
├── plan.md              # 이 파일
├── research.md          # Phase 0 — 결정 12건
├── data-model.md        # Phase 1 — 엔티티·상태 전이·상대 시각 규칙
├── quickstart.md        # Phase 1 — 검증 시나리오(유닛·실기)
├── contracts/
│   ├── notifications-api.md   # GET/PATCH 와이어 계약(Swagger 요약)·헤더·오류
│   └── inbox-ui.md            # 훅 API·화면 testID·무효화 시점·i18n 키 증감
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — 이 커맨드가 만들지 않음)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── api/notificationAdapter.ts            # 신설 — NotificationWire(+type·foodId 옵션) → InboxItem (R-3)
│   ├── data/useNotifications.ts              # 신설 — 쿼리·파생 배지·낙관 읽음·무효화·onPushTapped (R-1/2/6/7)
│   ├── data/__tests__/useNotifications499.test.tsx   # 신설
│   ├── notifications/inbox.ts                # 삭제
│   ├── notifications/__tests__/inbox216.test.ts      # 삭제
│   ├── push/pushAdapter.ts                   # 수정 — record() → invalidateNotifications() 지연 require (R-7)
│   ├── flags.ts                              # 수정 — notificationCenter 주석(로컬 목 언급 제거)
│   └── i18n/
│       ├── ko.json … es.json (10)            # 수정 — inbox 11키 제거 · ko community.justNow · zh-Hans/Hant reviews.daysAgo 공백
│       └── __tests__/inboxKeys498.test.ts    # 갱신 (R-10)
├── app/
│   ├── notifications.tsx                     # 수정 — 서버 훅·게스트 Redirect(/login)·3상태·timeAgo·탭=읽음+routeForNotificationData·모두읽음 제거 (R-5/8/9)
│   ├── _layout.tsx                           # 수정 — AppState active 무효화 1줄 · 푸시 탭 onPushTapped (R-7)
│   ├── (tabs)/index.tsx · (tabs)/food.tsx    # 수정 — useUnreadCount import 경로 1줄
│   └── __tests__/
│       ├── inbox499.test.tsx                 # 신설 — 화면 스위트
│       ├── design4Home430.test.tsx           # 갱신 — 목 경로·목 데이터 형태
│       └── homeFeed317.test.tsx              # 갱신 — 목 경로
├── features/community/
│   ├── ReviewFeed.tsx                        # 수정 — useUnreadCount import 경로 1줄
│   ├── parts.tsx                             # 무변 (timeAgo 재사용)
│   └── __tests__/timeAgo499.test.ts          # 신설 — 경계 9종
└── components/
    └── Skeleton.tsx                          # 수정 — SkeletonInbox 추가 (R-9). AuthGateSheet 무변(R-8 개정)
```

**Structure Decision**: 기존 단일 레포 `src/` 구조 그대로. 데이터 훅은 `src/lib/data/`, 와이어 어댑터는 `src/lib/api/*Adapter.ts` 관례를 따른다. 화면·헤더 컴포넌트 구조 변화 없음.

## Complexity Tracking

위반 없음 — 기재 사항 없음.

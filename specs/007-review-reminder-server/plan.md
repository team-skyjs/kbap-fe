# Implementation Plan: 리뷰 리마인더 서버 전환 — 로컬 예약 제거·주문 상세 착지

**Branch**: `feat/kb500-review-reminder-server` (spec 디렉터리 `007-review-reminder-server`) | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-review-reminder-server/spec.md` · Jira KB-500 (서버 PR #305 · KB-469)

## Summary

서버가 주문 저장 60~65분 뒤 `REVIEW_REMINDER` 푸시(`{type, orderId, notificationId}`)를 보내므로 앱의 로컬 리마인더 예약 경로를 **통째로 삭제**하고(`scheduleReviewReminder`·`cancelReviewReminder`·`REVIEW_REMINDER_SECONDS`·AsyncStorage 리마인더 맵·10로케일 `push.reviewReminder*` 키), 착지 매핑 `routeForNotificationData`의 리마인더 case를 `foodId → /food/{id}`에서 `orderId → /profile/order/{orderId}`(숫자 문자열만 인정, 그 외 null)로 바꾼다. 알림함 어댑터는 `foodId` 대신 `orderId`를 읽어 같은 매핑에 넘긴다. 주문 상세(B안: 행 탭 = 음식 상세 유지)·Android 채널·nav 헬퍼·루트 레이아웃 배선은 무변. 순수 JS — 소스 5파일 + 로케일 10 + 테스트 8(갱신 7·신규 1) + 문서, 신규 모듈 0, 신규 의존성 0.

## Technical Context

**Language/Version**: TypeScript ~6.0 · React Native 0.85 · Expo SDK 56 · expo-router ~56.2

**Primary Dependencies**: expo-notifications ~56.0(어댑터 지연 require 1곳 — 사용 API가 `scheduleNotificationAsync`·`cancelScheduledNotificationAsync` 2개 줄어듦) · @tanstack/react-query(알림함 훅 무변) · i18next

**Storage**: AsyncStorage `kbap.push.reminders.v1` — 쓰기·읽기 코드 삭제. 기존 기기의 잔존 값은 정리하지 않음(고아 키, 무해 — research R-1)

**Testing**: jest 29 + jest-expo · 기존 7파일 갱신 + 삭제 잠금 유닛 1 신규(`reviewReminderServer500.test.ts`)

**Target Platform**: iOS/Android (Expo 앱). 플랫폼 분기 없음(채널은 기존 `activity`)

**Project Type**: mobile-app (단일 레포, `src/` 하위)

**Performance Goals**: N/A — 주문 완료 시 비동기 예약 호출 1건 소멸(비용 감소)

**Constraints**: OTA 가능(네이티브·config plugin·채널 무변) · 어댑터 단일 관문·순수 매핑 함수 유지 · 탭 콜백 `(href, notificationId)` 계약(specs/002 §3) 무변 · **서버 배치 prod 활성화 = 이 앱 버전 릴리스와 동기**(중복 알림 방지 — 릴리스 일정 BE 회신은 열린 항목)

**Scale/Scope**: 소스 5파일(`pushAdapter.ts`·`notificationAdapter.ts`·`notifications.tsx`·`FlippedOrderCard.tsx`·`review.tsx`) + 로케일 10 + 테스트 8 + 문서(specs/002·004·005 갱신, PROGRESS.md)

## Constitution Check

*GATE: `.specify/memory/constitution.md`는 미기입 템플릿이라 실효 게이트는 프로젝트 CLAUDE.md 불변 규칙이다.*

| 규칙 | 적용 | 판정 |
|------|------|------|
| tsc 0 · jest 전체 통과 · 신규 로직에 그 버그를 잡는 테스트 동반 | 매핑 리마인더 5케이스(orderId 숫자·문자열 숫자·없음·비숫자·foodId만) + 삭제 잠금(어댑터 소스에 `scheduleNotificationAsync` 0·카드에 `scheduleReviewReminder` 0·작성 화면에 `cancelReviewReminder` 0·로케일 키 0) + 알림함 어댑터 `orderId` 변환 | PASS — quickstart §1 |
| 서버가 아는 사실은 서버가 정본 | 리마인더 발송 여부·시점·문구 전부 서버로 이관. 앱은 `orderId`만 경로화. 활동 알림 설정 필터도 서버 몫 | PASS |
| 계정 생애주기 유닛 상비 | 게이팅 로직 변경 없음. 주문 상세는 기존 오류 표면(`q.isError`)이 타 계정·삭제 주문을 처리. 실기 D-6(게스트 잔존 리마인더 탭) | N/A(유닛)·실기 |
| API 뮤테이션 버튼 공용 제출 가드 | 버튼 추가 없음 | N/A |
| OTA 게이트 커밋 동승 금지 · 배포 게이트(예진 승인) · production OTA 금지(종한 9/11) | 코드·테스트·PR까지. 배포 경로·시점은 지시 대기 | 준수 |
| 선택/상태 변화 프레임 불변 | UI 변경 0(B안) | N/A |
| 위험도 false-safe 금지 · 기호 텍스트 · 원격 이미지 스켈레톤 | 무관 | N/A |
| Jira 전환·자기 완료 선언 금지 | 하지 않음 | 준수 |

**Post-design 재검토**: Phase 1 설계 후 신규 위반 없음. 신규 파일 = 테스트 1. 추상화 추가 0(orderId 검증은 case 안 정규식 1줄).

## Project Structure

### Documentation (this feature)

```text
specs/007-review-reminder-server/
├── plan.md              # 이 파일
├── research.md          # Phase 0 — 결정 R-1~R-9
├── data-model.md        # Phase 1 — 푸시 data·알림함 항목·착지 표·삭제 표면
├── quickstart.md        # Phase 1 — 정적·유닛 명령 + 실기 D-1~D-7
├── contracts/
│   └── review-reminder-landing.md   # routeForNotificationData 리마인더 행 · NotificationWire/InboxItem · 삭제 계약 · 테스트 계약
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 산출 (여기서 만들지 않음)
```

### Source Code (repository root)

```text
src/lib/push/pushAdapter.ts                 # 삭제: REMINDERS_KEY·REVIEW_REMINDER_SECONDS·getReminderMap·setReminderMap·scheduleReviewReminder·cancelReviewReminder(섹션 "로컬 리뷰 유도 알림" 통째)
                                            # 변경: routeForNotificationData case 'REVIEW_REMINDER' → orderId 숫자 문자열이면 `/profile/order/${orderId}` 아니면 null · d 타입에 orderId 추가·foodId 제거
src/lib/api/notificationAdapter.ts          # NotificationWire.foodId → orderId?: number|string|null · InboxItem.foodId → orderId?: string · toInboxItem 변환 · 헤더 주석
src/app/notifications.tsx                   # open(n): routeForNotificationData({ type: n.type, orderId: n.orderId }) · 주석
src/features/order/FlippedOrderCard.tsx     # import·호출 삭제(target 계산 포함) · 주석 정리
src/app/food/[id]/review.tsx                # import·`cancelReviewReminder(id)` 줄 삭제
src/lib/i18n/{ko,en,ja,zh-Hans,zh-Hant,vi,id,th,ru,es}.json
                                            # push.reviewReminderTitle · push.reviewReminderBody 삭제
src/lib/push/__tests__/pushAdapter192.test.ts       # 예약/취소 테스트 삭제 · 매핑 리마인더 3줄 → orderId 5케이스 · 리스너 r1~r3·콜드 데이터 orderId로 교체
src/lib/push/__tests__/pushProdGuard221.test.ts     # schedule/cancel 호출·REVIEW_REMINDER_SECONDS 잠금 삭제
src/features/push/__tests__/pushSurfaces192.test.tsx # 목 항목 3개 삭제 · 카드 테스트: schedule 기대 → 미호출·onDone만 · 취소 소스 잠금 → not.toContain
src/lib/data/__tests__/orderHistory252.test.ts      # beforeModal scheduleReviewReminder 기대 삭제(주석 갱신)
src/app/__tests__/modalSerialize267.test.tsx        # 목의 scheduleReviewReminder 항목 삭제
src/app/__tests__/reviewEditCompose521.test.tsx     # pushAdapter 목 삭제(더 이상 import 없음)
src/app/__tests__/inbox499.test.tsx                 # 항목 3: foodId '7' → orderId '12', 기대 '/profile/order/12'
src/lib/data/__tests__/useNotifications499.test.tsx # 어댑터 ① foodId → orderId
src/lib/push/__tests__/reviewReminderServer500.test.ts  # (신규) 삭제 잠금 4건 + 로케일 키 부재
specs/002-push-data-contract/{spec,data-model}.md · contracts/push-notification-data.md   # 리마인더 행 orderId·주문 상세 · 로컬 리마인더 문단 삭제
specs/004-inbox-server/{data-model}.md · contracts/{notifications-api,inbox-ui}.md         # foodId → orderId
specs/005-push-tap-landing/data-model.md · contracts/push-tap-landing.md                  # 리마인더 행 갱신
PROGRESS.md                                 # KB-500 항목
```

**Structure Decision**: 기존 파일 내 삭제·치환만. 새 모듈·새 화면·새 훅 없음.

## Complexity Tracking

위반 없음 — 기재 생략.

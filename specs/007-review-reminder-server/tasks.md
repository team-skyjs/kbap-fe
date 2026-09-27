# Tasks: 리뷰 리마인더 서버 전환 — 로컬 예약 제거·주문 상세 착지

**Input**: Design documents from `/specs/007-review-reminder-server/` (plan · spec · research R-1~R-9 · data-model · contracts/review-reminder-landing.md · quickstart)

**Prerequisites**: 워크트리 `feat/kb500-review-reminder-server`(origin/develop 기준) + `npm ci`.

**Tests**: CLAUDE.md 완료 기준(tsc 0 · jest 전체 · 신규 로직에 그 버그를 잡는 테스트)에 따라 테스트 태스크 포함. 갱신 7파일 + 신규 1.

**Organization**: 스토리별 페이즈. US1(푸시 탭 착지)·US2(알림함 착지)·US3(로컬 예약 제거)·US4(주문 상세 회귀 — 코드 변경 0). 전부 JS 변경, 새 의존성 0, 새 모듈 0.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 워크트리 `.claude/worktrees/feat+kb500-review-reminder-server`에서 `npm ci` 완료 확인 후 `npx tsc --noEmit && npx jest src/lib/push src/app/__tests__/inbox499.test.tsx` 베이스라인 통과 확인

## Phase 2: Foundational

없음 — 스토리 간 공유 인프라 없음(매핑 함수·어댑터 모두 기존).

---

## Phase 3: US1 — 리마인더 푸시 탭 = 주문 상세 (P1)

**Goal**: `routeForNotificationData({type:'REVIEW_REMINDER', orderId})` → `/profile/order/{orderId}`(숫자 문자열만), foodId 분기 삭제.

**Independent Test**: contracts §1 표 6행이 유닛에서 일치 + 탭 콜백 `('/profile/order/12', 456)`.

- [X] T002 [US1] `src/lib/push/pushAdapter.ts` `routeForNotificationData`: `d` 타입 힌트를 `{ type?: string; orderId?: string | number }`로, `case 'REVIEW_REMINDER'`를 `{ const s = d.orderId == null ? '' : String(d.orderId); return /^\d+$/.test(s) ? \`/profile/order/${s}\` : null; }`로 교체(주석: KB-500 서버 리마인더 = 주문 단위 · 숫자 문자열만 · 정밀도는 문자열 보존 · foodId 폐기). 헤더 주석의 "리마인더=음식 상세" 언급 갱신
- [X] T003 [US1] `src/lib/push/__tests__/pushAdapter192.test.ts` 매핑 테스트: 리마인더 3줄을 contracts §1 6행(orderId 12 · '12' · 없음 · 'abc' · -1 · foodId:7 → null)으로 교체. 리스너 테스트 r1~r3 data를 `{type:'REVIEW_REMINDER', orderId:12, notificationId:…}`로, 기대를 `'/profile/order/12'`로. 콜드 스타트 data `orderId:3` → 기대 `('/profile/order/3', 7)`. 테스트 제목의 "리마인더=음식 상세" → "리마인더=주문 상세"

---

## Phase 4: US2 — 알림함 리마인더 항목 = 주문 상세 (P1)

**Goal**: 목록·읽음 응답의 `orderId`(nullable)를 읽어 푸시 탭과 같은 매핑으로 이동. `foodId` 타입·사용 삭제.

**Independent Test**: `toInboxItem({…orderId:12})` → `orderId:'12'` · `orderId:null` → undefined · 화면 탭 → `navigate('/profile/order/12')`.

- [X] T004 [P] [US2] `src/lib/api/notificationAdapter.ts`: `NotificationWire.foodId` → `orderId?: number | string | null`, `InboxItem.foodId` → `orderId?: string`, `toInboxItem`의 `foodId` 줄 → `orderId: w.orderId != null ? String(w.orderId) : undefined`. 헤더 주석: "`orderId`(REVIEW_REMINDER만, 그 외 null · KB-500) — 구 `foodId`는 서버가 항상 null로 보내는 호환 필드라 타입에서 제거"
- [X] T005 [P] [US2] `src/app/notifications.tsx` `open(n)`: `routeForNotificationData({ type: n.type, orderId: n.orderId })`. 라인 7·40 주석의 `foodId` → `orderId`
- [X] T006 [P] [US2] `src/lib/data/__tests__/useNotifications499.test.tsx` ① 어댑터: 기대 객체 `foodId: undefined` → `orderId: undefined`, `{type:'REVIEW_REMINDER', foodId:7}` → `orderId:12` 기대 `orderId:'12'`, `{type:'NEWS', foodId:null}).foodId` → `orderId:null}).orderId`
- [X] T007 [P] [US2] `src/app/__tests__/inbox499.test.tsx` ⑨⑩⑪: 항목 3 `foodId:'7'` → `orderId:'12'`, 기대 `mockNavigate('/food/7')` → `'/profile/order/12'`, 제목 문구 갱신

---

## Phase 5: US3 — 주문 완료 시 로컬 리마인더 예약 제거 (P1)

**Goal**: 어댑터의 로컬 예약 섹션·호출부 2곳·10로케일 문구 삭제. 재도입 방지 잠금 유닛.

**Independent Test**: `grep -rn 'scheduleReviewReminder\|cancelReviewReminder\|REVIEW_REMINDER_SECONDS\|reviewReminderTitle' src` 0건 · `reviewReminderServer500` 통과 · 카드 테스트에서 done 탭 후 `onDone`만 호출.

- [X] T008 [US3] `src/lib/push/pushAdapter.ts`: `REMINDERS_KEY`·`REVIEW_REMINDER_SECONDS` 상수와 "로컬 리뷰 유도 알림" 섹션(`getReminderMap`·`setReminderMap`·`scheduleReviewReminder`·`cancelReviewReminder`) 통째 삭제. `AsyncStorage`·`queryClient`·`NOTIF_SETTINGS_KEY`·`NotificationSettings`·`i18n` import가 다른 곳에서 안 쓰이면 함께 제거(tsc/eslint unused 확인)
- [X] T009 [P] [US3] `src/features/order/FlippedOrderCard.tsx`: `scheduleReviewReminder` import 삭제, done 탭 핸들러의 `const target = …`·`if (target?.foodId) void scheduleReviewReminder(…)` 2줄 삭제, 주석의 "리마인더" 언급을 "저장·계측"으로 정리(KB-500: 리마인더는 서버 배치)
- [X] T010 [P] [US3] `src/app/food/[id]/review.tsx`: `cancelReviewReminder` import 삭제, `if (id) void cancelReviewReminder(id);` 줄 삭제
- [X] T011 [P] [US3] `src/lib/i18n/{ko,en,ja,zh-Hans,zh-Hant,vi,id,th,ru,es}.json`: `push.reviewReminderTitle`·`push.reviewReminderBody` 키 삭제(JSON 유효성·마지막 콤마 확인)
- [X] T012 [P] [US3] `src/lib/push/__tests__/pushAdapter192.test.ts`: import에서 `cancelReviewReminder`·`REVIEW_REMINDER_SECONDS`·`scheduleReviewReminder` 제거, "리뷰 유도 예약" 테스트(라인 69~)와 재예약·권한 없음·플래그 케이스(라인 85~95 부근) 삭제
- [X] T013 [P] [US3] `src/lib/push/__tests__/pushProdGuard221.test.ts`: import·`scheduleReviewReminder(...)`·`cancelReviewReminder('7')` resolves 단언·`REVIEW_REMINDER_SECONDS = 3600` 소스 잠금(라인 107~108) 삭제
- [X] T014 [P] [US3] `src/features/push/__tests__/pushSurfaces192.test.tsx`: 목의 `scheduleReviewReminder`·`cancelReviewReminder`·`REVIEW_REMINDER_SECONDS` 3항목과 타입 유니온의 두 이름 삭제. 카드 테스트: `expect(mockAdapter.scheduleReviewReminder)…` → 삭제하고 `onDone` 단언만 유지, 제목 갱신. "리뷰 작성 성공 시 예약 취소 배선" 테스트 → 삭제(잠금은 T017로 이동)
- [X] T015 [P] [US3] `src/lib/data/__tests__/orderHistory252.test.ts`: `expect(beforeModal).toContain('scheduleReviewReminder')` 삭제, 주석 "저장·계측·리마인더" → "저장·계측"(afterModal not.toContain 유지 가능)
- [X] T016 [P] [US3] `src/app/__tests__/modalSerialize267.test.tsx` 목의 `scheduleReviewReminder` 항목 삭제 · `src/app/__tests__/reviewEditCompose521.test.tsx`의 `jest.mock('@/lib/push/pushAdapter', …)` 줄 삭제(review.tsx가 더 이상 import 안 함)
- [X] T017 [US3] `src/lib/push/__tests__/reviewReminderServer500.test.ts` 신설(fs 소스 잠금, `pushProdGuard221` 스타일): ① `pushAdapter.ts`에 `scheduleNotificationAsync`·`cancelScheduledNotificationAsync`·`kbap.push.reminders`·`REVIEW_REMINDER_SECONDS` 0건 ② `FlippedOrderCard.tsx`에 `scheduleReviewReminder` 0건 ③ `food/[id]/review.tsx`에 `cancelReviewReminder` 0건 ④ 10로케일 JSON `push.reviewReminderTitle`·`push.reviewReminderBody` 부재 ⑤ `routeForNotificationData({type:'REVIEW_REMINDER', foodId:7})` null(구 로컬 알림 잔존 = 이동 없음)

---

## Phase 6: US4 — 주문 상세 리뷰 진입 회귀 (P2, 코드 변경 0)

**Goal**: B안 — 행 탭 = 음식 상세·`ready===false`·`foodId==null` 비활성이 기존 테스트로 잠겨 있는지 확인.

- [X] T018 [US4] `npx jest src/lib/data/__tests__/myFoods253.test.tsx` 실행해 `order-item-*` disabled·push 기대가 존재·통과함을 확인(없으면 케이스 1개 추가: ready false 행 press → `router.push` 0회)

---

## Phase 7: Polish

- [X] T019 [P] `specs/002-push-data-contract/spec.md`(개요 문단 15행·FR-002)·`data-model.md`(표 9행·22행·25행 로컬 리마인더 문단·35행 data 타입)·`contracts/push-notification-data.md`(21행·32·33·37행): 리마인더 = `orderId` → `/profile/order/{orderId}`, foodId 폐기, 로컬 리마인더 문단 삭제(KB-500)
- [X] T020 [P] `specs/004-inbox-server/data-model.md`(17·31·33·54행)·`contracts/notifications-api.md`(39·48행)·`contracts/inbox-ui.md`(11·15·21·63행): `foodId` → `orderId`(REVIEW_REMINDER만, int64 nullable)
- [X] T021 [P] `specs/005-push-tap-landing/data-model.md`(12·13행)·`contracts/push-tap-landing.md`(12·13행)·`quickstart.md` D-6: 리마인더 행을 `orderId` → `/profile/order/{id}`로
- [X] T022 [P] `PROGRESS.md` 말미: `## 리뷰 리마인더 서버 전환 (2026-09-28, KB-500 — Spec Kit 7호 \`specs/007-review-reminder-server\`)` — 결정(B안 주문 상세 무변 · 로컬 예약 삭제 · orderId 정규식 · foodId 폐기) + 열린 항목(릴리스 일정 BE 회신 · 배포 경로는 예진 승인)
- [X] T023 `npx tsc --noEmit` 0 · `npx jest` 전체 통과 · `grep -rn 'scheduleReviewReminder\|cancelReviewReminder\|REVIEW_REMINDER_SECONDS\|reviewReminderTitle\|reviewReminderBody' src` 0건 · `npx eslint src/lib/push src/features/order/FlippedOrderCard.tsx src/app/food src/app/notifications.tsx src/lib/api/notificationAdapter.ts`
- [ ] T024 커밋(`feat(push): 리뷰 리마인더 서버 전환 — 로컬 예약 제거·orderId 주문 상세 착지`, 본문 Jira: KB-500) → push → `open-draft-pr` 스킬로 draft PR(base develop). 본문: spec 경로 · B안 결정 · **릴리스 일정 BE 회신 필요**·배포 시 서버 배치 동기 주의 · 실기 D-1~D-8 미실행 명기

## Dependencies

- Phase 3(US1) → Phase 4(US2)는 매핑 함수를 공유하나 파일이 달라 병렬 가능. 단 T003·T012는 같은 파일(`pushAdapter192`)이라 순차.
- Phase 5(US3) T008이 어댑터 export를 지우므로 T012~T016(참조 제거)은 T008과 같은 커밋에 있어야 tsc가 통과. T017은 T008~T011 뒤.
- Phase 7은 전부 마지막.

## Parallel Example

```
T002 → T003 (pushAdapter192 매핑) → T012 (같은 파일 예약 테스트 삭제)
T004 ∥ T005 ∥ T006 ∥ T007 (US2 파일 4개 서로 다름)
T008 → T009 ∥ T010 ∥ T011 ∥ T013 ∥ T014 ∥ T015 ∥ T016 → T017
T019 ∥ T020 ∥ T021 ∥ T022 → T023 → T024
```

## Implementation Strategy

- MVP = US1 + US3(중복 알림 방지·착지 정확) — 이 둘이 서버 배치 활성화의 전제. US2는 BE 응답 `orderId` dev 배포 여부와 무관하게 옵션 필드라 같이 머지 가능.
- 전부 한 PR. 실기 D-1~D-8은 dev 배치 또는 테스트 발송 확보 후.

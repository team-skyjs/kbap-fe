# Tasks: 푸시 탭 착지 화면 확정 — MEAL_TIME·SCAN_SUGGESTION→홈, HELPFUL→내 리뷰, 임시 push-landing 제거

**Input**: Design documents from `/specs/005-push-tap-landing/`

**Prerequisites**: plan.md · spec.md(Clarifications 3건 반영) · research.md(R-1~R-7) · data-model.md · contracts/push-tap-landing.md · quickstart.md

**Tests**: 포함. CLAUDE.md 완료 기준 "신규 로직엔 그 버그를 정확히 잡는 테스트 동반". 각 스토리는 테스트 먼저(실패 확인) → 구현 순.

**Organization**: 스토리별 페이즈. 소스 변경 4파일(`pushAdapter.ts`·`nav.ts`·`_layout.tsx`·`notifications.tsx`) + 삭제 1 + 로케일 10 + 테스트 3(기존 1 확장·신규 2). 스토리 순서는 우선순위대로 US1→US2 다음 **US4→US3** — 임시 화면 제거(US3)는 스캔 제안 매핑(US4)이 끝나야 가능.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·미완 태스크 의존 없음 → 병렬 가능
- **[Story]**: US1~US4 (spec.md)

## Path Conventions

단일 Expo 앱. 소스 `src/`, 테스트는 각 모듈 옆 `__tests__/`. 경로는 레포 루트(워크트리) 기준.

---

## Phase 1: Setup

**Purpose**: 워크트리에 `node_modules`가 없다(plan 작성 시 확인). 검증 도구를 쓸 수 있게 한다.

- [X] T001 워크트리 루트에서 `npm ci` 실행 후 `npx tsc --noEmit` · `npx jest src/lib/push` 가 현재 코드로 통과하는지 확인 (기준선). 실패하면 원인을 PROGRESS.md에 적고 멈춘다

---

## Phase 2: Foundational

**Purpose**: 세 스토리(US1·US2·US4)가 함께 쓰는 "어떻게 가는가" 헬퍼와 호출부 배선(research R-2·R-3·R-4). 이 뒤에야 매핑 교체가 실기에서 의미를 가진다.

- [X] T002 `src/lib/__tests__/nav573.test.ts` 신규 — `openNotificationRoute` 유닛 4케이스: ① `'/(tabs)'` + `canDismiss()` true → `dismissAll` 1회 후 `navigate('/(tabs)')` 1회(호출 순서 `mock.invocationCallOrder`로 단언), `push` 0회 ② `'/(tabs)'` + `canDismiss()` false → `dismissAll` 0회, `navigate` 1회 ③ `'/profile/reviews'` → `navigate('/profile/reviews')` 1회, `dismissAll` 0회, `push` 0회 ④ `'/food/7'` → `navigate('/food/7')` 1회. 라우터는 `{ canDismiss: jest.fn(), dismissAll: jest.fn(), navigate: jest.fn(), push: jest.fn() }` 객체 목. 실행해 **실패**(함수 없음) 확인
- [X] T003 `src/lib/nav.ts`에 `export function openNotificationRoute(router: Router, href: string): void` 추가 — `href === '/(tabs)'`면 `try { if (router.canDismiss()) router.dismissAll(); } catch { /* 스택 밖 — 무시 */ }` 후 `router.navigate('/(tabs)' as Href)`, 그 외 `router.navigate(href as Href)`. 헤더 주석에 "푸시 탭·알림함 항목 탭 공용 — 홈은 스택 리셋(뒤로 가기 없음, KB-573 종한 확정) + 탭 점프, 그 외 navigate(맨 위 같은 화면이면 재사용). expo-router 56 StackRouter는 getId 없으면 name이 현재 최상단과 다를 때 무조건 push라 홈은 dismissAll 선행 필수" 요지 3줄. T002 통과 확인
- [X] T004 [P] `src/app/_layout.tsx` 푸시 배선 effect(주석 "P-192: 푸시 배선") 수정 — ① 게이트를 `if (!FLAGS.pushEnabled || !entryChecked) return;`로, deps를 `[router, entryChecked]`로 ② 콜백 `(href) => { if (href) router.push(href as Href); }` → `(href) => { if (href) openNotificationRoute(router, href); }` (`import { openNotificationRoute } from '@/lib/nav'`) ③ effect 주석에 "KB-573: entryChecked 뒤 등록 — Stack 마운트 전 navigate는 expo-router가 throw(store.assertIsReady). 콜드 스타트 탭(getLastNotificationResponseAsync)이 스플래시 게이트보다 먼저 해소되므로 등록 자체를 늦춘다" 추가. `Href` import가 다른 곳에서 안 쓰이면 정리
- [X] T005 [P] `src/app/notifications.tsx` `open(n)` — `if (href) router.push(href as Href);` → `if (href) openNotificationRoute(router, href);` (`import { openNotificationRoute } from '@/lib/nav'`). `Href` 타입 import가 남는 곳(Redirect 등) 없으면 제거

**Checkpoint**: `npx tsc --noEmit` 0 · `npx jest src/lib/__tests__/nav573.test.ts` 통과. 매핑은 아직 옛값이라 실기 착지는 변하지 않는다.

---

## Phase 3: User Story 1 — 식사 시간 알림을 탭하면 홈이 열린다 (Priority: P1) 🎯 MVP

**Goal**: MEAL_TIME 탭 = 홈 탭, 열려 있던 화면 전부 닫힘, 이미 홈이면 무동작 (FR-001·FR-005).

**Independent Test**: `routeForNotificationData({type:'MEAL_TIME'})` → `'/(tabs)'`, 탭 콜백 `('/(tabs)', 4)`. 실기 quickstart D-1·D-2·D-3.

- [X] T006 [US1] `src/lib/push/__tests__/pushAdapter192.test.ts` — 매핑 테스트(제목 "KB-498 딥링크 매핑(9/12 결정)…")에서 `expect(routeForNotificationData({ type: 'MEAL_TIME' })).toBeNull()` → `.toBe('/(tabs)')` (주석 "KB-573: 홈 탭 — 스택 리셋은 nav 헬퍼 몫"), 구독 테스트("KB-498: 탭 콜백 2번째 인자…")의 `handler(... MEAL_TIME, notificationId: 4 ...)` 기대를 `toHaveBeenLastCalledWith('/(tabs)', 4)`로. 실행해 **실패** 확인
- [X] T007 [US1] `src/lib/push/pushAdapter.ts` `routeForNotificationData` — `case 'NEWS': case 'MEAL_TIME': return null;`을 분리해 `case 'MEAL_TIME': return '/(tabs)'; // KB-573(9/16 종한): 홈 탭 — 스택 리셋+탭 점프는 lib/nav openNotificationRoute` · `case 'NEWS': return null; // 알림함 열람용 — 이동 없음`. T006 통과 확인

**Checkpoint**: US1 유닛 통과. 실기 D-1~D-3은 Phase 7 T019에서 일괄.

---

## Phase 4: User Story 2 — 리뷰 좋아요 알림을 탭하면 내 리뷰 목록이 열린다 (Priority: P1)

**Goal**: HELPFUL 탭 = `/profile/reviews`, 맨 위가 이미 그 화면이면 재사용 (FR-002). 게스트 게이트는 화면 자체 `useIsGuest` 분기가 처리 — 착지 로직 무판단.

**Independent Test**: `routeForNotificationData({type:'HELPFUL'})` → `'/profile/reviews'`, 구독 테스트 `('/profile/reviews', undefined)`. 실기 D-4·D-5·D-7.

- [X] T008 [US2] `src/lib/push/__tests__/pushAdapter192.test.ts` — 매핑 테스트 `HELPFUL` 기대 `'/push-landing?type=HELPFUL'` → `'/profile/reviews'` (주석 "KB-573: 내 리뷰 목록 — 리뷰 id 미제공이라 상세 불가"), 구독 테스트("알림 탭 구독 — 응답 data로 라우팅 콜백…") 기대 `toHaveBeenCalledWith('/profile/reviews', undefined)`. 실행해 **실패** 확인
- [X] T009 [US2] `src/lib/push/pushAdapter.ts` — `case 'HELPFUL': return '/push-landing?type=HELPFUL';` → `return '/profile/reviews'; // KB-573(9/16 종한): 내 리뷰 목록(게스트 게이트는 화면 몫)`. 함수 위 "2026-09-12 종한: HELPFUL·SCAN_SUGGESTION 착지 미정…" 주석 삭제. T008 통과 확인

**Checkpoint**: US1+US2 유닛 통과. 이 시점에 PR을 내도 임시 화면은 SCAN_SUGGESTION 전용으로만 남는다(스토리 4 전까지).

---

## Phase 5: User Story 4 — 스캔 제안 알림의 착지 (Priority: P2)

**Goal**: SCAN_SUGGESTION 탭 = 홈 탭, MEAL_TIME과 완전 동일 (FR-003, clarify Q1 종한 확정).

**Independent Test**: `routeForNotificationData({type:'SCAN_SUGGESTION'})` → `'/(tabs)'`. 실기 D-8.

- [X] T010 [US4] `src/lib/push/__tests__/pushAdapter192.test.ts` 매핑 테스트 — `SCAN_SUGGESTION` 기대 `'/push-landing?type=SCAN_SUGGESTION'` → `'/(tabs)'` (주석 "KB-573: 홈 — MEAL_TIME과 동일"). 테스트 제목을 "KB-573 딥링크 매핑(9/16 확정) — MEAL_TIME·SCAN_SUGGESTION=홈 · HELPFUL=내 리뷰 · 리마인더=음식 상세 · NEWS=무동작 · 미지=무동작"으로 갱신. 실행해 **실패** 확인
- [X] T011 [US4] `src/lib/push/pushAdapter.ts` — `case 'SCAN_SUGGESTION': return '/push-landing?type=SCAN_SUGGESTION';` → `case 'SCAN_SUGGESTION': // 구 NUDGE(9/7 개명) — 구 이름은 default로 무동작` + `case 'MEAL_TIME': return '/(tabs)';` 로 fall-through 병합. T010 통과 + 이 시점 `grep -n "push-landing" src/lib/push/pushAdapter.ts` 0건 확인

**Checkpoint**: 다섯 유형 매핑 전부 확정값. `push-landing` 경로를 산출하는 코드 0.

---

## Phase 6: User Story 3 — 임시 착지 화면이 사라진다 (Priority: P2)

**Goal**: `push-landing` 화면·경로·문구 키 0건 (FR-006 · SC-003). **US4 완료가 선행 조건.**

**Independent Test**: 잠금 테스트(T012) 통과 + `grep -rn "push-landing\|landingTbd" src | grep -v __tests__` 0건 + `ls src/app/push-landing.tsx` 부재.

- [X] T012 [US3] `src/lib/push/__tests__/landingRemoved573.test.ts` 신규 — fs 기반 잠금 3건(`inboxKeys498.test.ts`의 LOCALES·load 패턴 재사용): ① 10로케일 `push` 네임스페이스에 `landingTbdTitle`·`landingTbdBody` 키 없음 ② `src/lib/push/pushAdapter.ts` 소스에 문자열 `push-landing` 0회 ③ `src/app/push-landing.tsx` 파일 부재(`fs.existsSync` false). 실행해 ①·③ **실패** 확인(②는 T011로 이미 통과)
- [X] T013 [P] [US3] `src/app/push-landing.tsx` 삭제 (`git rm`). expo-router 파일 기반 라우팅이라 등록 해제 없음. `_layout.tsx`의 `<Stack.Screen name=…>` 목록에 push-landing이 명시돼 있으면 그 줄도 제거(현재 미명시 — 확인만)
- [X] T014 [P] [US3] 10로케일 `src/lib/i18n/{ko,en,ja,zh-Hans,zh-Hant,vi,id,th,ru,es}.json` `push` 네임스페이스에서 `landingTbdTitle`·`landingTbdBody` 두 키 제거(각 파일 마지막 키였다면 앞 줄 trailing comma 정리). `push.*` 다른 키 무변. T012 통과 확인

**Checkpoint**: `npx tsc --noEmit` 0 · `npx jest src/lib` 통과 · `grep -rn "push-landing\|landingTbd" src | grep -v __tests__` 0건.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: 문서 동기화(FR-009) · 전체 검증(SC-004) · 실기 확인(SC-002).

- [X] T015 [P] `specs/002-push-data-contract/spec.md` — 개요 단락(15행 근처 "리뷰 반응과 스캔 제안은 착지 기획이 미정이라 **임시 디버깅 화면**…") · US1 AS 1·2·5 · FR-002를 확정 착지로 갱신: HELPFUL→내 리뷰 목록, SCAN_SUGGESTION·MEAL_TIME→홈 탭(스택 리셋), NEWS→이동 없음. 각 갱신 문장에 "(KB-573, 2026-09-16 개정)" 표기. `push-landing` 언급 0건
- [X] T016 [P] `specs/002-push-data-contract/contracts/push-notification-data.md` §2 표 — HELPFUL 행 `'/profile/reviews'`, SCAN_SUGGESTION 행 `'/(tabs)'`, MEAL_TIME 행 `'/(tabs)'` (콜백 `('/(tabs)', 4)`). "(임시)" 표기 삭제. 표 아래에 "이동 방식(스택 리셋·재사용)은 specs/005 contracts/push-tap-landing.md §2" 한 줄
- [X] T017 [P] `PROGRESS.md` 말미에 KB-573 항목 추가(기존 `- [x]` 관례): 착지 확정 3종·헬퍼·콜드 스타트 게이트(소스 근거 store.assertIsReady, 실기 확인 필수)·임시 화면 삭제·로케일 키 제거·테스트 수·tsc/jest 결과. 미확인 실기 항목은 `- [ ]`로 남긴다
- [X] T018 `npx tsc --noEmit` 0 오류 · `npx jest` 전체 통과 확인, 결과 수치를 T017 항목에 기입. 실패 시 원인 수정 후 재실행(회귀 스위트 무시 금지)
- [ ] T019 실기 검증(종한, iOS·Android 각각) — quickstart.md §2 D-1~D-10을 Expo Push Tool로 발송해 확인. **D-3·D-4(콜드 스타트)는 필수** — research R-4 게이트의 유일한 검증. 결과를 T017 항목의 `- [ ]`에 체크. 이 항목 완료 전 OTA 발행 금지(OTA 게이트 커밋)

---

## Dependencies & Execution Order

- **Phase 1 → 2 → (3, 4, 5 순서 자유) → 6 → 7**
- US1·US2·US4는 서로 독립(같은 함수의 다른 case·같은 테스트 파일의 다른 줄) — 한 사람이면 순서대로, 둘이면 파일 충돌 주의해 순차 머지.
- **US3은 US4 이후** — SCAN_SUGGESTION이 임시 화면을 가리키는 동안 파일을 지우면 경로 깨짐.
- T004·T005는 T003 이후 병렬. T013·T014는 T012 이후 병렬. T015·T016·T017은 Phase 6 이후 병렬.

## Parallel Execution Examples

- Phase 2: T003 완료 후 `T004 ∥ T005`
- Phase 6: T012 완료 후 `T013 ∥ T014`
- Phase 7: `T015 ∥ T016 ∥ T017` → T018 → T019

## Implementation Strategy

- **MVP = Phase 1·2 + US1(T001~T007)**: 식사 시간 알림이 홈으로 가고 콜드 스타트가 안전해진다. 이것만으로도 PR 가능(임시 화면은 HELPFUL·SCAN_SUGGESTION에 남음).
- **완성 = US2·US4·US3 + Polish**: 임시 화면 소멸. 한 PR로 묶는 것을 권장(총 변경이 작다 — 소스 4·삭제 1·로케일 10·테스트 3·문서 3).
- 발행: JS 전용이라 OTA 가능하나 T019(실기, 특히 콜드 스타트) 전엔 발행 금지. 발행 자체는 예진 승인·명시 지시 후.

# Tasks: 알림 동의 바텀시트 모션 + 알림 문구 구분자 정리 (KB-553)

**Input**: Design documents from `/specs/003-notification-sheet-motion/`

**Prerequisites**: plan.md · spec.md · research.md(R-1~R-11) · data-model.md · contracts/notification-sheet-ui.md · quickstart.md

**Tests**: 포함. CLAUDE.md 완료 기준 "신규 로직엔 그 버그를 정확히 잡는 테스트 동반" + P-151 "상태 전환 요소엔 메트릭 비교 유닛 동반". 각 스토리는 테스트 먼저(실패 확인) → 구현 순.

**Organization**: 스토리별 페이즈. 소스는 `src/features/push/NotificationSheet.tsx` 1파일 + 로케일 JSON 4개(ko·ja·zh-Hans·zh-Hant) + 기존 테스트 2스위트 확장. 신규 파일 0 · 신규 의존성 0 · 공용 훅 `useSheetSwipeDismiss` 무수정.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·미완 태스크 의존 없음 → 병렬 가능
- **[Story]**: US1~US3 (spec.md)

## Path Conventions

단일 Expo 앱. 소스 `src/`, 테스트는 각 모듈 옆 `__tests__/`. 경로는 워크트리 루트 기준.

---

## Phase 1: Setup

**Purpose**: 기준선 확인. 워크트리에 `node_modules`가 있는지, 현재 코드가 tsc·jest 그린인지.

- [X] T001 워크트리 루트에서 `ls node_modules/.bin/jest`로 의존성 존재 확인(없으면 `npm ci`) → `npx tsc --noEmit` 0 · `npx jest src/features/push src/lib/i18n src/components/__tests__/sheetSwipeDismiss490.test.tsx` 통과 확인 (기준선)

---

## Phase 2: Foundational

**Purpose**: NotificationSheet가 reanimated `Animated.View`·RNGH `GestureHandlerRootView`/`GestureDetector`·공용 훅을 import하게 되면 기존 유닛(a)~(f)가 목 부족으로 즉시 깨진다(research R-8). 구현 전 목을 보강해 US1·US2가 같은 스위트에 케이스를 얹을 수 있게 한다.

- [X] T002 `src/features/push/__tests__/notificationSheet497.test.tsx` 목 보강 — ① reanimated 목: `default: { View, createAnimatedComponent: (c) => c }` 유지 + `runOnJS: (fn) => fn` · `interpolate: () => 1` · `Extrapolation: { CLAMP: 'clamp' }` · `withTiming: jest.fn((v, _c, cb) => { if (cb) cb(true); return v; })`(완료 콜백 즉시 발화 — 퇴장 종단 = onClose 경로 검증, sheetSwipeDismiss490 방식) 추가. ② RNGH 목 신설: `Gesture.Pan()`은 체이닝 빌더 — `runOnJS/onUpdate/onFinalize/onStart/onEnd/onChange/enabled/minDistance` 호출 시 `handlers[name] = cb`로 보관하고 자신을 반환, 생성된 마지막 빌더를 모듈 변수 `__lastPan`에 노출; `GestureDetector: ({ children }) => <View testID="notif-sheet-gesture">{children}</View>`; `GestureHandlerRootView: View`. ③ 실행 → 기존 (a)~(f) 그린 유지 확인(구현 전이라 훅 미호출 — 목만 늘어난 상태)

**Checkpoint**: 기존 6케이스 그린. 이후 스토리 케이스는 이 파일에 (g)~(k)로 추가.

---

## Phase 3: User Story 1 — 알림 시트가 아래에서 올라오고 아래로 내려간다 (Priority: P1) 🎯 MVP

**Goal**: 두 변형 시트의 등장 = 슬라이드 업, 닫힘(나중에·확인·배경 탭·안드 백버튼) = 슬라이드 다운. `Modal animationType="slide"` + 안드 RootView + 딤 전용 레이어 구조로 개편(research R-1·R-3·R-4·R-5). 드래그는 다음 스토리.

**Independent Test**: `npx jest src/features/push/__tests__/notificationSheet497.test.tsx` (g)·(j) 통과 + 기존 (a)~(f) 유지. 실기(Phase 6)에서 등장/퇴장 슬라이드 확인.

### Tests for User Story 1

- [X] T003 [US1] `src/features/push/__tests__/notificationSheet497.test.tsx`에 추가 — **(g) 소스 잠금**: `fs.readFileSync('src/features/push/NotificationSheet.tsx')`가 `animationType="slide"` 포함 · `animationType="fade"` 0 · `GestureHandlerRootView` 포함 · `<Modal` 직후 첫 자식이 RootView(정규식 `/<Modal[^>]*>\s*(\{\/\*[\s\S]*?\*\/\}\s*)?<GestureHandlerRootView/`). **(j) 프레임 불변(P-151, FR-009/SC-005)**: consent 변형에서 `host(tree,'notif-sheet-consent')[0].props.style`을 flatten → `{ paddingTop, paddingBottom, paddingHorizontal, borderTopLeftRadius, borderTopRightRadius, gap }`을 (i) `open` false→true 전환 전후 (ii) `consent-privacy` 탭 전후로 비교해 `toEqual`; 핸들 `notif-sheet-grab`(T006에서 부여 — 이 케이스는 T006 후 활성화되므로 T003 시점엔 `.handle` 스타일 상수 `{ width: 36, height: 4 }`를 flatten으로 확인). **(c) 유지**: `notif-sheet-backdrop` 탭 → onClose(구조 개편 후 testID가 스크림 Pressable에 남아야 함). 실행 → (g) 실패 확인

### Implementation for User Story 1

- [X] T004 [US1] `src/features/push/NotificationSheet.tsx` 구조 개편(contracts/notification-sheet-ui.md "렌더 구조" 그대로) — ① import 추가: `import Animated from 'react-native-reanimated';` · `import { GestureHandlerRootView } from 'react-native-gesture-handler';`. ② `<Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>` (fade→slide). ③ Modal 직계 자식 `<GestureHandlerRootView style={{ flex: 1 }}>`(주석: "Codex #98 3R P2: Modal = 안드 별도 네이티브 루트 — 자체 RootView 필수") → `<View style={styles.root}>`(`flex: 1, justifyContent: 'flex-end'`) → 자식 순서: `<Animated.View style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none" />`(`dim: { backgroundColor: 'rgba(0,0,0,0.45)' }` — 기존 backdrop 색 유지) · `<Pressable style={{ flex: 1 }} onPress={onClose} testID="notif-sheet-backdrop" />` · `<Animated.View style={[styles.sheet, sheetPad]} testID={\`notif-sheet-${variant}\`}>`(기존 내부 자식 그대로). ④ 기존 `styles.backdrop` 삭제 → `root`·`dim` 추가. `styles.sheet/handle/title/body/consents/row/box/actions/later` 메트릭 값 무변. ⑤ 헤더 주석 갱신: "Modal fade · 스와이프 제스처 없음(워클릿 실기 게이트 회피)" 문장 → "KB-553: Modal slide + useSheetSwipeDismiss(핸들·제목 드래그) — 선례 LegalSheet/TagPickerSheet/OrderDishPickerSheet와 같은 골격". ⑥ `npx tsc --noEmit` 0 · T003 (g)·(j)·(c) 그린 · 기존 (a)~(f) 그린

**Checkpoint**: 등장·퇴장 슬라이드는 RN Modal 네이티브 담당 → US1 완결. 호출부 2곳(`PushPrimerModal`·`profile/notifications`) 무수정 확인(`git diff --stat`).

---

## Phase 4: User Story 2 — 시트를 끌어내리거나 배경을 눌러 닫는다 (Priority: P1)

**Goal**: 핸들+제목 드래그 → 임계 통과 시 아래로 퇴장 후 `onClose` 1회, 미만·취소 = 스프링 복귀, 딤 비례 페이드, 재오픈 시 리셋 — 전부 공용 훅 계약 상속(FR-002~FR-008). 제스처 영역 밖 탭(체크박스·전문 보기·확인·나중에) 충돌 0(FR-005).

**Independent Test**: `npx jest src/features/push/__tests__/notificationSheet497.test.tsx` (h)·(i)·(k) 통과 · `src/components/__tests__/sheetSwipeDismiss490.test.tsx` 무변 통과. 실기(Phase 6)에서 끌기 복귀·닫힘·스크림 탭 확인.

### Tests for User Story 2

- [X] T005 [US2] `src/features/push/__tests__/notificationSheet497.test.tsx`에 추가 — **(h) 제스처 배선(FR-003/FR-006, SC-002/SC-004)**: render 후 RNGH 목의 `__lastPan.handlers`로 구동 — `onUpdate({translationY:40, velocityY:0})` + `onFinalize({translationY:40, velocityY:100}, true)` → `onClose` 0회 · 새 render에서 `onFinalize({translationY:90, velocityY:0}, true)` → `onClose` 1회 · 이어서 `onFinalize({translationY:200, velocityY:900}, true)` → 여전히 1회(단일 발사) · 새 render에서 `onFinalize({translationY:150, velocityY:900}, false)` → 0회(취소 = 복귀). **(i) 제스처 영역 한정(FR-005, SC-003)**: `notif-sheet-gesture` 호스트를 찾아 그 하위 `findAll`에 `notif-sheet-grab`이 있고 제목 문자열 `'T'` Text가 있음 · `consent-privacy`·`consent-privacy-full`·`notif-sheet-confirm`·`notif-sheet-later`는 하위에 **없음**(`toHaveLength(0)`) — 동시에 트리 전체에는 각 1개. **(k) 재오픈 리셋·open 전달(FR-007)**: 소스 잠금 `useSheetSwipeDismiss(onClose, open)` 문자열 포함(훅이 `open` 전환에 `ty=0` 리셋 — 훅 유닛이 보증) + `onLayout={swipe.onSheetLayout}`·`swipe.dimStyle`·`swipe.sheetStyle` 3문자열 포함(FR-004/FR-008 배선). 실행 → (h)·(i)·(k) 실패 확인

### Implementation for User Story 2

- [X] T006 [US2] `src/features/push/NotificationSheet.tsx` 훅 배선 — ① import: `GestureDetector` 추가(RNGH), `import { useSheetSwipeDismiss } from '@/components/useSheetSwipeDismiss';`. ② 컴포넌트 상단 `const swipe = useSheetSwipeDismiss(onClose, open);`(마운트 유지형 — `open` 전달 필수, research R-5). ③ 딤 `Animated.View` style에 `swipe.dimStyle` 추가(주석: "P-337: 딤 전용 레이어 — 시트 컨테이너에 걸면 시트도 바랜다") · 시트 `Animated.View`에 `swipe.sheetStyle` 추가 + `onLayout={swipe.onSheetLayout}`. ④ 시트 첫 자식을 `<GestureDetector gesture={swipe.gesture}><View>{/* P-337 제스처 영역 = 핸들 + 제목(본문·체크·버튼은 밖) */}<View style={styles.handle} testID="notif-sheet-grab" /><Text style={styles.title}>{title}</Text></View></GestureDetector>`로 감싸고, `body` Text·`consents`·`actions`는 GestureDetector 밖 형제로 유지. 간격 검토: 시트 `gap: 12`가 래퍼 View 1덩어리에 적용되므로 제목↔본문 12 유지, 핸들↔제목은 기존 `handle.marginBottom: 6` 유지 → 시각 메트릭 무변. ⑤ `npx tsc --noEmit` 0 · T005 (h)·(i)·(k) 그린 · (a)~(g)·(j) 그린 · `npx jest src/components/__tests__/sheetSwipeDismiss490.test.tsx` 통과 · `git diff --quiet -- src/components/useSheetSwipeDismiss.ts`(훅 무변)

**Checkpoint**: US1+US2 = 모션 전부. `NotificationSheet.tsx` 외 소스 diff 0.

---

## Phase 5: User Story 3 — 알림 관련 문구의 중간점이 슬래시로 바뀐다 (Priority: P2)

**Goal**: 5키(`notif.activitySub`·`notif.newsSub`·`notif.mealTimeSub`·`push.consentSheetBody`·`push.privacyConsent`)의 중간점(U+00B7 `·`, U+30FB `・`)을 `/`로 1:1 치환(공백 추가 없음, research R-7). 실측 대상 = ko 5키 · ja 4키 · zh-Hans/zh-Hant `activitySub` 1키. 나머지 6로케일 무변(FR-010/FR-011).

**Independent Test**: `npx jest src/lib/i18n/__tests__/notifKeys497.test.ts` 통과 + `grep -nE '"(activitySub|newsSub|mealTimeSub|consentSheetBody|privacyConsent)"' src/lib/i18n/*.json | grep -E '[·・]'` 0줄.

### Tests for User Story 3

- [X] T007 [P] [US3] `src/lib/i18n/__tests__/notifKeys497.test.ts`에 케이스 추가 — `const SLASH_KEYS: Array<['notif'|'push', string]> = [['notif','activitySub'],['notif','newsSub'],['notif','mealTimeSub'],['push','consentSheetBody'],['push','privacyConsent']];` · `it('KB-553: 알림 문구 5키에 중간점(U+00B7·U+30FB) 0 — 10로케일 (FR-010/SC-006)')`: 각 로케일·각 키 값에 `expect({ locale: l, key: \`${ns}.${k}\`, value: v }).not.toMatch(/[·・]/)` 형태(실패 시 로케일·키가 메시지에 남게). 실행 → ko·ja·zh-Hans·zh-Hant 실패 확인

### Implementation for User Story 3

- [X] T008 [P] [US3] `src/lib/i18n/ko.json` 5키 치환(data-model §4 표 그대로): `notif.activitySub` "리뷰 반응/식사 후 리뷰 작성" · `notif.newsSub` "이벤트/새 기능 소식 (광고성)" · `notif.mealTimeSub` "점심/저녁 메뉴 스캔 알림 (광고성)" · `push.consentSheetBody` "이벤트/새 기능 소식을 광고성 알림으로 보내요." · `push.privacyConsent` "마케팅 목적 개인정보 수집/이용 동의 (선택)". 다른 키 무변
- [X] T009 [P] [US3] `src/lib/i18n/ja.json` 4키 `・`→`/`: `notif.activitySub` "レビューへの反応/食後のレビュー作成" · `notif.newsSub` "イベント/新機能のお知らせ（広告）" · `notif.mealTimeSub` "昼/夜のメニュースキャン通知（広告）" · `push.privacyConsent` "マーケティング目的の個人情報収集/利用への同意（任意）". `push.consentSheetBody`는 중간점 없음 → 무변
- [X] T010 [P] [US3] `src/lib/i18n/zh-Hans.json` `notif.activitySub` "评论获得反馈/用餐后写评论提醒" · `src/lib/i18n/zh-Hant.json` `notif.activitySub` "評論獲得回饋/用餐後撰寫評論提醒". 두 파일 나머지 4키는 중간점 없음 → 무변
- [X] T011 [US3] 검증: `npx jest src/lib/i18n/__tests__/notifKeys497.test.ts` 전부 그린(패리티·구키 0·consentStatus 보간·신규 중간점 0) · `git diff --stat src/lib/i18n`이 ko·ja·zh-Hans·zh-Hant 4파일만 · quickstart §2 grep 0줄

**Checkpoint**: US3 독립 완결. `notif.*`·`push.*` 외 키 diff 0.

---

## Phase 6: Polish & 게이트

**Purpose**: 전체 검증 · 실기 게이트(FR-012/SC-001) · 기록 · PR.

- [X] T012 전체 검증: `npx tsc --noEmit` 0 · `npx jest` 전체 그린 · `git diff --quiet -- src/components/useSheetSwipeDismiss.ts src/features/push/PushPrimerModal.tsx src/app/profile/notifications.tsx`(무변 3파일) · `git status --short`에 `NotificationSheet.tsx`·테스트 2·로케일 4·specs만
- [ ] T013 실기 확인(PR 게이트 — CLAUDE.md "제스처·워클릿 코드는 실기기 확인 후 발행"): iOS·Android dev client(`npx expo start --dev-client`)에서 quickstart §3 체크리스트 1~9(등장 슬라이드 · 끌어 닫힘 · 임계 미만 복귀 · 본문 끌기 무반응 + 체크/링크/확인 탭 1회 반응 · 스크림 탭·백버튼 슬라이드 다운 · 딤 비례 페이드 · 등장 중 스크림 탭 중간정지 없음 · 안드 스와이프 동작) 결과를 플랫폼별 ✅/❌로 기록해 PR 본문에 넣을 텍스트를 `specs/003-notification-sheet-motion/quickstart.md` 하단 "실기 결과" 절로 추가. **`eas update` 실행 금지**(발행은 예진 승인 후 별도)
- [X] T014 `PROGRESS.md` 관례대로 KB-553 항목 추가(변경 요약 1~2줄 + 유닛 추가 수 + "실기 확인 결과 · JS-only OTA 가능" 표기)
- [X] T016 실기 1차 피드백 반영(2026-09-14): ① Modal slide가 딤 레이어까지 밀어 올림 → `Modal animationType="fade"` + 훅 `animateIn`(시트만 아래에서 등장) + 훅 `dismiss(onDone)` 노출로 5개 닫힘 경로 전부 슬라이드 다운 후 Modal 숨김(`visible` 지연) — `src/components/useSheetSwipeDismiss.ts` 가산 확장, `src/features/push/NotificationSheet.tsx` ② 스프링 등장 "둥 뜸" 반려 → `withTiming(0, 240ms, Easing.out(cubic))` 직선. 유닛: `sheetSwipeDismiss490` +2(animateIn 기본 무변·dismiss 즉시/애니메이션 경로) · `notificationSheet497` (g)(k) 갱신 + (l) 퇴장 후 Modal 숨김 · 화면 스위트 목(Easing·runOnJS·withTiming 콜백) 보강. tsc 0 · jest 전체 그린
- [X] T017 실기 2차 피드백(2026-09-14, 종한 "드래그 가능하게"): 제스처 영역을 핸들+제목 → 시트 전체로 확장(`GestureDetector`가 시트 `Animated.View`를 감쌈). 사유: 이 시트는 스크롤이 없어 P-337 한정 근거 없음, Pan은 이동 후 활성화라 탭 통과. `src/features/push/NotificationSheet.tsx` · (i) 유닛 갱신(시트·체크·버튼 포함, 스크림 제외). research R-2·contract·data-model §3·quickstart §3-5 개정
- [X] T018 스코프 추가(2026-09-14, 종한): consent 시트 체크 2종 **사전 체크** + 하나만 체크된 채 확인 탭 시 "둘 다 동의 필요" 안내(고정 슬롯·불투명도만) — `src/features/push/NotificationSheet.tsx` · `push.consentBothRequired` 10로케일 · `notifKeys497` REQUIRED_PUSH · `notificationSheet497` (b)(b2)(e)(f) 갱신 · `notificationSettings497` US2(b) 갱신. research R-13(사전 체크 광고성 동의 = 법적 리뷰 포인트 → PR 본문)
- [X] T019 스코프 추가(2026-09-14 실기, 종한): 동의 확정 후 토글 깜빡임 — KB-544 계약(`news.consent:true`)으로 페이로드 교체 + `mealTime:true` 동봉 + `predictSettings`가 요청에 없는 값을 앞서 예측하지 않게 수정. `src/lib/data/useNotificationSettings.ts` · `src/app/profile/notifications.tsx` · 유닛 `useNotificationSettings497` +1 · `notificationSettings497` US2(b) 페이로드 갱신. research R-14. 실기 재확인: 확인 → 소식·식사 시간 ON 유지, 소식 OFF → OFF 유지
- [ ] T015 커밋 후 `open-draft-pr` 스킬로 PR — 제목은 Jira 키 없이 `feat(push): 알림 시트 슬라이드·드래그 닫힘 모션 및 문구 중간점 슬래시` 형식, 본문에 `Jira: KB-553` 줄 · T013 실기 체크리스트 · 리뷰 포인트 "ja 나카구로 `・` 4키 → `/` 치환이 카피 의도에 맞는지(research R-7)" 기재. 커밋 메시지 끝 어트리뷰션 규칙 준수

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (T001)** → **Phase 2 (T002)** → **Phase 3 (T003→T004)** → **Phase 4 (T005→T006)** → **Phase 6**
- **Phase 5 (T007~T011)**: T001 이후 언제든 시작 가능 — 모션 스토리와 파일이 겹치지 않음(로케일 JSON·i18n 테스트만)
- **Phase 6**: T012는 T006·T011 이후 · T013은 T006 이후(모션 실기) · T014·T015는 T012·T013 이후

### User Story Dependencies

- **US1 (P1)**: T002 목 보강 뒤 시작. 다른 스토리 의존 없음
- **US2 (P1)**: US1의 구조 개편(T004 — Animated.View 컨테이너·딤 레이어·RootView) 위에 훅을 배선하므로 **US1 완료 후**. 같은 파일이라 병렬 불가
- **US3 (P2)**: 완전 독립. 병렬 가능

### Within Each User Story

- 테스트 추가 → 실행해 실패 확인 → 구현 → 그린 확인 → 훅·호출부 무변 확인

### Parallel Opportunities

- T007·T008·T009·T010은 서로 다른 파일 → 동시 진행 가능
- Phase 5 전체가 Phase 3~4와 병렬 가능(같은 세션이면 US1→US2 사이 어디든 끼워도 됨)

---

## Parallel Example: User Story 3

```bash
# 동시 진행 가능(서로 다른 파일):
Task: "T007 notifKeys497.test.ts에 중간점 0 케이스 추가"
Task: "T008 ko.json 5키 치환"
Task: "T009 ja.json 4키 치환"
Task: "T010 zh-Hans.json·zh-Hant.json activitySub 치환"
# 그 후:
Task: "T011 jest notifKeys497 + grep 0줄 + diff 4파일 확인"
```

---

## Implementation Strategy

### MVP First (US1)

1. T001 기준선 → T002 목 보강
2. T003 테스트(실패) → T004 구조 개편(그린)
3. **STOP·검증**: 시트가 slide로 뜨고 닫히는지 시뮬레이터에서 눈으로 확인(드래그는 아직 없음) — 여기까지가 안전한 최소 증분

### Incremental Delivery

1. US1 → 슬라이드 등장/퇴장(MVP)
2. US2 → 드래그·딤 페이드·영역 한정(모션 완결) → T013 실기 게이트
3. US3 → 문구(독립, 언제든)
4. T012~T015 → 전체 검증·기록·PR

### Notes

- `NotificationSheet.tsx`는 US1·US2가 순차로 만지는 유일한 소스 파일 — 두 스토리를 한 커밋으로 묶어도 무방(리뷰 단위는 PR)
- 훅 `useSheetSwipeDismiss.ts`는 가산 확장(옵션·반환값)만 — 기본 동작 변경 금지(시트 4곳 동시 영향, research R-12). T016에서 animateIn·dismiss 추가
- 발행(`eas update`)은 이 태스크 범위 밖 — 예진 승인·실기 확인 후 별도 지시

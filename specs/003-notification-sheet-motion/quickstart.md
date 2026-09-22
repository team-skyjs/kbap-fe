# Quickstart: 검증 가이드 (KB-553)

## 0. 전제

- 브랜치 `feat/kb553-sheet-motion`(워크트리), develop d5b4f06 기준.
- `npm ci` 완료. 실기 확인은 iOS·Android dev client(development 채널) — 발행은 하지 않는다.

## 1. 유닛 (구현 전 RED → 구현 후 GREEN)

```bash
npx tsc --noEmit
npx jest src/features/push/__tests__/notificationSheet497.test.tsx src/lib/i18n/__tests__/notifKeys497.test.ts src/components/__tests__/sheetSwipeDismiss490.test.tsx
npx jest   # 전체 그린
```

`notificationSheet497` 기대 케이스(기존 a~f 유지 + 추가):

| 케이스 | 단언 |
|--------|------|
| (a)~(f) 기존 | 전부 통과(props·testID 계약 무변) |
| (g) 소스 잠금 | `NotificationSheet.tsx`에 `animationType="fade"`(딤 페이드) 포함·`"slide"` 0 · Modal 직계 `GestureHandlerRootView` · `animateIn: true`(시트 등장은 훅 직선 240ms) |
| (h) 제스처 배선 | RNGH 목 `handlers.onFinalize({translationY: 90, velocityY: 0}, true)` → `onClose` 1회 · `({translationY: 40, velocityY: 100}, true)` → 0회 · 취소(success=false) → 0회 |
| (i) 제스처 영역 = 시트 전체 | `notif-sheet-consent`·`notif-sheet-grab`·`consent-privacy`·`notif-sheet-confirm`·`notif-sheet-later`가 `notif-sheet-gesture` 하위, 스크림 `notif-sheet-backdrop`은 밖 |
| (j) 프레임 불변 | `notif-sheet-consent` flatten 스타일의 paddingTop/paddingBottom/paddingHorizontal/borderTopLeftRadius/gap이 `open` false→true·체크 전후 동일, 핸들 36×4 1개 |
| (k) 훅 배선 잠금 | `useSheetSwipeDismiss(onClose, open, { animateIn: true })`·`swipe.dismiss(`·`swipe.dimStyle`·`swipe.sheetStyle`·`onLayout={swipe.onSheetLayout}` |
| (l) 퇴장 후 숨김 | open=false → 퇴장 180ms 1회 후 Modal visible=false · 드래그로 이미 내려간 뒤엔 추가 애니메이션 0 |
| (m)(n)(o) 퇴장 중 조작 | 퇴장 중 루트 pointerEvents none · 나중에/스크림/백버튼은 훅 dismiss 경유로 onClose 1회 · 내부·드래그 퇴장 중 확인 탭 = onConfirm 0 · iOS VoiceOver announce |
| (c) 스크림/나중에 | 열림 1회당 onClose 1회(닫힌 뒤 재탭 무시), 재오픈 후 다시 1회 |
| (b)(b2)(e)(f) 동의 | 사전 체크로 열림 · 하나 해제+확인 = 안내(고정 슬롯 메트릭 동일)·onConfirm 0 · 재오픈 = 리셋 |

`notifKeys497` 추가 케이스: 5키 × 10로케일 값에 `/[·・]/` 매치 0 · 기존 패리티·구키 0·consentStatus 보간 유지.

목 요구(연구 R-8): reanimated 목에 `runOnJS: fn=>fn`·`interpolate: ()=>1`·`Extrapolation.CLAMP`·`default.View`; RNGH 목 `Gesture.Pan()` 체인에 `runOnJS/onUpdate/onFinalize` 포함 + `handlers` 노출, `GestureDetector` = `testID="notif-sheet-gesture"` View 래퍼, `GestureHandlerRootView` = View.

## 2. 문구 확인

```bash
grep -nE '"(activitySub|newsSub|mealTimeSub|consentSheetBody|privacyConsent)"' src/lib/i18n/{ko,ja,zh-Hans,zh-Hant}.json | grep -E '[·・]'   # 출력 0줄
git diff --stat src/lib/i18n   # ko·ja·zh-Hans·zh-Hant 4파일만
```

## 3. 실기 확인 (PR 게이트 — DoD, 결과를 PR 본문 체크리스트로)

dev client(`npx expo start --dev-client`) iOS·Android 각각:

1. 스캔 결과 → 프라이머 시트가 **하단에서 슬라이드 업**(직선, 튕김 없음). **딤은 제자리에서 짙어지기만** — 시트와 함께 올라오면 결함(1차 반려 재발).
2. 핸들을 아래로 100pt+ 끌어 놓기 → 아래로 내려가며 닫힘, 「나중에」 로직(decline) 1회.
3. 재노출 경로가 없으므로 설정 화면으로: 프로필 > 알림 설정 > 소식 토글 → 동의 시트 슬라이드 업.
4. 핸들을 30pt만 끌다 놓기 → 원위치 스프링 복귀, 시트 유지.
5. 시트 어디를 잡아도(핸들·제목·본문·체크 행) 끌어 내려감. 체크 2개·전문 링크·확인 각각 탭 1회로 반응 — 손가락을 살짝 흔들며 탭해도 씹히지 않는지.
6. 스크림 탭·「나중에」·확인 완료 → 시트가 먼저 내려가고 그 뒤 딤이 걷힘. Android 백버튼 → 동일.
7. 드래그 중 딤이 비례해 옅어짐, 시트는 바래지 않음.
8. 등장 애니메이션 도중 스크림 탭 → 중간 정지 없이 닫힘으로 이어짐(R-10).
9. (Android) 스와이프가 무동작이면 Modal 내부 RootView 누락 — 소스 잠금 (g) 재확인.

## 4. 범위 밖(변경 없음 확인)

- `src/components/useSheetSwipeDismiss.ts` 무변 (`git diff --quiet -- src/components/useSheetSwipeDismiss.ts`).
- `PushPrimerModal.tsx`·`profile/notifications.tsx` 무변. 소식 OFF 확인 모달(`offConfirm`) fade 유지.
- `notif.*`·`push.*` 외 로케일 키 무변.

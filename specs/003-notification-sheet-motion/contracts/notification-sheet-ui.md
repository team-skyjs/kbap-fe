# UI Contract: NotificationSheet (KB-553 이후)

## Props (무변 — 호출부 2곳 무수정)

```ts
{
  open: boolean;
  variant: 'primer' | 'consent';
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: (consents?: { privacy: boolean; receive: boolean }) => Promise<void> | void; // consent = 둘 다 true일 때만
  onClose: () => void; // 드래그 퇴장 완료 · 스크림 탭 · 「나중에」 · 안드 백버튼 — 사이클당 1회
}
```

호출부: `src/features/push/PushPrimerModal.tsx`(primer) · `src/app/profile/notifications.tsx`(consent). 두 곳 모두 `onClose`에서 `open=false`로 전환한다(기존).

## 렌더 구조

```
Modal(visible=visible ← open 지연: open=false 시 swipe.dismiss 퇴장 후 false, transparent, animationType="fade", onRequestClose=onClose)
└ GestureHandlerRootView(flex:1)
  └ View(flex:1, justifyContent:'flex-end')
    ├ Animated.View(absoluteFill · 딤 배경색 · swipe.dimStyle · pointerEvents="none")
    ├ Pressable(flex:1 · onPress=onClose · testID="notif-sheet-backdrop")
    └ GestureDetector(gesture=swipe.gesture)          ← 제스처 영역 = 시트 전체(스크롤 없음 — R-2 개정)
      └ Animated.View(styles.sheet + sheetPad + swipe.sheetStyle · onLayout=swipe.onSheetLayout · testID=`notif-sheet-${variant}`)
        ├ View(styles.handle)      testID="notif-sheet-grab"
        ├ Text(title)
        ├ Text(body)
      ├ [consent] View(consents) — ConsentRow×2 (testID consent-privacy / consent-receive / *-box / *-full)
      └ View(actions) — Btn(testID="notif-sheet-confirm") · Pressable(testID="notif-sheet-later")
```

## testID 계약

| testID | 유지/신규 | 의미 |
|--------|-----------|------|
| `notif-sheet-backdrop` | 유지 | 스크림 탭 = onClose |
| `notif-sheet-primer` / `notif-sheet-consent` | 유지 | 시트 컨테이너(메트릭 비교 대상) |
| `notif-sheet-grab` | 신규 | 그랩 핸들 |
| `consent-{privacy\|receive}` · `-box` · `-full` | 유지 | 체크 행·박스·전문 링크 — 시트 전체가 제스처 영역이라 안에 있음, 탭은 Pan 미활성 시 통과 |
| `notif-sheet-confirm` · `notif-sheet-later` | 유지 | 동일 |

## 제스처·모션 계약 (공용 훅 상속 — `src/components/useSheetSwipeDismiss.ts`, KB-553 확장 포함)

- 훅 호출: `useSheetSwipeDismiss(onClose, open, { animateIn: true })`.
- 등장(animateIn): open 전환 시 `ty = 화면 높이 → withTiming(0, 240ms, Easing.out(cubic))`. 스프링·오버슈트 없음. 딤은 Modal fade + dimStyle 비례로 함께 짙어짐.
- 퇴장 공통: `swipe.dismiss(onDone)` = `withTiming(시트 실높이, 180ms)` 후 onDone. 드래그로 이미 내려간 뒤 호출이면 즉시 onDone. 시트는 이걸로 `visible=false`.

- 임계: 이동 ≥ 80pt 또는 속도 ≥ 500pt/s → 퇴장(180ms) → `onClose` 1회.
- 미만 또는 제스처 취소(success=false) → `withSpring(0, spring.sheet)` 복귀, `onClose` 0회.
- 위로 끌기 무시(`ty ≥ 0`). 단일 발사(closingRef).
- 딤 opacity = `interpolate(ty, [0, 280], [1, 0.25])`.

## 프레임 불변 계약 (P-151)

`styles.sheet`(paddingTop 10 · paddingBottom 34 · paddingHorizontal 20 · radius 24 · gap 12) · `handle`(36×4) · `box`(20×20 · border 1.5)는 열림 전후·드래그 중 동일. 상태로 바뀌는 것은 `transform.translateY`·딤 `opacity`·체크 색만.

## i18n 계약

`notif.activitySub`·`notif.newsSub`·`notif.mealTimeSub`·`push.consentSheetBody`·`push.privacyConsent` — 10로케일 값에 U+00B7·U+30FB 0개. 키 집합은 ko 기준 패리티(기존 `notifKeys497`).

# Research: 알림 시트 모션 + 문구 슬래시 (KB-553)

Technical Context에 NEEDS CLARIFICATION은 없었다(스택·의존성·테스트 전부 기존). 아래는 설계 결정 7건.

## R-1. 등장/퇴장 모션 구현 방식 (2026-09-14 실기 후 개정)

- **1차 결정(반려)**: `Modal animationType="slide"` + 훅 드래그. 선례 시트 3곳과 같은 조합이었으나 실기에서 **딤 레이어가 시트와 함께 아래에서 올라오는** 문제가 보였다 — Modal slide는 Modal 내용 전체(딤 포함)를 밀어 올린다. 선례 3곳도 같은 구조라 같은 증상을 갖는다(별도 티켓 후보).
- **Decision**: `Modal animationType="fade"`(딤만 페이드) + 시트 슬라이드는 공용 훅이 전담. 훅에 가산적 확장 2건 — ① `animateIn` 옵션: open 전환 시 `ty = winH → withTiming(0, 240ms, Easing.out(cubic))`(1차로 `spring.sheet`를 썼으나 실기 "둥 뜬다" 반려 → 직선 ease-out). ② `dismiss(onDone)` 노출: 외부 닫힘 경로도 슬라이드 다운(180ms) 후 콜백, 드래그로 이미 내려갔으면 즉시. 시트는 `open=false`가 되면 `swipe.dismiss(() => setVisible(false))`로 퇴장 후 Modal을 내린다(visible 지연). 확인 완료·나중에·스크림·백버튼·드래그 5경로 모두 같은 퇴장을 탄다(spec FR-001).
- **Rationale**: 딤은 위치가 아니라 불투명도만 바뀌어야 한다(spec Edge Case "상태로 바뀌는 건 위치와 딤 불투명도뿐"). 훅 확장은 옵션·반환값 추가만이라 선례 시트 3곳 동작 무변(훅 유닛으로 잠금). Codex #98 결함 수정(onFinalize·실높이·RootView)은 그대로 상속.
- **Alternatives considered**:
  - reanimated `entering={SlideInDown}`/`exiting` 레이아웃 애니메이션 — AuthGateSheet에서 `SlideInDown.springify()`를 P-031 B5로 넣었다가 예진 실기 반려로 제거한 전례(PROGRESS.md). Modal 밖 레이아웃 애니메이션은 안드 언마운트 타이밍 이슈도 있어 기각.
  - `@gorhom/bottom-sheet` 도입 — 신규 의존성 + 네이티브 fingerprint 회전 가능성(OTA 도달 0 사고 계열). 기각.
  - 커스텀 shared value로 등장까지 직접 애니메이션 — 훅이 등장을 다루지 않고(`open` 전환 시 `ty=0` 리셋만), 선례도 등장은 Modal에 맡긴다. 불필요.

## R-2. 제스처 영역 (2026-09-14 실기 후 개정)

- **1차 결정**: P-337 계약대로 핸들 + 제목만. 실기에서 종한이 본문을 끌어 "드래그가 안 된다"고 판단 → 시트 전체로 확장 지시.
- **Decision**: `GestureDetector`가 시트 `Animated.View` 전체를 감싼다. 스크림 Pressable은 밖(탭 닫힘만).
- **Rationale**: P-337이 영역을 한정한 사유는 **내부 스크롤 리스트와의 충돌**인데, 이 시트는 스크롤이 없다. RNGH Pan은 이동(기본 minDist)이 있어야 활성화되므로 체크박스·전문 링크·버튼의 탭은 RN 반응 체계로 그대로 전달된다 — 유닛 (b)(c)(d)가 탭 동작을, (i)가 영역 포함을 잠근다. 실기 재확인 항목: 체크박스를 살짝 흔들며 탭해도 씹히지 않는지(quickstart §3-5).
- **Alternatives considered**: 핸들+제목 유지 — 사용자 기대(시트 어디를 잡아도 내려감)와 어긋남. 기각.

## R-3. 안드로이드 Modal 루트

- **Decision**: Modal 직계 자식으로 `<GestureHandlerRootView style={{flex:1}}>`.
- **Rationale**: Codex #98 3R P2 — RN Modal은 안드에서 별도 네이티브 루트라 앱 레벨 RootView가 닿지 않아 스와이프가 무동작. 선례 3곳 전부 동일 처치. 유닛으로 소스 잠금(quickstart).

## R-4. 배경 딤·스크림 탭 구조

- **Decision**: 컨테이너 `View(flex:1, justifyContent:'flex-end')` 안에 ① `Animated.View(absoluteFill, 배경색, dimStyle, pointerEvents="none")` ② `Pressable(flex:1, onPress=onClose, testID="notif-sheet-backdrop")` ③ `Animated.View(styles.sheet, sheetStyle, onLayout=onSheetLayout)` 순. 현행 "backdrop Pressable이 시트를 품는" 중첩 구조는 해체.
- **Rationale**: 훅 주석 — dimStyle을 시트를 품는 컨테이너에 걸면 시트까지 바랜다. 딤 전용 레이어 + 스크림 Pressable 분리는 `OrderDishPickerSheet`와 동일. 기존 testID `notif-sheet-backdrop`은 ②에 유지해 유닛(c) 호환.
- **Alternatives considered**: 현행 중첩 유지 + 시트만 Animated — 딤 페이드를 넣을 자리가 없음. 기각.

## R-5. 마운트 방식 (visible={open} vs 조건부 null)

- **Decision**: 현행 `Modal visible={open}` 유지(마운트 유지형). 훅에 `open`을 넘겨 재오픈 시 `ty=0` 리셋.
- **Rationale**: 시트의 pending 체크 폐기 effect가 `open` prop에 걸려 있고 유닛(f)가 `open` false→true 토글로 이를 검증한다. `LegalSheet`와 같은 방식. 조건부 null(`OrderDishPickerSheet` 방식)은 등장 슬라이드도 `visible` 전환으로 얻지 못한다(마운트 즉시 visible → 안드에서 애니메이션 생략 사례).

## R-6. 프레임 불변(P-151) 확인 방법

- **Decision**: `styles.sheet`·`handle`·`box` 메트릭은 무변. 스타일 배열에 `swipe.sheetStyle`(transform만)이 추가될 뿐. 유닛: 열림 전후 `notif-sheet-{variant}` 호스트의 flatten 스타일에서 `paddingTop/paddingBottom/paddingHorizontal/borderTopLeftRadius/gap` 동일 + 기존 (e) 체크박스 메트릭 유지.
- **Rationale**: CLAUDE.md 승격 규칙 — 상태 전환 요소엔 메트릭 비교 유닛 동반.

## R-7. 문구 중간점 치환 범위·문자

- **Decision**: 대상 5키 × 10로케일에서 U+00B7 `·`(ko·zh-Hans·zh-Hant)와 U+30FB `・`(ja 나카구로)를 `/`로 1:1 치환(공백 추가 없음 — CJK 문장은 어절 공백이 없어 `·` 자리에 그대로 `/`). 실측: ko 5키 전부 · ja 4키(consentSheetBody 제외) · zh-Hans/zh-Hant `activitySub` 1키만. en·es·id·ru·th·vi는 중간점 없음(en 등은 이미 ` / ` 사용) → 무변.
- **Rationale**: 티켓 "10로케일 같은 키에서 동일 처리(중간점 없는 로케일은 그대로)". ja `・`는 일본어 중간점이므로 "동일 처리"에 포함한다.
- **Alternatives considered**: ja 나카구로 유지(일본어 병렬 표기 관례) — 티켓 문면상 동일 처리가 우선. **리뷰어 확인 포인트로 PR 본문에 기재**: ja 4키 `・`→`/` 치환이 카피 의도에 맞는지.
- **검증**: `notifKeys497`에 케이스 추가 — 5키×10로케일 값에 `[·・]` 0개. `notif.*`·`push.*` 외 키는 검사하지 않는다(spec FR-011 — 다른 영역 문구 무변).

## R-8. jest 목 전략 (테스트 인프라)

- **Decision**: `notificationSheet497`의 reanimated 목에 `runOnJS`·`interpolate`·`Extrapolation`·`default.View`를 보강하고, RNGH 목을 추가한다. RNGH 목의 `Gesture.Pan()`은 체이닝 빌더로 `runOnJS/onUpdate/onFinalize` 등록 콜백을 `handlers`에 보관(`sheetSwipeDismiss490`이 실모듈에서 읽는 형태와 동일 shape) — 테스트가 `handlers.onFinalize({translationY:90,velocityY:0}, true)`로 임계 통과를 구동해 `onClose` 1회를 확인한다. `GestureDetector`는 자식을 `testID="notif-sheet-gesture"` 호스트 View로 감싸 렌더 → 체크 행·확인이 그 하위가 아님을 트리로 단언.
- **Rationale**: 기존 RNGH 목(예: `scanDesign.test.tsx`)의 체인 키 목록에 `onFinalize`가 없어 훅이 `.onFinalize`를 호출하면 throw — 그대로 복사하면 실패한다. 훅 스위트는 실 RNGH로 돌지만 컴포넌트 스위트는 `GestureHandlerRootView`·`GestureDetector` 네이티브 표면 때문에 목이 필요.

## R-12. 훅 확장 범위(2026-09-14)

- **Decision**: `useSheetSwipeDismiss`에 `opts.animateIn`(기본 false)·반환 `dismiss` 추가만. 기존 시그니처·기본 동작·선례 호출 3곳 무변(훅 유닛 "기본(false)은 0 리셋만" 잠금).
- **Rationale**: 애초 "훅 무수정" 전제는 R-1 1차 결정에 묶인 것이었고, Modal slide가 딤을 밀어 올리는 결함이 확인된 이상 등장을 시트 레이어에서 처리할 곳은 훅뿐이다. 시트 4곳 동시 영향은 opt-in으로 차단.

## R-9. 접근성 "동작 줄이기" (spec Edge Case)

- **Decision**: 이번 범위에서 별도 처리 없음. 열림/닫힘 **기능**은 모션 유무와 무관하게 동일(Modal `visible` 전환 + `onClose` 콜백이 모션과 분리돼 있음)하므로 spec 요구("모션이 짧아지거나 생략돼도 열림·닫힘 기능은 동일")는 구조적으로 충족된다.
- **Rationale**: 공용 훅을 수정하지 않는 것이 이 기능의 전제(선례 3곳과 동일 동작). reanimated 4의 `ReduceMotion.System` 옵션은 훅의 `withTiming/withSpring`에 걸어야 해 훅 변경 = 시트 4곳 동시 영향 → 별도 티켓이 맞다.
- **Add when**: 접근성 티켓에서 앱 전체 모션 정책을 정할 때 훅 1곳에 `reduceMotion` 옵션 추가(시트 4곳 자동 적용).

## R-10. 열리는 도중 스크림 탭 (spec Edge Case)

- **Decision**: 추가 코드 없음. RN Modal은 `visible` true→false 전환을 네이티브에서 직렬화하므로 등장 중 `onClose`→`open=false`가 와도 시트가 중간에 멈추지 않고 닫힘 애니메이션으로 이어진다. 스크림 Pressable은 등장 첫 프레임부터 활성(선례와 동일).
- **Rationale**: 선례 시트 3곳이 같은 구조로 운영 중이며 해당 결함 보고 없음. 실기 체크리스트에 "등장 중 스크림 탭" 1항목 추가(quickstart §3).

## R-11. 확인 처리 중(busy) 끌기·스크림 탭 (spec Edge Case)

- **Decision**: 기존 계약 유지 — `onClose`만 호출, 진행 중 `onConfirm` Promise는 취소하지 않는다. 동의 시트는 호출부(`profile/notifications`)의 `confirmConsent`가 낙관 patch 후 `setConsentOpen(false)`를 하므로 결과는 설정 화면에 반영된다(기존 흐름).
- **Rationale**: 훅·시트 어느 쪽도 busy를 알 필요가 없다. 유닛(d) 제출 가드 케이스가 이 경계를 이미 잠근다.

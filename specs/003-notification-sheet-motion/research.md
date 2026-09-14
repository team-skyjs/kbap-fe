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

## R-13. 동의 체크 초기값·미충족 안내 (2026-09-14 종한 지시 — 스코프 추가)

- **Decision**: consent 변형은 두 체크가 **체크된 상태로 열린다**. 하나라도 해제된 채 확인을 누르면 진행하지 않고 체크 행 아래 고정 슬롯에 `push.consentBothRequired`("두 항목에 모두 동의해야 알림을 켤 수 있어요.")를 표시한다. 둘 다 체크되면 안내 소거. 닫히면 초기값(둘 다 체크)·안내 리셋. 확인 버튼은 항상 활성(탭을 받아야 안내를 낼 수 있음). 슬롯은 항상 렌더 + 불투명도만 전환(P-151 — 유닛 (e)에 메트릭 비교 추가).
- **대체된 것**: KB-497 spec FR-005 "확인은 둘 다 체크 시에만 활성(색만)" → 종한 지시로 교체. 이 기능 spec(003)에는 해당 FR 없음 — 스코프 추가로 tasks T018에 기록.
- **⚠ 리뷰 포인트(법적)**: 광고성 정보 수신 동의를 사전 체크로 받는 것은 정보통신망법·KISA 안내서 계열에서 유효 동의로 보지 않을 소지가 있다(메모리 push-consent-reinstall-legal 조사 맥락). 구현은 지시대로, PR 본문에 명시해 예진·팀 판단으로 넘긴다.
- **Alternatives considered**: 미체크 + 확인 비활성 유지(기존) — 종한이 사용성 사유로 교체 지시. 안내를 Snackbar/TopToast로 — 둘 다 루트 레이어라 Modal 위에 뜨지 않음 → 시트 내부 인라인 슬롯.

## R-14. 동의 확정 후 토글 깜빡임 (2026-09-14 실기 — 스코프 추가)

- **증상**: 동의 시트 확인 → 소식·식사 시간 토글이 켜졌다가 서버 응답으로 다시 꺼짐.
- **원인 2겹**: ① dev Swagger(SSOT)가 KB-544 계약으로 바뀌어 동의 기록은 `news.consent:true` + 버전 2종인데 앱은 `enabled:true` + 버전만 보냈다 → 서버가 동의를 기록하지 않아 응답 `enabled:false`. ② `predictSettings`가 요청에 없는 `mealTime`을 true로 앞서 예측 → 응답 저장값(false)으로 되돌아감.
- **Decision**: 확정 페이로드 = `{ news: { consent: true, privacyConsentVersion, receiveConsentVersion, enabled: true, mealTime: true } }`(종한: 소식 ON 시 식사 시간도 ON. 서버 처리 순서 consent→enabled→mealTime 이라 한 요청 OK). 예측은 요청에 담긴 값만 반영(consent → 동의 2종, enabled, mealTime 각각). 타입 `NotificationSettingsPatch.news.consent` 추가. 유닛: predictSettings 3분기.
- **미확인**: 응답 `news.enabled` 설명이 "동의 2종 유효 여부"라 기기 OFF(`enabled:false`) 후 응답이 어떻게 오는지는 실기로 확인(소식 OFF → 토글이 OFF로 남는지). 어긋나면 BE 세션과 계약 확인.

## R-15. 식사 시간만 OFF → 소식 토글도 잠깐 OFF (2026-09-14 실기 4차)

- **Swagger 확정 의미**: 응답 `news.enabled` = **이 기기 소식 토글 저장값**(동의와 결합 안 함). 동의 상태는 `privacyConsent`·`receiveConsent`로 읽는다. 따라서 R-14의 "소식 OFF 응답 의미" 미확인은 해소 — OFF는 OFF로 온다.
- **원인(추정 → 유닛 재현)**: 동의 확정 PATCH가 서버에 반영되기 전에 식사 시간 OFF PATCH가 병렬 도착 → 서버가 반영 전 행(전부 false) 기준으로 `enabled:false` 응답 → 그 응답이 seq상 최신이라 캐시를 덮음 → 소식 토글 OFF. 늦게 온 동의 응답은 무시. 화면 재진입(GET)에서 복구되어 "잠깐"으로 보임.
- **Decision**: PATCH를 클라이언트에서 직렬화 — 앞 요청이 settle된 뒤에만 다음 요청 전송(모듈 체인 `sendPatch`, 훅 안팎 공유). 낙관 표시는 즉시, 응답 반영은 seq 규칙 그대로. 실패한 앞 요청은 체인을 막지 않는다.
- **Alternatives considered**: 요청 중 토글 비활성 — 낙관 토글의 즉답성을 잃음. 서버에서 요청 순서 보장 — 클라 병렬 전송이면 서버가 순서를 알 수 없음. 기각.

## R-16. OS 알림 권한 꺼짐 = 저장값 미노출 (2026-09-14 종한 지시 — 스코프 추가)

- **Decision**: 알림 설정 화면에서 OS 권한이 `denied`면 서버 저장 토글·동의 캡션을 렌더하지 않고 기존 배너("기기 설정에서 알림이 꺼져 있어요" + "기기 설정 열기")만 보인다. 권한 판정 전(`permission === null`)엔 스켈레톤만 — 값이 잠깐 보였다 숨겨지는 깜빡임 방지. 권한 재판정은 기존 AppState active 리스너 그대로(설정에서 켜고 돌아오면 토글 노출).
- **Rationale**: 기기가 알림을 받지 못하는 상태에서 "소식 ON·동의 완료"가 보이면 실제 수신과 어긋난 표시. 서버 값은 그대로(정본 무변), 표시만 게이트. 문구는 기존 키 재사용 — 신규 i18n 0.
- **Alternatives considered**: 토글은 보이되 비활성 — 여전히 저장 동의 내역이 노출됨. 기각(지시).

## R-17. Codex 독립 리뷰 반영 (2026-09-14, PR #150 — Important 4·Minor 1)

| # | 지적 | 조치 |
|---|------|------|
| 1 | PATCH 큐 대기 중 로그아웃·계정 전환 → 다른 계정 자격으로 전송·이전 계정 값 캐시 재시딩 | 큐 진입 시 세션 세대(`currentGen`) 캡처, 전송 직전·응답/롤백 반영 시 세대 불일치면 폐기(`StaleSessionError`). 유닛 |
| 2 | open=false 뒤 퇴장 180ms 동안 Modal이 남아 확인 탭 가능 + 닫힘 직후 체크 리셋값(둘 다 true)으로 제출될 수 있음 | 체크·안내 리셋을 **열릴 때**로 이동, 루트 `pointerEvents={open ? 'auto' : 'none'}`로 퇴장 중 전 조작 차단. 유닛(지연 퇴장 목으로 중간 상태 검증) |
| 3 | `closingRef`가 "진행 중"과 "완료"를 구분 못 해 퇴장 중 백버튼/스크림 → Modal이 애니메이션 중간에 사라짐, 외부 dismiss 중복 호출 가능 | 훅 상태를 idle/closing/closed 3상으로, closing 중 외부 onDone은 큐에 모아 완료 시 1회씩, closed 뒤는 즉시. 재오픈은 큐 폐기. 유닛(지연 완료·취소) |
| 4 | 미충족 확인 탭 안내가 iOS VoiceOver에 전달되지 않음(liveRegion은 Android 전용) | `AccessibilityInfo.announceForAccessibility` 호출 + 비표시 시 `accessibilityElementsHidden`/`importantForAccessibility`로 트리 제외(슬롯 유지). 유닛 |
| 5(Minor) | withTiming 동기 완료 목이 퇴장 중 상태·중복·재오픈 타이밍을 못 봄 | 훅·시트 유닛에 `mockImplementationOnce` 지연 완료 도입(위 2·3 케이스) |

기각/보류: "Modal fade는 시트도 페이드" — 사실이며 주석 정정(실기 승인된 모션). "Pan에 `activeOffsetY` 명시" — 실기에서 탭 씹힘 미관찰, 재현 시 추가. `enabled`를 동의 결합값으로 적은 훅 헤더 주석 — Swagger대로 정정.

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

# SKILL.md의 웹 코드 → 이 레포(RN+Expo) 번역 노트 (2026-07-21, 커맨드 센터)

SKILL.md는 원칙은 그대로 따르되 **코드는 웹(CSS·Pointer Events·Framer Motion) 기준**이다.
이 레포에선 아래로 치환한다 (reanimated 4.3 + gesture-handler 2.31 — 이미 설치됨):

| SKILL.md (웹) | 이 레포 (RN) |
|---|---|
| Framer Motion `animate(..., {type:'spring', bounce, duration})` | `withSpring(target, {damping, stiffness})` — reanimated. Apple의 damping ratio·response와 개념 동일 |
| `:active` press 피드백 | `Pressable` + `onPressIn`에서 즉시 scale 0.97 (`onPress` 대기 금지) — 기존 `Btn.tsx` 확인 후 공통화 |
| Pointer Events + `setPointerCapture` | `react-native-gesture-handler` `Gesture.Pan()` — velocity는 이벤트에 내장(`velocityX/Y`) |
| CSS transition 금지(제스처 경로) | `Animated.timing` 대신 `withSpring` — 인터럽트 시 현재값에서 자연 재출발 |
| `prefers-reduced-motion` | `AccessibilityInfo.isReduceMotionEnabled()` + reanimated `ReducedMotionConfig` |
| 2D를 X/Y 독립 스프링으로 | shared value 2개(x, y) 각각 `withSpring` |

**기본값 (Apple 실측치 그대로):**
- 대부분 UI: 오버슈트 없는 critically damped — reanimated로는 `withSpring(v, {damping: 20+, stiffness: ~180})` 계열, 튀지 않게
- 바운스는 **사용자 모멘텀이 있던 제스처의 릴리스에만** (플릭·드래그 놓기) — 그냥 나타나는 메뉴/모달에 바운스 금지
- 시트/드로어: damping비 ~0.8 상당

**이 레포 제약과의 교차:**
- 헌법: 이모지 금지·i18n 가변 길이 — 모션이 텍스트 길이에 의존하지 않게
- JS-only 변경(스프링 파라미터·Pressable 피드백)은 OTA 가능. 새 네이티브 라이브러리 추가는 재빌드 — 지금 스택으로 충분하므로 **추가 금지**

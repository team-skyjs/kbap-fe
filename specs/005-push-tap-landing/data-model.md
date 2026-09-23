# Data Model: 푸시 탭 착지 (KB-573)

서버 데이터 형식은 바뀌지 않는다(FR-007). 앱이 소유하는 두 개념만 정리한다.

## 1. 알림 유형 → 착지 매핑 (`routeForNotificationData`, 순수 함수)

| `data.type` | 착지 href | 비고 |
|-------------|-----------|------|
| `MEAL_TIME` | `'/(tabs)'` (홈 탭) | 9/16 결정. 이전 = 이동 없음 |
| `HELPFUL` | `'/profile/reviews'` (내 리뷰 목록) | 9/16 결정. 리뷰 id 미제공 → 상세 불가 |
| `SCAN_SUGGESTION` | `'/(tabs)'` (홈 탭) | 9/16 확정(clarify). 식사 시간과 동일 |
| `REVIEW_REMINDER` + `foodId` | `` `/food/${foodId}` `` | 기존 유지 |
| `REVIEW_REMINDER` (foodId 없음) | `null` | 기존 유지 |
| `NEWS` | `null` | 기존 유지(알림함 열람용) |
| 그 외(미지·구 이름·대소문자·공백) | `null` | 기존 유지(정확 일치만) |

- 입력: `unknown`(서버 payload 그대로). 출력: `string | null`.
- `'/push-landing?type=…'`는 더 이상 산출되지 않는다(제거 대상).
- 콜백 2번째 인자(`notificationId`) 계약은 무변(specs/002 §3).

## 2. 착지 이동 의도 (`openNotificationRoute(router, href)`, `src/lib/nav.ts`)

| href | 동작 | 이유 |
|------|------|------|
| `'/(tabs)'` | `canDismiss() → dismissAll()` 후 `navigate('/(tabs)')` | 루트 스택 리셋 + 홈 탭 점프. 뒤로 가기 대상 없음, 중복 (tabs) 0 (research R-2, clarify Q2) |
| 그 외 문자열 | `navigate(href)` | 현재 최상단과 같은 화면이면 재사용, 아니면 push (research R-3) |
| `null` | 호출하지 않음(호출부 `if (href)` 가드 유지) | 이동 없는 유형 |

## 3. 탭 진입 경로

| 경로 | 소스 | 착지 시점 |
|------|------|-----------|
| 백그라운드 탭 | `addNotificationResponseReceivedListener` | 즉시 |
| 콜드 스타트 탭 | `getLastNotificationResponseAsync` | **`entryChecked` 이후**(리스너 등록 자체를 게이트, research R-4) |

두 경로 모두 어댑터 `emit` → `routeForNotificationData` → 호출부 → `openNotificationRoute`. 같은 identifier는 `routed` Set이 1회로 접는다.

## 4. 제거되는 표면

- 라우트 `push-landing` (`src/app/push-landing.tsx`)
- i18n 키 `push.landingTbdTitle`, `push.landingTbdBody` × 10로케일

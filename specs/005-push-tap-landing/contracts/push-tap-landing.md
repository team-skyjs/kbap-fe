# Contract: 푸시 탭 착지 (KB-573)

앱 내부 계약. 서버→앱 data 계약은 specs/002 `contracts/push-notification-data.md`가 정본이며, 그 §2 표의 착지 열을 아래로 갱신한다.

## 1. `routeForNotificationData(data: unknown): string | null` — `src/lib/push/pushAdapter.ts`

| 입력 `data` | 반환 |
|-------------|------|
| `{type:'MEAL_TIME'}` | `'/(tabs)'` |
| `{type:'HELPFUL'}` | `'/profile/reviews'` |
| `{type:'SCAN_SUGGESTION'}` | `'/(tabs)'` |
| `{type:'REVIEW_REMINDER', foodId:7}` / `foodId:'7'` | `'/food/7'` |
| `{type:'REVIEW_REMINDER'}` | `null` |
| `{type:'NEWS'}` | `null` |
| `{type:'NUDGE'}` · `{type:'helpful'}` · `{type:'HELPFUL '}` · `{type:'UNKNOWN_FUTURE'}` · `undefined` · `{}` | `null` |

불변: 반환값에 `push-landing`이 포함되지 않는다. `notificationId`는 반환에 영향 없음.

## 2. `openNotificationRoute(router, href: string): void` — `src/lib/nav.ts` (신규)

- `href === '/(tabs)'`(MEAL_TIME·SCAN_SUGGESTION): `router.canDismiss()`가 true면 `router.dismissAll()`(try/catch — `resetToOnboarding`과 동일 방어), 이어서 `router.navigate('/(tabs)')`.
- 그 외: `router.navigate(href)`.
- `null`은 받지 않는다 — 호출부가 `if (href)`로 거른다(기존 1줄 가드 유지).

## 3. 호출부 (2곳, 둘 다 `router.push(href)` → `openNotificationRoute(router, href)`)

- `src/app/_layout.tsx` 푸시 배선 effect: 게이트 `if (!FLAGS.pushEnabled || !entryChecked) return;`, deps `[router, entryChecked]`. 그 외 effect 본문(언어 변경 재등록·해제)은 무변.
- `src/app/notifications.tsx` `open(n)`: `markInboxRead` 뒤 헬퍼 호출. 무변 그 외.

## 4. 제거 표면

- `src/app/push-landing.tsx` 삭제(라우트 소멸). expo-router 파일 기반이라 등록 해제 별도 없음.
- 10로케일 `push.landingTbdTitle`·`push.landingTbdBody` 삭제. `push.*` 다른 키 무변.

## 5. 테스트 계약

- `pushAdapter192`: 매핑 7+케이스(§1 표 전부 — SCAN_SUGGESTION도 `'/(tabs)'`) · 구독 테스트 기대값 `'/profile/reviews'` · `(null, 4)`였던 MEAL_TIME 케이스 → `('/(tabs)', 4)`.
- `nav` 헬퍼 유닛(신규, `src/lib/__tests__/nav573.test.ts` 또는 기존 nav 테스트 확장): 홈 = dismissAll→navigate 순서(canDismiss false면 dismissAll 미호출) · 그 외 = navigate 1회, push 0회.
- 잠금: 10로케일 `push.landingTbd*` 부재 · 어댑터 소스 `push-landing` 문자열 0 · `src/app/push-landing.tsx` 부재.
- `_layout` 게이트: 기존 레이아웃 테스트가 없으므로 유닛 대신 quickstart 실기 D-3·D-4로 검증(콜드 스타트는 jest로 재현 불가).

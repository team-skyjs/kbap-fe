# Quickstart: 푸시 탭 착지 검증 (KB-573)

## 사전 조건

- 브랜치 `feat/kb573-push-landing`(spec 디렉터리 `005-push-tap-landing`), `npm ci` 완료.
- 실기: dev BE(`dev.kbap.site`) 연결 development 빌드, 회원 로그인 + 푸시 권한 허용. 테스트 발송은 Expo Push Tool(https://expo.dev/notifications)에 기기 토큰 + `data` JSON.

## 1. 정적·유닛 (SC-001 · SC-003 · SC-004)

```bash
npx tsc --noEmit
npx jest src/lib/push src/lib/i18n src/lib/__tests__ 2>&1 | tail -5
npx jest 2>&1 | tail -5
```

기대: tsc 오류 0, 전체 통과. 매핑 유닛은 [contracts/push-tap-landing.md](./contracts/push-tap-landing.md) §1 표 전 행 포함.

```bash
grep -rn "push-landing\|landingTbd" src | grep -v __tests__ ; ls src/app/push-landing.tsx 2>&1
```

기대: grep 0건(테스트의 부재 단언 제외), `ls`는 "No such file".

## 2. 실기 시나리오 (SC-002) — iOS·Android 각각

발송 `data` 예: `{"type":"MEAL_TIME","notificationId":1}` · `{"type":"HELPFUL","notificationId":2}` · `{"type":"SCAN_SUGGESTION","notificationId":3}` · `{"type":"REVIEW_REMINDER","foodId":7}`.

| # | Given | When | Then |
|---|-------|------|------|
| D-1 | 앱 백그라운드, 프로필 탭 → 내 리뷰 화면 진입 상태 | MEAL_TIME 탭 | 홈 탭. 뒤로 가기 대상 없음(스택 리셋) |
| D-2 | 앱 백그라운드, 홈 탭 | MEAL_TIME 탭 | 홈 그대로, 화면 전환 애니메이션 없음(중복 0) |
| D-3 | 앱 완전 종료(스와이프 킬) | MEAL_TIME 탭 | 스플래시 → 홈 탭. 크래시·Sentry 이벤트 0 |
| D-4 | 앱 완전 종료 | HELPFUL 탭 | 스플래시 → 내 리뷰 목록, 뒤로 = 홈 |
| D-5 | 앱 백그라운드, 회원 | HELPFUL 두 건 연속 탭 | 내 리뷰 목록 1장(뒤로 1회면 이전 화면) |
| D-6 | 음식 상세 `/food/A` 열린 상태 | REVIEW_REMINDER(foodId B) 탭 | 상세가 B로 갱신(새 화면 쌓이지 않음), 내용·스크롤 정상 |
| D-7 | 로그아웃(게스트) 상태, 알림 센터에 HELPFUL 잔존 | 탭 | 내 리뷰 화면의 로그인 유도 시트(AuthGateSheet) |
| D-8 | 앱 백그라운드, 음식 상세 열린 상태 | SCAN_SUGGESTION 탭 | 홈 탭, 뒤로 가기 대상 없음(D-1과 동일) |
| D-9 | 앱 백그라운드 | NEWS 탭 / `{"type":"NUDGE"}` 탭 | 앱만 열림, 이동 없음 |
| D-10 | 알림함 화면(`notificationCenter` 플래그 on) | MEAL_TIME 항목 탭 | 알림함이 닫히고 홈 탭 |

D-3·D-4가 콜드 스타트 게이트(research R-4)의 유일한 검증 수단이다 — 반드시 양 플랫폼.

## 3. 문서 대조 (FR-009)

- `specs/002-push-data-contract/spec.md` 개요·AS·FR-002와 `contracts/push-notification-data.md` §2 표에 `push-landing` 0건, 착지가 [data-model.md](./data-model.md) §1과 일치.

## 4. 배포 메모

JS 전용(네이티브·config plugin 무변)이라 OTA 가능. 발행은 예진 승인 후, 메모리 규칙(production OTA 금지·명시 지시 없이 `eas update` 금지) 준수.

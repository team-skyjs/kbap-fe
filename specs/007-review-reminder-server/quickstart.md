# Quickstart — 007 리뷰 리마인더 서버 전환 검증

## 0. 전제

- 브랜치 `feat/kb500-review-reminder-server`(origin/develop 기준 워크트리).
- dev Swagger `NotificationResponse`에 `orderId`가 올라왔는지 확인(`curl -s https://dev.kbap.site/v3/api-docs | jq '.components.schemas.NotificationResponse.properties | keys'`). 없으면 §2의 알림함 실기는 "검증 불가"로 기재.
- 리마인더 실기는 dev 서버 배치(주문 저장 60~65분 후) 또는 관리자 테스트 발송 `{"type":"REVIEW_REMINDER","orderId":<내 주문 id>,"notificationId":1}`.

## 1. 정적·유닛

```bash
npx tsc --noEmit
npx jest src/lib/push src/lib/api src/lib/data/__tests__/useNotifications499.test.tsx src/app/__tests__/inbox499.test.tsx src/features/push src/lib/data/__tests__/orderHistory252.test.ts src/app/__tests__/modalSerialize267.test.tsx src/app/__tests__/reviewEditCompose521.test.tsx
npx jest   # 전체
grep -rn 'scheduleReviewReminder\|cancelReviewReminder\|REVIEW_REMINDER_SECONDS\|reviewReminderTitle' src   # 0건
```

기대: tsc 0 · 전체 통과 · grep 0건. 매핑 6행·삭제 잠금·어댑터 변환은 contracts §1·§4·§5.

## 2. 실기 (iOS·Android 각 1대, dev BE)

| # | 상태 | 동작 | 기대 |
|---|------|------|------|
| D-1 | 앱 백그라운드, 홈 | 리마인더(orderId=A) 탭 | 주문 A 상세, 뒤로 가기 → 홈 |
| D-2 | 앱 종료 | 리마인더 탭 | 스플래시 후 주문 A 상세 |
| D-3 | 주문 A 상세 열림 | 리마인더(orderId=B) 탭 | 상세가 B로 갱신, 화면 1장 |
| D-4 | 아무 상태 | orderId 없는 리마인더 탭(테스트 발송) | 앱만 켜짐, 이동 없음 |
| D-5 | 알림함 | 리마인더 항목 탭 | 읽음 + 주문 상세. 다른 유형 항목은 기존 착지 |
| D-6 | 로그아웃 상태 | 리마인더 탭 | 주문 상세의 기존 오류/로그인 표면, 크래시 없음 |
| D-7 | 주문 완료 흐름 완주 후 | iOS 설정 > 알림 예약 확인 불가 → 대신 1시간 대기 또는 `npx expo run` 콘솔에서 `getAllScheduledNotificationsAsync` 확인 | 로컬 리마인더 0건 |
| D-8 | Android | 리마인더 도착 | 채널 = 활동 알림(activity), 새 채널 없음 |

## 3. 문서

specs/002·004·005의 리마인더 행이 `orderId`·주문 상세로 바뀌었는지 grep: `grep -rn "food/{foodId}\|foodId" specs/002-push-data-contract specs/004-inbox-server specs/005-push-tap-landing` 결과에 "REVIEW_REMINDER + foodId" 착지 서술이 남아 있지 않아야 한다.

## 4. 열린 항목

- 릴리스 일정 BE 회신(서버 배치 prod 활성화 동기) — PR 본문에 명기, 종한 전달.

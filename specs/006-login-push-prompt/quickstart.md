# Quickstart: spec 006 · KB-631 검증

계약은 [contracts/login-push-prompt.md](./contracts/login-push-prompt.md), 상태는 [data-model.md](./data-model.md).

## 1. 정적·유닛 (완료 기준: tsc 0 · jest 전체 통과)

```bash
npx tsc --noEmit
npx jest src/lib/push src/app/__tests__/loginPushPrompt631.test.tsx src/features/push
npx jest   # 전체
```

기대: 신규 `loginPrompt631`·`loginPushPrompt631` 전부 통과, `pushProdGuard221` 확장 케이스 통과, 기존 `pushSurfaces192`·`notificationSheet497`·`sourceLock497` 무변 통과.

## 2. 실기 (iOS 필수 · Android 확인) — 발행 전 게이트

전제: teamtest 빌드(develop) 또는 Metro dev 빌드. 기기에서 K-Bap **삭제** 후 시작.

| # | 시나리오 | 기대 |
|---|---|---|
| D-1 | 삭제 → 설치 → 실행 | 스플래시 뒤 로그인 화면 위에 OS 알림 팝업 즉시. 팝업이 스플래시 페이드와 겹쳐도 거슬리지 않음(R-5) |
| D-2 | D-1에서 **허용** | 팝업 닫힘, 로그인 화면 그대로. 기기 설정 앱 > K-Bap > 알림 = 허용 |
| D-3 | D-2 후 소셜 로그인 | 서버에 이 기기 토큰 행 생성(dev DB `notification_token` 또는 BE 로그) + `GET /api/notifications/settings` activity=true(R-4) |
| D-4 | 삭제 → 설치 → **거부** | 기기 설정 앱에 알림 항목 "꺼짐". 로그인 후 알림 설정 화면에 "기기 설정 열기" 배너, 토큰 요청 0 |
| D-5 | D-2 또는 D-4 후 첫 스캔 결과 | 알림 안내 시트 0회 |
| D-6 | 팝업 떠 있는 채 소셜 로그인 버튼 탭 | 팝업 먼저 처리, 이후 로그인 정상 |
| D-7 | 게스트 진입 → 게이트(북마크 등) → 로그인 화면 | 팝업 0회 |
| D-8 | 삭제 후 재설치(OS가 이전 결정 기억) | 팝업 0회, 로그인 후 D-3 동일(허용 기억 시) |
| D-9 | 팝업 도중 홈 버튼 → 복귀 | 결과 1회만 처리(계측 `push_permission` 1건) |
| D-10 | 계정 A 로그인(activity 끔) → 로그아웃 → 계정 B 로그인 | B 로그인 후 activity 그대로 false(표식 소진, PATCH 0) |
| D-11 | D-2 허용 → 로그인 → 알림 설정 탭에서 소식 토글 ON(동의 시트 확인) | 서버 news.enabled=true 저장 + 이 기기 토큰 등록 상태 → 테스트 발송 시 실제 수신(R-8) |
| D-12 | D-4 거부 → 로그인 → 알림 설정 탭 | 배너 + 토글 흐림·조작 불가 → OS 설정에서 켜고 복귀 → 토글 살아남 + 토큰 등록 → 소식 토글 ON 후 실제 수신 |

## 3. 발행 게이트

- JS 전용(네이티브·config plugin 무변) — OTA 가능. **production OTA는 명시 지시 없이 금지**(memory: no-production-ota). 발행 전 fingerprint 대조·`git log` 동승 확인은 CLAUDE.md 절차.
- D-1~D-5 실기 확인 전 OTA 게이트 커밋으로 취급.

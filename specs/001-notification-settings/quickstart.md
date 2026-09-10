# Quickstart: 검증 가이드 (KB-497)

## 전제
- `git branch --show-current` = `feat/kb497-notification-settings`
- dev BE 연결(`EXPO_PUBLIC_BE_BASE` = dev). BE "회원 전용 + 회원×기기" 수정 배포 여부는 §4 실측 전 확인.
- 회원 계정 1개(온보딩 미완료 신규 1 + 기존 1), 실기기 2대(기기별 독립 검증용).

## 1. 정적 게이트
```bash
npx tsc --noEmit
npx jest
```
기대: tsc 0 오류, jest 전체 통과. 신규·갱신 테스트 —
- `src/lib/data/__tests__/useNotificationSettings497.test.tsx`: GET 캐시 · 낙관 반영 → 응답 교체 · 실패 롤백 · 연타 seq · 훅 밖 patch seq 공유 · 버전 헤더 · clear
- `src/app/profile/__tests__/notificationSettings497.test.tsx`: 스켈레톤/재시도 · 스위치 3 · 캡션(최근 일시·수신 버전) · 소식 OFF→ON = 시트(mutate 0) · 둘 체크 확인 = enabled:true+버전 2종 · 소식 ON→OFF = enabled:false · 식사 시간 = mealTime 토글/비활성 · 게스트 AuthGateSheet · OS 배너·AppState · AsyncStorage 0
- `src/app/profile/__tests__/notificationSettingsMetrics497.test.tsx`: P-151 Switch·비활성 행·캡션 유무 메트릭
- `src/features/push/__tests__/notificationSheet497.test.tsx`: primer/consent · 확인 비활성 조건 · 전문 링크 · 나중에/스크림 · 제출 가드 · 체크박스 메트릭 · 닫힘 시 pending 폐기
- `src/features/push/__tests__/pushSurfaces192.test.tsx`(갱신): 프라이머 시트 순서(기록→OS→토큰→PATCH) · 거절 · 게스트 PATCH 0 · denied · 온보딩 프라이머 0 · scan 직렬화 소스 잠금
- `src/features/push/__tests__/sourceLock497.test.ts`: 로컬 설정·guestConsent 참조 0 · 언어 변경 재등록 배선
- `src/lib/push/__tests__/tokenGuard543.test.ts` + `pushAdapter192.test.ts`(갱신): 세션 없음 PUT 0 · 본문 {token,platform,lang} · 401 비치명 · 리마인더 activity 캐시 게이트
- `src/lib/auth/__tests__/loginTokenRegister543.test.tsx`: 로그인 성공 → 등록 1회 · cancelled 0회
- `src/lib/i18n/__tests__/notifKeys497.test.ts`: 10로케일 notif/push 키 집합 일치 · 구 키 0
- `src/app/__tests__/guestProfile311.test.ts`(갱신): 게스트 진입점 없음 · 라우트 AuthGateSheet

## 2. 실기 — 신규 회원 흐름 (US4·US1·US2)
1. 앱 삭제 후 설치 → 온보딩 완료 → 홈 진입.
   기대: 홈 위에 동의 표면(푸시 안내 + 소식 동의 체크 2 + 전문 링크).
2. 체크 2개 → "알림 켜기" → OS 팝업 허용.
   기대: 표면 닫힘. 프로필 > 알림 설정: 활동 푸시 ON, 동의 2 체크, 식사 시간 ON.
3. 식사 시간 OFF → 동의 하나 해제.
   기대: 두 체크 해제 + 식사 시간 OFF·흐림. 다시 두 체크 → 소식 ON, 식사 시간 = 서버 복원값(OFF).
4. 비행기 모드 → 활동 푸시 토글.
   기대: 스위치 즉시 반전 후 원복 + "저장하지 못했어요" 배너.
5. 앱 재시작 → 홈.
   기대: 동의 표면 재노출 없음.

## 3. 실기 — 스캔 프라이머 유지 (US6)
1. 신규 설치 후 게스트로 첫 스캔 완료(코치마크 닫은 뒤).
   기대: "리뷰 알림 받아보실래요?" 프라이머 노출. 수락 → OS 팝업 → 서버 설정 요청 없음(게스트).
2. 홈 표면을 이미 본 회원이 첫 스캔.
   기대: 프라이머 미노출.

## 4. 실기 — 기기별 독립 (US1 시나리오 2) — BE 수정 배포 후
1. 기기 A에서 활동 푸시 ON.
2. 기기 B 같은 계정 로그인 → 알림 설정.
   기대: 전부 OFF. (BE 미배포 상태면 A 값이 보인다 — 계약 §Dependencies.)

## 5. 실기 — 게스트·OS 권한 (US3·US5)
- 게스트 프로필 탭: 알림 설정 행 없음. 딥링크 `kbap://profile/notifications`: 로그인 시트만.
- OS 설정에서 알림 OFF → 화면 상단 배너 → 탭 → 시스템 설정 → ON → 복귀 시 배너 사라짐.

## 6. 토큰 언어
- 앱 언어 변경(시스템 설정) → 복귀. dev 서버 로그/DB에서 해당 installation의 `lang` 갱신 확인.

## 산출 확인
- `git log` 대조: 네이티브 소스 변경 0(fingerprint 회전 없음 — OTA 가능).
- PR: `feat(push): 알림 설정 2그룹 재편 + 서버 정본화`, 본문 `Jira: KB-497`. PROGRESS.md 갱신.

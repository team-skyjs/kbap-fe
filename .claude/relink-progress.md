# 실연결 진행 메모 (KB-67/68/69/74/75)
갱신: 2026-07-13 14:35

> 재개 시(새 세션/컴팩션 후): 이 파일부터 읽고 이어서. Jira와 어긋나면 이 파일이 우선(그리고 Jira를 맞춰).
> 착수 직전·완료 직후 갱신 + 작업 커밋에 포함.

| 단계 | 상태 | 커밋 | 메모 |
|---|---|---|---|
| KB-67 인증 | 코드완료(검토중) | 84653db | beTokens+beAuth+client 401 재시도, 교환→newMember 분기, logout/withdraw 실연결. 실기기 검증은 예진(KB-109 재빌드 선행) |
| KB-75 온보딩 제출 | 코드완료(검토중) | (다음 커밋) | 스텁→실호출, 스킵=[], 재제출 4xx는 완료 간주, 맵기는 AsyncStorage(kbap.profile.spice.v1) 로컬 보관 |
| KB-68 프로필 | 진행중 | - | 화면별 PATCH 필드 엄격 분리 |
| KB-69 홈 | 대기 | - | 3섹션 + authenticated=false 블러. 로컬 스캔 이력 계획 폐기 |
| KB-74 랭킹 | 대기 | - | 디테일 화면 실연결, nextTier null 경계 |

## 결정사항 (이어받는 세션이 알아야 할 것)
- 인증 하이브리드: Firebase 로그인 → `POST /auth/login {idToken}` → BE access/refresh 토큰. **모든 API 헤더 = BE accessToken** (Firebase ID토큰 부착 구조는 제거).
- 토큰 저장: expo-secure-store, 키 `kbap.auth.access.v1` / `kbap.auth.refresh.v1` + 메모리 캐시.
- 401 → `POST /auth/refresh` rotation(두 토큰 모두 재저장, 구 refresh 재사용 금지), **mutex로 동시 401에 refresh 1회만**, 원요청 1회 재시도. refresh 실패 = 토큰 삭제 + 세션만료 이벤트 → /login.
- 모듈 경계: `beAuth.ts`는 RNFB 임포트 금지(웹 번들 안전) — Firebase signOut 등 네이티브 몫은 화면에서 Platform 가드 lazy require(session.ts).
- newMember=true → /onboarding, false → /(tabs). SocialAuthButtons onSignedIn(newMember) 시그니처.
- BE 개발용 test-token: dropbox/jh/test-token.html (시크릿은 DM — 이 세션은 미보유).

## 미해결/질문
- **맵기(spice)**: 온보딩/프로필 계약에 필드 없음 → 로컬 저장만 유지, BE 질의 대기 (KB-75/68 티켓에 기록됨).
- **UNSET vs 빈 배열**: 계약상 스킵=빈 배열로 전송(회의 확정). FE 내부 UNSET 구분은 draft에만 유지.
- foods 3종 AUTH→인증-선택 전환 요청 중(guest-access-policy) — 이번 묶음에서 건드리지 않음.
- 실기기 검증(소셜 로그인→교환)은 예진 몫 — KB-109 재빌드 선행 필요.

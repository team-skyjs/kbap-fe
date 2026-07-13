# 실연결 진행 메모 (KB-67/68/69/74/75)
갱신: 2026-07-13 15:50 — 묶음 완료

> 재개 시(새 세션/컴팩션 후): 이 파일부터 읽고 이어서. Jira와 어긋나면 이 파일이 우선(그리고 Jira를 맞춰).
> 착수 직전·완료 직후 갱신 + 작업 커밋에 포함.

| 단계 | 상태 | 커밋 | 메모 |
|---|---|---|---|
| KB-67 인증 | 코드완료(검토중) | 84653db | beTokens+beAuth+client 401 재시도, 교환→newMember 분기, logout/withdraw 실연결. 실기기 검증은 예진(KB-109 재빌드 선행) |
| KB-75 온보딩 제출 | 코드완료(검토중) | f154912+수정 | 스텁→실호출, 스킵=[]. 검토 수정: 4xx→서버 onboardingCompleted 확인해 true만 완료 간주(검증 400 삼킴 방지), 실패 시 화면 유지+에러 표시, 회귀 테스트 5건 |
| KB-68 프로필 | 코드완료(검토중) | 69d9a65 | memberAdapter+useMe/useUpdateMe 실연결(세션 있을 때만, 게스트=mock). PATCH는 제공 필드만. 배너 재유도=서버 플래그 우선. 인증 경계 queryClient.clear(). ⚠️ Unit 응답 가드 완화(client) |
| KB-69 홈 | 코드완료(검토중) | d357a05 | GET /home 실연결, 게스트=인사·유도카드·배너숨김(웹 검증). 지역화 성분명 배너, 사진 렌더 |
| KB-74 랭킹 | 대기 | - | 디테일 화면 실연결, nextTier null 경계 |

## 결정사항 (이어받는 세션이 알아야 할 것)
- 인증 하이브리드: Firebase 로그인 → `POST /auth/login {idToken}` → BE access/refresh 토큰. **모든 API 헤더 = BE accessToken** (Firebase ID토큰 부착 구조는 제거).
- 토큰 저장: expo-secure-store, 키 `kbap.auth.access.v1` / `kbap.auth.refresh.v1` + 메모리 캐시.
- 401 → `POST /auth/refresh` rotation(두 토큰 모두 재저장, 구 refresh 재사용 금지), **mutex로 동시 401에 refresh 1회만**, 원요청 1회 재시도. refresh 실패 = 토큰 삭제 + 세션만료 이벤트 → /login.
- 모듈 경계: `beAuth.ts`는 RNFB 임포트 금지(웹 번들 안전) — Firebase signOut 등 네이티브 몫은 화면에서 Platform 가드 lazy require(session.ts).
- newMember=true → /onboarding, false → /(tabs). SocialAuthButtons onSignedIn(newMember) 시그니처.
- BE 개발용 test-token: dropbox/jh/test-token.html (시크릿은 DM — 이 세션은 미보유).

## 미해결/질문
- **성분 코드 정합(KB-75 버그, 7/13 수정)**: 내부 카탈로그를 BE 정본 81종(UPPER_SNAKE)으로 재키잉. 와이어 경계(온보딩 제출·프로필 PATCH)에 toBeCode 변환 — 레거시 ing:slug는 넓은 카테고리 매핑(과회피=안전) 또는 드롭+로그. 신규 항목 ~30종 번역은 영어 fallback(KB-125 목록에 추가).
- **맵기(spice)**: 온보딩/프로필 계약에 필드 없음 → 로컬 저장만 유지, BE 질의 대기 (KB-75/68 티켓에 기록됨).
- **UNSET vs 빈 배열**: 계약상 스킵=빈 배열로 전송(회의 확정). FE 내부 UNSET 구분은 draft에만 유지.
- foods 3종 AUTH→인증-선택 전환 요청 중(guest-access-policy) — 이번 묶음에서 건드리지 않음.
- 실기기 검증(소셜 로그인→교환)은 예진 몫 — KB-109 재빌드 선행 필요.

## 남은 실기기 검증 (예진 — KB-109 dev 재빌드 선행)
- KB-67: 로그인→교환→인증 API / 401 rotation / 만료 강제 로그아웃
- KB-67 후속: 만료 access 토큰으로 공개 API(foods/home) 호출 → refresh 후 정상 응답 / 비행기모드에서 refresh 실패해도 로그아웃 안 됨(토큰 보존)
- KB-75: 제출→onboardingCompleted=true, 스킵=빈 배열
- KB-68: 수정→재조회 일치, 빈배열/미전송 시맨틱
- KB-69: 회원 3섹션(스캔 이력 서버 보관 확인)
- KB-74: 실데이터 + tier 키 일치 여부 (불일치 시 매핑 테이블)

## 실기기 검증 발견 버그 2건 수정 (2026-07-13 저녁)
- 온보딩 제출 후 stale 캐시: staleTime 60s 동안 제출 전 fetch된 빈 개인화 데이터가 홈에 표시 → 제출 성공 시 queryClient.clear() 추가
- 미완료 회원 재로그인 시 온보딩 스킵: newMember=false만 보고 홈 직행 → 로그인 후 onboardingCompleted 확인해 false면 /onboarding (판별 실패는 홈+resume 모달 안전망)

## KB-67 후속 — BE JWT 가이드 대조 (2026-07-13)
- 수정 2건: ① 공개 인증 3종(login/refresh/logout)에 Authorization 미부착(만료 access가 붙으면 refresh 영구 실패 경로) ② refresh 실패 판별 — 401만 로그아웃, 네트워크/5xx는 토큰 보존
- 일치 2건: ③ logout body refreshToken 포함 ④ 공개 API 401→refresh 인터셉터(전 경로)
- 회귀 테스트 4건 (beAuth.test.ts)

## 게이팅 세트 (KB-77/78/84) — 2026-07-13 착수
정책 SSOT = dropbox/yj/guest-access-policy.md §1 매트릭스. 원칙: 게스트에 개인화 위험도 절대 미표시(UNKNOWN도 X), 잠금=블러 고스트+CTA→게이트 시트→로그인→맥락 복귀.

| 조각 | 상태 | 메모 |
|---|---|---|
| useSession 훅 (게스트 판별) | 완료 | useQuery(['auth','session'], hasBeSession) — 인증 경계 queryClient.clear()로 자동 갱신. FLAGS.guestMode 기본 ON |
| KB-77 AuthGateSheet | 완료 | context prop(risk/reviews/writeReview/scan/profile)→카피 분기, CTA→/login?returnTo=, 나중에/닫기 |
| login returnTo | 완료 | 기존회원 replace(returnTo ?? /(tabs)) |
| KB-78 목록/검색 뱃지 | 완료 | 게스트=뱃지 미렌더(자리 비움) |
| KB-78 상세 잠금 | 완료(락카드+중립 재료+시트) | verdict=락카드(블러+CTA), 재료행 중립(위험 pill·문구 숨김, 이름+% 공개), 저장/북마크 게이트 |
| KB-78 스캔 게이트 | 완료 | 게스트 카메라/샘플 탭→시트 (§3-Q1 제안) |
| KB-78 프로필/랭킹 | 완료(프로필 탭 가입 유도 화면; 랭킹은 프로필 경유) | 탭 진입=가입 유도 화면 |
| KB-78 헤더 Sign in pill | 완료 | StickyHeader에 게스트 pill |
| KB-84 리뷰 잠금 | 완료(요약 공개·리스트 고스트+lock-pop·쓰기 게이트) — reviews.tsx에 import는 됨. 할 것: isGuest면 요약(있으면)만 표시+리스트를 blurred ghost(opacity 0.35, pointerEvents none)로 렌더+중앙 lock CTA 카드(IconLock+lock.reviewsLocked+intro.signUp 버튼)→AuthGateSheet(context reviews). 리뷰쓰기 버튼→시트(context writeReview) | 요약 공개, 본문 리스트 블러+lock CTA→시트 (mock 위 UI, KB-73 때 재사용) |
| 401 게스트 정숙 처리 | 완료(목록/검색 빈 페이지; 상세는 기존 에러UI=크래시 아님) | foods 3종 BE 전환(7/14 예정) 전: 게스트 401→빈/잠금, 크래시 금지 |
| i18n gate/lock 키 ×9 | 완료(gate 10키+lock 4키, 패리티 미실행 — 커밋 전 확인) | |

### 게이팅 완료 (2026-07-13) — 웹 게스트 검증: 홈 pill·상세 락카드→시트·중립 재료·리뷰 lock-pop 전부 확인. 실기기: 로그인↔로그아웃 전환 시 잠금 즉시 해제 확인 필요(세션 쿼리). 게스트 실데이터 상세/목록은 BE foods 인증-선택 전환(7/14) 후 소생.

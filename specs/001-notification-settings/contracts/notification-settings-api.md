# Contract: 알림 설정·토큰 API (dev Swagger 실측 2026-09-11 + BE 수정 가정)

정본 = https://dev.kbap.site/swagger-ui/index.html. 아래는 FE가 의존하는 부분만.

## 공통 헤더 (api client가 전 요청에 자동 부착)
- `X-API-Version`(필수), `X-Installation-Id`(앱 설치 UUID), `X-OS-Version`, `X-App-Version`, `Authorization: Bearer`(회원)

## GET /api/notifications/settings
- 회원 전용(게스트 401). **가정(BE 수정 예정)**: `X-Installation-Id` 기준 회원×기기 설정을 돌려준다. 설정 없으면 전부 false/null.
- 200 `payload`:
```json
{ "activity": false,
  "news": { "enabled": false, "mealTime": false, "privacyConsent": null, "receiveConsent": null } }
```
- `privacyConsent`/`receiveConsent`: `{ "version": 1, "grantedAt": "2026-09-07T12:00:00" }` 또는 null.

## PATCH /api/notifications/settings
- 보낸 필드만 반영. 처리 순서 `activity → news.enabled → news.mealTime`. 응답 = GET과 같은 전체 설정.
- 요청 스키마:
```json
{ "activity": true,
  "news": { "enabled": true, "mealTime": true, "privacyConsentVersion": 1, "receiveConsentVersion": 1 } }
```
- 규칙(서버 검증 — FE는 이 조합을 만들지 않되 거부 응답은 롤백으로 처리):
  - `news.enabled:true` → 두 `*ConsentVersion` 필수(400 COMMON-002). 하위 토글 전부 켬(같은 요청의 `mealTime:false`는 뒤에 반영).
  - `news.enabled:false` → 두 동의 철회, mealTime 응답 false.
  - `news.mealTime:true` + 소식 꺼짐 → 400 `NOTIFICATION-001`.
- **가정(BE 수정 예정)**: `X-Installation-Id`가 설정·동의의 키(현행은 선택·기록용).

## PUT /api/notifications/tokens (X-API-Version 1.1+)
- 본문 `{ "token": "ExponentPushToken[...]", "platform": "ios|android", "lang": "ko" }` — FE 현행 그대로. `lang` = `apiLang()`(BE 허용 10코드로 클램프).
- `settings`(게스트 동의) 필드는 FE가 보내지 않는다. BE "회원 전용" 수정 후 폐기 예상.
- 호출 시점: **로그인(세션 교환) 성공 직후** · 앱 시작(세션 있을 때) · 언어 변경 · 권한 획득 직후 · 설정 화면 AppState active. 권한 미허용 **또는 회원 세션 없음**이면 스킵. 실패(401 포함)는 무시(비치명).
- 응답(KB-543): 200 등록·갱신(payload 없음, 멱등) · 400 `X-Installation-Id` 누락/공백/36자 초과·본문 검증(COMMON-002) · 401 Authorization 없음/위조/만료 · 404 `X-API-Version: 1.0`.
- 출처: kbap-server#260 (`kb-543-member-only-notification`), `specs/kb-543-member-only-notification/contracts/notification-token.md`.
- **KB-544(확정 2026-09-11)**: 토글은 (회원, 기기) 단위 · 동의 원장은 회원 단위. 요청·응답 스키마는 **현행 그대로**(위 GET/PATCH). 의미: `activity`·`news.mealTime` = 이 기기(X-Installation-Id) 저장값 / `news.enabled` = 계산값(이 기기 news 저장값 AND 회원 열린 동의 2종) / `privacyConsent`·`receiveConsent` = 회원 단위. `enabled:true` = 두 버전 필수(회원 동의 grant + 이 기기 news on) · `enabled:false` = 이 기기만 off(회원 전 기기 off 시 원장 동의 닫힘) · `mealTime:true` = 이 기기 news on + 회원 열린 동의 필요(아니면 NOTIFICATION-001). `X-Installation-Id` 필수(누락·공백·36자 초과 → 400 COMMON-002). **기본값 전부 false**(설정 행 없는 기기 포함). `X-API-Version` 새 매핑 값은 KB-544 착수 시 확정(앱 릴리스 번호 규약) — FE는 엔드포인트 한정 헤더 상수 1곳으로 둔다. KB-544 적용 전 dev는 회원 단위 레거시.

## 에러 처리 (FE)
| 상황 | 처리 |
|---|---|
| GET 실패/타임아웃 | 스위치 미렌더 + 재시도 배너(탭 = refetch) |
| PATCH 4xx/5xx/타임아웃 | 캐시 롤백 + `notif.saveFailed` 배너 |
| 401(세션 만료) | 위와 동일. 재로그인 후 화면 재진입 시 refetch |

## FE 상수 (계약 아님 — 클라 소유)
- `PRIVACY_CONSENT_VERSION = 1`, `RECEIVE_CONSENT_VERSION = 1` — 문구 개정 시 증가(1~65535).
- 전문 URL: `LEGAL_URLS.marketingPrivacy` / `marketingReceive` (kbap-legal 정적 페이지, 생성 요청 필요).

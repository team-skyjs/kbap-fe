# Data Model: 알림 설정 (KB-497)

## 1. NotificationSettings (서버 정본 — react-query 캐시 `['notifSettings']`)

| 필드 | 타입 | 출처 | 비고 |
|---|---|---|---|
| activity | boolean | 서버 | 활동 푸시(리뷰 도움됨·리뷰 리마인더). 기본 false |
| news.enabled | boolean | 서버(계산) | 두 동의가 모두 유효한지. 저장값 아님 |
| news.mealTime | boolean | 서버 | enabled=false면 항상 false |
| news.privacyConsent | `{version:int, grantedAt:ISO}` \| null | 서버 | 마케팅 목적 개인정보 수집·이용 동의 최신 열린 1건 |
| news.receiveConsent | `{version:int, grantedAt:ISO}` \| null | 서버 | 광고성 정보 수신 동의 최신 열린 1건 |

- 단위(KB-544 확정): `activity`·`news.mealTime`은 회원 × 기기(`X-Installation-Id` 필수) 저장값, `news.enabled`는 계산값(이 기기 news 저장값 AND 회원 열린 동의 2종), `privacyConsent`·`receiveConsent`는 회원 단위. 스키마·필드명 변경 없음. 기본값 전부 false. 새 `X-API-Version` 매핑 값은 상수 1곳(`NOTIF_SETTINGS_API_VERSION`)으로 두고 KB-544 착수 시 채운다.
- 클라는 응답을 그대로 표시한다. 파생값(enabled·mealTime 가시 상태)을 클라에서 재계산하지 않는다.
- 로컬 저장 금지. 화면 로컬 상태는 캐시 미러(낙관)뿐.

### 화면 표시 규칙(파생, 렌더 전용)
- 활동 푸시 스위치 = `activity`.
- 동의 체크 2개 = `privacyConsent != null`, `receiveConsent != null`. (`enabled`가 true면 둘 다 non-null.)
- 소식 알림 스위치 = `news.enabled`. 식사 시간 스위치 = `news.mealTime`, 비활성(opacity·탭 무동작) = `!news.enabled`.

## 2. PATCH 요청 (부분 수정 — 보낸 필드만 반영)

| 사용자 조작 | 요청 본문 |
|---|---|
| 활동 푸시 토글 | `{activity: !cur.activity}` |
| 소식 알림 토글 OFF→ON | 서버 전송 없음 — 동의 시트 표시(토글 OFF 유지) |
| 시트에서 두 동의 체크 + 확인 | `{news:{enabled:true, privacyConsentVersion:PV, receiveConsentVersion:RV}}` → 응답으로 소식·식사 시간 ON |
| 시트에서 하나만 체크 / 나중에 | 서버 전송 없음, 시트 닫힘 시 pending 체크 폐기 |
| 소식 알림 토글 ON→OFF | `{news:{enabled:false}}` — 이 기기 소식 OFF(원장 철회는 서버: 회원 전 기기 OFF 시) |
| 식사 시간 토글(소식 ON일 때만) | `{news:{mealTime: !cur.mealTime}}` |
| 식사 시간 토글(소식 OFF) | 비활성 — 탭 무동작 |
| 홈 표면 확인(권한 granted, 두 체크) | `{activity:true, news:{enabled:true, PV, RV}}` (하나의 요청) |
| 홈 표면 확인(granted, 체크 미완) | `{activity:true}` |
| 홈/스캔 프라이머 수락(denied) + 체크 미완 | 요청 없음 |

- PV/RV = `consent.ts`의 `PRIVACY_CONSENT_VERSION`, `RECEIVE_CONSENT_VERSION` (정수 상수, 문구 개정 시 증가).
- "첫째 동의만 체크" 상태는 서버에 없다(둘 다 필수). 화면 로컬 `pendingConsent` 상태로만 존재하고, 화면 이탈·refetch 시 사라진다.

## 3. 낙관 갱신 상태기계 (훅 내부)

```
idle ──toggle──▶ optimistic(cache = predicted, seq=n) ──PATCH ok(seq==latest)──▶ idle(cache = 서버 응답)
                       │                                └─PATCH ok(seq<latest)──▶ 무시(최신이 덮어씀)
                       └──PATCH fail──▶ rollback(cache = 스냅샷) + saveFailed 배너 → idle
```

- predicted: activity/mealTime 토글은 값 반전. news.enabled true 예측 = `{enabled:true, mealTime:true, consents:{version, grantedAt:now}}`, enabled false 예측 = `{enabled:false, mealTime:false}`(consents는 유지 — 회원 단위)(응답으로 교체).
- 401/세션 만료: 실패로 취급(롤백 + 배너). 재로그인 후 refetch.

## 4. 기기 로컬 (AsyncStorage) — 잔존 항목만

| 키 | 의미 | 상태 |
|---|---|---|
| `kbap.push.prompted.v1` | 프라이머(홈·스캔·구 온보딩) 노출 결과 `accepted\|declined` | 유지 — 홈·스캔 표면 공유 |
| `kbap.push.reminders.v1` | 로컬 리뷰 리마인더 예약 맵 | 유지(KB-500에서 폐기) |
| `kbap.push.settings.v1` | 구 3토글 | **삭제(코드 제거, 읽지 않음)** |
| `kbap.guestNotif.v1.<installationId>` | 구 게스트 동의 | **삭제(코드 제거, 읽지 않음)** |

## 5. 메모리 핸드오프

- `pushAdapter.requestHomeConsent()` / `consumeHomeConsent(): boolean` — 온보딩 제출 성공 → 홈 첫 렌더 1회. 프로세스 수명.

## 6. 동의 문구 버전 (`src/lib/push/consent.ts`)

```
PRIVACY_CONSENT_VERSION = 1
RECEIVE_CONSENT_VERSION = 1
consentUrl(kind: 'privacy'|'receive') → LEGAL_URLS.marketingPrivacy | marketingReceive
```

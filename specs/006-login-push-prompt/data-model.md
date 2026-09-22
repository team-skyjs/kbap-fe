# Data Model: spec 006 · KB-631

전부 기기 로컬(AsyncStorage) 또는 OS 상태. 서버 스키마 무변. 자세한 근거는 [research.md](./research.md).

## 엔티티

| 엔티티 | 저장 | 값 | 쓰는 곳 | 읽는 곳 |
|---|---|---|---|---|
| 알림 안내 응답 기록 | `kbap.push.prompted.v1` (기존) | `accepted` · `declined` · 없음 | 로그인 팝업 헬퍼(신규) · 프라이머 시트(기존) | 로그인 팝업 헬퍼(FR-002) · `scan.tsx maybeShowPrimer`(FR-003) |
| 활동 알림 기본값 대기 표식 | `kbap.push.activityDefaultPending.v1` (신규) | `'1'` · 없음 | 로그인 팝업 헬퍼 — OS 결과 `granted`일 때만 | `applyPendingActivityDefault()` — 로그인 성공 직후 1회 소비(삭제) |
| 첫 설치 판별 | `kbap.installed.v1` (기존 센티널) → 라우트 파라미터 `entry=intro` | fresh=true → `/login?entry=intro` | `_layout.tsx` | `login.tsx` 마운트 effect |
| OS 알림 권한 상태 | OS | `granted` · `denied` · `undetermined` · `unavailable`(모듈 없음/예외) | OS | 헬퍼 `getPermissionStatus()` |

## 상태 전이 — 로그인 팝업 헬퍼

```
[entry=intro && !returnTo] ──▶ 플래그 off / 모듈 없음 ──▶ 종료(기록 0)
        │
        ▼
 응답 기록 있음 ──▶ 종료(요청 0)
        │ 없음
        ▼
 OS 상태 조회
   unavailable ──▶ 종료(기록 0 — 스캔 시트·설정 배너로 이월)
   granted     ──▶ 기록 accepted + 대기 표식
   denied      ──▶ 기록 declined
   undetermined ─▶ requestPermission()(OS 팝업 · push_permission 계측) ─▶ 상태 재조회
                      granted → 기록 accepted + 대기 표식
                      denied  → 기록 declined
                      그 외   → 기록 0(예외 = 결과 아님)
```

## 상태 전이 — 대기 표식

```
없음 ──(로그인 팝업 granted)──▶ '1' ──(로그인 성공: PATCH activity:true 시도, 성공/실패 불문)──▶ 없음
                                 └──(재설치: AsyncStorage 초기화)──▶ 없음
```

## 불변식

- 로그인 화면(게스트)에서는 서버 요청 0 — 헬퍼는 토큰 등록·PATCH를 호출하지 않는다(FR-004).
- 응답 기록은 OS가 결정을 낸 경우(`granted`/`denied`)에만 쓴다. 예외·모듈 없음은 기록하지 않는다(Edge "예외 → 다음 기회").
- 대기 표식은 한 번 소비되면 재생성되지 않는다(응답 기록이 있으면 헬퍼가 재진입하지 않으므로). 계정 전환·재로그인에서 사용자가 끈 activity를 되돌리지 않는다.
- 기존 키 의미 변경 없음 — 프라이머 시트의 `accepted`/`declined` 해석 그대로.

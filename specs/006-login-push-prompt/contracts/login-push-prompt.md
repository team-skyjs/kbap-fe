# Contract: 로그인 화면 OS 알림 권한 즉시 요청 (spec 006 · KB-631)

## 1. 어댑터 API (`src/lib/push/pushAdapter.ts`, 유일 관문 유지)

```ts
/** 첫 설치 로그인 화면 마운트 시 1회. 서버 요청 0. 결과는 프라이머 기록 + (granted) 대기 표식. */
export function promptPermissionOnFirstLogin(): Promise<void>;

/** 로그인 성공 직후(회원 세션 확정 뒤) 호출. 대기 표식 있을 때만 PATCH {activity:true} 1회 후 표식 삭제. 비치명. */
export function applyPendingActivityDefault(): Promise<void>;
```

| 조건 | `promptPermissionOnFirstLogin` 동작 | 기록 | 계측 |
|---|---|---|---|
| `FLAGS.pushEnabled=false` 또는 모듈 없음 | 즉시 반환 | 0 | 0 |
| 프라이머 기록 존재 | 즉시 반환 | 0 | 0 |
| OS `unavailable` | 반환 | 0 | 0 |
| OS `granted`(기억) | 요청 0 | `accepted` + 표식 | 0 |
| OS `denied`(기억) | 요청 0 | `declined` | 0 |
| OS `undetermined` → 허용 | `requestPermission()` 1회 | `accepted` + 표식 | `push_permission{state:grant}`(기존) |
| OS `undetermined` → 거부 | `requestPermission()` 1회 | `declined` | `push_permission{state:deny}`(기존) |
| 요청 예외(재조회 `undetermined`/`unavailable`) | — | 0 | 0 |
| 동시 재호출 | 진행 중 프로미스 반환 | 1회분 | 1회분 |

| 조건 | `applyPendingActivityDefault` 동작 |
|---|---|
| 플래그 off / 모듈 없음 / 표식 없음 / 세션 없음 | no-op, PATCH 0 |
| 표식 있음 + 세션 | `patchNotificationSettings({activity:true})` 1회 → 표식 삭제(성공·실패 불문) |

## 2. 호출부 배선

| 파일 | 변경 | 잠금 문자열(소스 유닛) |
|---|---|---|
| `src/app/login.tsx` | 마운트 effect: `if (entry === 'intro' && returnTo == null) void promptPermissionOnFirstLogin();` | `entry === 'intro' && returnTo == null` |
| `src/lib/auth/useSocialAuth.ts` `exchange()` | `registerPushToken()` 옆: `if (!exch.cancelled) { void registerPushToken(); void applyPendingActivityDefault(); }` | `void applyPendingActivityDefault();` |
| `src/app/_layout.tsx` | 무변 (`router.replace('/login?entry=intro' as Href)` 그대로) | 기존 |
| `src/app/scan.tsx` · `PushPrimerModal.tsx` · `profile/notifications.tsx` | 동작 무변(주석만) | pushSurfaces192 기존 잠금 유지 |

## 3. 저장 키

| 키 | 신규 | 값 |
|---|---|---|
| `kbap.push.prompted.v1` | 기존 | `accepted` · `declined` |
| `kbap.push.activityDefaultPending.v1` | 신규 | `'1'` |

클린업 목록(`clearMemberLocal`·`clearTokens`·KB-152 계열)에 넣지 않는다 — 기기 사실이며 회원 데이터가 아니다.

## 4. 서버 계약(무변)

- `PUT /api/notifications/tokens` — 기존 `registerPushToken` 경로(로그인 성공 직후, KB-543).
- `PATCH /api/notifications/settings {activity:true}` — 기존 `patchNotificationSettings`(seq 보호). X-Installation-Id 헤더는 클라이언트 공통.

## 5. 테스트 계약

| 스위트 | 케이스 |
|---|---|
| `src/lib/push/__tests__/loginPrompt631.test.ts`(신규) | §1 표 9행 + in-flight 합치기 + 생애주기 2(재설치 = 스토리지 초기화 후 재요청 1 · 계정 전환 = 표식 소진 후 두 번째 로그인 PATCH 0) |
| `src/app/__tests__/loginPushPrompt631.test.tsx`(신규, loginCollageMarquee 목 재사용) | `entry=intro` → 헬퍼 1 · `entry=intro&returnTo=/x` → 0 · 파라미터 없음 → 0 · 소셜 버튼 렌더 유지 |
| `src/lib/push/__tests__/pushProdGuard221.test.ts`(확장) | 플래그 off: 두 헬퍼 모두 모듈 미접근·AsyncStorage 기록 0·PATCH 0 |
| 소스 잠금(loginPrompt631 안) | login.tsx 조건 문자열 · useSocialAuth 배선 문자열 · `_layout.tsx` `entry=intro` replace 유지 · `scan.tsx` `getPrimerResult` 게이트 유지 |

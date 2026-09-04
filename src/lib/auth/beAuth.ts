/**
 * auth/beAuth.ts — BE 세션 레이어 (KB-67, 하이브리드 인증).
 *
 *   Firebase 소셜 로그인 성공 → exchangeLogin(firebase idToken)
 *     → POST /auth/login → { accessToken, refreshToken, newMember }
 *   이후 모든 API 헤더 = BE accessToken (client.ts 프로바이더로 주입)
 *   401 → tryRefresh(): POST /auth/refresh — rotation(토큰 2종 재저장),
 *   MUTEX로 동시 401에도 refresh는 한 번만. 실패 = 세션 만료 →
 *   토큰 삭제 + onSessionExpired 구독자(루트 레이아웃)가 /login으로.
 *
 * ⚠️ RNFB 임포트 금지 (웹 번들 안전) — Firebase signOut 등 네이티브 몫은
 * 화면 쪽에서 Platform 가드 lazy require(session.ts)로 처리한다.
 */
import { api, ApiError, setAuthTokenProvider, setOnUnauthorized } from '@/lib/api/client';
import { queryClient } from '@/lib/queryClient';
import { bumpSessionGen, clearTokens, currentGen, loadTokens, revertTokensIf, saveTokens } from './beTokens';
import { initSessionState, setSessionState } from './useSession';

/** 인증 경계(로그인/로그아웃/탈퇴/만료)에서 서버 데이터 캐시를 통째로 비운다 —
 *  게스트 mock과 회원 실데이터가 섞이는 것을 원천 차단.
 *  P-112: 경계 직후 세션 판별(['auth','session'])은 재조회(비동기 스토리지
 *  재확인)에 맡기지 않고 **즉시 시드** — 그 사이 hasSession=undefined로
 *  게스트/회원 UI가 반대 상태로 스치던 지연(로그아웃 직후 커뮤니티 탭) 제거. */
function resetServerCache(sessionAfter: boolean): void {
  queryClient.clear();
  // P-205: 세션은 쿼리가 아니라 동기 스토어 — clear()로 엔트리·옵저버 연결이
  // 끊겨도 무관하게 구독 화면에 즉시 전파(구 setQueryData 시딩은 고착 원인).
  setSessionState(sessionAfter);
}

interface LoginResponseWire {
  newMember: boolean;
  accessToken: string;
  refreshToken: string;
}
interface TokenResponseWire {
  accessToken: string;
  refreshToken: string;
}

/* ---- 세션 만료 알림 (구독: 루트 레이아웃 → /login) ---- */
let expiredHandler: (() => void) | null = null;
export function onSessionExpired(handler: (() => void) | null) {
  expiredHandler = handler;
}

async function sessionExpired(): Promise<void> {
  await endSessionBoundary(); // KB-421: 로컬 정리+세대 증가(단일 경계 구현)
  expiredHandler?.();
}

/** Firebase idToken → BE 토큰 교환. 성공 시 저장, newMember 반환.
 *  KB-421(Codex #19 P1-4): 교환도 세대 가드 — pending 중 게스트 진입(경계)이
 *  끼면 응답을 폐기(cancelled)해 회원 복귀를 막는다. 이로써 saveTokens의 전
 *  호출자(doRefresh·exchangeLogin)가 "경계 이후 도착 결과 무효" 원칙 아래. */
export async function exchangeLogin(idToken: string): Promise<{ newMember: boolean; cancelled?: boolean }> {
  const gen = currentGen(); // 출발 세대 캡처(조기 폐기용 — 최종 방어는 싱크)
  const r = await api.post<LoginResponseWire>('/auth/login', { idToken });
  if (gen !== currentGen()) return { newMember: r.newMember, cancelled: true }; // 저장 자체 생략
  if (!(await saveTokens(r.accessToken, r.refreshToken))) {
    return { newMember: r.newMember, cancelled: true }; // 쓰기 중 경계 — 싱크가 되돌림, 커밋 생략
  }
  // Codex #19 P1-7/8: 커밋 지점 최종 재검증 — 저장 통과 후 ~ 세션 점등 전 경계가
  // 오면 **자기 저장분만** 회수(소유자 범위 undo — 교체 로그인 B 보존) 후 취소.
  // 세션을 켜는 유일한 커밋 지점이 여기라 이 검사가 최종 방어.
  if (gen !== currentGen()) {
    await revertTokensIf(r.accessToken, r.refreshToken);
    return { newMember: r.newMember, cancelled: true };
  }
  resetServerCache(true);
  console.log('[auth] BE token exchange ok | newMember =', r.newMember);
  return { newMember: r.newMember };
}

/** 세션 끝 경계 — **유일한 경계 구현**(Codex #19: 로그아웃/만료/freshInstall
 *  전부 이 헬퍼). 순서 고정: ① 세대 bump(동기 — 싱크 saveTokens가 이후 도착
 *  쓰기를 자가 되돌림) ② clearTokens(cached=null 동기 선행) ③ 세션 false·캐시
 *  clear ④ 뮤텍스 소유권 해제(자기확인은 tryRefresh 몫). 서버 폐기는 호출측
 *  best-effort. 세대의 정본은 beTokens(저장소 싱크) — 최종 라운드 구조. */
export async function endSessionBoundary(): Promise<void> {
  bumpSessionGen(); // ① 이전 출발분 무효 — 싱크가 최종 방어
  refreshing = null;
  const done = clearTokens(); // cached=null 동기 선행
  resetServerCache(false);
  await done;
}

/* ---- refresh rotation (mutex: 동시 401 다발에도 한 번만) ---- */
let refreshing: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    // Codex #19 P1-2b: finally는 **자기 프라미스일 때만** 해제 — 경계가 뮤텍스를
    // 비운 뒤 설치된 새 refresh(B)를 낡은 A의 정리가 지우면 동시 refresh(회전
    // 토큰 재사용 충돌)가 열린다.
    const p: Promise<boolean> = doRefresh().finally(() => {
      if (refreshing === p) refreshing = null;
    });
    refreshing = p;
  }
  return refreshing;
}

async function doRefresh(): Promise<boolean> {
  const t = await loadTokens();
  if (!t) return false; // 로그인한 적 없음 — 만료 이벤트도 불필요
  const gen = currentGen(); // KB-421: 출발 세대 캡처(조기 폐기 — 최종 방어는 싱크)
  try {
    const r = await api.post<TokenResponseWire>('/auth/refresh', { refreshToken: t.refresh });
    if (gen !== currentGen()) return false; // 경계 개입 — 결과 폐기(세션 재부활 금지)
    // 이중 방어(withdraw처럼 경계가 뒤에 오는 흐름): 경계가 토큰을 비웠으면
    // 세대와 무관하게 회전 결과도 폐기 — cached=null은 경계의 동기 첫 동작.
    if ((await loadTokens()) == null) return false;
    if (!(await saveTokens(r.accessToken, r.refreshToken))) return false; // 쓰기 중 경계 — 싱크 되돌림
    // P1-8: 저장 resolve ~ 반환 사이 경계 — 성공 보고 금지(재시도가 로그아웃된
    // 세션 토큰으로 나가는 것 방지). 토큰 자체는 경계의 clearTokens가 지운다.
    if (gen !== currentGen()) return false;
    console.log('[auth] token refreshed (rotation)');
    return true;
  } catch (e) {
    if (gen !== currentGen()) return false; // 이미 끝난 세션 — 만료 처리도 생략
    // BE JWT 가이드: refresh 401 = refresh 만료/무효 → 이때만 로그아웃.
    // 네트워크/5xx는 일시 장애 — 토큰을 지우면 지하철에서 앱 열었다고
    // 로그아웃되는 꼴이다 → 토큰 보존, 원요청 에러 표면화(다음 시도에 재도전).
    const status = e instanceof ApiError ? e.status : undefined;
    if (status === 401) {
      console.log('[auth] refresh token expired/invalid → session expired');
      await sessionExpired();
    } else {
      console.log('[auth] refresh transient failure — tokens preserved:', (e as Error)?.message);
    }
    return false;
  }
}

/** KB-421(Codex #19 P1): **로컬-우선 로그아웃 — 유일한 로그아웃 구현.**
 *  ① 서버 폐기용 refresh 캡처 ② 경계(endSessionBoundary — 토큰·세션·캐시·세대
 *  동기 무효) await ③ 서버 /auth/logout은 best-effort 백그라운드(실패 무시).
 *  서버를 먼저 기다리면 그 창에서 시작한 refresh가 세션을 재부활시킨다(P1-3). */
export async function logoutLocalFirst(): Promise<void> {
  const t = await loadTokens(); // 서버 폐기용 — 정리 전에 확보(로컬 읽기)
  await endSessionBoundary();
  if (t) void api.post('/auth/logout', { refreshToken: t.refresh }).catch(() => {});
}

/** 로그아웃(프로필 등) — 구현은 logoutLocalFirst 하나로 통일(Codex #19 P1-3).
 *  Firebase signOut은 호출측(native). */
export async function logoutBe(): Promise<void> {
  return logoutLocalFirst();
}

/** 탈퇴: PATCH /auth/withdraw → 경계. ⚠️ 서버 호출이 **인증 토큰을 요구**하므로
 *  여기만 서버-선행 유지(토큰을 먼저 지우면 탈퇴 자체가 401로 실패) — 그 창에서
 *  출발/도착하는 refresh는 finally 경계의 세대 증가 + doRefresh의 무토큰 재확인
 *  이중 가드로 폐기된다(재부활 불가). */
export async function withdrawBe(): Promise<void> {
  try {
    await api.patch('/auth/withdraw');
  } finally {
    await endSessionBoundary();
  }
}

/** BE 세션 존재 여부(동기 판단용은 loadTokens 사용). */
export async function hasBeSession(): Promise<boolean> {
  return (await loadTokens()) != null;
}

/**
 * client.ts에 BE 토큰 배선 설치 — 앱 시작 시 1회(루트 레이아웃).
 * KB-109의 Firebase ID토큰 부착 구조를 이걸로 교체한다.
 */
/** P-257(종한 요청): 401 분기 정책 — 이 한 곳.
 *  서버 ErrorCode 정본: AUTH-003(무효 access)·AUTH-004(만료 access)·
 *  AUTH-005(무효 refresh)·AUTH-006(만료 refresh) — 전부 401.
 *  - AUTH-004만 refresh 가치 → tryRefresh(mutex·rotation 현행).
 *  - 003/005/006 = 위조·무효 — refresh 왕복 없이 즉시 세션 만료.
 *  - 기타 401(COMMUNITY-005 로그인 필요 등) = 무반응(기존 에러 흐름 — 게이트는 화면 몫).
 *  - code null(비JSON 401 — 프록시 등) = 현행 refresh 1회 폴백(fail-safe:
 *    진짜 만료였는데 body가 깨진 경우 세션 유실 방지). */
async function handleUnauthorized(code: string | null): Promise<boolean> {
  if (code === 'AUTH-004' || code == null) return tryRefresh();
  if (code === 'AUTH-003' || code === 'AUTH-005' || code === 'AUTH-006') {
    // P-260 🔴: 게스트(저장 토큰 없음)의 무토큰 401도 AUTH-003으로 온다 —
    // 지울 세션이 없으므로 sessionExpired(= queryClient.clear) 생략(doRefresh의
    // `if (!t) return false` 철학 동일). 안 그러면 게스트 화면의 인증 쿼리 401이
    // 전 캐시를 소거해 배경이 로딩으로 리셋된다(예진 실기 회귀).
    if ((await loadTokens()) != null) await sessionExpired();
    return false;
  }
  return false;
}

export function installBeAuth(): void {
  setAuthTokenProvider(async () => (await loadTokens())?.access ?? null);
  setOnUnauthorized(handleUnauthorized); // true 반환 시 client가 원요청 1회 재시도
  // KB-421(P-205 사고): 구 모듈 스코프 부팅 선읽기는 제거 —
  // freshInstall 정리와 경합해 지운 세션을 회원으로 선고착시켰다. 부팅 초기화는
  // 루트 레이아웃이 cleanup 완료 **이후** initSessionFromStorage()로 직렬 호출.
}

/** KB-421: 부팅 세션 초기화 — cleanup 직렬화 이후에만 호출할 것(_layout). */
export function initSessionFromStorage(): Promise<void> {
  return hasBeSession().then(initSessionState);
}

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
import { clearTokens, loadTokens, saveTokens } from './beTokens';
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
  await clearTokens();
  resetServerCache(false);
  expiredHandler?.();
}

/** Firebase idToken → BE 토큰 교환. 성공 시 저장, newMember 반환. */
export async function exchangeLogin(idToken: string): Promise<{ newMember: boolean }> {
  const r = await api.post<LoginResponseWire>('/auth/login', { idToken });
  await saveTokens(r.accessToken, r.refreshToken);
  resetServerCache(true);
  console.log('[auth] BE token exchange ok | newMember =', r.newMember);
  return { newMember: r.newMember };
}

/* ---- refresh rotation (mutex: 동시 401 다발에도 한 번만) ---- */
let refreshing: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function doRefresh(): Promise<boolean> {
  const t = await loadTokens();
  if (!t) return false; // 로그인한 적 없음 — 만료 이벤트도 불필요
  try {
    const r = await api.post<TokenResponseWire>('/auth/refresh', { refreshToken: t.refresh });
    await saveTokens(r.accessToken, r.refreshToken); // rotation: 구 refresh 폐기
    console.log('[auth] token refreshed (rotation)');
    return true;
  } catch (e) {
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

/** 로그아웃: BE 세션 폐기(+실패해도 로컬은 정리). Firebase signOut은 호출측(native). */
export async function logoutBe(): Promise<void> {
  const t = await loadTokens();
  if (t) {
    await api.post('/auth/logout', { refreshToken: t.refresh }).catch(() => {});
  }
  await clearTokens();
  resetServerCache(false);
}

/** 탈퇴: PATCH /auth/withdraw. 성공 여부와 무관하게 로컬 세션은 정리한다. */
export async function withdrawBe(): Promise<void> {
  try {
    await api.patch('/auth/withdraw');
  } finally {
    await clearTokens();
    resetServerCache(false);
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
  // P-205: 세션 스토어 부팅 초기화 — 미확정일 때만(경계 선행 시 덮지 않음)
  void hasBeSession().then(initSessionState);
}

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
import { api, setAuthTokenProvider, setOnUnauthorized } from '@/lib/api/client';
import { clearTokens, loadTokens, saveTokens } from './beTokens';

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
  expiredHandler?.();
}

/** Firebase idToken → BE 토큰 교환. 성공 시 저장, newMember 반환. */
export async function exchangeLogin(idToken: string): Promise<{ newMember: boolean }> {
  const r = await api.post<LoginResponseWire>('/auth/login', { idToken });
  await saveTokens(r.accessToken, r.refreshToken);
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
    console.log('[auth] refresh failed → session expired', (e as Error)?.message);
    await sessionExpired(); // refresh 만료 = 강제 로그아웃
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
}

/** 탈퇴: PATCH /auth/withdraw. 성공 여부와 무관하게 로컬 세션은 정리한다. */
export async function withdrawBe(): Promise<void> {
  try {
    await api.patch('/auth/withdraw');
  } finally {
    await clearTokens();
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
export function installBeAuth(): void {
  setAuthTokenProvider(async () => (await loadTokens())?.access ?? null);
  setOnUnauthorized(tryRefresh); // true 반환 시 client가 원요청 1회 재시도
}

/**
 * beAuth refresh 판별 (KB-67 후속 — BE JWT 가이드 대조).
 * refresh 401 = refresh 만료 → 토큰 삭제(로그아웃). 네트워크/5xx = 일시
 * 장애 → 토큰 보존(지하철 시나리오). 그 구분이 깨지는 회귀를 잠근다.
 */
jest.mock('@/lib/queryClient', () => ({ queryClient: { clear: jest.fn(), setQueryData: jest.fn() } }));
jest.mock('@/lib/api/client', () => {
  class MockApiError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError: MockApiError,
    api: { post: jest.fn(), get: jest.fn(), patch: jest.fn() },
    setAuthTokenProvider: jest.fn(),
    setOnUnauthorized: jest.fn(),
  };
});
jest.mock('../beTokens', () => ({
  loadTokens: jest.fn(async () => ({ access: 'A', refresh: 'R' })),
  saveTokens: jest.fn(async () => {}),
  clearTokens: jest.fn(async () => {}),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { api, ApiError, setOnUnauthorized } = require('@/lib/api/client');
const tokens = require('../beTokens');
const beAuth = require('../beAuth') as typeof import('../beAuth');
/* eslint-enable @typescript-eslint/no-require-imports */

// installBeAuth가 등록하는 401 핸들러(P-257: code 분기 — null = refresh 폴백)를 캡처
beAuth.installBeAuth();
const handleUnauthorized: (code?: string | null) => Promise<boolean> = (setOnUnauthorized as jest.Mock).mock.calls[0][0];
const tryRefresh = () => handleUnauthorized(null); // 기존 케이스 = refresh 경로(폴백과 동일)

beforeEach(() => jest.clearAllMocks());

describe('refresh 실패 판별 (BE JWT 가이드)', () => {
  it('refresh 성공 → rotation 저장 + true', async () => {
    api.post.mockResolvedValueOnce({ accessToken: 'A2', refreshToken: 'R2' });
    await expect(tryRefresh()).resolves.toBe(true);
    expect(tokens.saveTokens).toHaveBeenCalledWith('A2', 'R2');
    expect(tokens.clearTokens).not.toHaveBeenCalled();
  });

  it('refresh 401 → 토큰 삭제(강제 로그아웃) + false', async () => {
    api.post.mockRejectedValueOnce(new ApiError('유효하지 않은 갱신 토큰', 401));
    await expect(tryRefresh()).resolves.toBe(false);
    expect(tokens.clearTokens).toHaveBeenCalled();
  });

  it('refresh 네트워크 오류 → 토큰 보존 + false (로그아웃 금지)', async () => {
    api.post.mockRejectedValueOnce(new ApiError('NETWORK: request failed'));
    await expect(tryRefresh()).resolves.toBe(false);
    expect(tokens.clearTokens).not.toHaveBeenCalled();
  });

  it('refresh 5xx → 토큰 보존 + false', async () => {
    api.post.mockRejectedValueOnce(new ApiError('HTTP 503', 503));
    await expect(tryRefresh()).resolves.toBe(false);
    expect(tokens.clearTokens).not.toHaveBeenCalled();
  });
});

/* ---- P-112 → P-205: 인증 경계 = 세션 스토어 동기 전파(구 setQueryData 시딩은
        clear()와의 옵저버 단절로 고착 원인 — sessionPropagation205 재현 잠금) ---- */
describe('P-205: 경계 직후 세션 스토어 전파', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { queryClient } = require('@/lib/queryClient');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sessionStore = require('../useSession') as typeof import('../useSession');

  it('로그아웃 → clear + 세션 false 동기 전파', async () => {
    api.post.mockResolvedValueOnce(undefined); // POST /auth/logout
    await beAuth.logoutBe();
    expect(queryClient.clear).toHaveBeenCalled();
    expect(sessionStore.getSessionState()).toBe(false);
  });

  it('로그인 교환 성공 → 세션 true 동기 전파', async () => {
    api.post.mockResolvedValueOnce({ newMember: false, accessToken: 'A2', refreshToken: 'R2' });
    await beAuth.exchangeLogin('firebase-id-token');
    expect(sessionStore.getSessionState()).toBe(true);
  });

  it('탈퇴 → 세션 false 전파 (요청 실패여도)', async () => {
    api.patch.mockRejectedValueOnce(new ApiError('HTTP 500', 500));
    await expect(beAuth.withdrawBe()).rejects.toBeTruthy();
    expect(tokens.clearTokens).toHaveBeenCalled();
    expect(sessionStore.getSessionState()).toBe(false);
  });
});

describe('P-257: 401 code 분기(종한 요청) — AUTH-004만 refresh', () => {
  it('AUTH-004(만료 access) → refresh 발화(현행 rotation)', async () => {
    api.post.mockResolvedValueOnce({ accessToken: 'A2', refreshToken: 'R2' });
    await expect(handleUnauthorized('AUTH-004')).resolves.toBe(true);
    expect(api.post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'R' });
  });

  it.each(['AUTH-003', 'AUTH-005', 'AUTH-006'])(
    '%s(위조·무효) → refresh 왕복 0 + 즉시 세션 만료(토큰 삭제) + false',
    async (code) => {
      await expect(handleUnauthorized(code)).resolves.toBe(false);
      expect(api.post).not.toHaveBeenCalled(); // refresh 시도 없음
      expect(tokens.clearTokens).toHaveBeenCalled(); // sessionExpired
    },
  );

  // P-260 🔴: 게스트 무토큰 401도 AUTH-003으로 온다 — 지울 세션이 없으므로
  // sessionExpired(= queryClient.clear 전 캐시 소거) 미발동(배경 리셋 회귀 방지)
  it.each(['AUTH-003', 'AUTH-005', 'AUTH-006'])(
    'P-260: 토큰 부재(게스트) + %s → sessionExpired 미호출·clear 미발동·false만',
    async (code) => {
      (tokens.loadTokens as jest.Mock).mockResolvedValueOnce(null);
      await expect(handleUnauthorized(code)).resolves.toBe(false);
      expect(tokens.clearTokens).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      expect(require('@/lib/queryClient').queryClient.clear).not.toHaveBeenCalled();
      expect(api.post).not.toHaveBeenCalled();
    },
  );

  it('P-260: 게스트 blocked 쿼리 미발화 — enabled: !isGuest 소스 잠금', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src = require('fs').readFileSync('src/lib/community/hooks.ts', 'utf8') as string;
    expect(src).toContain('enabled: !isGuest'); // /members/me/blocks 게스트 호출 0
  });

  it('기타 401(COMMUNITY-005 등) → refresh·세션만료 모두 없음(기존 에러 흐름)', async () => {
    await expect(handleUnauthorized('COMMUNITY-005')).resolves.toBe(false);
    expect(api.post).not.toHaveBeenCalled();
    expect(tokens.clearTokens).not.toHaveBeenCalled(); // 게스트 유도는 화면 몫 — 토큰 보존
  });

  it('code null(비JSON 401 — 프록시 등) → 현행 refresh 1회 폴백(fail-safe)', async () => {
    api.post.mockResolvedValueOnce({ accessToken: 'A2', refreshToken: 'R2' });
    await expect(handleUnauthorized(null)).resolves.toBe(true);
    expect(api.post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'R' });
  });

  it('client 배선 — 401 body 선독(1회 read)·code 전달·/auth/* 제외·재시도 1회(무변) 소스 잠금', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src = require('fs').readFileSync('src/lib/api/client.ts', 'utf8') as string;
    expect(src).toContain('await onUnauthorized(authCode)'); // code 전달
    expect(src).toContain("!path.startsWith('/auth/')"); // /auth/* 제외(현행)
    expect(src.split('text = await res.text()').length).toBe(2); // res.text() 1회만(이중 read 금지)
    expect(src).toContain('!isRetry'); // 재시도 1회 한정(현행)
  });
});

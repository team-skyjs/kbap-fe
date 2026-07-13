/**
 * beAuth refresh 판별 (KB-67 후속 — BE JWT 가이드 대조).
 * refresh 401 = refresh 만료 → 토큰 삭제(로그아웃). 네트워크/5xx = 일시
 * 장애 → 토큰 보존(지하철 시나리오). 그 구분이 깨지는 회귀를 잠근다.
 */
jest.mock('@/lib/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
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

// installBeAuth가 등록하는 401 핸들러(=tryRefresh)를 캡처
beAuth.installBeAuth();
const tryRefresh: () => Promise<boolean> = (setOnUnauthorized as jest.Mock).mock.calls[0][0];

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

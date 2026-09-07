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
    setOnMemberMissing: jest.fn(),
    setSessionGenerationProvider: jest.fn(),
  };
});
jest.mock('../beTokens', () => ({
  loadTokens: jest.fn(async () => ({ access: 'A', refresh: 'R' })),
  saveTokens: jest.fn(async () => true), // KB-421: 싱크 가드 — true = 커밋 진행
  clearTokens: jest.fn(async () => {}),
  bumpSessionGen: jest.fn(),
  currentGen: jest.fn(() => 0),
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

describe('KB-441(P-297)·Codex P1-3: MEMBER-003 = 좀비 세션 무효화 — 세대(gen) 스냅샷 판별', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { setOnMemberMissing, setSessionGenerationProvider } = require('@/lib/api/client');
  const handleMemberMissing: (requestGen: number | null) => Promise<void> = (setOnMemberMissing as jest.Mock).mock.calls[0][0];
  // 캡처는 수집 시점(clearAllMocks 전) — installBeAuth의 등록 인자
  const capturedGenProvider = (setSessionGenerationProvider as jest.Mock).mock.calls[0][0];
  /* eslint-enable @typescript-eslint/no-require-imports */

  it('배선: client 세대 프로바이더 = beTokens.currentGen(요청 발행 시 스냅샷)', () => {
    expect(capturedGenProvider).toBe(tokens.currentGen);
  });

  it('refresh 회전 후 도착(gen 동일 — 회전은 세대 불변) → 처리(sessionExpired 1회)', async () => {
    await handleMemberMissing(0); // 목 currentGen = 0
    expect(tokens.clearTokens).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require('@/lib/queryClient').queryClient.clear).toHaveBeenCalledTimes(1);
  });

  it('계정 전환 후 도착(gen 상이 — 경계가 세대 증가) → 무시(새 세션 보존)', async () => {
    (tokens.currentGen as jest.Mock).mockReturnValue(1);
    await handleMemberMissing(0);
    expect(tokens.clearTokens).not.toHaveBeenCalled();
    (tokens.currentGen as jest.Mock).mockReturnValue(0);
  });

  it('동일 gen 동시 2건 → 경계 1회(래치 합침)', async () => {
    await Promise.all([handleMemberMissing(0), handleMemberMissing(0)]);
    expect(tokens.clearTokens).toHaveBeenCalledTimes(1);
  });

  it('게스트(토큰 부재·비회원) → 미발동(P-260 철학) · 프로바이더 부재(null) → 무시', async () => {
    (tokens.loadTokens as jest.Mock).mockResolvedValueOnce(null);
    await handleMemberMissing(0);
    expect(tokens.clearTokens).not.toHaveBeenCalled();
    await handleMemberMissing(null);
    expect(tokens.clearTokens).not.toHaveBeenCalled();
  });

  it('client 배선 소스 잠금 — gen 스냅샷 전달(/auth/* 제외·에러 throw 무변)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src = require('fs').readFileSync('src/lib/api/client.ts', 'utf8') as string;
    expect(src).toContain("json?.code === 'MEMBER-003' && onMemberMissing && !path.startsWith('/auth/')) onMemberMissing(requestGen)");
    expect(src).toContain('let requestGen = sessionGenerationProvider ? sessionGenerationProvider() : null;'); // P1-6: 토큰 로드 앞 캡처 + 1회 재정렬
    expect(src.indexOf("json?.code === 'MEMBER-003'")).toBeLessThan(src.indexOf('throw new ApiError(json?.message'));
  });
});

describe('KB-441 Codex P1-4: 로그인 커밋 = 세션 경계(gen 증가)', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { setOnMemberMissing } = require('@/lib/api/client');
  const handleMemberMissing: (requestGen: number | null) => Promise<void> = (setOnMemberMissing as jest.Mock).mock.calls[0][0];
  /* eslint-enable @typescript-eslint/no-require-imports */

  it('로그인 A 세대의 in-flight → 로그인 B 커밋(gen 증가) → 늦은 MEMBER-003 무시·B 토큰 보존', async () => {
    let gen = 0;
    (tokens.currentGen as jest.Mock).mockImplementation(() => gen);
    // P1-5: 세대 증가는 saveTokens(newSession)가 캐시 공개와 같은 동기 틱에 수행 — 목도 동일 재현
    (tokens.saveTokens as jest.Mock).mockImplementation((_a: string, _r: string, opts?: { newSession?: boolean }) => {
      if (opts?.newSession) gen += 1;
      return Promise.resolve(true);
    });
    try {
      const staleGen = gen; // A 세션에서 발행된 요청의 스냅샷
      api.post.mockResolvedValueOnce({ newMember: false, accessToken: 'B', refreshToken: 'RB' });
      await beAuth.exchangeLogin('firebase-token-B'); // 커밋 시 경계(saveTokens newSession)
      expect(tokens.saveTokens).toHaveBeenCalledWith('B', 'RB', { newSession: true });
      await handleMemberMissing(staleGen); // gen 상이 — 무시
      expect(tokens.clearTokens).not.toHaveBeenCalled(); // B 토큰 보존
    } finally {
      (tokens.currentGen as jest.Mock).mockImplementation(() => 0);
      (tokens.saveTokens as jest.Mock).mockImplementation(async () => true);
    }
  });
});

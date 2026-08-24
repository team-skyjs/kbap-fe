/**
 * P-204: 설치 ID — 최초 생성·재실행 동일값·클린업 생존(소스 잠금)·전 요청 헤더 부착.
 */
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((k: string) => Promise.resolve(mockStore.get(k) ?? null)),
  setItemAsync: jest.fn((k: string, v: string) => {
    mockStore.set(k, v);
    return Promise.resolve();
  }),
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'uuid-fixed-0001') }));

import { getInstallationId, _resetInstallationIdCacheForTest } from '../installationId';

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  _resetInstallationIdCacheForTest();
});

it('최초 실행 = UUID 생성 + SecureStore 저장 · 재실행(캐시 리셋 후) = 동일값 재사용', async () => {
  const first = await getInstallationId();
  expect(first).toBe('uuid-fixed-0001');
  expect(mockStore.get('kbap.installation.id.v1')).toBe('uuid-fixed-0001');
  _resetInstallationIdCacheForTest(); // 앱 재실행 시뮬레이션 — 스토어 유지
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('expo-crypto') as { randomUUID: jest.Mock }).randomUUID.mockReturnValue('uuid-other');
  expect(await getInstallationId()).toBe(first); // 저장분 재사용 — 재생성 0
});

it('SecureStore 불능 = 세션 메모리 폴백(요청은 계속 식별값 보유)', async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ss = require('expo-secure-store') as { getItemAsync: jest.Mock };
  ss.getItemAsync.mockRejectedValue(new Error('keychain unavailable'));
  const a = await getInstallationId();
  const b = await getInstallationId();
  expect(a).toBe(b); // 세션 내 동일
});

it('클린업 생존 소스 잠금 — 탈퇴/로그아웃/재설치 정리 어디에도 설치 ID 키 미등록', () => {
  const fs = require('fs');
  for (const f of ['src/lib/auth/clearMemberLocal.ts', 'src/lib/auth/beTokens.ts', 'src/lib/auth/freshInstall.ts']) {
    expect(fs.readFileSync(f, 'utf8')).not.toContain('kbap.installation.id'); // 지워지면 3회 카운트 무력화
  }
  // 안드 SSAID 보강은 다음 네이티브 빌드 항목 — 주석 존재 잠금
  expect(fs.readFileSync('src/lib/installationId.ts', 'utf8')).toContain('expo-application');
});

it('전 요청 X-Installation-Id 부착(공용 클라 — 채널 무관)', async () => {
  process.env.EXPO_PUBLIC_BE_BASE = 'https://dev-eks.kbap.site';
  jest.resetModules();
  jest.doMock('@/lib/flags', () => ({ FLAGS: {}, isProdChannel: () => false }));
  jest.doMock('@/lib/installationId', () => ({ getInstallationId: jest.fn().mockResolvedValue('uuid-fixed-0001') }));
  const fetchMock = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ success: true, payload: {}, message: null })),
    } as unknown as Response),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { api } = require('@/lib/api/client') as typeof import('@/lib/api/client');
  await api.get('/foods');
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
  expect(init.headers['X-Installation-Id']).toBe('uuid-fixed-0001');
});

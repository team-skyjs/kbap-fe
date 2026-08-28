/**
 * P-199 → P-270(KB-389): 전 채널 신계약 통일 — 버전리스 경로·헤더 3종 전 요청
 * 부착·app-version 예외·storeUrls aos 키. 구 prod 채널 분기(/api/v1·무헤더)는
 * 스토어 앱 전 API 404(iOS 19 심사 거부 2.1a)의 원인으로 제거 — prod 채널
 * 상태에서도 신계약으로 나가는지 이 스위트가 잠근다.
 */
process.env.EXPO_PUBLIC_BE_BASE = 'https://dev.kbap.site';

jest.mock('@/lib/installationId', () => ({ getInstallationId: () => Promise.resolve('test-install-id') })); // P-204: expo-secure-store 로드가 jest에서 fetch 폴리필 오염 — 표면 목
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.1' } } }));

const okEnvelope = () =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ success: true, payload: { ok: 1 }, message: null })),
  } as unknown as Response);

describe('dev 계열(기본 채널)', () => {
  let api: typeof import('../client').api;
  let fetchMock: jest.Mock;
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@/lib/flags', () => ({ FLAGS: {}, isProdChannel: () => false }));
    fetchMock = jest.fn(okEnvelope);
    global.fetch = fetchMock as unknown as typeof fetch;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    api = (require('../client') as typeof import('../client')).api;
  });

  it('상대 경로 = 버전리스(/api) + 헤더 3종 부착 — v1 잔존 0', async () => {
    await api.get('/foods');
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe('https://dev.kbap.site/api/foods'); // /api/v1 소멸
    expect(init.headers['X-API-Version']).toBe('1.0');
    expect(init.headers['X-OS-Version']).toMatch(/^(iOS|AOS) /); // `iOS 18.1` / `AOS 14` 형식
    expect(init.headers['X-App-Version']).toBe('1.0.1');
  });

  it('절대 /api/ 경로(기존 버전리스) = 무변 + 헤더 3종', async () => {
    await api.get('/api/reviews?lang=en');
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe('https://dev.kbap.site/api/reviews?lang=en');
    expect(init.headers['X-API-Version']).toBe('1.0');
  });

  it('app-version = 유일 헤더 예외(3종 미부착) — 무인증 게이트 엔드포인트', async () => {
    await api.get('/api/app-version');
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe('https://dev.kbap.site/api/app-version');
    expect(init.headers['X-API-Version']).toBeUndefined();
    expect(init.headers['X-OS-Version']).toBeUndefined();
    expect(init.headers['X-App-Version']).toBeUndefined();
  });

  it('엔드포인트 한정 헤더(스캔 v2 날짜판)가 기본 X-API-Version을 오버라이드', async () => {
    await api.post('/scans', {}, { headers: { 'X-API-Version': '2026.08.07' } });
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers['X-API-Version']).toBe('2026.08.07');
  });
});

describe('P-270: production 채널 = 신계약 동일(구계약 분기 소멸 — 2.1a 원인 제거)', () => {
  it('prod 채널 상태에서도 버전리스 /api 경로 + 헤더 3종 부착(dev와 동일)', async () => {
    jest.resetModules();
    jest.doMock('@/lib/flags', () => ({ FLAGS: {}, isProdChannel: () => true }));
    const fetchMock = jest.fn(okEnvelope);
    global.fetch = fetchMock as unknown as typeof fetch;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { api } = require('../client') as typeof import('../client');
    await api.get('/foods');
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe('https://dev.kbap.site/api/foods'); // /api/v1 잔존 0
    expect(init.headers['X-API-Version']).toBe('1.0');
    expect(init.headers['X-OS-Version']).toBeDefined();
    expect(init.headers['X-App-Version']).toBe('1.0.1');
  });

  it('소스 잠금 — LEGACY_CONTRACT·API_V1_BASE 실코드 잔존 0(주석 제외)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    const client = fs.readFileSync('src/lib/api/client.ts', 'utf8') as string;
    expect(client).not.toMatch(/const LEGACY_CONTRACT|LEGACY_CONTRACT\s*\?/); // 선언·분기 소멸
    expect(client).not.toContain('API_V1_BASE');
    expect(fs.readFileSync('src/lib/data/config.ts', 'utf8')).not.toMatch(/export const API_V1_BASE/);
  });
});

describe('app-version 어댑터 — 실계약(aos 키)', () => {
  it('storeUrls.aos 수용 + 구 android 키 폴백 + 게이트 배선 소스 잠금', () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { adaptAppConfig } = require('../appConfigAdapter') as typeof import('../appConfigAdapter');
    const cfg = adaptAppConfig({
      minSupportedVersion: '1.0.0',
      latestVersion: '1.0.2',
      storeUrls: { ios: 'https://apps.apple.com/x', aos: 'https://play.google.com/x' },
    });
    expect(cfg?.storeUrls.android).toBe('https://play.google.com/x'); // aos 키
    const legacy = adaptAppConfig({ minSupportedVersion: '1.0.0', storeUrls: { android: 'https://play.google.com/y' } });
    expect(legacy?.storeUrls.android).toBe('https://play.google.com/y'); // 구 키 폴백
    const src = require('fs').readFileSync('src/lib/versionGate.ts', 'utf8') as string;
    expect(src).toContain('APP_VERSION_PATH'); // 실계약 경로 배선(구 /app-config 소멸)
    expect(src).not.toContain("'/app-config'");
  });
});

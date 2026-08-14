/**
 * P-115(KB-125 계열): API 타임아웃 잠금 — fetch 침묵(응답 유실) 시 reject 보장
 * (무한 스켈레톤 구조 봉쇄), 정상 응답 무영향, 타임아웃은 NETWORK로 분류
 * (classifyQueryError → offline, 재시도 유도).
 */
jest.mock('@/lib/installationId', () => ({ getInstallationId: () => Promise.resolve('test-install-id') })); // P-204: expo-secure-store 로드가 jest에서 fetch 폴리필 오염 — 표면 목
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/data/config', () => ({ API_V1_BASE: 'https://test.host/api/v1', BE_BASE: 'https://test.host' }));
// StateBlock(classifyQueryError) 경유로 딸려오는 reanimated — jest 표준 목
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    cancelAnimation: () => {},
  };
});

import { api, ApiError } from '../client';
import { classifyQueryError } from '@/components/StateBlock';

const okEnvelope = (payload: unknown) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(JSON.stringify({ success: true, payload, message: null })),
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('타임아웃 발화 → NETWORK timeout reject (침묵 fetch도 reject 보장)', async () => {
  jest.useFakeTimers();
  // 시그널 abort를 존중하는 "침묵" fetch — abort 전까지 영원히 pending
  global.fetch = jest.fn((_url: unknown, init?: { signal?: AbortSignal }) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
    });
  }) as unknown as typeof fetch;

  const p = api.get('/home');
  const assertion = expect(p).rejects.toThrow(/NETWORK: timeout after 15000ms/);
  await Promise.resolve(); // P-204: 설치 ID await 양보 — 타이머 arm 후 advance
  await Promise.resolve();
  jest.advanceTimersByTime(15_001);
  await assertion;
});

it('per-call 오버라이드 — 60s 전엔 미발화, 60s에 발화', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn((_url: unknown, init?: { signal?: AbortSignal }) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
    });
  }) as unknown as typeof fetch;

  const p = api.post('/scans', {}, { timeoutMs: 60_000 });
  const assertion = expect(p).rejects.toThrow(/timeout after 60000ms/);
  await Promise.resolve(); // P-204: 설치 ID await 양보 — 타이머 arm 후 advance
  await Promise.resolve();
  jest.advanceTimersByTime(15_001); // 기본값이었다면 여기서 이미 발화
  jest.advanceTimersByTime(45_000);
  await assertion;
});

it('정상 응답 무영향 — 페이로드 해체 + 타이머 정리(추가 발화 없음)', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockResolvedValue(okEnvelope({ hello: 1 })) as unknown as typeof fetch;
  await expect(api.get('/home')).resolves.toEqual({ hello: 1 });
  jest.advanceTimersByTime(120_000); // 잔여 타이머가 있었다면 abort 부작용 — 없음이 정상
  expect(jest.getTimerCount()).toBe(0);
});

it('타임아웃 에러 = NETWORK 분류 (offline UI — 재시도 유도 문구 경로)', () => {
  expect(classifyQueryError(new ApiError('NETWORK: timeout after 15000ms'))).toBe('offline');
  expect(classifyQueryError(new ApiError('HTTP 500'))).toBe('error');
});

it("P-165 → P-199: '/api/' 절대 경로 = BE_BASE만 · 상대 경로 = dev 계열 버전리스(/api)", async () => {
  const calls: string[] = [];
  global.fetch = jest.fn((url: unknown) => {
    calls.push(String(url));
    return Promise.resolve(okEnvelope({}) as unknown as Response);
  }) as unknown as typeof fetch;
  await api.get('/api/reviews?lang=en');
  await api.get('/home');
  expect(calls[0]).toBe('https://test.host/api/reviews?lang=en'); // v1 미포함
  expect(calls[1]).toBe('https://test.host/api/home'); // P-199: /api/v1 전멸(dev) — prod 분기는 apiOverhaul199
});

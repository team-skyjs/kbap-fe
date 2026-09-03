/**
 * submitOnboardingProfile — 4xx 판별 시맨틱 (KB-75 검토 수정).
 * 400은 "검증 실패"와 "이미 완료"를 겸용(구분 코드 없음) → 서버
 * onboardingCompleted 플래그로만 완료를 간주할 수 있다. 검증 실패를
 * 삼키면 프로필 미저장으로 홈 진입(false-safe) — 그 회귀를 잠근다.
 */
import { ApiError } from '@/lib/api/client';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => {}),
}));
jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: jest.fn(async () => true) }));
jest.mock('@/lib/api/client', () => {
  class MockApiError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  }
  return { ApiError: MockApiError, api: { post: jest.fn(), get: jest.fn() } };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require('@/lib/api/client') as { api: { post: jest.Mock; get: jest.Mock } };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { submitOnboardingProfile, UNSET } = require('../submit') as typeof import('../submit');

const payload = {
  nationality: 'KR',
  language: 'en',
  avoidIngredients: UNSET,
  spiceTolerance: 'SKIP', // P-081: 스킵 = SKIP enum (구 UNSET 승계)
} as const;

beforeEach(() => jest.clearAllMocks());

describe('submitOnboardingProfile 4xx 판별 (KB-75)', () => {
  it('성공 시 그대로 resolve', async () => {
    api.post.mockResolvedValueOnce(undefined);
    await expect(submitOnboardingProfile(payload)).resolves.toBeUndefined();
    expect(api.get).not.toHaveBeenCalled();
  });

  // P-019(KB-195): required 승격 — 스킵도 명시 전송 (생략하면 가입 400)
  // P-084: 신계약 = enum 문자열 통과 — SKIP도 문자열 'SKIP'으로 명시 전송
  it('spicinessPreference — enum 문자열 그대로 전송 (SKIP 포함, P-084 스왑)', async () => {
    api.post.mockResolvedValue(undefined);
    await submitOnboardingProfile(payload); // spiceTolerance: 'SKIP'
    expect(api.post.mock.calls[0][1]).toMatchObject({ spicinessPreference: 'SKIP' });
    await submitOnboardingProfile({ ...payload, spiceTolerance: 'HOT' });
    expect(api.post.mock.calls[1][1]).toMatchObject({ spicinessPreference: 'HOT' });
  });

  // P-243(BE #179): 프리셋 선택 = dietCategories 전송(1.1) — 빈/생략 = 필드 미전송
  it('P-243: dietCategories — 선택분 전송·빈 배열/생략 = 미전송(스킵 시맨틱)', async () => {
    api.post.mockResolvedValue(undefined);
    await submitOnboardingProfile({ ...payload, dietCategories: ['VEGAN', 'MUSLIM'] });
    expect(api.post.mock.calls[0][1]).toMatchObject({ dietCategories: ['VEGAN', 'MUSLIM'] });
    await submitOnboardingProfile({ ...payload, dietCategories: [] });
    expect(api.post.mock.calls[1][1]).not.toHaveProperty('dietCategories');
    await submitOnboardingProfile(payload);
    expect(api.post.mock.calls[2][1]).not.toHaveProperty('dietCategories');
  });

  // P-016 → P-209 → KB-418: 닉네임·아바타 서버 자동 지정(전 채널 1.1 — prod 폴백 소멸)
  it('P-209/KB-418: profileImageUrl·nickname 미전송 + 1.1 헤더', async () => {
    api.post.mockResolvedValue(undefined);
    await submitOnboardingProfile(payload);
    const [, body, opts] = api.post.mock.calls[0] as [string, Record<string, unknown>, { headers?: Record<string, string> }];
    expect(body.profileImageUrl).toBeUndefined();
    expect(body.nickname).toBeUndefined();
    expect(opts?.headers?.['X-API-Version']).toBe('1.1');
  });

  it('400 + onboardingCompleted=false → 에러 표면화 (검증 실패를 삼키지 않는다)', async () => {
    api.post.mockRejectedValueOnce(new ApiError('닉네임 형식 오류', 400));
    api.get.mockResolvedValueOnce({ onboardingCompleted: false });
    await expect(submitOnboardingProfile(payload)).rejects.toThrow('닉네임 형식 오류');
  });

  it('400 + onboardingCompleted=true → 이미 완료로 간주하고 resolve', async () => {
    api.post.mockRejectedValueOnce(new ApiError('이미 온보딩 완료', 400));
    api.get.mockResolvedValueOnce({ onboardingCompleted: true });
    await expect(submitOnboardingProfile(payload)).resolves.toBeUndefined();
  });

  it('400 + 플래그 확인 자체가 실패 → 완료 확신 불가 → 에러 표면화', async () => {
    api.post.mockRejectedValueOnce(new ApiError('검증 실패', 400));
    api.get.mockRejectedValueOnce(new ApiError('NETWORK: down'));
    await expect(submitOnboardingProfile(payload)).rejects.toThrow('검증 실패');
  });

  it('5xx는 판별 없이 그대로 표면화', async () => {
    api.post.mockRejectedValueOnce(new ApiError('HTTP 500', 500));
    await expect(submitOnboardingProfile(payload)).rejects.toThrow('HTTP 500');
    expect(api.get).not.toHaveBeenCalled();
  });
});

// P-060②(KB-230): 언어 OS 정본화 — 서버는 언어 무저장, body에 appLanguage 금지
it('P-060: 제출 body에 appLanguage 부재 (BE 계약 삭제 동보조)', async () => {
  api.post.mockClear();
  api.post.mockResolvedValue(undefined);
  await submitOnboardingProfile({
    nationality: 'KR',
    language: 'ko',
    avoidIngredients: ['EGG'],
    spiceTolerance: 'HOT',
  });
  const body = api.post.mock.calls[0][1] as Record<string, unknown>;
  expect('appLanguage' in body).toBe(false);
});

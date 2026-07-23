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
  nickname: 'Yejin',
  nationality: 'KR',
  language: 'en',
  avoidIngredients: UNSET,
  spiceTolerance: UNSET,
} as const;

beforeEach(() => jest.clearAllMocks());

describe('submitOnboardingProfile 4xx 판별 (KB-75)', () => {
  it('성공 시 그대로 resolve', async () => {
    api.post.mockResolvedValueOnce(undefined);
    await expect(submitOnboardingProfile(payload)).resolves.toBeUndefined();
    expect(api.get).not.toHaveBeenCalled();
  });

  // P-019(KB-195): required 승격 — 스킵도 -1 명시 전송 (생략하면 가입 400)
  it('spicinessPreference — 스킵(UNSET) 시 -1 명시 전송, 설정 시 실값', async () => {
    api.post.mockResolvedValue(undefined);
    await submitOnboardingProfile(payload); // spiceTolerance: UNSET
    expect(api.post.mock.calls[0][1]).toMatchObject({ spicinessPreference: -1 });
    await submitOnboardingProfile({ ...payload, spiceTolerance: 7 });
    expect(api.post.mock.calls[1][1]).toMatchObject({ spicinessPreference: 7 });
  });

  // P-016(KB-149 최종): 선택 시 업로드 path, 미선택 시 **기본 path 명시 전송** (생략·null 폐기)
  it('profileImageUrl — 선택 시 업로드 path, 미선택 시 기본 path 전송', async () => {
    api.post.mockResolvedValue(undefined);
    await submitOnboardingProfile({ ...payload, profileImageUrl: 'profile/1/a.jpg' });
    expect(api.post.mock.calls[0][1]).toMatchObject({ profileImageUrl: 'profile/1/a.jpg' });
    await submitOnboardingProfile({ ...payload, profileImageUrl: null });
    expect(api.post.mock.calls[1][1]).toMatchObject({
      profileImageUrl: 'images/default/profile/profile-default-512.png',
    });
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
    nickname: 'Yejin',
    nationality: 'KR',
    language: 'ko',
    avoidIngredients: ['EGG'],
    spiceTolerance: 5,
    profileImageUrl: null,
  });
  const body = api.post.mock.calls[0][1] as Record<string, unknown>;
  expect('appLanguage' in body).toBe(false);
});

/**
 * P-209: 온보딩 1.1 전환 — dev = 1.1 헤더+닉네임/아바타 미전송(서버 자동 지정),
 * prod = 구 1.0 폴백(클라 생성 유지) · 프로필 PATCH 1.1 헤더 분기.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: jest.fn().mockResolvedValue(true) }));

const CHANNEL = { prod: false };
jest.mock('@/lib/flags', () => ({ FLAGS: {}, isProdChannel: () => CHANNEL.prod }));
jest.mock('@/lib/api/client', () => ({
  api: { post: jest.fn().mockResolvedValue(undefined), get: jest.fn(), patch: jest.fn().mockResolvedValue(undefined) },
  ApiError: class extends Error {},
  apiLang: () => 'en',
}));

import { submitOnboardingProfile } from '../submit';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require('@/lib/api/client') as { api: { post: jest.Mock; patch: jest.Mock } };

const PAYLOAD = { nationality: 'US', language: 'en', avoidIngredients: ['EGG'], spiceTolerance: 'MILD' } as never;

beforeEach(() => {
  jest.clearAllMocks();
  CHANNEL.prod = false;
});

it('dev = X-API-Version 1.1 오버라이드 + nickname·profileImageUrl 미전송(서버 자동 지정)', async () => {
  await submitOnboardingProfile(PAYLOAD);
  const [path, body, opts] = api.post.mock.calls[0] as [string, Record<string, unknown>, { headers?: Record<string, string> }];
  expect(path).toBe('/members/me/onboarding');
  expect(opts?.headers?.['X-API-Version']).toBe('1.1');
  expect(body.nickname).toBeUndefined();
  expect(body.profileImageUrl).toBeUndefined();
  expect(body.countryCode).toBe('US'); // 나머지 필드 무변
});

it('prod 채널 = 구 1.0 폴백 — 헤더 오버라이드 없음 + 클라 생성 닉네임/아바타 전송(구계약 required)', async () => {
  CHANNEL.prod = true;
  await submitOnboardingProfile(PAYLOAD);
  const [, body, opts] = api.post.mock.calls[0] as [string, Record<string, unknown>, { headers?: Record<string, string> } | undefined];
  expect(opts).toBeUndefined();
  expect(String(body.nickname)).toMatch(/^[A-Za-z]+_\d{4}$/); // 폴백 생성(한식명_4자리)
  expect(typeof body.profileImageUrl).toBe('string');
  // KB-389 2차: prod도 맵기 = enum 문자열(구정수 5 전송이 MEMBER-009 400의 원인)
  expect(body.spicinessPreference).toBe('MILD');
});

it('배선 소스 잠금 — 온보딩 화면 클라 생성 소멸 · PATCH dev 1.1 헤더·countryCode 미전송', () => {
  const fs = require('fs');
  const ob = fs.readFileSync('src/app/onboarding/index.tsx', 'utf8') as string;
  expect(ob).not.toContain('generateNickname'); // 화면 생성 호출 소멸(서버 지정)
  expect(ob).not.toContain('pickDefaultAvatarPath');
  const me = fs.readFileSync('src/lib/data/useMe.ts', 'utf8') as string;
  expect(me).toContain("isProdChannel() ? undefined : { headers: { 'X-API-Version': '1.1' } }");
  expect(me).not.toMatch(/body\.countryCode/); // P-078 유지 — 1.1 그룹 정합
  // autoProfile = prod 폴백 전용 강등(prod 1.1 배포 시 삭제)
  expect(fs.readFileSync('src/lib/onboarding/autoProfile.ts', 'utf8')).toContain('prod 채널(구 1.0 계약) 폴백 전용');
});

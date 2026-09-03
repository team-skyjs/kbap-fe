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

// KB-418(P-201): P-209 prod=구 1.0 폴백 분기 소멸 — prod 서버에 1.1+ 핸들러 포함
// 실측(MemberController.kt:28·:62, 26.08.0). 구 잠금(무헤더+클라 생성 전송)을 뒤집는다.
it('prod 채널 목에서도 = 1.1 — 헤더 오버라이드 + nickname·profileImageUrl 미전송 + dietCategories 송신', async () => {
  CHANNEL.prod = true;
  await submitOnboardingProfile({ ...PAYLOAD, dietCategories: ['VEGAN'] } as never);
  const [, body, opts] = api.post.mock.calls[0] as [string, Record<string, unknown>, { headers?: Record<string, string> } | undefined];
  expect(opts?.headers?.['X-API-Version']).toBe('1.1');
  expect(body.nickname).toBeUndefined(); // 서버 자동 지정 — 클라 생성 소멸
  expect(body.profileImageUrl).toBeUndefined();
  expect(body.dietCategories).toEqual(['VEGAN']); // P-243 — 이제 전 채널
  // KB-389 2차: prod도 맵기 = enum 문자열(구정수 5 전송이 MEMBER-009 400의 원인)
  expect(body.spicinessPreference).toBe('MILD');
});

it('배선 소스 잠금 — 클라 생성(autoProfile) 소멸 · PATCH 항상 1.1 헤더·countryCode 미전송', () => {
  const fs = require('fs');
  const ob = fs.readFileSync('src/app/onboarding/index.tsx', 'utf8') as string;
  expect(ob).not.toContain('generateNickname'); // 화면 생성 호출 소멸(서버 지정)
  expect(ob).not.toContain('pickDefaultAvatarPath');
  const me = fs.readFileSync('src/lib/data/useMe.ts', 'utf8') as string;
  expect(me).toContain("{ headers: { 'X-API-Version': '1.1' } }"); // KB-418: 전 채널 1.1
  expect(me).not.toContain('isProdChannel'); // 채널 분기 소멸
  expect(me).not.toMatch(/body\.countryCode/); // P-078 유지 — 1.1 그룹 정합
  // KB-418: autoProfile(prod 1.0 폴백 전용) 통삭제 — 부활 금지
  expect(fs.existsSync('src/lib/onboarding/autoProfile.ts')).toBe(false);
  const sub = fs.readFileSync('src/lib/onboarding/submit.ts', 'utf8') as string;
  expect(sub).not.toContain('isProdChannel'); // 온보딩 송신 채널 분기 소멸
  expect(sub).not.toContain('autoProfile');
});

/**
 * P-197: Sentry 관문 — init 게이트(__DEV__ off·환경 판별)·PII 스코프(memberId만)·
 * 배선 소스 잠금(엔트리 init·식별/해제 지점).
 */
const mockInit = jest.fn();
const mockSetUser = jest.fn();
jest.mock('@sentry/react-native', () => ({ init: (o: unknown) => mockInit(o), setUser: (u: unknown) => mockSetUser(u) }));
jest.mock('@/lib/flags', () => ({ FLAGS: {}, isProdChannel: () => false }));

import { initSentry, setSentryUser } from '../sentry';

beforeEach(() => jest.clearAllMocks());

it('init 게이트 — dev 런타임(__DEV__)에선 enabled false, 환경 = 채널 판별값', () => {
  initSentry();
  const arg = mockInit.mock.calls[0][0] as Record<string, unknown>;
  expect(arg.enabled).toBe(false); // jest = __DEV__ true → Metro 노이즈 차단
  expect(arg.environment).toBe('dev'); // isProdChannel false
  expect(arg.sendDefaultPii).toBe(false);
  expect(String(arg.dsn)).toContain('sentry.io');
  // 게이트 표현식 자체 잠금 — 상수 false로 바꿔치기 방지
  const src = require('fs').readFileSync('src/lib/sentry.ts', 'utf8') as string;
  expect(src).toContain('enabled: !__DEV__');
});

it('PII 스코프 — 식별 = memberId 단일 키, null = 해제. 닉네임/이메일 필드 소스 부재', () => {
  setSentryUser('42');
  expect(mockSetUser).toHaveBeenCalledWith({ id: '42' }); // id 외 키 0
  expect(Object.keys(mockSetUser.mock.calls[0][0] as object)).toEqual(['id']);
  setSentryUser(null);
  expect(mockSetUser).toHaveBeenLastCalledWith(null);
  const src = require('fs').readFileSync('src/lib/sentry.ts', 'utf8') as string;
  expect(src).not.toMatch(/nickname|email/i);
});

it('배선 소스 잠금 — 엔트리 init 1회 · fetchMe 식별/게스트 해제 · logOut 해제', () => {
  const fs = require('fs');
  expect(fs.readFileSync('src/app/_layout.tsx', 'utf8')).toContain('initSentry()');
  const me = fs.readFileSync('src/lib/data/useMe.ts', 'utf8') as string;
  expect(me).toContain('setSentryUser(user.id)');
  expect(me).toContain('setSentryUser(null)');
  expect(fs.readFileSync('src/lib/auth/session.ts', 'utf8')).toContain('setSentryUser(null)');
});

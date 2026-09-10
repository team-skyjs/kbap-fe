/**
 * sessionInflight509 (Codex #109 7R P1) — 세션 관문의 네이티브 프라미스는
 * inflight 카운터(track) 경유: 프로필 로그아웃(Firebase signOut) 진행 중
 * OTA 정적 창(canReloadNow의 networkIdle)이 이 왕복을 본다.
 */
let resolveSignOut: () => void;
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(
    () =>
      new Promise<void>((r) => {
        resolveSignOut = r;
      }),
  ),
}));
jest.mock('@/lib/sentry', () => ({ setSentryUser: jest.fn() }));

import { inflightCount } from '@/lib/net/inflight';
import { logOut } from '../session';

it('session.logOut 진행 중 inflight = 1, 완료 후 0 (KB-509 관문)', async () => {
  expect(inflightCount()).toBe(0);
  const p = logOut();
  expect(inflightCount()).toBe(1); // signOut 왕복이 OTA 정적 창에 보인다
  resolveSignOut();
  await p;
  expect(inflightCount()).toBe(0);
});

it('세션 관문 소스 잠금 — beAuth 진입점(로그인·로그아웃·탈퇴·경계) 전부 track 경유', () => {
  const src = require('fs').readFileSync('src/lib/auth/beAuth.ts', 'utf8') as string;
  expect(src).toContain("import { track } from '@/lib/net/inflight'");
  expect(src).toContain('return track(exchangeLoginInner(idToken));');
  expect(src).toContain('return track(logoutLocalFirstInner());');
  expect(src).toContain('return track(withdrawBeInner());');
  expect(src).toContain('const done = track(clearTokens());');
});

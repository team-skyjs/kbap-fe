/**
 * P-217(KB-51·152): 인트로 폐지 — 최초 실행 = 로그인 직행.
 * 부팅 판별이 freshInstall 센티널 하나로 단순화됐는지(구 introSeen 소멸),
 * 재설치 시 세션만 정리되고 **P-204 설치 ID는 생존**하는지 잠금.
 */
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (k: string) => Promise.resolve(mockStore.get(k) ?? null),
    setItem: (k: string, v: string) => { mockStore.set(k, v); return Promise.resolve(); },
    removeItem: (k: string) => { mockStore.delete(k); return Promise.resolve(); },
  },
}));
const mockClearTokens = jest.fn(() => Promise.resolve());
jest.mock('../beTokens', () => ({ clearTokens: () => mockClearTokens() }));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } })); // RNFB 경로 회피
// KB-421: freshInstall → beAuth(세션 경계) 의존 신설 — client 체인의 네이티브
// 상수 접근 회피(표면 목, 동작 무관)
jest.mock('../beAuth', () => ({ endSessionBoundary: () => mockEndBoundary() }));
const mockEndBoundary = jest.fn(async () => {});

import { cleanupIfFreshInstall } from '../freshInstall';

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

it('최초 실행(센티널 부재) = true 반환 + 잔존 세션 정리 → 로그인 직행 신호', async () => {
  await expect(cleanupIfFreshInstall()).resolves.toBe(true);
  expect(mockEndBoundary).toHaveBeenCalledTimes(1); // KB-421: 정리 = 경계 헬퍼 단일 구현
});

it('기설치(센티널 존재) = false + 정리 0 — 게스트가 매 실행 로그인으로 튀지 않는다', async () => {
  await cleanupIfFreshInstall(); // 첫 실행 — 센티널 기록
  jest.clearAllMocks();
  await expect(cleanupIfFreshInstall()).resolves.toBe(false);
  expect(mockEndBoundary).not.toHaveBeenCalled();
});

it('P-204 설치 ID 무관 — 정리 대상은 액세스·리프레시 토큰뿐(SecureStore 설치 ID 생존)', () => {
  const fs = require('fs');
  const src = fs.readFileSync('src/lib/auth/freshInstall.ts', 'utf8') as string;
  expect(src).toContain('endSessionBoundary'); // KB-421: 토큰 정리는 경계 헬퍼 경유
  expect(src).not.toContain('installationId');
  expect(fs.readFileSync('src/lib/auth/beTokens.ts', 'utf8')).not.toContain('kbap.installation.id');
});

it('부팅 경로 — 최초 실행이면 /login replace, 인트로 라우트·플래그 잔존 0', () => {
  const fs = require('fs');
  const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8') as string;
  expect(layout).toContain("router.replace('/login' as Href)");
  expect(layout).not.toContain("'/intro'");
  expect(layout).not.toContain('hasSeenIntro');
  // 화면·플래그 모듈 자체가 삭제됐다(보존형 아님 — 발주 명시)
  expect(fs.existsSync('src/app/intro.tsx')).toBe(false);
  expect(fs.existsSync('src/lib/introSeen.ts')).toBe(false);
  expect(fs.existsSync('src/features/intro')).toBe(false);
  // 로그인 백버튼은 canGoBack 가드 — 첫 진입(빈 스택)에선 자동 미노출
  expect(fs.readFileSync('src/app/login.tsx', 'utf8')).toContain('!embedded && router.canGoBack()');
});

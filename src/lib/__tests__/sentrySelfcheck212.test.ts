/**
 * P-212(KB-39): Sentry 수신 검증 트리거 — 7연타 게이트(2s 창)·prod 무동작·
 * 전송 호출(태그 채널·버전)·__DEV__ 안내·배선 소스 잠금.
 */
const mockCapture = jest.fn();
// KB-608: 실제 채널 문자열로 모델링 — prod/비prod 2분류로는 preview 누출을 못 잡는다
const mockChannel = { name: 'teamtest' as string | null };
const isProd = () => mockChannel.name === 'production';
const isDiag = () => mockChannel.name == null || mockChannel.name === 'teamtest' || mockChannel.name === 'development';
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  captureMessage: (m: unknown, o: unknown) => mockCapture(m, o),
}));
jest.mock('@/lib/flags', () => ({ FLAGS: {}, isProdChannel: () => isProd(), isDiagnosticChannel: () => isDiag() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.3' } } }));

import { tapSentrySelfcheck, _resetSelfcheckForTest } from '../sentry';

const DEV_GLOBAL = global as unknown as { __DEV__: boolean };

beforeEach(() => {
  jest.clearAllMocks();
  mockChannel.name = 'teamtest';
  _resetSelfcheckForTest();
});
afterEach(() => {
  DEV_GLOBAL.__DEV__ = true; // jest 기본 복원
});

/** 2s 창 안 연타 n회 — 마지막 반환값. */
function taps(n: number, start = 1_000_000): string | null {
  let out: string | null = null;
  for (let i = 0; i < n; i++) out = tapSentrySelfcheck(start + i * 100);
  return out;
}

it('7연타 게이트 — 6연타 = 무반응, 7번째에 발화·카운터 리셋', () => {
  DEV_GLOBAL.__DEV__ = false;
  expect(taps(6)).toBeNull();
  expect(mockCapture).not.toHaveBeenCalled();
  expect(tapSentrySelfcheck(1_000_600)).not.toBeNull(); // 7번째
  expect(mockCapture).toHaveBeenCalledTimes(1);
  expect(tapSentrySelfcheck(1_000_700)).toBeNull(); // 리셋 — 다시 1부터
});

it('2s 창 — 간격이 창을 넘으면 카운터 1부터(느린 탭 오발화 금지)', () => {
  DEV_GLOBAL.__DEV__ = false;
  for (let i = 0; i < 10; i++) tapSentrySelfcheck(1_000_000 + i * 2500);
  expect(mockCapture).not.toHaveBeenCalled();
});

it('prod 채널 = 트리거 무동작(P-114 분기) — 7연타에도 전송·토스트 0', () => {
  mockChannel.name = 'production';
  DEV_GLOBAL.__DEV__ = false;
  expect(taps(7)).toBeNull();
  expect(mockCapture).not.toHaveBeenCalled();
});

/* KB-608: 채널 게이트를 **명시 허용**으로 — `!isProdChannel()`로 두면 preview까지 포함돼
   한국어 하드코딩 진단 문구가 production 백엔드 사용자에게 샌다(#176과 같은 함정). */
describe('KB-608 진단 채널 허용 목록', () => {
  const fires = (channel: string | null) => {
    mockChannel.name = channel;
    DEV_GLOBAL.__DEV__ = false;
    _resetSelfcheckForTest();
    return taps(7) !== null;
  };

  it('teamtest·development·채널 부재(로컬) = 노출', () => {
    expect(fires('teamtest')).toBe(true);
    expect(fires('development')).toBe(true);
    expect(fires(null)).toBe(true);
  });

  it('preview·production = 미노출', () => {
    expect(fires('preview')).toBe(false); // production 백엔드를 쓰는 내부 배포
    expect(fires('production')).toBe(false);
  });

  it('소스 잠금 — negate가 아니라 isDiagnosticChannel 경유', () => {
    const src = require('fs').readFileSync('src/lib/sentry.ts', 'utf8') as string;
    const body = src.slice(src.indexOf('export function tapSentrySelfcheck'));
    const fn = body.slice(0, body.indexOf('\n}'));
    const code = fn.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).toContain('if (!isDiagnosticChannel()) return null;');
    expect(code).not.toContain('isProdChannel');
  });
});

it('전송 = 고정 메시지 + 채널·앱 버전 태그(PII 0)', () => {
  DEV_GLOBAL.__DEV__ = false;
  taps(7);
  expect(mockCapture).toHaveBeenCalledWith('sentry-selfcheck', {
    tags: { channel: 'dev', appVersion: '1.2.3' },
  });
});

it('__DEV__(Metro) = Sentry off — 전송 없이 빌드 안내만', () => {
  const msg = taps(7);
  expect(msg).toContain('빌드에서 확인');
  expect(mockCapture).not.toHaveBeenCalled();
});

it('배선 소스 잠금 — 프로필 버전 줄(7연타)·표시는 화면, 로직은 sentry.ts 한 곳', () => {
  const fs = require('fs');
  const pr = fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8') as string;
  expect(pr).toContain('testID="app-version-row"');
  expect(pr).toContain('tapSentrySelfcheck()');
  expect(pr).not.toContain('captureMessage'); // 화면 직접 전송 금지 — 관문 경유
});

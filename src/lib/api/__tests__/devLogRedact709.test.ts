/**
 * KB-709(P-449 ②) — 개발 로거: 요청·응답 본문의 토큰 원문이 로그 어디에도 없다(헤더는 원래 가림).
 */
jest.mock('@/lib/installationId', () => ({ getInstallationId: () => Promise.resolve('test-install-id') }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/data/config', () => ({ BE_BASE: 'https://test.host' }));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
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

// eslint-disable-next-line import/first -- jest.mock 선언 뒤(팩토리 호이스팅) — 레포 관례
import { api, setAuthTokenProvider } from '../client';
// eslint-disable-next-line import/first -- 위와 같음
import { redactSecrets, redactText } from '../redactLog';

const SECRETS = ['RT-REQ-1', 'AT-RES-2', 'RT-RES-3', 'ID-RES-4', 'AT-HDR-5', 'PW-6'];

afterEach(() => jest.restoreAllMocks());

it('dev 로그(요청 →·응답 ←) 어디에도 토큰 원문 없음 — 본문 중첩·대소문자 무관, 가림 표시는 남음', async () => {
  expect(__DEV__).toBe(true); // 로거가 켜진 환경에서 검증
  setAuthTokenProvider(() => Promise.resolve('AT-HDR-5'));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: () => Promise.resolve(JSON.stringify({ success: true, message: null, payload: { accessToken: 'AT-RES-2', RefreshToken: 'RT-RES-3', member: { idToken: 'ID-RES-4', nickname: 'Mina' } } })),
    }),
  ) as unknown as typeof fetch;
  await api.post('/auth/refresh', { refreshToken: 'RT-REQ-1', nested: { password: 'PW-6' }, keep: 'visible' });
  const out = log.mock.calls.map((args) => args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')).join('\n');
  expect(out).toContain('[api] →');
  expect(out).toContain('[api] ←');
  for (const s of SECRETS) expect({ s, leaked: out.includes(s) }).toEqual({ s, leaked: false });
  expect(out).toContain('***');
  expect(out).toContain('visible'); // 비밀이 아닌 값은 그대로(디버깅 가치 유지)
  expect(out).toContain('Mina');
});

it('redactSecrets/redactText — 키 이름 기준·중첩·배열 · 잘린(비 JSON) 본문도 가림', () => {
  expect(redactSecrets({ a: 1, list: [{ ACCESS_TOKEN: 'x' }], authorizationCode: 'c', clientSecret: 's' })).toEqual({ a: 1, list: [{ ACCESS_TOKEN: '***' }], authorizationCode: '***', clientSecret: '***' });
  expect(redactText('{"payload":{"accessToken":"abc"}')).toBe('{"payload":{"accessToken":"***"}'); // 4000자 자르기 등으로 깨진 JSON
  expect(redactText('plain text')).toBe('plain text');
  // KB-722(KB-709 메모): /scans/tickets 응답의 JWT(`ticket`)·요청 헤더 `X-Scan-Ticket`만 — ticketId·scanTicket은 디버깅값이라 남긴다(P-255 선발급 재사용 추적)
  expect(redactSecrets({ ticket: 'eyJhbGciOi.AAA', 'X-Scan-Ticket': 'eyJ.BBB', scanTicket: 'T2', ticketId: 7 })).toEqual({ ticket: '***', 'X-Scan-Ticket': '***', scanTicket: 'T2', ticketId: 7 });
  expect(redactText('{"payload":{"ticket":"eyJhbGciOi.AAA","ticketId":7}')).toBe('{"payload":{"ticket":"***","ticketId":7}');
  // 비밀 패턴 키의 값이 객체·배열이어도 통째로 — 안쪽 키(access·refresh)가 패턴이 아니어도 새지 않게
  expect(redactSecrets({ tokens: { access: 'AAA', refresh: 'RRR' }, secretList: ['S1'], ok: { keep: 1 } })).toEqual({ tokens: '***', secretList: '***', ok: { keep: 1 } });
  expect(redactText('{"payload":{"tokens":{"access":"AAA"}}}')).not.toContain('AAA');
});

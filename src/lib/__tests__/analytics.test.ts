/**
 * P-083(KB-265): 계측 어댑터 잠금 —
 *  ① no-op: 키 없으면 SDK init/track 호출 0 (키 주입 시 코드 변경 0의 전제)
 *  ② 키 있으면 init 1회 + track 전달
 *  ③ PII 방어 실측: 허용 키 밖 prop(닉네임·이메일·국적·재료 내용 등)은 전송 전 드롭
 *  ④ 스키마 표 자체에 PII 키 부재
 */
const mockInit = jest.fn();
const mockTrack = jest.fn();
jest.mock('@amplitude/analytics-react-native', () => ({ init: mockInit, track: mockTrack }));

const KEY_NAME = 'EXPO_PUBLIC_AMPLITUDE_API_KEY';

function loadAnalytics(key: string | undefined) {
  jest.resetModules();
  if (key == null) delete process.env[KEY_NAME];
  else process.env[KEY_NAME] = key;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../analytics') as typeof import('../analytics');
}

beforeEach(() => {
  mockInit.mockClear();
  mockTrack.mockClear();
});

afterAll(() => {
  delete process.env[KEY_NAME];
});

it('키 없음 → no-op: SDK init/track 호출 0', () => {
  const a = loadAnalytics(undefined);
  a.track(a.EVENTS.guest_enter);
  a.track(a.EVENTS.scan_complete, { degraded: false, item_count: 3 });
  expect(mockInit).not.toHaveBeenCalled();
  expect(mockTrack).not.toHaveBeenCalled();
});

it('키 있음 → init 1회(익명 — userId 미전달) + track 전달', () => {
  const a = loadAnalytics('test-key');
  a.track(a.EVENTS.scan_complete, { degraded: true, item_count: 6 });
  a.track(a.EVENTS.review_submit);
  expect(mockInit).toHaveBeenCalledTimes(1);
  expect(mockInit).toHaveBeenCalledWith('test-key');
  expect(mockTrack).toHaveBeenCalledWith('scan_complete', { degraded: true, item_count: 6 });
  expect(mockTrack).toHaveBeenCalledWith('review_submit', undefined);
});

it('PII 드롭 실측 — 허용 키 밖 prop은 전송되지 않는다', () => {
  const a = loadAnalytics('test-key');
  a.track(a.EVENTS.login_success, {
    provider: 'APPLE',
    // 실수로 섞였다고 가정한 PII — 어댑터가 전부 드롭해야 한다
    nickname: 'yejin',
    email: 'x@y.com',
    countryCode: 'KR',
  });
  expect(mockTrack).toHaveBeenCalledWith('login_success', { provider: 'APPLE' });
  a.track(a.EVENTS.onboarding_submit, {
    avoid_count: 2,
    avoid_skipped: false,
    spice_skipped: true,
    ingredients: ['MILK', 'SHRIMP'], // 재료 내용 — 개수만 허용, 내용 금지
  });
  expect(mockTrack).toHaveBeenLastCalledWith('onboarding_submit', {
    avoid_count: 2,
    avoid_skipped: false,
    spice_skipped: true,
  });
});

it('스키마 표에 PII성 키 자체가 없다 (sanitize가 전 이벤트에서 PII를 거른다)', () => {
  const a = loadAnalytics('test-key');
  const PII = { nickname: 'n', email: 'e', countryCode: 'KR', nationality: 'KR', ingredients: ['MILK'] };
  for (const ev of Object.values(a.EVENTS)) {
    const out = a.sanitize(ev, { ...PII }) ?? {};
    expect(Object.keys(out)).toHaveLength(0);
  }
});

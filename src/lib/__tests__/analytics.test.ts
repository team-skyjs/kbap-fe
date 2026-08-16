/**
 * P-083(KB-265): 계측 어댑터 잠금 —
 *  ① no-op: 키 없으면 SDK init/track 호출 0 (키 주입 시 코드 변경 0의 전제)
 *  ② 키 있으면 init 1회 + track 전달
 *  ③ PII 방어 실측: 허용 키 밖 prop(닉네임·이메일·국적·재료 내용 등)은 전송 전 드롭
 *  ④ 스키마 표 자체에 PII 키 부재
 */
const mockInit = jest.fn();
const mockTrack = jest.fn();
const mockIdentify = jest.fn();
class MockIdentify {
  ops: Record<string, unknown> = {};
  set(k: string, v: unknown) {
    this.ops[k] = v;
    return this;
  }
}
jest.mock('@amplitude/analytics-react-native', () => ({ init: mockInit, track: mockTrack, identify: mockIdentify, Identify: MockIdentify }));

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
  mockIdentify.mockClear();
});

afterAll(() => {
  delete process.env[KEY_NAME];
});

it('키 없음 → no-op: SDK init/track 호출 0', () => {
  const a = loadAnalytics(undefined);
  a.track(a.EVENTS.auth_guest_enter);
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
  a.track(a.EVENTS.auth_login_success, {
    provider: 'APPLE',
    // 실수로 섞였다고 가정한 PII — 어댑터가 전부 드롭해야 한다
    nickname: 'yejin',
    email: 'x@y.com',
    countryCode: 'KR',
  });
  expect(mockTrack).toHaveBeenCalledWith('auth_login_success', { provider: 'APPLE' }); // P-215
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


/* ---- P-144(KB-316): amplitude-taxonomy.csv 전사 잠금 ---- */

it('P-144: CSV 이벤트·속성 스키마 1:1 — 신규 7종 + 확장 2종', () => {
  const a = loadAnalytics('test-key');
  // CSV 이벤트명 그대로(임의 개명 금지)
  for (const e of ['app_opened', 'scan_start', 'scan_result_item_tap', 'order_card_open', 'search_query', 'review_write_tap', 'food_bookmark_toggle']) { // P-215 개명 반영
    expect((a.EVENTS as Record<string, string>)[e]).toBe(e);
  }
  // 속성 스키마 — CSV 열 그대로 통과, 그 외 드롭
  expect(a.sanitize(a.EVENTS.scan_start, { source: 'camera', junk: 1 })).toEqual({ source: 'camera' });
  expect(a.sanitize(a.EVENTS.scan_result_item_tap, { risk: 'danger' })).toEqual({ risk: 'danger' });
  expect(a.sanitize(a.EVENTS.order_card_open, { item_count: 2, has_avoids: true })).toEqual({ item_count: 2, has_avoids: true });
  expect(a.sanitize(a.EVENTS.search_query, { keyword: 'kimchi', result_count: 4 })).toEqual({ keyword: 'kimchi', result_count: 4 });
  expect(a.sanitize(a.EVENTS.review_write_tap, { source: 'detail' })).toEqual({ source: 'detail' });
  expect(a.sanitize(a.EVENTS.food_bookmark_toggle, { on: true })).toEqual({ on: true });
  // 확장: scan_complete success/fail_reason · review_submit has_photos/photo_count/rating
  expect(a.sanitize(a.EVENTS.scan_complete, { success: false, fail_reason: 'ocr', item_count: 0, degraded: false })).toEqual({ success: false, fail_reason: 'ocr', item_count: 0, degraded: false });
  expect(a.sanitize(a.EVENTS.review_submit, { has_photos: true, photo_count: 3, rating: 5 })).toEqual({ has_photos: true, photo_count: 3, rating: 5 });
  expect(a.sanitize(a.EVENTS.food_detail_view, { source: 'scan', food_id: '7' })).toEqual({ source: 'scan', food_id: '7' });
});

it('P-144: user property — 허용 키만 통과(PII 키 드롭) + Identify 경유(익명 유지)', () => {
  const a = loadAnalytics('test-key');
  // sanitize: 재료명·닉네임·이메일 등 허용 밖 키 드롭
  expect(
    a.sanitizeUserProps({
      // P-215: user property = user_info_ 접두(도메인 접두 규칙)
      user_info_country: 'US',
      user_info_spice_level: 'MEDIUM',
      user_info_avoid_count: 3,
      user_info_is_registered: true,
      // @ts-expect-error — PII 침투 시나리오 + 구 접두 없는 키도 드롭
      nickname: 'Yejin',
      email: 'a@b.c',
      country: 'US',
    }),
  ).toEqual({ user_info_country: 'US', user_info_spice_level: 'MEDIUM', user_info_avoid_count: 3, user_info_is_registered: true });
  // Identify 호출 — setUserId 없음(익명 device id 유지)
  a.setUserProps({ user_info_lang: 'en', user_info_os: 'ios' });
  expect(mockIdentify).toHaveBeenCalledTimes(1);
  expect((mockIdentify.mock.calls[0][0] as { ops: Record<string, unknown> }).ops).toEqual({ user_info_lang: 'en', user_info_os: 'ios' });
});

it('P-144: 키 없음 → setUserProps도 no-op', () => {
  const a = loadAnalytics(undefined);
  a.setUserProps({ user_info_country: 'US' });
  expect(mockIdentify).not.toHaveBeenCalled();
  expect(mockInit).not.toHaveBeenCalled();
});

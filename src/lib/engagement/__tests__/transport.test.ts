const mockTrack = jest.fn();
jest.mock('@amplitude/analytics-react-native', () => ({ init: jest.fn(), track: mockTrack }));

test('invalid area events never reach the SDK, valid areas and legacy calls still do', () => {
  const oldKey = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;
  process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY = 'test-key';
  jest.resetModules();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { track } = require('../../analytics') as typeof import('../../analytics');
    const names = ['screen_surface_impression', 'screen_surface_visible_time', 'screen_scroll_depth', 'screen_scroll_summary'] as const;
    for (const event of names) {
      track(event, { screen: 'scan', surface: 'body', area_id: 'card_1', depth: 25 });
      track(event, { screen: 'scan', surface: 'screen', area_id: 'screen_1' });
      track(event, { screen: 'scan', surface: 'card' });
    }
    expect(mockTrack).not.toHaveBeenCalled();
    track('screen_surface_impression', { screen: 'scan', surface: 'card', area_id: 'card_1' });
    track('review_submit');
    expect(mockTrack.mock.calls).toEqual([
      ['screen_surface_impression', { screen: 'scan', surface: 'card', area_id: 'card_1' }],
      ['review_submit', undefined],
    ]);
  } finally {
    if (oldKey === undefined) delete process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;
    else process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY = oldKey;
  }
});

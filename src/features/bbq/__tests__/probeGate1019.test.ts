const load = (channel: string | null | undefined) => {
  jest.resetModules();
  jest.doMock('expo-updates', () => ({ channel }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../probeGate') as typeof import('../probeGate')).isBbqProbeChannel();
};

it.each(['production', 'preview', 'teamtest', 'teamtest-prod'])('%s 채널은 닫힘', (ch) => {
  expect(load(ch)).toBe(false);
});

it.each(['development', 'demo'])('%s 채널은 열림', (ch) => {
  expect(load(ch)).toBe(true);
});

it('채널 부재는 __DEV__를 따름', () => {
  expect(load(null)).toBe(__DEV__);
  expect(load('')).toBe(__DEV__);
});

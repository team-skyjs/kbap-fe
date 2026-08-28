/**
 * P-059(KB-175): BE_BASE env 분기 잠금 — EXPO_PUBLIC_BE_BASE 있으면 그 값,
 * 없으면 prod fallback(P-067 — meogo 폐기).
 */
const ORIG = process.env.EXPO_PUBLIC_BE_BASE;
afterEach(() => {
  if (ORIG === undefined) delete process.env.EXPO_PUBLIC_BE_BASE;
  else process.env.EXPO_PUBLIC_BE_BASE = ORIG;
});

it('env 설정 시 그 값 사용 (dev.kbap.site 배선)', () => {
  process.env.EXPO_PUBLIC_BE_BASE = 'https://dev.kbap.site';
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BE_BASE } = require('../config');
    expect(BE_BASE).toBe('https://dev.kbap.site');
  });
});

it('env 부재 시 prod fallback (P-067 — meogo 폐기)', () => {
  delete process.env.EXPO_PUBLIC_BE_BASE;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BE_BASE } = require('../config');
    expect(BE_BASE).toBe('https://prod.kbap.site');
  });
});

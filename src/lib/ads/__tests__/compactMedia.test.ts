import { compactMediaSize } from '../compactMedia';
it.each([[16 / 9, 256, 144], [1, 256, 256], [9 / 16, 144, 256], [3 / 4, 192, 256], [4 / 3, 256, 192]])('image/video ratio %s stays intact', (ratio, width, height) => {
  for (const video of [false, true]) expect(compactMediaSize(335, ratio, video, 1)).toEqual({ width, height });
});
it('unknown image is contained; unknown video falls back', () => {
  expect(compactMediaSize(335, undefined, false, 2)).toEqual({ width: 256, height: 144 });
  expect(compactMediaSize(335, 0, true, 2)).toBeNull();
});
it('video checks layout minimum and physical pixels without overflowing available width', () => {
  expect(compactMediaSize(240, 16 / 9, true, 2)).toEqual({ width: 240, height: 135 });
  expect(compactMediaSize(240, 16 / 9, true, 1)).toBeNull();
  expect(compactMediaSize(200, 16 / 9, true, 3)).toBeNull();
  expect(compactMediaSize(200, 16 / 9, false, 3)).toEqual({ width: 200, height: 112.5 });
});
it.each([0.01, 100, NaN, Infinity, -1])('unsupported video ratio %s falls back', (ratio) => {
  expect(compactMediaSize(335, ratio, true, 3)).toBeNull();
});
it('extreme images and insufficient width fall back instead of cropping', () => {
  expect(compactMediaSize(335, 0.01, false, 2)).toBeNull();
  expect(compactMediaSize(335, 100, false, 2)).toBeNull();
  expect(compactMediaSize(0, 1, false, 2)).toBeNull();
});

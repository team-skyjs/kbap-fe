/**
 * KB-730 QA 10/9 — 네이티브 모듈 없는 구 빌드(OTA만 받은 빌드)에서 [좋아요] = `Cannot find native module 'ExpoStoreReview'` 치명 레드박스.
 * 이벤트 핸들러 안의 지연 require는 Metro guardedLoadModule이 예외를 삼키고 reportFatalError로 보고하므로 try/catch가 무력 —
 * require 전에 requireOptionalNativeModule로 존재를 판정하고, 없으면 expo-store-review를 **require조차 하지 않아야** 한다.
 */
import fs from 'fs';
import path from 'path';

const mockNative = jest.fn<unknown, [string]>();
jest.mock('expo-modules-core', () => ({
  ...jest.requireActual<typeof import('expo-modules-core')>('expo-modules-core'),
  requireOptionalNativeModule: (name: string) => mockNative(name),
}));

const mockLoaded = jest.fn();
const mockAvailable = jest.fn(async () => true);
const mockRequest = jest.fn(async () => undefined);
let mockModuleMissing = false;
jest.mock('expo-store-review', () => {
  mockLoaded();
  if (mockModuleMissing) throw new Error("Cannot find native module 'ExpoStoreReview'"); // 구 빌드의 모듈 초기화 실패 재현
  return { isAvailableAsync: () => mockAvailable(), requestReview: () => mockRequest() };
});

const load = () => {
  let m!: typeof import('@/lib/storeReview');
  jest.isolateModules(() => {
    m = jest.requireActual<typeof import('@/lib/storeReview')>('@/lib/storeReview');
  });
  return m;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockModuleMissing = false;
});

it('네이티브 모듈 부재(구 빌드): 좋아요 → throw 0 · false(종료 표시는 호출측) · expo-store-review require 0', async () => {
  mockNative.mockReturnValue(null);
  mockModuleMissing = true;
  const { requestStoreReview, isStoreReviewModuleInstalled } = load();
  await expect(requestStoreReview()).resolves.toBe(false);
  expect(mockLoaded).not.toHaveBeenCalled(); // 모듈 로드 자체가 없어야 Metro fatal 경로를 안 탄다(수정 전: 1회 로드 → 레드박스)
  expect(mockRequest).not.toHaveBeenCalled();
  expect(mockNative).toHaveBeenCalledWith('ExpoStoreReview');
  expect(isStoreReviewModuleInstalled()).toBe(false);
});

it('모듈 있음: isAvailable → requestReview → true / isAvailable=false → false·요청 0 / 호출이 던지면 false(조용히)', async () => {
  mockNative.mockReturnValue({});
  const { requestStoreReview, isStoreReviewModuleInstalled } = load();
  expect(isStoreReviewModuleInstalled()).toBe(true);
  await expect(requestStoreReview()).resolves.toBe(true);
  expect(mockLoaded).toHaveBeenCalledTimes(1);
  expect(mockRequest).toHaveBeenCalledTimes(1);

  mockAvailable.mockResolvedValueOnce(false);
  await expect(requestStoreReview()).resolves.toBe(false);
  expect(mockRequest).toHaveBeenCalledTimes(1);

  mockRequest.mockRejectedValueOnce(new Error('os refused'));
  await expect(requestStoreReview()).resolves.toBe(false);
});

it('존재 판정 자체가 던져도(모듈 레지스트리 이상) false — 레드박스 0', () => {
  mockNative.mockImplementation(() => { throw new Error('registry'); });
  expect(load().isStoreReviewModuleInstalled()).toBe(false);
});

it('소스 잠금: require 전에 requireOptionalNativeModule 판정 · 정적 import 0', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'storeReview.ts'), 'utf8');
  const probe = s.indexOf("requireOptionalNativeModule('ExpoStoreReview')");
  const req = s.indexOf("const SR = require('expo-store-review')");
  expect(probe).toBeGreaterThan(-1);
  expect(req).toBeGreaterThan(probe);
  expect(s).not.toMatch(/^import .* from 'expo-store-review'/m);
});

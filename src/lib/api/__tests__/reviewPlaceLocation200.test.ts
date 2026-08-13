/**
 * P-200: 리뷰 장소 실위치 전환 — 권한 허용/거절/미결정 좌표 분기 · 강남 폴백 ·
 * 재요청 없음(거절 이력) · 플러그인/플래그 소스 잠금.
 */
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/api/client', () => ({ api: { get: jest.fn().mockResolvedValue([]) }, apiLang: () => 'en' }));

const mockLoc = {
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
};
jest.mock('expo-location', () => mockLoc);

import { fetchNearbyPlaces, REVIEW_PLACE_FALLBACK_COORD, _resetCoordCacheForTest } from '../places';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require('@/lib/api/client') as { api: { get: jest.Mock } };
const lastUrl = () => api.get.mock.calls.at(-1)![0] as string;
const FALLBACK_Q = `latitude=${REVIEW_PLACE_FALLBACK_COORD.latitude}&longitude=${REVIEW_PLACE_FALLBACK_COORD.longitude}`;

beforeEach(() => {
  jest.clearAllMocks();
  _resetCoordCacheForTest();
  api.get.mockResolvedValue([]);
});

it('허용 = 실위치 좌표로 nearby 호출(강남 폴백 아님)', async () => {
  mockLoc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockLoc.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 35.1796, longitude: 129.0756 } }); // 부산
  await fetchNearbyPlaces();
  expect(lastUrl()).toBe('/api/places/nearby?latitude=35.1796&longitude=129.0756');
  expect(mockLoc.requestForegroundPermissionsAsync).not.toHaveBeenCalled(); // 기허용 = 팝업 없음
});

it('미결정 = OS 팝업 바로(사전 모달 없음) → 허용 시 실위치', async () => {
  mockLoc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
  mockLoc.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockLoc.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 37.5665, longitude: 126.978 } });
  await fetchNearbyPlaces();
  expect(mockLoc.requestForegroundPermissionsAsync).toHaveBeenCalled();
  expect(lastUrl()).toBe('/api/places/nearby?latitude=37.5665&longitude=126.978');
});

it('거절 = 재요청 없이 강남 폴백(P-201 경로 그대로 — 기능 전부 동작)', async () => {
  mockLoc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });
  await fetchNearbyPlaces();
  expect(mockLoc.requestForegroundPermissionsAsync).not.toHaveBeenCalled(); // iOS 1회성 — 조용히 폴백
  expect(lastUrl()).toBe(`/api/places/nearby?${FALLBACK_Q}`);
});

it('GPS 오류/모듈 부재 = 강남 폴백(크래시 0 — 구 런타임 동승 안전)', async () => {
  mockLoc.getForegroundPermissionsAsync.mockRejectedValue(new Error('native missing'));
  await fetchNearbyPlaces();
  expect(lastUrl()).toBe(`/api/places/nearby?${FALLBACK_Q}`);
});

it('실위치 60초 메모 — 시트 세션 내 키 입력마다 GPS 재조회 없음', async () => {
  mockLoc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockLoc.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 35.1, longitude: 129.0 } });
  await fetchNearbyPlaces();
  await fetchNearbyPlaces();
  expect(mockLoc.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
});

it('소스 잠금 — 플러그인 문구(iOS 사용 중 권한)·폴백 상수 유지·플래그 현행', () => {
  const fs = require('fs');
  const appJson = fs.readFileSync('app.json', 'utf8') as string;
  expect(appJson).toContain('"expo-location"');
  expect(appJson).toContain('locationWhenInUsePermission');
  expect(appJson).toContain('nearby restaurants you can tag in a review');
  expect(fs.readFileSync('src/lib/api/places.ts', 'utf8')).toContain('REVIEW_PLACE_FALLBACK_COORD = { latitude: 37.4979502, longitude: 127.0276368 }');
  expect(fs.readFileSync('src/lib/flags.ts', 'utf8')).toContain('reviewPlaceEnabled: !PROD_CHANNEL'); // 플래그 현행(발주 4)
});

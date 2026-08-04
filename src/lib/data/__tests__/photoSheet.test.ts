/**
 * P-049(KB-218): 사진 소스 선택 시트 + 촬영 경로 잠금.
 *  - iOS: 삭제 옵션은 사진 있을 때만(destructive), 인덱스→소스 매핑
 *  - Android: 시스템 Alert 3버튼(촬영/갤러리/취소 — 삭제는 화면 링크 담당)
 *  - 촬영: 권한 거부 → 설정 유도 Alert + null(흐름 불막음) / 허용 → launchCameraAsync 결과
 */
import { ActionSheetIOS, Alert, Platform } from 'react-native';

const mockRequestCam = jest.fn();
const mockLaunchCamera = jest.fn();
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: () => mockRequestCam(),
  launchCameraAsync: (o: unknown) => mockLaunchCamera(o),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('@/lib/api/scanImage', () => ({ uploadImage: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));

import { choosePhotoSource, pickBySource } from '../profileImage';

const LABELS = { title: 'T', camera: 'Cam', gallery: 'Gal', cancel: 'X' };
const PERM = { permTitle: 'PT', permBody: 'PB', openSettings: 'OS', cancel: 'X' };

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('choosePhotoSource — iOS ActionSheet', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });

  it('사진 없음: [촬영, 갤러리, 취소] — remove 미노출, 인덱스 매핑', async () => {
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((opts, cb) => cb(0));
    await expect(choosePhotoSource(LABELS)).resolves.toBe('camera');
    const opts = sheet.mock.calls[0][0];
    expect(opts.options).toEqual(['Cam', 'Gal', 'X']);
    expect(opts.destructiveButtonIndex).toBeUndefined();
  });

  it('사진 있음: 삭제 옵션 destructive(2), 취소는 null', async () => {
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((opts, cb) => cb(2));
    await expect(choosePhotoSource({ ...LABELS, remove: 'Rm' })).resolves.toBe('remove');
    const opts = sheet.mock.calls[0][0];
    expect(opts.options).toEqual(['Cam', 'Gal', 'Rm', 'X']);
    expect(opts.destructiveButtonIndex).toBe(2);
    sheet.mockImplementation((_o, cb) => cb(3));
    await expect(choosePhotoSource({ ...LABELS, remove: 'Rm' })).resolves.toBe(null);
  });
});

describe('choosePhotoSource — Android = 커뮤니티 ActionSheet 호스트 위임 (P-123, Alert 폐기)', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  });

  it('호스트 requestPhotoSourceSheet로 위임 — 라벨 통과·결과 그대로 반환', async () => {
    const host = require('@/components/PhotoSourceSheetHost') as typeof import('@/components/PhotoSourceSheetHost');
    const spy = jest.spyOn(host, 'requestPhotoSourceSheet').mockResolvedValue('camera');
    await expect(choosePhotoSource(LABELS)).resolves.toBe('camera');
    expect(spy).toHaveBeenCalledWith(LABELS);
    const alert = jest.spyOn(Alert, 'alert');
    expect(alert).not.toHaveBeenCalled(); // 시스템 Alert 경로 소멸
  });
});

describe('pickBySource — 촬영 경로', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });

  it('권한 거부 → 설정 유도 Alert + null (흐름 불막음)', async () => {
    mockRequestCam.mockResolvedValue({ granted: false });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await expect(pickBySource('camera', PERM)).resolves.toBe(null);
    expect(alert).toHaveBeenCalledWith('PT', 'PB', expect.any(Array));
    expect(mockLaunchCamera).not.toHaveBeenCalled();
  });

  it('허용 → launchCameraAsync(1:1 크롭 옵션) 결과 매핑', async () => {
    mockRequestCam.mockResolvedValue({ granted: true });
    mockLaunchCamera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:a.jpg', width: 100, height: 100 }] });
    await expect(pickBySource('camera', PERM)).resolves.toEqual({ uri: 'file:a.jpg', width: 100, height: 100 });
    expect(mockLaunchCamera.mock.calls[0][0]).toMatchObject({ allowsEditing: true, aspect: [1, 1] });
  });

  it('촬영 취소 → null', async () => {
    mockRequestCam.mockResolvedValue({ granted: true });
    mockLaunchCamera.mockResolvedValue({ canceled: true });
    await expect(pickBySource('camera', PERM)).resolves.toBe(null);
  });
});

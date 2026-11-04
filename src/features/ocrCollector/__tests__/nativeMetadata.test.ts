import * as App from 'expo-application';
import { Platform } from 'react-native';
import { identify } from '../native';
jest.mock('expo-file-system', () => ({ Directory: class {}, File: class {}, Paths: { document: 'file:///test/' } }));
jest.mock('expo-crypto', () => ({}));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('react-native-share', () => ({ open: jest.fn() }));
jest.mock('@/lib/scan/ocr', () => ({ recognizeMenuLines: jest.fn() }));
jest.mock('@/lib/deviceInfo', () => ({ collectDeviceInfo: () => ({ buildNumber: '1', appVersion: '1.0.4', osVersion: '26.4' }) }));
jest.mock('expo-application', () => ({ getIosApplicationReleaseTypeAsync: jest.fn(),
  ApplicationReleaseType: { UNKNOWN: 0, SIMULATOR: 1, DEVELOPMENT: 3, APP_STORE: 5 } }));
beforeEach(() => { Platform.OS = 'ios'; });
it('never promotes UNKNOWN or failed release lookup to a measured physical phone', async () => {
  (App.getIosApplicationReleaseTypeAsync as jest.Mock).mockResolvedValue(0);
  await expect(identify('iPhone', 'physical')).rejects.toThrow('DEVICE_KIND_UNKNOWN');
  (App.getIosApplicationReleaseTypeAsync as jest.Mock).mockRejectedValue(new Error('native missing'));
  await expect(identify('iPhone', 'physical')).rejects.toThrow();
});
it('rejects kind mismatch and records actual simulator release metadata', async () => {
  (App.getIosApplicationReleaseTypeAsync as jest.Mock).mockResolvedValue(1);
  await expect(identify('iPhone 17', 'physical')).rejects.toThrow('DEVICE_KIND');
  await expect(identify('iPhone 17', 'simulator')).resolves.toMatchObject({ kind: 'simulator', app_build: '1.0.4/1', script: 'KOREAN' });
});

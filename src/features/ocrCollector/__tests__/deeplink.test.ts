import { resolveDeeplink, SUPPORTED_DEEPLINKS } from '@/lib/deeplink';
import * as Updates from 'expo-updates';
jest.mock('expo-router', () => ({ router: {} }));
jest.mock('expo-updates', () => ({ channel: 'teamtest' }));
jest.mock('@/lib/data/config', () => ({ BE_BASE: 'https://dev.kbap.site' }));
it('opens the development tool through the real central handler and excludes public advertising links', () => {
  expect(resolveDeeplink('kbap://ocr-collector')).toBe('/ocr-collector');
  expect(SUPPORTED_DEEPLINKS).not.toContain('kbap://ocr-collector');
});
it('accepts the empty channel returned by a local dev client', () => {
  Object.defineProperty(Updates, 'channel', { value: '', configurable: true });
  expect(resolveDeeplink('kbap://ocr-collector')).toBe('/ocr-collector');
});
it('blocks both production channel and production backend before routing', () => {
  Object.defineProperty(Updates, 'channel', { value: 'production', configurable: true });
  expect(resolveDeeplink('kbap://ocr-collector')).toBeNull();
  Object.defineProperty(Updates, 'channel', { value: 'teamtest', configurable: true });
  jest.requireMock('@/lib/data/config').BE_BASE = 'https://prod.kbap.site';
  expect(resolveDeeplink('kbap://ocr-collector')).toBeNull();
});

/**
 * KB-1016: Play 사전 출시 로봇(Test Lab) — 판별 공용화(testLab.ts) + Amplitude 이벤트 드롭.
 * 로봇 contexts = REACT-NATIVE-10·13 실제 값(P-626과 같은 픽스처).
 */
/* eslint-disable @typescript-eslint/no-require-imports -- 플랫폼·키별 모듈 재로드 */
const ROBOT = {
  device: { manufacturer: 'OnePlus', brand: 'OnePlus', model: 'OnePlus8Pro', simulator: false },
  os: { name: 'Android', version: '11', kernel_version: 'Linux version 4.19.198-506490-g939f3fa30b83-dirty (android-build@apa28.mtv.corp.google.com) (Android (7284624, based on r416183b) clang version 12.0.5) #1 SMP PREEMPT' },
};
const REAL = { device: { manufacturer: 'samsung', brand: 'samsung' }, os: { name: 'Android', kernel_version: 'Linux version 5.15.104 (dpi@SWDK6103) #1 SMP PREEMPT' } };

function loadTestLab(os: string, fetch: jest.Mock) {
  jest.resetModules();
  jest.doMock('react-native', () => ({ Platform: { OS: os } }));
  jest.doMock('@sentry/react-native/dist/js/wrapper', () => ({ NATIVE: { fetchNativeDeviceContexts: fetch } }));
  return require('../testLab') as typeof import('../testLab');
}

afterEach(() => {
  jest.dontMock('react-native');
  jest.dontMock('@sentry/react-native/dist/js/wrapper');
  jest.useRealTimers();
});

describe('detectTestLab — 앱 시작 1회·캐시', () => {
  it('Android 로봇 = true, 두 번 불러도 네이티브 조회 1회', async () => {
    const fetch = jest.fn().mockResolvedValue({ contexts: ROBOT });
    const { detectTestLab } = loadTestLab('android', fetch);
    await expect(detectTestLab()).resolves.toBe(true);
    await expect(detectTestLab()).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('Android 실기기 = false', async () => {
    const { detectTestLab } = loadTestLab('android', jest.fn().mockResolvedValue({ contexts: REAL }));
    await expect(detectTestLab()).resolves.toBe(false);
  });
  it('iOS = false, 네이티브 조회 안 함', async () => {
    const fetch = jest.fn();
    const { detectTestLab } = loadTestLab('ios', fetch);
    await expect(detectTestLab()).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('Sentry 네이티브 미준비(null·throw) 뒤 준비되면 다시 물어 판별', async () => {
    jest.useFakeTimers();
    const fetch = jest.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('not ready')).mockResolvedValue({ contexts: ROBOT });
    const { detectTestLab } = loadTestLab('android', fetch);
    const p = detectTestLab();
    await jest.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('끝내 못 받으면 false(보냄) — 3회까지만', async () => {
    jest.useFakeTimers();
    const fetch = jest.fn().mockResolvedValue(null);
    const { detectTestLab } = loadTestLab('android', fetch);
    const p = detectTestLab();
    await jest.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe('Amplitude — 로봇이면 전송 없음, 실기기는 유지', () => {
  function loadAnalytics(robot: boolean) {
    jest.resetModules();
    process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY = 'test-key';
    const add = jest.fn();
    jest.doMock('@amplitude/analytics-react-native', () => ({ init: jest.fn(), track: jest.fn(), add }));
    jest.doMock('../testLab', () => ({ detectTestLab: () => Promise.resolve(robot), isTestLabContexts: () => robot }));
    const a = require('../analytics') as typeof import('../analytics');
    a.track('app_opened');
    expect(add).toHaveBeenCalledTimes(1); // init과 함께 1회 등록
    return add.mock.calls[0][0] as { type: string; execute: (e: object) => Promise<object | null> };
  }
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;
    jest.dontMock('@amplitude/analytics-react-native');
    jest.dontMock('../testLab');
  });
  it('로봇 = enrichment가 null(타임라인 드롭)', async () => {
    const plugin = loadAnalytics(true);
    expect(plugin.type).toBe('enrichment');
    await expect(plugin.execute({ event_type: 'app_opened' })).resolves.toBeNull();
  });
  it('실기기 = 이벤트 그대로', async () => {
    const plugin = loadAnalytics(false);
    const e = { event_type: 'app_opened' };
    await expect(plugin.execute(e)).resolves.toBe(e);
  });
});

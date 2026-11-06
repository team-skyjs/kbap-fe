/**
 * P-626: Play 사전 출시 로봇(Firebase Test Lab) JS 이벤트 제외 — beforeSend.
 * 로봇 픽스처 = REACT-NATIVE-10·13 실제 contexts(커맨드 제공). Pixel·일반 기기 = 보냄.
 */
/* eslint-disable import/first -- jest.mock 뒤 */
const mockInit = jest.fn();
jest.mock('@sentry/react-native', () => ({ init: (o: unknown) => mockInit(o) }));
jest.mock('@/lib/flags', () => ({ FLAGS: {}, isProdChannel: () => true, isDiagnosticChannel: () => false }));

import { initSentry, isTestLabEvent } from '../sentry';

const ROBOT = {
  contexts: {
    device: { manufacturer: 'OnePlus', brand: 'OnePlus', model: 'OnePlus8Pro', simulator: false, processor_count: 2 },
    os: {
      name: 'Android',
      version: '11',
      kernel_version:
        'Linux version 4.19.198-506490-g939f3fa30b83-dirty (android-build@apa28.mtv.corp.google.com) (Android (7284624, based on r416183b) clang version 12.0.5) #1 SMP PREEMPT Thu Oct 6 00:48:31 UTC 2022',
    },
  },
};
const ev = (manufacturer: string, brand: string, kernel: string, name = 'Android') => ({
  contexts: { device: { manufacturer, brand }, os: { name, kernel_version: kernel } },
});

describe('isTestLabEvent', () => {
  it('로봇(OnePlus 표기 + 구글 사내 빌드 커널) = 제외', () => {
    expect(isTestLabEvent(ROBOT)).toBe(true);
  });
  it('실기 Pixel = 보냄 — abfarm 커널, 그리고 .google.com 커널이어도 제조사·브랜드 Google이면 보냄', () => {
    expect(isTestLabEvent(ev('Google', 'google', 'Linux version 5.10.157 (android-build@abfarm-release-rbe-64-00044) #1'))).toBe(false);
    expect(isTestLabEvent(ev('Google', 'google', 'Linux version 4.19.110 (android-build@wphr1.hot.corp.google.com) #1'))).toBe(false);
    // 브랜드만 google이어도 보냄(두 조건 각각 살아 있는지)
    expect(isTestLabEvent(ev('Foxconn', 'google', ROBOT.contexts.os.kernel_version))).toBe(false);
    expect(isTestLabEvent(ev('Google', 'Pixel', ROBOT.contexts.os.kernel_version))).toBe(false);
  });
  it('일반 기기(samsung dpi@ 커널)·iOS·컨텍스트 없음 = 보냄', () => {
    expect(isTestLabEvent(ev('samsung', 'samsung', 'Linux version 5.15.104 (dpi@SWDK6103) #1 SMP PREEMPT'))).toBe(false);
    expect(isTestLabEvent(ev('OnePlus', 'OnePlus', ROBOT.contexts.os.kernel_version, 'iOS'))).toBe(false);
    expect(isTestLabEvent({})).toBe(false);
    expect(isTestLabEvent({ contexts: { os: { name: 'Android' } } })).toBe(false);
  });
  it('init beforeSend 배선 — 로봇은 null, 일반 이벤트는 그대로', () => {
    initSentry();
    const { beforeSend } = mockInit.mock.calls[0][0] as { beforeSend: (e: object) => object | null };
    expect(beforeSend(ROBOT)).toBeNull();
    const normal = ev('samsung', 'samsung', 'Linux version 5.15 (dpi@x) #1');
    expect(beforeSend(normal)).toBe(normal);
  });
});

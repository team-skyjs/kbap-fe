/**
 * P-381(KB-541 후속) — Linking 실패가 조용히 삼켜지지 않는다.
 *
 * 9/15 Sentry REACT-NATIVE-A: iOS 심사 기기에서 설정 열기가 거부됐는데 `void`가
 * 거부를 잡지 않아 unhandled rejection으로 흘렀다 — 사용자는 눌러도 아무 일이 없었다.
 *
 * ⚠️ 잠금은 **글롭 순회**다. P-196이 검사 대상 6파일을 손으로 적어 둔 탓에
 * 잠근 뒤 생긴 파일과 잠글 때 못 찾은 파일 **양쪽으로 뚫렸다**(bridge/TODO.md).
 * 전수 성격 규칙은 목록이 아니라 순회로 건다.
 */
const mockOpenBrowser = jest.fn();
const mockToast = jest.fn();

jest.mock('expo-web-browser', () => ({ openBrowserAsync: (u: string) => mockOpenBrowser(u) }));
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  __esModule: true,
  default: { openURL: jest.fn(), openSettings: jest.fn() },
}));
jest.mock('@/components/topToastStore', () => ({
  showTopToast: (text: string, opts?: unknown) => mockToast(text, opts),
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));

import { Linking } from 'react-native';
import { openAppSettings, openStoreLink } from '../openExternal';

const mockOpenSettings = Linking.openSettings as jest.Mock;
const mockOpenURL = Linking.openURL as jest.Mock;
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

beforeEach(() => {
  jest.clearAllMocks();
  mockOpenSettings.mockResolvedValue(undefined);
  mockOpenURL.mockResolvedValue(undefined);
});

describe('설정 열기', () => {
  it('성공 = 토스트 없음 + true', async () => {
    await expect(openAppSettings()).resolves.toBe(true);
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('거부 = 설정 전용 문구 토스트 + false(무반응 금지)', async () => {
    mockOpenSettings.mockRejectedValue(new Error('Unable to open URL: app-settings:'));
    await expect(openAppSettings()).resolves.toBe(false);
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith('states.settingsFailed', { error: true });
  });

  it('설정 실패에 링크 문구를 재사용하지 않는다 — 눌린 것과 문구가 어긋나면 안 된다', async () => {
    mockOpenSettings.mockRejectedValue(new Error('x'));
    await openAppSettings();
    expect(mockToast).not.toHaveBeenCalledWith('states.linkFailed', expect.anything());
  });
});

describe('스토어 딥링크', () => {
  it('성공 = 스토어 앱으로 직행(인앱 브라우저 미사용)', async () => {
    await expect(openStoreLink('https://apps.apple.com/app/id123')).resolves.toBe(true);
    expect(mockOpenURL).toHaveBeenCalledWith('https://apps.apple.com/app/id123');
    expect(mockOpenBrowser).not.toHaveBeenCalled(); // 딥링크를 웹뷰로 대체하면 업데이트가 안 된다
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('거부 = 토스트 + false — 조용히 넘기면 사용자가 업데이트를 못 한다', async () => {
    mockOpenURL.mockRejectedValue(new Error('Unable to open URL'));
    await expect(openStoreLink('https://apps.apple.com/app/id123')).resolves.toBe(false);
    expect(mockToast).toHaveBeenCalledWith('states.linkFailed', { error: true });
  });
});

describe('전수 잠금(글롭 순회 — 파일 목록 하드코딩 금지)', () => {
  /** src/ 아래 .ts·.tsx 전부(테스트·__mocks__ 제외). */
  const sourceFiles = (): string[] => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === '__tests__' || e.name === '__mocks__' || e.name === 'node_modules') continue;
          walk(full);
        } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
          out.push(full);
        }
      }
    };
    walk('src');
    return out;
  };
  /** 주석 제거 — 규정을 설명하는 주석이 자기 잠금에 걸리면 안 된다. */
  const codeOf = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  it('순회 자체가 유효하다 — 최소 100파일 이상 읽는다(경로 오타로 0건 통과 방지)', () => {
    expect(sourceFiles().length).toBeGreaterThan(100);
  });

  it('`void Linking.` 잔존 0 — 거부가 unhandled rejection으로 새지 않는다', () => {
    const offenders = sourceFiles().filter((f) => /void\s+Linking\./.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });

  it('설정 열기·스토어 이동은 공용 헬퍼 경유 — 화면에서 Linking 직접 호출 0', () => {
    const offenders = sourceFiles()
      .filter((f) => f !== 'src/lib/openExternal.ts' && f !== 'src/features/community/placeMap.tsx')
      .filter((f) => /Linking\.(openSettings|openURL)\s*\(/.test(codeOf(f)));
    // placeMap = 지도 앱 딥링크(별도 계약, openMap 안에서 try/catch) — 예외는 이 줄이 유일
    expect(offenders).toEqual([]);
  });

  it('신규 키 states.settingsFailed 10로케일 + 기존 linkFailed 존속', () => {
    for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
      const j = JSON.parse(read(`src/lib/i18n/${loc}.json`)) as { states: Record<string, string> };
      expect(j.states.settingsFailed).toBeTruthy();
      expect(j.states.linkFailed).toBeTruthy();
      expect(j.states.settingsFailed).not.toBe(j.states.linkFailed); // 문구가 갈려 있어야 한다
    }
  });
});

describe('P-381 2R(Codex P2) — 하드 게이트는 인라인, 소프트 넛지는 토스트', () => {
  const codeOf = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  it('커버 elevation > 토스트 elevation — 안드에서 토스트가 커버 뒤에 깔린다(값 대소 잠금)', () => {
    const num = (src: string, key: string) => {
      const m = src.match(new RegExp(`${key}:\\s*(\\d+)`));
      return m ? Number(m[1]) : NaN;
    };
    const coverElevation = num(read('src/components/VersionGate.tsx').split('cover:')[1], 'elevation');
    const toastElevation = num(read('src/components/TopToast.tsx').split('toast:')[1], 'elevation');
    expect(Number.isFinite(coverElevation)).toBe(true);
    expect(Number.isFinite(toastElevation)).toBe(true);
    // 이 관계가 성립하는 한 하드 게이트에서 토스트는 보이지 않는다 → 인라인 경로가 필수다.
    // 누가 값을 뒤집으면 이 단언이 깨지고, 그때 인라인 경로를 재검토하면 된다.
    expect(coverElevation).toBeGreaterThan(toastElevation);
  });

  it('하드 게이트 = silent 호출 + 인라인 문구 / 소프트 넛지 = 토스트(경로가 갈려 있다)', () => {
    const vg = codeOf('src/components/VersionGate.tsx');
    // 커버 안: 반환값으로 실패를 받아 화면에 띄운다 + 보이지도 않을 토스트는 띄우지 않는다
    expect(vg).toContain('{ silent: true }');
    expect(vg).toContain('setStoreFailed(!ok)');
    expect(vg).toContain('testID="version-gate-store-error"');
    expect(vg).toContain("t('versionGate.storeFailed')");
    // 넛지 배너: 옵션 없는 호출 = 공용 토스트 경로
    expect(vg).toContain('void openStoreLink(gate.storeUrl!)}>');
  });

  it('storeFailed 10로케일 — 링크·설정 문구와 각각 다르다', () => {
    for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
      const j = JSON.parse(read(`src/lib/i18n/${loc}.json`)) as {
        versionGate: Record<string, string>;
        states: Record<string, string>;
      };
      expect(j.versionGate.storeFailed).toBeTruthy();
      expect(j.versionGate.storeFailed).not.toBe(j.states.linkFailed);
      expect(j.versionGate.storeFailed).not.toBe(j.states.settingsFailed);
    }
  });
});

it('openStoreLink silent = 토스트 0(호출부가 직접 알린다) · 기본 = 토스트 1', async () => {
  mockOpenURL.mockRejectedValue(new Error('Unable to open URL'));
  await expect(openStoreLink('https://apps.apple.com/app/id1', { silent: true })).resolves.toBe(false);
  expect(mockToast).not.toHaveBeenCalled();
  await expect(openStoreLink('https://apps.apple.com/app/id1')).resolves.toBe(false);
  expect(mockToast).toHaveBeenCalledTimes(1);
});

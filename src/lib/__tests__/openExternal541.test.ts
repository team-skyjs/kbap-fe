/**
 * P-377(KB-541) — 정보성 https 링크 = 인앱 브라우저(WebBrowser) → Linking 폴백 → 토스트.
 * Sentry REACT-NATIVE-9(iOS Unable to open URL)의 근본 원인 = 외부 브라우저 위임 의존.
 */
const mockOpenBrowser = jest.fn();
const mockToast = jest.fn();

jest.mock('expo-web-browser', () => ({ openBrowserAsync: (u: string) => mockOpenBrowser(u) }));
// Linking 실모듈은 NativeEventEmitter를 물고 올라와 워커가 정상 종료되지 않는다
// (react-native 통짜 목은 jest-expo 프리셋의 Platform.select를 깨뜨림) → 딥 경로만 목.
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  __esModule: true, // RN index가 default를 재수출한다
  default: { openURL: jest.fn() },
}));
jest.mock('@/components/topToastStore', () => ({
  showTopToast: (text: string, opts?: unknown) => mockToast(text, opts),
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));

import { Linking } from 'react-native';
import { openWebPage } from '../openExternal';

const mockOpenURL = Linking.openURL as jest.Mock;

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;
const URL = 'https://team-skyjs.github.io/kbap-legal/terms-of-service.html';

beforeEach(() => {
  jest.clearAllMocks();
  mockOpenBrowser.mockResolvedValue({ type: 'opened' });
  mockOpenURL.mockResolvedValue(undefined);
});

it('① 정상 = 인앱 브라우저로 열고 Linking·토스트 없음', async () => {
  await expect(openWebPage(URL)).resolves.toBe(true);
  expect(mockOpenBrowser).toHaveBeenCalledWith(URL);
  expect(mockOpenURL).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
});

it('② 인앱 브라우저 실패 = Linking 폴백(토스트 없음)', async () => {
  mockOpenBrowser.mockRejectedValue(new Error('no browser module'));
  await expect(openWebPage(URL)).resolves.toBe(true);
  expect(mockOpenURL).toHaveBeenCalledWith(URL);
  expect(mockToast).not.toHaveBeenCalled();
});

it('③ 둘 다 실패 = 오류 토스트 1회 + false(무반응 금지)', async () => {
  mockOpenBrowser.mockRejectedValue(new Error('no browser module'));
  mockOpenURL.mockRejectedValue(new Error('Unable to open URL')); // 실사고 예외
  await expect(openWebPage(URL)).resolves.toBe(false);
  expect(mockToast).toHaveBeenCalledTimes(1);
  expect(mockToast).toHaveBeenCalledWith('states.linkFailed', { error: true });
});

it('적용 4표면 = openWebPage 경유 · Linking.openURL 잔재 0', () => {
  const surfaces = ['src/app/login.tsx', 'src/app/(tabs)/profile.tsx', 'src/features/scan/ScanRichList.tsx'];
  for (const f of surfaces) {
    const s = read(f);
    expect(s).toContain('openWebPage(');
    expect(s).not.toContain('Linking.openURL'); // 이 3파일엔 웹페이지 링크만 있었다
  }
  const login = read('src/app/login.tsx');
  expect(login).toContain('openWebPage(LEGAL_URLS.terms)');
  expect(login).toContain('openWebPage(LEGAL_URLS.privacy)');
  const profile = read('src/app/(tabs)/profile.tsx');
  expect((profile.match(/openWebPage\(SAFETY_NOTICE_URL\)/g) ?? []).length).toBe(2); // 게스트·회원 두 분기
  expect(profile).toContain('Linking.openSettings()'); // OS 설정은 Linking 유지
  expect(read('src/lib/legalText.ts')).toContain("export const SAFETY_NOTICE_URL = 'https://team-skyjs.github.io/kbap-legal/safety.html'");
});

it('네이티브 앱 딥링크는 Linking 유지(전환 금지) — 스토어·지도', () => {
  const vg = read('src/components/VersionGate.tsx');
  expect(vg).toContain('Linking.openURL(gate.storeUrl!)'); // 스토어 앱으로 열려야 함
  expect(vg).not.toContain('openWebPage');
  const map = read('src/features/community/placeMap.tsx');
  expect(map).toContain('Linking.openURL(app)'); // 지도 앱 스킴
  expect(map).not.toContain('openWebPage');
});

it('신규 키 states.linkFailed 10로케일', () => {
  for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
    const j = JSON.parse(read(`src/lib/i18n/${loc}.json`)) as { states: Record<string, string> };
    expect(j.states.linkFailed).toBeTruthy();
  }
  expect((JSON.parse(read('src/lib/i18n/ko.json')) as { states: Record<string, string> }).states.linkFailed).toBe('링크를 열 수 없어요');
});

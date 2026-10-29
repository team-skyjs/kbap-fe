/** KB-904 — 설정 딥링크(T-080·T-025) · 저장 파일명(T-027) · 화면 소스 잠금(T-078·T-079·T-081·T-082·T-086·T-087·T-095·T-097) */
import * as fs from 'fs';
import { Linking, Platform } from 'react-native';

const mockToast = jest.fn();
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
// Linking 실모듈은 NativeEventEmitter를 물고 올라와 워커가 안 끝난다 — 딥 경로만 목(openExternal541과 같은 방식)
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  __esModule: true,
  default: { openURL: jest.fn(), openSettings: jest.fn(), sendIntent: jest.fn() },
}));
jest.mock('@/components/topToastStore', () => ({ showTopToast: (text: string, opts?: unknown) => mockToast(text, opts) }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));

// eslint-disable-next-line import/first -- jest.mock 뒤
import { openNotificationSettings } from '../openExternal';
// eslint-disable-next-line import/first
import { shareFileName } from '@/features/order/shareExport';

const sendIntent = Linking.sendIntent as jest.Mock;
const openSettings = Linking.openSettings as jest.Mock;
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
const read = (p: string) => fs.readFileSync(p, 'utf8');

beforeEach(() => jest.clearAllMocks());

describe('T-080 알림 설정 = 이 앱 알림 페이지', () => {
  it('안드 = APP_NOTIFICATION_SETTINGS + 패키지 extra(데이터 URI 없이 resolve — API 35 에뮬 확인) · 앱 설정 안 감', async () => {
    setOS('android');
    sendIntent.mockResolvedValueOnce(undefined);
    expect(await openNotificationSettings()).toBe(true);
    expect(sendIntent).toHaveBeenCalledWith('android.settings.APP_NOTIFICATION_SETTINGS', [{ key: 'android.provider.extra.APP_PACKAGE', value: 'com.rocher.kbap' }]);
    expect(openSettings).not.toHaveBeenCalled();
  });
  it('안드 인텐트 실패 = 앱 설정 폴백 · 그것도 실패 = 설정 실패 토스트', async () => {
    setOS('android');
    sendIntent.mockRejectedValueOnce(new Error('no activity'));
    openSettings.mockResolvedValueOnce(undefined);
    expect(await openNotificationSettings()).toBe(true);
    expect(openSettings).toHaveBeenCalledTimes(1);
    sendIntent.mockRejectedValueOnce(new Error('no activity'));
    openSettings.mockRejectedValueOnce(new Error('nope'));
    expect(await openNotificationSettings()).toBe(false);
    expect(mockToast).toHaveBeenCalledWith('states.settingsFailed', { error: true });
  });
  it('iOS = 앱 설정 페이지(알림 행이 그 안) · 인텐트 0', async () => {
    setOS('ios');
    openSettings.mockResolvedValueOnce(undefined);
    expect(await openNotificationSettings()).toBe(true);
    expect(sendIntent).not.toHaveBeenCalled();
  });
  it('배선 = 알림 배너·스캔 넛지 "기기 설정 열기" 둘 다 이 헬퍼', () => {
    expect(read('src/app/profile/notifications.tsx')).toContain('void openNotificationSettings(); }}');
    expect(read('src/features/push/PushPrimerModal.tsx')).toContain('if (!(await openNotificationSettings())) cancel();');
  });
});

it('T-025 언어 = 앱 설정 + 안드는 누르기 전 안내 한 줄(앱 언어 직행은 package: 데이터 URI가 필요해 RN으로 못 보냄) · 10로케일', () => {
  const pf = read('src/app/(tabs)/profile.tsx');
  expect(pf).toContain("{Platform.OS === 'android' && <Text style={styles.langHint} testID=\"profile-language-hint\">{t('profile.languageHintAndroid')}</Text>}");
  expect(read('src/app/profile/edit.tsx')).toContain("t('profile.languageHintAndroid')");
  for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi']) {
    const d = JSON.parse(read(`src/lib/i18n/${l}.json`));
    expect({ l, hint: typeof d.profile.languageHintAndroid, meal: typeof d.notif.mealTimeNeedsNews }).toEqual({ l, hint: 'string', meal: 'string' });
    // T-078: 연동 계정 값 = 상태(브랜드명) — "Sign in with Google"이 버튼처럼 읽혔다
    expect({ l, a: d.editProfile.linkedApple, g: d.editProfile.linkedGoogle }).toEqual({ l, a: 'Apple', g: 'Google' });
  }
});

it('T-027 저장 파일명 = kbap-order-YYYYMMDD(로컬 날짜) · 정확한 이름으로 복사(view-shot fileName은 안드 접두어만)', () => {
  expect(shareFileName(new Date(2026, 9, 5))).toBe('kbap-order-20261005');
  const ex = read('src/features/order/shareExport.ts');
  expect(ex).toContain('const named = `${FileSystem.cacheDirectory}${shareFileName()}.png`;');
  const en = JSON.parse(read('src/lib/i18n/en.json')).myFoods;
  expect([en.shareDownloadInline, en.shareDownload]).toEqual(['Share image', 'Save to\nphotos']); // 1단계 공유 · 시트 안 사진 저장
});

it('T-078·T-079·T-086 저장 버튼 하나 + 바뀐 게 없으면 비활성(off·onPress 없음)', () => {
  const ed = read('src/app/profile/edit.tsx');
  expect(ed).not.toContain('edit-save-header');
  expect(ed).toContain("variant={photoBusy || !dirty ? 'off' : 'primary'}");
  expect(ed).toContain("{t('profile.language')}"); // "Reader language" ↔ 메뉴 "Language" 통일
  const rs = read('src/app/profile/restrictions.tsx');
  expect(rs).not.toContain('restrictions-save-header');
  expect(rs).toContain("variant={dirty ? 'primary' : 'off'} busy={saving} onPress={dirty ? save : undefined}");
  expect(read('src/app/profile/diet.tsx')).toContain("variant={dirty ? 'primary' : 'off'} busy={saving} onPress={dirty ? save : undefined} testID=\"diet-save\"");
});

it('T-081·T-097 알림: 소식 OFF = 식사 알림 아래 이유 · OS 꺼짐이면 겹쳐 흐리지 않음 · 외톨이 구분선 0', () => {
  const nt = read('src/app/profile/notifications.tsx');
  expect(nt).toContain("{!s.news.enabled && <Text style={styles.captionText} testID=\"notif-mealtime-why\">{t('notif.mealTimeNeedsNews')}</Text>}");
  expect(nt).toContain('<View style={[!s.news.enabled && !osOff && styles.rowDisabled]} testID="notif-mealtime-row">');
  expect(nt).not.toContain('styles.hair');
});

it('T-082·T-087·T-095 소스 잠금', () => {
  const pf = read('src/app/(tabs)/profile.tsx');
  expect(pf).toContain('<Text style={styles.natText} testID="nation-lang">{LANG_ENDONYM[lang] ?? lang}</Text>'); // EN → English
  expect(pf).not.toContain("lang.split('-')[0].toUpperCase()");
  const del = read('src/app/delete-account.tsx');
  expect(del).toContain('<View style={styles.bulletIconSlot} />');
  expect(del).not.toMatch(/consent: \{[^}]*justifyContent: 'center'/);
  expect(del).toContain('paddingTop: 24 }');
  expect(read('src/app/profile/order/[id].tsx')).toContain('testID={`order-item-chevron-${k}`}');
});

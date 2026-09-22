/**
 * KB-631(spec 006) — 첫 설치 로그인 화면 OS 알림 권한 즉시 요청.
 * ① promptPermissionOnFirstLogin 시퀀스(contracts §1 표) ② in-flight 합치기
 * ③ applyPendingActivityDefault(서버 activity 기본 false 보정, R-4) ④ 생애주기(재설치·계정 전환) ⑤ 소스 잠금.
 */
import * as fs from 'fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyPendingActivityDefault, getPrimerResult, promptPermissionOnFirstLogin } from '../pushAdapter';

jest.mock('@/lib/flags', () => ({ FLAGS: { pushEnabled: true }, isProdChannel: () => false, SYSTEM_CAMERA_AUTOLAUNCH: false }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockNotifications = {
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[t]' }),
};
jest.mock('expo-notifications', () => mockNotifications);
const mockApi = { put: jest.fn().mockResolvedValue(undefined) };
jest.mock('@/lib/api/client', () => ({ get api() { return mockApi; }, apiLang: () => 'en' }));
const mockSession = { hasBeSession: jest.fn().mockResolvedValue(true) };
jest.mock('@/lib/auth/beAuth', () => ({ get hasBeSession() { return mockSession.hasBeSession; } }));
const mockAnalytics = { track: jest.fn() };
jest.mock('@/lib/analytics', () => ({ EVENTS: { push_permission: 'push_permission' }, get track() { return mockAnalytics.track; } }));
const mockSettings = { patch: jest.fn().mockResolvedValue(undefined) };
jest.mock('@/lib/data/useNotificationSettings', () => ({
  NOTIF_SETTINGS_KEY: ['notifSettings'],
  get patchNotificationSettings() { return mockSettings.patch; },
}));


const PENDING_KEY = 'kbap.push.activityDefaultPending.v1';
const pending = () => AsyncStorage.getItem(PENDING_KEY);
const os = (...statuses: string[]) => {
  mockNotifications.getPermissionsAsync.mockReset();
  for (const s of statuses) mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: s });
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockSession.hasBeSession.mockResolvedValue(true);
  mockSettings.patch.mockResolvedValue(undefined);
  mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  await AsyncStorage.clear();
});

describe('promptPermissionOnFirstLogin — 시퀀스 (FR-001~004)', () => {
  it('미결정 → OS 요청 1회 → 허용 = accepted 기록 + 대기 표식 + push_permission grant(기존 계측 그 자리)', async () => {
    os('undetermined', 'granted');
    await promptPermissionOnFirstLogin();
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(await getPrimerResult()).toBe('accepted');
    expect(await pending()).toBe('1');
    expect(mockAnalytics.track).toHaveBeenCalledWith('push_permission', { state: 'grant' });
    expect(mockApi.put).not.toHaveBeenCalled(); // 게스트 — 서버 요청 0
    expect(mockSettings.patch).not.toHaveBeenCalled();
  });

  it('미결정 → 거부 = declined 기록, 표식 없음', async () => {
    os('undetermined', 'denied');
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await promptPermissionOnFirstLogin();
    expect(await getPrimerResult()).toBe('declined');
    expect(await pending()).toBeNull();
  });

  it('OS가 이미 허용(재설치 기억) = 요청 0·계측 0, accepted 기록 + 표식 (US1 AS6)', async () => {
    os('granted');
    await promptPermissionOnFirstLogin();
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockAnalytics.track).not.toHaveBeenCalled();
    expect(await getPrimerResult()).toBe('accepted');
    expect(await pending()).toBe('1');
  });

  it('OS가 이미 거부 = 요청 0, declined 기록', async () => {
    os('denied');
    await promptPermissionOnFirstLogin();
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(await getPrimerResult()).toBe('declined');
    expect(await pending()).toBeNull();
  });

  it('응답 기록이 있으면 OS 조회·요청 0 (FR-002)', async () => {
    await AsyncStorage.setItem('kbap.push.prompted.v1', 'declined');
    os('undetermined');
    await promptPermissionOnFirstLogin();
    expect(mockNotifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('권한 조회 예외(unavailable) = 기록 0 — 스캔 시트·설정 배너로 이월', async () => {
    mockNotifications.getPermissionsAsync.mockReset().mockRejectedValue(new Error('boom'));
    await expect(promptPermissionOnFirstLogin()).resolves.toBeUndefined();
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(await getPrimerResult()).toBeNull();
  });

  it('요청 예외(재조회도 미결정) = 기록 0 — 예외는 결과가 아니다', async () => {
    os('undetermined', 'undetermined');
    mockNotifications.requestPermissionsAsync.mockRejectedValue(new Error('boom'));
    await expect(promptPermissionOnFirstLogin()).resolves.toBeUndefined();
    expect(await getPrimerResult()).toBeNull();
    expect(await pending()).toBeNull();
  });

  it('동시 재호출(리마운트) = OS 요청 1회 (Edge: 결과 처리 1회)', async () => {
    os('undetermined', 'granted');
    await Promise.all([promptPermissionOnFirstLogin(), promptPermissionOnFirstLogin()]);
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});

describe('applyPendingActivityDefault — 로그인 성공 직후 1회 (FR-010)', () => {
  it('표식 있음 + 세션 = PATCH {activity:true} 1회 후 표식 삭제', async () => {
    await AsyncStorage.setItem(PENDING_KEY, '1');
    await applyPendingActivityDefault();
    expect(mockSettings.patch).toHaveBeenCalledTimes(1);
    expect(mockSettings.patch).toHaveBeenCalledWith({ activity: true });
    expect(await pending()).toBeNull();
  });

  it('표식 없음 = PATCH 0', async () => {
    await applyPendingActivityDefault();
    expect(mockSettings.patch).not.toHaveBeenCalled();
  });

  it('세션 없음 = PATCH 0, 표식 유지(다음 로그인으로 이월)', async () => {
    await AsyncStorage.setItem(PENDING_KEY, '1');
    mockSession.hasBeSession.mockResolvedValue(false);
    await applyPendingActivityDefault();
    expect(mockSettings.patch).not.toHaveBeenCalled();
    expect(await pending()).toBe('1');
  });

  it('PATCH 실패도 표식 삭제(비치명 — 설정 화면에서 직접 켤 수 있음, 프라이머와 동일 정책)', async () => {
    await AsyncStorage.setItem(PENDING_KEY, '1');
    mockSettings.patch.mockRejectedValue(new Error('401'));
    await expect(applyPendingActivityDefault()).resolves.toBeUndefined();
    expect(await pending()).toBeNull();
  });
});

describe('계정 생애주기', () => {
  it('재설치(스토리지 초기화) = 다시 판정 — OS 기억 허용이면 요청 0·기록·표식 재생성', async () => {
    os('undetermined', 'granted');
    await promptPermissionOnFirstLogin();
    await AsyncStorage.clear(); // 재설치 = AsyncStorage 소멸
    os('granted');
    await promptPermissionOnFirstLogin();
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(await getPrimerResult()).toBe('accepted');
    expect(await pending()).toBe('1');
  });

  it('계정 전환(A 로그인 → B 로그인) = 표식은 첫 로그인에서 소진, 두 번째 PATCH 0 — 끈 값 되돌리지 않음', async () => {
    os('granted');
    await promptPermissionOnFirstLogin();
    await applyPendingActivityDefault(); // A
    await applyPendingActivityDefault(); // B
    expect(mockSettings.patch).toHaveBeenCalledTimes(1);
  });
});

describe('소스 잠금 (contracts §2)', () => {
  const read = (p: string) => fs.readFileSync(p, 'utf8');
  it('login.tsx: entry=intro && returnTo 없음 → promptPermissionOnFirstLogin', () => {
    const src = read('src/app/login.tsx');
    expect(src).toContain("entry === 'intro' && returnTo == null");
    expect(src).toContain('whenSplashDone().then(() => promptPermissionOnFirstLogin())'); // Codex P1: 스플래시 오버레이 뒤
  });
  it('_layout.tsx: AnimatedSplash onDone → markSplashDone (로그인 팝업 게이트의 유일한 resolve 지점)', () => {
    expect(read('src/app/_layout.tsx')).toContain('setSplashVisible(false); markSplashDone();');
  });
  it('useSocialAuth.ts: 세션 교환 성공 직후 registerPushToken 옆 applyPendingActivityDefault', () => {
    const src = read('src/lib/auth/useSocialAuth.ts');
    expect(src).toContain('void registerPushToken();');
    expect(src).toContain('void applyPendingActivityDefault();');
  });
  it('첫 설치 경로·스캔 시트 게이트 무변 — _layout replace(entry=intro) · scan getPrimerResult', () => {
    expect(read('src/app/_layout.tsx')).toContain("router.replace('/login?entry=intro' as Href)");
    expect(read('src/app/scan.tsx')).toContain('getPrimerResult().then((r) => {');
  });
});

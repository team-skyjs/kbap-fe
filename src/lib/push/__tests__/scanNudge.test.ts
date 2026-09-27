/**
 * 스캔 직후 알림 유도 판정(2026-09-28 종한 결정) — OS 거부 / 서버 활동 알림 OFF는 매 스캔마다,
 * 그 외는 기존 프라이머 1회 규칙. 게스트는 새 두 모드 제외. 설정 조회 실패 = 유도 안 함.
 */
import { AppState } from 'react-native';
import { decideScanNudge, finishAfterOsSettings } from '../scanNudge';

const mockAdapter = { getPermissionStatus: jest.fn(), getPrimerResult: jest.fn(), registerPushToken: jest.fn().mockResolvedValue(undefined) };
jest.mock('@/lib/push/pushAdapter', () => ({
  get getPermissionStatus() { return mockAdapter.getPermissionStatus; },
  get getPrimerResult() { return mockAdapter.getPrimerResult; },
  get registerPushToken() { return mockAdapter.registerPushToken; },
}));
const mockAppState = { handler: null as null | ((s: string) => void), remove: jest.fn() };
const mockPatch = jest.fn().mockResolvedValue(undefined);
const mockFetchQuery = jest.fn();
jest.mock('@/lib/queryClient', () => ({ queryClient: { get fetchQuery() { return mockFetchQuery; } } }));
jest.mock('@/lib/data/useNotificationSettings', () => ({ NOTIF_SETTINGS_KEY: ['notifSettings'], fetchNotificationSettings: jest.fn(), get patchNotificationSettings() { return mockPatch; } }));


const settings = (activity: boolean) => ({ activity, news: { enabled: false, mealTime: false, privacyConsent: null, receiveConsent: null } });

beforeEach(() => {
  jest.clearAllMocks();
  mockAdapter.getPrimerResult.mockResolvedValue('accepted'); // 기본: 프라이머 응답 기록 있음
  // react-native 통째 목은 jest-expo 프리셋을 깨므로(Platform.select) AppState만 spy
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
    mockAppState.handler = cb;
    return { remove: mockAppState.remove };
  }) as unknown as typeof AppState.addEventListener);
});

it('OS 거부 → osDenied (프라이머 기록·서버 설정 무관, 조회 0)', async () => {
  mockAdapter.getPermissionStatus.mockResolvedValue('denied');
  await expect(decideScanNudge(false)).resolves.toBe('osDenied');
  expect(mockFetchQuery).not.toHaveBeenCalled();
});

it('OS 허용 + 서버 activity false → activityOff · true → 없음', async () => {
  mockAdapter.getPermissionStatus.mockResolvedValue('granted');
  mockFetchQuery.mockResolvedValueOnce(settings(false));
  await expect(decideScanNudge(false)).resolves.toBe('activityOff');
  mockFetchQuery.mockResolvedValueOnce(settings(true));
  await expect(decideScanNudge(false)).resolves.toBeNull();
  expect(mockFetchQuery).toHaveBeenCalledTimes(2);
  expect(mockFetchQuery.mock.calls[0][0]).toMatchObject({ queryKey: ['notifSettings'] });
});

it('OS 허용 + 설정 조회 실패 → 없음(보수적)', async () => {
  mockAdapter.getPermissionStatus.mockResolvedValue('granted');
  mockFetchQuery.mockRejectedValueOnce(new Error('401'));
  await expect(decideScanNudge(false)).resolves.toBeNull();
});

it('게스트 → 새 두 모드 없음, 기존 프라이머 규칙만(기록 없음 = primer · 있음 = 없음)', async () => {
  mockAdapter.getPermissionStatus.mockResolvedValue('denied');
  await expect(decideScanNudge(true)).resolves.toBeNull();
  mockAdapter.getPermissionStatus.mockResolvedValue('granted');
  mockAdapter.getPrimerResult.mockResolvedValue(null);
  await expect(decideScanNudge(true)).resolves.toBe('primer');
  expect(mockFetchQuery).not.toHaveBeenCalled();
});

it('OS 미결정·unavailable → 기존 프라이머 1회 규칙(로그인 화면 OS 팝업이 담당, 새 표면 없음)', async () => {
  mockAdapter.getPermissionStatus.mockResolvedValue('undetermined');
  await expect(decideScanNudge(false)).resolves.toBeNull(); // 기록 있음
  mockAdapter.getPrimerResult.mockResolvedValue(null);
  await expect(decideScanNudge(false)).resolves.toBe('primer');
  mockAdapter.getPermissionStatus.mockResolvedValue('unavailable');
  await expect(decideScanNudge(false)).resolves.toBe('primer');
  expect(mockFetchQuery).not.toHaveBeenCalled();
});

const flush = () => new Promise((r) => setTimeout(r, 0));

it('기기 설정 복귀(active 1회): 허용으로 바뀌었으면 토큰 등록 + activity:true, 리스너 해제', async () => {
  finishAfterOsSettings();
  mockAppState.handler!('background'); // 설정 앱으로 나감 — 무동작
  expect(mockAdapter.registerPushToken).not.toHaveBeenCalled();
  mockAdapter.getPermissionStatus.mockResolvedValue('granted');
  mockAppState.handler!('active');
  await flush();
  expect(mockAppState.remove).toHaveBeenCalledTimes(1);
  expect(mockAdapter.registerPushToken).toHaveBeenCalledTimes(1);
  expect(mockPatch).toHaveBeenCalledWith({ activity: true });
});

it('기기 설정 복귀: 여전히 거부면 아무것도 안 함(다음 스캔에서 재유도)', async () => {
  finishAfterOsSettings();
  mockAdapter.getPermissionStatus.mockResolvedValue('denied');
  mockAppState.handler!('active');
  await flush();
  expect(mockAppState.remove).toHaveBeenCalledTimes(1);
  expect(mockAdapter.registerPushToken).not.toHaveBeenCalled();
  expect(mockPatch).not.toHaveBeenCalled();
});

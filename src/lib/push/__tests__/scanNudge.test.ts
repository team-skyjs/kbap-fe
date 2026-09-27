/**
 * 스캔 직후 알림 유도 판정(2026-09-28 종한 결정) — OS 거부 / 서버 활동 알림 OFF는 매 스캔마다,
 * 그 외는 기존 프라이머 1회 규칙. 게스트는 새 두 모드 제외. 설정 조회 실패 = 유도 안 함.
 */
import { decideScanNudge } from '../scanNudge';

const mockAdapter = { getPermissionStatus: jest.fn(), getPrimerResult: jest.fn() };
jest.mock('@/lib/push/pushAdapter', () => ({
  get getPermissionStatus() { return mockAdapter.getPermissionStatus; },
  get getPrimerResult() { return mockAdapter.getPrimerResult; },
}));
const mockFetchQuery = jest.fn();
jest.mock('@/lib/queryClient', () => ({ queryClient: { get fetchQuery() { return mockFetchQuery; } } }));
jest.mock('@/lib/data/useNotificationSettings', () => ({ NOTIF_SETTINGS_KEY: ['notifSettings'], fetchNotificationSettings: jest.fn() }));


const settings = (activity: boolean) => ({ activity, news: { enabled: false, mealTime: false, privacyConsent: null, receiveConsent: null } });

beforeEach(() => {
  jest.clearAllMocks();
  mockAdapter.getPrimerResult.mockResolvedValue('accepted'); // 기본: 프라이머 응답 기록 있음
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

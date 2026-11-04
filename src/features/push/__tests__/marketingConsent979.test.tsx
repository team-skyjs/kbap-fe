/**
 * KB-979 — 홈·알림함 광고성 동의 시트.
 * 게이트 순수 함수(로컬 날짜·같은 날·어제·미래) · 홈 큐 스텝(런타임 1회·게스트·동의·실패·abort·코치마크 뒤·재가입) ·
 * 확인(공용 PATCH·권한 undetermined만 요청·실패 토스트) · 알림함(transitionEnd 뒤·포커스마다·덮개 대기) · ScanExitPrompts 상호 배제 · 계측 화이트리스트.
 */
/* eslint-disable import/first -- jest.mock 뒤 */
import * as React from 'react';
import { AppState, InteractionManager } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import * as fs from 'fs';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@/lib/queryClient', () => {
  const { QueryClient } = require('@tanstack/react-query');
  return { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
});
let mockSession: boolean | null = true;
jest.mock('@/lib/auth/useSession', () => ({ getSessionState: () => mockSession }));
const mockFetch = jest.fn();
const mockPatch = jest.fn();
let mockQuery: { isSuccess: boolean; isFetchedAfterMount: boolean; data?: unknown } = { isSuccess: false, isFetchedAfterMount: false };
jest.mock('@/lib/data/useNotificationSettings', () => ({
  NOTIF_SETTINGS_KEY: ['notifSettings'],
  fetchNotificationSettings: (...a: unknown[]) => mockFetch(...a),
  patchNotificationSettings: (...a: unknown[]) => mockPatch(...a),
  useNotificationSettings: () => mockQuery,
}));
let mockAdsSettled = true;
const mockAdsSubs = new Set<() => void>();
jest.mock('@/lib/ads/adsSession', () => ({
  isAdsSettled: () => mockAdsSettled,
  subscribeAds: (fn: () => void) => { mockAdsSubs.add(fn); return () => mockAdsSubs.delete(fn); },
}));
const mockPerm = { status: 'undetermined', granted: true };
const mockRequestPermission = jest.fn(async () => mockPerm.granted);
const mockRegister = jest.fn(async () => {});
jest.mock('@/lib/push/pushAdapter', () => ({
  getPermissionStatus: async () => mockPerm.status,
  requestPermission: () => mockRequestPermission(),
  registerPushToken: () => mockRegister(),
}));
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a) }));
// 시트 본체(NotificationSheet)는 notificationSheet497 담당 — 여기선 넘겨받은 props만
type SheetProps = { open: boolean; variant: string; consentSurface?: string; title: string; body: string; confirmLabel: string; onConfirm: () => Promise<void>; onClose: () => void; onDismiss?: () => void };
const mockSheet: { last: SheetProps | null } = { last: null };
jest.mock('@/features/push/NotificationSheet', () => ({
  NotificationSheet: (p: SheetProps) => { mockSheet.last = p; return require('react').createElement('Sheet', { open: p.open }); },
}));
// 알림함: native-stack 이벤트 + 포커스 수동 구동
const mockNav = { listeners: new Map<string, Set<(e: { data: { closing: boolean } }) => void>>() };
const mockFocus: { cb: (() => void | (() => void)) | null; cleanup: void | (() => void) } = { cb: null, cleanup: undefined };
jest.mock('expo-router', () => {
  const R = require('react');
  return {
    useNavigation: () => R.useState(() => ({
      addListener: (ev: string, fn: (e: { data: { closing: boolean } }) => void) => {
        if (!mockNav.listeners.has(ev)) mockNav.listeners.set(ev, new Set());
        mockNav.listeners.get(ev)!.add(fn);
        return () => mockNav.listeners.get(ev)!.delete(fn);
      },
    }))[0],
    useFocusEffect: (cb: () => void | (() => void)) => {
      R.useEffect(() => {
        mockFocus.cb = cb;
        mockFocus.cleanup = cb();
        return () => { if (typeof mockFocus.cleanup === 'function') mockFocus.cleanup(); };
      }, [cb]);
    },
  };
});
// ScanExitPrompts 주변
const mockRequest = jest.fn();
jest.mock('@/lib/useReviewPrompt', () => ({ useReviewPrompt: () => ({ request: mockRequest, open: false, respond: jest.fn(), onShow: jest.fn(), onClosed: jest.fn(), answered: false }) }));
const mockDecide = jest.fn();
jest.mock('@/lib/push/scanNudge', () => ({ decideScanNudge: (...a: unknown[]) => mockDecide(...a) }));
jest.mock('@/components/ReviewPromptSheet', () => ({ ReviewPromptSheet: () => null }));
const mockPrimer: { open: boolean } = { open: false };
jest.mock('@/features/push/PushPrimerModal', () => ({ PushPrimerModal: (p: { open: boolean }) => { mockPrimer.open = p.open; return null; } }));
jest.mock('@/features/coach/PackagedCoach', () => ({ isPackagedCoachActive: () => false, shouldShowPackagedCoach: async () => false }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '@/lib/queryClient';
import { createOneShotQueue } from '@/lib/oneShotQueue';
import { pushOcclusion, _resetOcclusionForTest } from '@/lib/engagement/occlusion';
import { sanitize, EVENTS } from '@/lib/analytics';
import { MARKETING_CONSENT_PATCH } from '@/lib/push/consent';
import {
  HOME_SHOWN_DATE_KEY,
  _resetMarketingConsentForTest,
  isMarketingConsentActive,
  isUnconsented,
  localDateKey,
  presentHomeMarketingConsent,
  setMarketingConsentActive,
  shouldCheckHome,
} from '../marketingConsentPrompt';
import { InboxMarketingConsent, MarketingConsentSheet } from '../MarketingConsentSheet';
import { ScanExitPrompts, armScanExitPrompt, fireScanExitPrompt } from '@/features/scan/ScanExitPrompts';

const { FLAGS } = jest.requireActual('@/lib/flags') as { FLAGS: { pushEnabled: boolean } };
const prevPush = FLAGS.pushEnabled;
afterAll(() => { FLAGS.pushEnabled = prevPush; });

const UNCONSENTED = { activity: false, news: { enabled: false, mealTime: false, privacyConsent: null, receiveConsent: null } };
const CONSENTED = { activity: true, news: { enabled: true, mealTime: true, privacyConsent: { version: 2, grantedAt: '2026-11-04T09:00:00' }, receiveConsent: { version: 2, grantedAt: '2026-11-04T09:00:00' } } };
const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };
const trees: ReactTestRenderer[] = [];

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  queryClient.clear();
  _resetMarketingConsentForTest();
  _resetOcclusionForTest();
  Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => 'active' }); // 전경(가림 없음)
  FLAGS.pushEnabled = true;
  mockSession = true;
  mockAdsSettled = true;
  mockAdsSubs.clear();
  mockFetch.mockResolvedValue(UNCONSENTED);
  mockPatch.mockResolvedValue(CONSENTED);
  mockPerm.status = 'undetermined';
  mockPerm.granted = true;
  mockSheet.last = null;
  mockNav.listeners.clear();
  mockFocus.cb = null;
  mockFocus.cleanup = undefined;
  mockQuery = { isSuccess: false, isFetchedAfterMount: false };
  mockPrimer.open = false;
});
afterEach(() => { act(() => trees.forEach((t) => t.unmount())); trees.length = 0; });

const step = (signal = new AbortController().signal) => {
  const show = jest.fn();
  const done = jest.fn();
  return { show, done, run: () => presentHomeMarketingConsent(show, done, signal) };
};
const today = () => localDateKey(new Date());

describe('게이트 순수 함수', () => {
  it('localDateKey = 기기 로컬 날짜(자정 경계는 로컬 시계) · 0 패딩', () => {
    expect(localDateKey(new Date(2026, 10, 4, 0, 5))).toBe('2026-11-04');
    expect(localDateKey(new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03');
    expect(localDateKey(new Date(2026, 0, 9, 12))).toBe('2026-01-09');
    // UTC 금지 — 로컬 구성요소와 같아야 한다(TZ와 무관하게)
    const d = new Date(Date.UTC(2026, 10, 4, 23, 30));
    expect(localDateKey(d)).toBe(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  });
  it('shouldCheckHome: 같은 날 = skip · 어제·미래(시계 되돌림)·없음 = 통과', () => {
    expect(shouldCheckHome('2026-11-04', '2026-11-04')).toBe(false);
    expect(shouldCheckHome('2026-11-03', '2026-11-04')).toBe(true);
    expect(shouldCheckHome('2026-11-05', '2026-11-04')).toBe(true);
    expect(shouldCheckHome(null, '2026-11-04')).toBe(true);
  });
  it('isUnconsented: 둘 중 하나라도 null = 미동의', () => {
    expect(isUnconsented(UNCONSENTED)).toBe(true);
    expect(isUnconsented(CONSENTED)).toBe(false);
    expect(isUnconsented({ ...CONSENTED, news: { ...CONSENTED.news, receiveConsent: null } })).toBe(true);
  });
});

describe('홈 큐 스텝', () => {
  it('미동의 = 시트 1 + 오늘 날짜 기록 · 같은 런타임 두 번째 = GET 0·시트 0', async () => {
    const a = step();
    expect(await a.run()).toBe(true);
    expect(a.show).toHaveBeenCalledWith(a.done);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await flush();
    expect(await AsyncStorage.getItem(HOME_SHOWN_DATE_KEY)).toBe(today());
    const b = step();
    expect(await b.run()).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(b.show).not.toHaveBeenCalled();
  });

  it('저장 날짜 == 오늘(나중에 후 같은 날 재시작) = GET 0 · 어제·미래 = 판정', async () => {
    await AsyncStorage.setItem(HOME_SHOWN_DATE_KEY, today());
    expect(await step().run()).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    _resetMarketingConsentForTest(); // 새 런타임
    await AsyncStorage.setItem(HOME_SHOWN_DATE_KEY, '2000-01-01');
    expect(await step().run()).toBe(true);
    _resetMarketingConsentForTest();
    await AsyncStorage.setItem(HOME_SHOWN_DATE_KEY, '2999-12-31');
    expect(await step().run()).toBe(true);
  });

  it('게스트·세션 미확정 = GET 0·소모 0(회원이 되면 다음 포커스에 판정)', async () => {
    mockSession = false;
    expect(await step().run()).toBe(false);
    mockSession = null;
    expect(await step().run()).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    mockSession = true;
    expect(await step().run()).toBe(true);
  });

  it('pushEnabled off = GET 0', async () => {
    FLAGS.pushEnabled = false;
    expect(await step().run()).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('동의 회원 = 시트 0·날짜 기록 0 · 런타임 소모(그날 다시 GET 안 함)', async () => {
    mockFetch.mockResolvedValue(CONSENTED);
    const a = step();
    expect(await a.run()).toBe(false);
    expect(a.show).not.toHaveBeenCalled();
    await flush();
    expect(await AsyncStorage.getItem(HOME_SHOWN_DATE_KEY)).toBeNull();
    expect(await step().run()).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('재가입: 이전 회원이 동의했던 기기여도 서버 null이면 노출(로컬 동의 캐시 없음)', async () => {
    mockFetch.mockResolvedValue(CONSENTED);
    expect(await step().run()).toBe(false);
    expect(await AsyncStorage.getAllKeys()).toEqual([]); // 동의 사실은 아무것도 저장하지 않는다
    _resetMarketingConsentForTest(); // 탈퇴 → 재가입 → 새 런타임
    mockFetch.mockResolvedValue(UNCONSENTED);
    expect(await step().run()).toBe(true);
    expect(await AsyncStorage.getAllKeys()).toEqual([HOME_SHOWN_DATE_KEY]);
  });

  it('GET 실패 = 시트 0·소모 0(다음 포커스 재판정)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('net'));
    expect(await step().run()).toBe(false);
    expect(await AsyncStorage.getItem(HOME_SHOWN_DATE_KEY)).toBeNull();
    expect(await step().run()).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('스토리지 오류 = 안 띄움', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('io'));
    expect(await step().run()).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('블러(abort) — GET 대기 중·덮개 대기 중 모두 시트 0·날짜 0·소모 0', async () => {
    let resolveGet!: (v: unknown) => void;
    mockFetch.mockReturnValueOnce(new Promise((r) => { resolveGet = r; }));
    const ac1 = new AbortController();
    const p1 = step(ac1.signal).run();
    ac1.abort();
    expect(await p1).toBe(false);
    resolveGet(UNCONSENTED);
    // 덮개(다른 Modal) 대기 중 블러
    const release = pushOcclusion();
    const ac2 = new AbortController();
    const s2 = step(ac2.signal);
    const p2 = s2.run();
    await flush();
    expect(s2.show).not.toHaveBeenCalled();
    ac2.abort();
    expect(await p2).toBe(false);
    release();
    expect(await AsyncStorage.getItem(HOME_SHOWN_DATE_KEY)).toBeNull();
    expect(await step().run()).toBe(true); // 소모 0
  });

  it('광고 기동·덮개가 끝날 때까지 기다렸다가 그 자리에서 띄운다', async () => {
    mockAdsSettled = false;
    const release = pushOcclusion();
    const s = step();
    const p = s.run();
    await flush();
    expect(s.show).not.toHaveBeenCalled();
    mockAdsSettled = true;
    act(() => mockAdsSubs.forEach((f) => f()));
    await flush();
    expect(s.show).not.toHaveBeenCalled(); // 아직 덮개
    act(() => release());
    expect(await p).toBe(true);
    expect(s.show).toHaveBeenCalledTimes(1);
  });

  it('코치마크 스텝 뒤 — 코치마크가 완전히 닫히기(done) 전엔 판정·시트 0', async () => {
    const q = createOneShotQueue();
    let coachDone!: () => void;
    q.add({ key: 'packagedCoach', present: (done) => { coachDone = done; return true; } });
    const show = jest.fn();
    q.add({ key: 'marketingConsent', present: (done, signal) => presentHomeMarketingConsent(show, done, signal) });
    await flush();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
    coachDone();
    await flush();
    expect(show).toHaveBeenCalledTimes(1);
  });
});

describe('확인 — 공용 PATCH + OS 권한', () => {
  const mount = (onClose = jest.fn()) => {
    act(() => { trees.push(renderer.create(<MarketingConsentSheet open surface="home" onClose={onClose} />)); });
    return onClose;
  };
  it('시트 = consent 변형 · 새 제목·본문 · 기존 확인 라벨 · surface', () => {
    mount();
    expect(mockSheet.last).toMatchObject({ open: true, variant: 'consent', consentSurface: 'home', title: 'push.consentPromptTitle', body: 'push.consentPromptBody', confirmLabel: 'push.consentConfirm' });
  });
  it('PATCH body == 계약(설정 화면과 같은 상수) · undetermined → 요청 → 허용 = 토큰 등록 → 닫기', async () => {
    expect(MARKETING_CONSENT_PATCH).toEqual({ news: { consent: true, privacyConsentVersion: 2, receiveConsentVersion: 2, enabled: true, mealTime: true } });
    const onClose = mount();
    await act(async () => { await mockSheet.last!.onConfirm(); });
    expect(mockPatch).toHaveBeenCalledWith(MARKETING_CONSENT_PATCH);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('거부 = 토큰 등록 0 · granted/denied/unavailable = OS 팝업 0(PATCH는 기록)', async () => {
    mockPerm.granted = false;
    mount();
    await act(async () => { await mockSheet.last!.onConfirm(); });
    expect(mockRegister).not.toHaveBeenCalled();
    for (const st of ['granted', 'denied', 'unavailable']) {
      jest.clearAllMocks();
      mockPerm.status = st;
      await act(async () => { await mockSheet.last!.onConfirm(); });
      expect(mockPatch).toHaveBeenCalledTimes(1);
      expect(mockRequestPermission).not.toHaveBeenCalled();
    }
  });
  it('PATCH 실패 = 오류 토스트 + 닫기 · OS 팝업 0', async () => {
    mockPatch.mockRejectedValueOnce(new Error('net'));
    const onClose = mount();
    await act(async () => { await mockSheet.last!.onConfirm(); });
    expect(mockToast).toHaveBeenCalledWith('notif.saveFailed', { error: true });
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('설정 화면 confirmConsent도 같은 상수(소스 잠금)', () => {
    const src = fs.readFileSync('src/app/profile/notifications.tsx', 'utf8');
    expect(src).toContain('patch(MARKETING_CONSENT_PATCH)');
    expect(src).toContain('consentSurface="settings"');
    expect(src).not.toContain('privacyConsentVersion: PRIVACY_CONSENT_VERSION');
  });
});

describe('알림함', () => {
  const emit = (closing: boolean) => act(() => mockNav.listeners.get('transitionEnd')?.forEach((f) => f({ data: { closing } })));
  const open = () => mockSheet.last?.open ?? false;
  const closeSheet = () => act(() => { mockSheet.last!.onClose(); mockSheet.last!.onDismiss?.(); });
  const mount = () => { act(() => { trees.push(renderer.create(<InboxMarketingConsent />)); }); };

  it('미동의: transitionEnd{closing:false} 전엔 0 · closing:true 무시 · 후 1 · 떠 있는 동안 활성 플래그', () => {
    mockQuery = { isSuccess: true, isFetchedAfterMount: true, data: UNCONSENTED };
    mount();
    expect(open()).toBe(false);
    emit(true);
    expect(open()).toBe(false);
    emit(false);
    expect(open()).toBe(true);
    expect(mockSheet.last!.consentSurface).toBe('inbox');
    expect(isMarketingConsentActive()).toBe(true);
    closeSheet();
    expect(open()).toBe(false);
    expect(isMarketingConsentActive()).toBe(false);
    emit(false); // 같은 포커스 안 재발화 = 0
    expect(open()).toBe(false);
  });

  it('블러 → 재포커스(+transitionEnd) = 다시 1 · 떠 있는 채 블러 = 닫힘', () => {
    mockQuery = { isSuccess: true, isFetchedAfterMount: true, data: UNCONSENTED };
    mount();
    emit(false);
    expect(open()).toBe(true);
    act(() => { if (typeof mockFocus.cleanup === 'function') mockFocus.cleanup(); }); // 자식 화면 push = 블러
    expect(open()).toBe(false);
    expect(isMarketingConsentActive()).toBe(false);
    act(() => { mockFocus.cleanup = mockFocus.cb!(); }); // 복귀 = 포커스
    expect(open()).toBe(false); // 전환 끝나기 전
    emit(false);
    expect(open()).toBe(true);
  });

  it('동의 회원 = 0 · 이번 마운트 응답 전(캐시만) = 0 · 실패 = 0', () => {
    mockQuery = { isSuccess: true, isFetchedAfterMount: true, data: CONSENTED };
    mount();
    emit(false);
    expect(open()).toBe(false);
    act(() => trees.pop()!.unmount());
    mockQuery = { isSuccess: true, isFetchedAfterMount: false, data: UNCONSENTED };
    mount();
    emit(false);
    expect(open()).toBe(false);
    act(() => trees.pop()!.unmount());
    mockQuery = { isSuccess: false, isFetchedAfterMount: true, data: UNCONSENTED };
    mount();
    emit(false);
    expect(open()).toBe(false);
  });

  it('다른 덮개가 떠 있으면 풀릴 때까지 대기', () => {
    mockQuery = { isSuccess: true, isFetchedAfterMount: true, data: UNCONSENTED };
    const release = pushOcclusion();
    mount();
    emit(false);
    expect(open()).toBe(false);
    act(() => release());
    expect(open()).toBe(true);
  });

  it('게스트 분기엔 마운트 안 됨(소스 잠금: Redirect 뒤 회원 렌더에만)', () => {
    const src = fs.readFileSync('src/app/notifications.tsx', 'utf8');
    expect(src.indexOf('<InboxMarketingConsent />')).toBeGreaterThan(src.indexOf('if (isGuest) return <Redirect'));
    // InteractionManager 금지(RN 0.85 = 전환 대기 안 함)
    expect(fs.readFileSync('src/features/push/MarketingConsentSheet.tsx', 'utf8')).not.toMatch(/import \{[^}]*InteractionManager/);
  });
});

describe('ScanExitPrompts 상호 배제', () => {
  beforeEach(() => {
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(((cb: () => void) => { cb(); return { then: () => {}, done: () => {}, cancel: () => {} }; }) as never);
    mockRequest.mockResolvedValue(false);
  });
  const exit = async () => { armScanExitPrompt({ isGuest: false, ready: Promise.resolve() }); act(() => fireScanExitPrompt()); await flush(); };

  it('동의 시트 활성 중 = 넛지·리뷰 유도 0 · 풀리면 다시', async () => {
    mockDecide.mockResolvedValue(null);
    act(() => { trees.push(renderer.create(<ScanExitPrompts />)); });
    setMarketingConsentActive(true);
    await exit();
    expect(mockDecide).not.toHaveBeenCalled();
    expect(mockRequest).not.toHaveBeenCalled();
    setMarketingConsentActive(false);
    await exit();
    expect(mockRequest).toHaveBeenCalledWith('scan', expect.anything());
  });

  it('판정(await) 사이에 동의 시트가 뜨면 띄우기 직전에 건너뜀', async () => {
    mockDecide.mockImplementation(async () => { setMarketingConsentActive(true); return 'primer'; });
    act(() => { trees.push(renderer.create(<ScanExitPrompts />)); });
    await exit();
    expect(mockDecide).toHaveBeenCalledTimes(1);
    expect(mockPrimer.open).toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe('계측 화이트리스트', () => {
  it('push_consent_view{surface} · push_consent_response{action,target,surface}', () => {
    expect(EVENTS.push_consent_view).toBe('push_consent_view');
    expect(sanitize(EVENTS.push_consent_view, { surface: 'home', x: 1 })).toEqual({ surface: 'home' });
    expect(sanitize(EVENTS.push_consent_response, { action: 'confirm', surface: 'inbox', target: 'privacy', y: 2 })).toEqual({ action: 'confirm', surface: 'inbox', target: 'privacy' });
  });
});

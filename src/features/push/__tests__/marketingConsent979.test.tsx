/**
 * KB-979 → KB-987 — 홈·알림함 광고성 동의 시트.
 * 게이트 순수 함수(3시간) · 홈 큐 스텝(3시간·시계 되돌림·게스트·동의 캐시·실패·abort·코치마크 뒤·재가입) ·
 * 확인(공용 PATCH·권한 undetermined만 요청·실패 토스트) · 알림함(transitionEnd 뒤·포커스마다·덮개 대기) · ScanExitPrompts 상호 배제 · 계측 화이트리스트.
 */
/* eslint-disable import/first, @typescript-eslint/no-require-imports -- jest.mock 뒤 · 호이스팅되는 목 팩토리 안은 require만 가능 */
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
// dataUpdatedAt: 포커스 이후 응답 = 이번 포커스에서 받은 것(#416 Codex P2). 0 = 옛 캐시
let mockQuery: { isSuccess: boolean; dataUpdatedAt: number; data?: unknown } = { isSuccess: false, dataUpdatedAt: 0 };
const mockRefetch = jest.fn(() => { mockQuery = { ...mockQuery, dataUpdatedAt: Date.now() }; return Promise.resolve(); });
jest.mock('@/lib/data/useNotificationSettings', () => ({
  NOTIF_SETTINGS_KEY: ['notifSettings'],
  fetchNotificationSettings: (...a: unknown[]) => mockFetch(...a),
  patchNotificationSettings: (...a: unknown[]) => mockPatch(...a),
  useNotificationSettings: () => ({ ...mockQuery, refetch: mockRefetch }),
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
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => {
  const actual = jest.requireActual('@/lib/analytics');
  return { ...actual, track: (...a: unknown[]) => mockTrack(...a) };
});
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
  HOME_INTERVAL_MS,
  HOME_LAST_SHOWN_KEY,
  _resetMarketingConsentForTest,
  homeConsentDue,
  isMarketingConsentActive,
  isUnconsented,
  presentHomeMarketingConsent,
  setMarketingConsentActive,
} from '../marketingConsentPrompt';
import { InboxMarketingConsent, MarketingConsentSheet } from '../MarketingConsentSheet';
import { ScanExitPrompts, armScanExitPrompt, fireScanExitPrompt } from '@/features/scan/ScanExitPrompts';

const { FLAGS } = jest.requireActual('@/lib/flags') as { FLAGS: { pushEnabled: boolean; marketingConsentPrompt: boolean } };
const prevPush = FLAGS.pushEnabled;
const prevConsentFlag = FLAGS.marketingConsentPrompt;
afterAll(() => { FLAGS.pushEnabled = prevPush; FLAGS.marketingConsentPrompt = prevConsentFlag; });

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
  FLAGS.marketingConsentPrompt = true; // P-599: 이 스위트 = 플래그 ON(teamtest·dev) 기존 동작 — OFF는 아래 describe
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
  mockQuery = { isSuccess: false, dataUpdatedAt: 0 };
  mockRefetch.mockClear();
  mockPrimer.open = false;
});
afterEach(() => { act(() => trees.forEach((t) => t.unmount())); trees.length = 0; jest.restoreAllMocks(); });

const step = (signal = new AbortController().signal) => {
  const show = jest.fn();
  const done = jest.fn();
  return { show, done, run: () => presentHomeMarketingConsent(show, done, signal) };
};
const NOW = 1_800_000_000_000;
const H = 60 * 60 * 1000;
let now = NOW;
beforeEach(() => { now = NOW; jest.spyOn(Date, 'now').mockImplementation(() => now); });

describe('게이트 순수 함수', () => {
  it('homeConsentDue: 없음 = 통과 · 2:59:59 = skip · 3:00:00 이상 = 통과', () => {
    expect(HOME_INTERVAL_MS).toBe(3 * H);
    expect(homeConsentDue(null, NOW)).toBe(true);
    expect(homeConsentDue(NOW - (3 * H - 1000), NOW)).toBe(false);
    expect(homeConsentDue(NOW - 3 * H, NOW)).toBe(true);
    expect(homeConsentDue(NOW - 30 * H, NOW)).toBe(true);
  });
  it('isUnconsented: 둘 중 하나라도 null = 미동의', () => {
    expect(isUnconsented(UNCONSENTED)).toBe(true);
    expect(isUnconsented(CONSENTED)).toBe(false);
    expect(isUnconsented({ ...CONSENTED, news: { ...CONSENTED.news, receiveConsent: null } })).toBe(true);
  });
});

describe('홈 큐 스텝', () => {
  it('미동의 = 시트 1 + 노출 시각(epoch ms) 기록 · 3시간 안 두 번째 = GET 0·시트 0(런타임 리셋 없이도)', async () => {
    const a = step();
    expect(await a.run()).toBe(true);
    expect(a.show).toHaveBeenCalledWith(a.done);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await flush();
    expect(await AsyncStorage.getItem(HOME_LAST_SHOWN_KEY)).toBe(String(NOW));
    now = NOW + 3 * H - 1000;
    const b = step();
    expect(await b.run()).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(b.show).not.toHaveBeenCalled();
  });

  it('1시간 전 = GET 0 · 3시간 경과 = 판정(콜드 스타트 리셋 없이) · 미래값 = 시트 0 + now로 보정 · 깨진 값 = 통과', async () => {
    await AsyncStorage.setItem(HOME_LAST_SHOWN_KEY, String(NOW - H));
    expect(await step().run()).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    now = NOW + 2 * H; // 마지막 노출 후 3시간
    expect(await step().run()).toBe(true);
    await flush();
    expect(await AsyncStorage.getItem(HOME_LAST_SHOWN_KEY)).toBe(String(NOW + 2 * H));
    // 시계 되돌림 — 저장값이 미래
    now = NOW;
    const f = step();
    expect(await f.run()).toBe(false);
    expect(f.show).not.toHaveBeenCalled();
    await flush();
    expect(await AsyncStorage.getItem(HOME_LAST_SHOWN_KEY)).toBe(String(NOW)); // 기준점 재설정(안 하면 미래 시각까지 영영 막힘)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    now = NOW + 3 * H;
    expect(await step().run()).toBe(true); // 보정된 기준점에서 3시간
    await AsyncStorage.setItem(HOME_LAST_SHOWN_KEY, 'garbage');
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

  it('동의 회원 = 시트 0·기록 0 · 두 번째 포커스 = 캐시로 GET 0 · 인증 경계(queryClient.clear) 후 = 다시 GET', async () => {
    mockFetch.mockResolvedValue(CONSENTED);
    const a = step();
    expect(await a.run()).toBe(false);
    expect(a.show).not.toHaveBeenCalled();
    await flush();
    expect(await AsyncStorage.getItem(HOME_LAST_SHOWN_KEY)).toBeNull();
    expect(await step().run()).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    queryClient.clear();
    expect(await step().run()).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('미동의로 캐시된 세션은 매 판정마다 서버 재확인(캐시 생략은 동의일 때만)', async () => {
    expect(await step().run()).toBe(true);
    now = NOW + 3 * H;
    expect(await step().run()).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('재가입: 이전 회원이 동의했던 기기여도 서버 null이면 노출(로컬 동의 캐시 없음)', async () => {
    mockFetch.mockResolvedValue(CONSENTED);
    expect(await step().run()).toBe(false);
    expect(await AsyncStorage.getAllKeys()).toEqual([]); // 동의 사실은 아무것도 저장하지 않는다
    queryClient.clear(); // 탈퇴 → 재가입(인증 경계가 캐시를 비운다)
    mockFetch.mockResolvedValue(UNCONSENTED);
    expect(await step().run()).toBe(true);
    expect(await AsyncStorage.getAllKeys()).toEqual([HOME_LAST_SHOWN_KEY]);
  });

  it('GET 실패 = 시트 0·소모 0(다음 포커스 재판정)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('net'));
    expect(await step().run()).toBe(false);
    expect(await AsyncStorage.getItem(HOME_LAST_SHOWN_KEY)).toBeNull();
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
    expect(await AsyncStorage.getItem(HOME_LAST_SHOWN_KEY)).toBeNull();
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

  it('홈 화면: 포커스 동안 전경 복귀(AppState active)마다 같은 스텝 재등록 · 블러에 구독 해제 · 콜드 스타트 플래그 없음(소스 잠금)', () => {
    const src = fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8');
    expect(src).toMatch(/AppState\.addEventListener\('change', \(st\) => \{ if \(st === 'active'\) addConsent\(\); \}\)/);
    expect(src).toContain('return () => { sub.remove(); modalQueue.clear();');
    expect(fs.readFileSync('src/features/push/marketingConsentPrompt.ts', 'utf8')).not.toContain('homeChecked');
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
  it('KB-987 문구(ko 정본): 제목 = 동의 조건절 없음 · 본문 = "알림에 동의하시면"으로 시작 · 10개 로케일 두 키 존재', () => {
    const ko = JSON.parse(fs.readFileSync('src/lib/i18n/ko.json', 'utf8')).push;
    expect(ko.consentPromptTitle).toBe('취향에 맞춰 먹고 싶은 K-Food를 추천해드려요!');
    expect(ko.consentPromptBody).toBe('알림에 동의하시면 귀찮게 하지 않고 맛있는 음식 추천만 해드려요 👍');
    for (const l of ['en', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'vi', 'th', 'id', 'ru']) {
      const push = JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')).push;
      expect({ l, t: typeof push.consentPromptTitle, b: typeof push.consentPromptBody }).toEqual({ l, t: 'string', b: 'string' });
    }
  });
  it('PATCH body == 계약(설정 화면과 같은 상수) · undetermined → 요청 → 허용 = 토큰 등록 → 닫기', async () => {
    expect(MARKETING_CONSENT_PATCH).toEqual({ activity: true, news: { consent: true, privacyConsentVersion: 2, receiveConsentVersion: 2, enabled: true, mealTime: true } });
    const onClose = mount();
    await act(async () => { await mockSheet.last!.onConfirm(); });
    expect(mockPatch).toHaveBeenCalledWith(MARKETING_CONSENT_PATCH);
    expect(mockPatch.mock.calls[0][0].activity).toBe(true);
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
  it('확인 = push_pref_toggle{activity,on,source:consent} 1건, PATCH 직전(실패해도 1건 — A-3)', async () => {
    mockPatch.mockImplementationOnce(async () => { expect(mockTrack).toHaveBeenCalledTimes(1); throw new Error('net'); });
    mount();
    await act(async () => { await mockSheet.last!.onConfirm(); });
    const toggles = mockTrack.mock.calls.filter(([e]) => e === EVENTS.push_pref_toggle);
    expect(toggles).toEqual([[EVENTS.push_pref_toggle, { key: 'activity', on: true, source: 'consent' }]]);
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
    expect(src).toContain("track(EVENTS.push_pref_toggle, { key: 'activity', on: true, source: 'consent' })"); // KB-987
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
    mockQuery = { isSuccess: true, dataUpdatedAt: Date.now(), data: UNCONSENTED };
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
    mockQuery = { isSuccess: true, dataUpdatedAt: Date.now(), data: UNCONSENTED };
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
    mockQuery = { isSuccess: true, dataUpdatedAt: Date.now(), data: CONSENTED };
    mount();
    emit(false);
    expect(open()).toBe(false);
    act(() => trees.pop()!.unmount());
    mockQuery = { isSuccess: true, dataUpdatedAt: 0, data: UNCONSENTED };
    mockRefetch.mockImplementationOnce(() => Promise.resolve()); // 재조회 미완 = 옛 캐시만
    mount();
    emit(false);
    expect(open()).toBe(false);
    act(() => trees.pop()!.unmount());
    mockQuery = { isSuccess: false, dataUpdatedAt: Date.now(), data: UNCONSENTED };
    mount();
    emit(false);
    expect(open()).toBe(false);
  });

  it('포커스마다 refetch — 첫 GET 실패 뒤 복귀하면 재시도해 1 · 복귀 전 옛 캐시로는 0 (#416 Codex P2)', () => {
    mockQuery = { isSuccess: false, dataUpdatedAt: 0, data: UNCONSENTED };
    mount();
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    emit(false);
    expect(open()).toBe(false);
    act(() => { if (typeof mockFocus.cleanup === 'function') mockFocus.cleanup(); }); // 자식 화면 push
    mockRefetch.mockImplementationOnce(() => { mockQuery = { isSuccess: true, dataUpdatedAt: Date.now(), data: UNCONSENTED }; return Promise.resolve(); });
    act(() => { mockFocus.cleanup = mockFocus.cb!(); }); // 복귀 = 재조회 성공
    expect(mockRefetch).toHaveBeenCalledTimes(2);
    emit(false);
    expect(open()).toBe(true);
  });

  it('다른 덮개가 떠 있으면 풀릴 때까지 대기', () => {
    mockQuery = { isSuccess: true, dataUpdatedAt: Date.now(), data: UNCONSENTED };
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

describe('P-599 플래그 OFF(운영) — 노출·이벤트·큐 소모 0, 다른 시트는 그대로', () => {
  beforeEach(() => { FLAGS.marketingConsentPrompt = false; });

  it('홈 스텝 = 즉시 false · 설정 GET 0 · 날짜 기록 0 · 시트 0 · 런타임 소모 0(ON으로 돌아오면 같은 런타임에 판정)', async () => {
    const a = step();
    expect(await a.run()).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(a.show).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(HOME_LAST_SHOWN_KEY)).toBeNull();
    FLAGS.marketingConsentPrompt = true;
    const b = step();
    expect(await b.run()).toBe(true);
  });

  it('홈 큐: 코치마크 → 동의(OFF) → 다음 스텝 — 동의가 큐를 붙잡지 않고 다음 시트가 그대로 뜬다', async () => {
    const q = createOneShotQueue();
    let coachDone!: () => void;
    q.add({ key: 'packagedCoach', present: (done) => { coachDone = done; return true; } });
    const show = jest.fn();
    q.add({ key: 'marketingConsent', present: (done, signal) => presentHomeMarketingConsent(show, done, signal) });
    const next = jest.fn(() => true);
    q.add({ key: 'next', present: next });
    await flush();
    coachDone();
    await flush();
    expect(show).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('동의 시트가 없으니 스캔 종료 리뷰 유도는 막히지 않는다(활성 플래그 false 유지)', async () => {
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(((cb: () => void) => { cb(); return { then: () => {}, done: () => {}, cancel: () => {} }; }) as never);
    mockRequest.mockResolvedValue(false);
    mockDecide.mockResolvedValue(null);
    await step().run();
    expect(isMarketingConsentActive()).toBe(false);
    act(() => { trees.push(renderer.create(<ScanExitPrompts />)); });
    armScanExitPrompt({ isGuest: false, ready: Promise.resolve() });
    act(() => fireScanExitPrompt());
    await flush();
    expect(mockRequest).toHaveBeenCalledWith('scan', expect.anything());
    const blocked = (mockRequest.mock.calls[0][1] as { blocked: () => boolean }).blocked;
    expect(blocked()).toBe(false);
  });

  it('진입점 게이트 소스 잠금: 홈 스텝 첫 줄 · 알림함 마운트 · 플래그 = DEV_SERVER_CHANNEL', () => {
    expect(fs.readFileSync('src/features/push/marketingConsentPrompt.ts', 'utf8')).toContain('if (!FLAGS.pushEnabled || !FLAGS.marketingConsentPrompt) return false;');
    expect(fs.readFileSync('src/app/notifications.tsx', 'utf8')).toContain('{FLAGS.marketingConsentPrompt && <InboxMarketingConsent />}');
    expect(fs.readFileSync('src/lib/flags.ts', 'utf8')).toMatch(/\n  marketingConsentPrompt: DEV_SERVER_CHANNEL,\n/);
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
  it('push_pref_toggle{key,on,source} — KB-987 source 통과', () => {
    expect(sanitize(EVENTS.push_pref_toggle, { key: 'activity', on: true, source: 'consent', z: 3 })).toEqual({ key: 'activity', on: true, source: 'consent' });
  });
});

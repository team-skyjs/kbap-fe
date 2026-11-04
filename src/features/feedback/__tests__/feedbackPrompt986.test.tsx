/**
 * KB-986(P-597) 재방문 피드백 시트.
 * 판정: 첫 실행 0 · 두 번째 실행 노출 · 보내기 성공·다시 보지 않기 = 이후 0 · 닫기 = 다음 실행 재노출 · 그 실행에 다른 시트가 떴으면 0.
 * 시트: 성공 뒤에만 종료·완료(P-387) · 실패 = 본문 유지 · 닫기 경로 계측(본문 0) · 전송 중 닫기 무시 · KAV.
 * 배선(소스): 홈 큐 마지막 스텝·홈에서만 · 다른 일회성 시트 4종이 자리를 찍음 · 스캔 종료 넛지가 비켜 줌 · 루트에서 실행 수.
 */
/* eslint-disable import/first, @typescript-eslint/no-require-imports -- jest.mock 뒤 · 목 팩토리 안은 require만 */
import * as React from 'react';
import { AppState } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import * as fs from 'fs';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => require('react').useRef({ value: v }).current,
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown, _c?: unknown, cb?: (f: boolean) => void) => { if (cb) { if (mockTiming.hold) mockTiming.pending.push(cb); else cb(true); } return v; }, // hold = 퇴장 애니메이션 진행 중 고정
    runOnJS: (fn: (...a: unknown[]) => void) => fn,
    interpolate: () => 1,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, cubic: 0 },
    useReducedMotion: () => false,
  };
});
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  // 빌더: 등록 콜백·enabled 값을 보관(테스트가 직접 구동) — GestureDetector는 받은 gesture의 enabled를 prop으로 노출
  const pan = () => {
    const b: Record<string, (...a: unknown[]) => unknown> & { h: Record<string, (...a: unknown[]) => unknown>; on: boolean } = { h: {}, on: true } as never;
    for (const k of ['runOnJS', 'onUpdate', 'onFinalize', 'onStart', 'onEnd', 'onChange', 'minDistance', 'activeOffsetY']) b[k] = (cb: unknown) => { if (typeof cb === 'function') b.h[k] = cb as never; return b; };
    b.enabled = (v: unknown) => { b.on = v !== false; return b; };
    return b;
  };
  return {
    GestureDetector: ({ children, gesture }: { children: unknown; gesture: { on: boolean; h: Record<string, (...a: unknown[]) => unknown> } }) =>
      React.createElement(View, { testID: 'gesture-area', gestureOn: gesture.on, gestureRef: gesture }, children),
    GestureHandlerRootView: View,
    Gesture: { Pan: pan, Tap: pan },
  };
});
// 퇴장 애니메이션을 진행 중으로 붙잡기(#421: 닫히는 중 Send)
const mockTiming = { hold: false, pending: [] as ((f: boolean) => void)[] };
let mockAdsSettled = true;
jest.mock('@/lib/ads/adsSession', () => ({ isAdsSettled: () => mockAdsSettled, subscribeAds: () => () => {} }));
jest.mock('@/lib/engagement/occlusionSurfaces', () => {
  const RN = jest.requireActual('react-native');
  return { Modal: RN.Modal, Alert: { alert: jest.fn() } };
});
jest.mock('@/lib/engagement/occlusionPickers', () => ({ launchImageLibraryAsync: jest.fn(), launchCameraAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({ requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })) }));
const mockSubmit = jest.fn();
jest.mock('@/lib/data/useFeedback', () => ({ FEEDBACK_MAX_LEN: 2000, FEEDBACK_MAX_PHOTOS: 3, useSubmitFeedback: () => ({ mutateAsync: (...a: unknown[]) => mockSubmit(...a) }) }));
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a), subscribeTopToast: () => () => {}, dismissTopToast: () => {} })); // 호스트(TopToastHost)가 구독
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEEDBACK_PROMPT_KEY, _resetFeedbackPromptForTest, isFeedbackPromptActive, markFeedbackPromptDone, presentHomeFeedbackPrompt, recordLaunch } from '../feedbackPrompt';
import { FeedbackPromptSheet, useFeedbackPromptSheet } from '../FeedbackPromptSheet';
import { _resetPromptSlotForTest, markPromptShown } from '@/lib/engagement/promptSlot';
import { EVENTS } from '@/lib/analytics';

/** 새 실행(JS 런타임 재시작) 흉내 — 저장 상태는 남는다 */
const newRun = () => { _resetFeedbackPromptForTest(); _resetPromptSlotForTest(); };
const homeStep = async () => {
  const show = jest.fn();
  const shown = await presentHomeFeedbackPrompt(show, () => {}, new AbortController().signal);
  expect(shown).toBe(show.mock.calls.length === 1);
  return shown;
};
const stored = async () => JSON.parse((await AsyncStorage.getItem(FEEDBACK_PROMPT_KEY)) ?? 'null') as { launches: number; done: boolean } | null;

beforeEach(async () => {
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true }); // 덮개 판정(isOccluded) = 포그라운드
  await AsyncStorage.clear();
  newRun();
  mockAdsSettled = true;
  mockSubmit.mockReset();
  mockToast.mockReset();
  mockTrack.mockReset();
});

describe('판정 — 실행 수·빈도·한 실행 하나', () => {
  it('첫 실행 = 0 · 두 번째 실행 홈 = 노출 · 같은 실행 홈 재포커스 = 0', async () => {
    expect(await homeStep()).toBe(false);
    newRun();
    expect(await homeStep()).toBe(true);
    expect(await homeStep()).toBe(false); // 같은 실행 — 자리 하나
    expect(await stored()).toEqual({ launches: 2, done: false });
  });

  it('닫기(종료 기록 없음) = 다음 실행에 다시 · 보내기 성공·다시 보지 않기(종료) = 이후 실행 0', async () => {
    await recordLaunch();
    newRun();
    expect(await homeStep()).toBe(true); // 2회차 — 닫았다고 치자(종료 기록 없음)
    newRun();
    expect(await homeStep()).toBe(true); // 3회차 재노출
    await markFeedbackPromptDone(); // 보내기 성공·다시 보지 않기 공통
    for (let i = 0; i < 3; i++) {
      newRun();
      expect(await homeStep()).toBe(false);
    }
  });

  it('그 실행에 다른 일회성 시트가 이미 떴으면 0 → 다음 실행엔 노출 · 루트와 홈이 같은 실행을 두 번 세지 않음', async () => {
    await recordLaunch();
    newRun();
    await recordLaunch(); // 루트(_layout)가 먼저 셈
    markPromptShown(); // 예: 스토어 리뷰 시트·동의 시트·코치마크·스캔 종료 넛지
    expect(await homeStep()).toBe(false);
    expect((await stored())?.launches).toBe(2);
    newRun();
    expect(await homeStep()).toBe(true);
  });

  it('광고 기동 전·블러(abort) = 띄우지 않고 소모 0(같은 실행 다음 홈 포커스에 다시)', async () => {
    await recordLaunch();
    newRun();
    mockAdsSettled = false;
    const ac = new AbortController();
    const show = jest.fn();
    const p = presentHomeFeedbackPrompt(show, () => {}, ac.signal);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    ac.abort();
    expect(await p).toBe(false);
    expect(show).not.toHaveBeenCalled();
    mockAdsSettled = true;
    expect(await homeStep()).toBe(true);
  });
});

describe('시트 — 보내기·닫기·다시 보지 않기', () => {
  const trees: ReactTestRenderer[] = [];
  afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); });
  let api: ReturnType<typeof useFeedbackPromptSheet>;
  function Host() {
    api = useFeedbackPromptSheet();
    return <FeedbackPromptSheet {...api.props} />;
  }
  const mount = () => {
    let t!: ReactTestRenderer;
    act(() => { t = renderer.create(<Host />); });
    trees.push(t);
    act(() => api.show());
    return t;
  };
  const byId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.props.onPress === 'function')[0];
  const open = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'feedback-prompt').length > 0;
  const type = (t: ReactTestRenderer, v: string) => act(() => t.root.findAll((n) => n.props?.testID === 'feedback-body' && typeof n.props.onChangeText === 'function')[0].props.onChangeText(v));
  const events = () => mockTrack.mock.calls.map((c) => c[0] as string).filter((e) => e.startsWith('feedback_prompt_'));

  it('보내기 성공 = 응답 뒤에만 종료 기록·완료 토스트·submitted(개수만) → 닫힘', async () => {
    let resolve!: () => void;
    mockSubmit.mockImplementation(() => new Promise<void>((r) => { resolve = r; }));
    const t = mount();
    expect(isFeedbackPromptActive()).toBe(true);
    expect(events()).toEqual(['feedback_prompt_shown']);
    type(t, '  버튼이 안 눌려요  ');
    act(() => byId(t, 'feedback-send').props.onPress());
    expect(mockSubmit.mock.calls[0][0]).toMatchObject({ content: '버튼이 안 눌려요', photoUris: [] });
    act(() => byId(t, 'feedback-prompt-close').props.onPress()); // 전송 중 닫기 = 무시(응답을 기다린다)
    expect(open(t)).toBe(true);
    expect((await stored())?.done ?? false).toBe(false); // 응답 전 = 종료 기록 0
    await act(async () => { resolve(); });
    expect(mockToast).toHaveBeenCalledWith('feedback.sent');
    expect((await stored())?.done).toBe(true);
    expect(events()).toEqual(['feedback_prompt_shown', 'feedback_prompt_submitted']);
    expect(mockTrack.mock.calls.find((c) => c[0] === EVENTS.feedback_prompt_submitted)![1]).toEqual({ has_photos: false, photo_count: 0 });
    expect(open(t)).toBe(false);
  });

  it('보내기 실패 = 본문 유지·시트 유지·종료 기록 0 → 다시 보내 성공', async () => {
    mockSubmit.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'NETWORK' })).mockResolvedValueOnce(undefined);
    const t = mount();
    type(t, '사진이 안 올라가요');
    await act(async () => { byId(t, 'feedback-send').props.onPress(); });
    expect(mockToast).toHaveBeenCalledWith('feedback.sendFailed', { error: true });
    expect(open(t)).toBe(true);
    // #421 Codex P2: 실패 토스트가 보일 자리 = 열린 시트의 Modal 안 호스트(루트 호스트는 Modal 뒤에 가린다)
    const { TopToastHost } = jest.requireActual<typeof import('@/components/TopToast')>('@/components/TopToast');
    const modal = t.root.findAll((n) => n.props?.transparent === true && n.props?.animationType === 'fade')[0];
    expect(modal.findAll((n) => n.type === TopToastHost)).toHaveLength(1);
    expect(t.root.findAll((n) => n.props?.testID === 'feedback-body')[0].props.value).toBe('사진이 안 올라가요');
    expect(await stored()).toBeNull();
    expect(events()).toEqual(['feedback_prompt_shown']);
    await act(async () => { byId(t, 'feedback-send').props.onPress(); });
    expect(mockSubmit).toHaveBeenCalledTimes(2);
    expect((await stored())?.done).toBe(true);
  });

  it('#421 Codex P2: 전송 중 = 끌어 닫기 제스처 꺼짐(닫히지 않고 본문 유지) · 실패 응답 뒤 다시 켜짐', async () => {
    let reject!: (e: Error) => void;
    mockSubmit.mockImplementation(() => new Promise<void>((_r, j) => { reject = j; }));
    const t = mount();
    const area = () => t.root.findAll((n) => n.props?.testID === 'gesture-area')[0];
    expect(area().props.gestureOn).toBe(true);
    type(t, '전송 중 본문');
    act(() => byId(t, 'feedback-send').props.onPress());
    expect(area().props.gestureOn).toBe(false); // RNGH는 꺼진 제스처의 onFinalize를 부르지 않는다
    expect(open(t)).toBe(true);
    expect(t.root.findAll((n) => n.props?.testID === 'feedback-body')[0].props.value).toBe('전송 중 본문');
    expect(events()).toEqual(['feedback_prompt_shown']);
    await act(async () => { reject(new Error('NETWORK')); });
    expect(area().props.gestureOn).toBe(true); // 실패 = 다시 닫을 수 있음(본문은 그대로)
    expect(t.root.findAll((n) => n.props?.testID === 'feedback-body')[0].props.value).toBe('전송 중 본문');
  });

  it('#421 Codex P2: Modal 안에 키보드 내리기 바(modal 변형) — 루트 바는 Modal 뒤에 가린다(안드)', () => {
    const { KeyboardDismissBar } = jest.requireActual<typeof import('@/components/KeyboardDismissBar')>('@/components/KeyboardDismissBar');
    const t = mount();
    const modal = t.root.findAll((n) => n.props?.transparent === true && n.props?.animationType === 'fade')[0];
    expect(modal.findAll((n) => n.type === KeyboardDismissBar && n.props.modal === true)).toHaveLength(1);
  });

  it('#421 Codex P2: 닫히는 애니메이션 중 Send = 전송 0', async () => {
    const t = mount();
    type(t, '닫히는 중 본문');
    mockTiming.hold = true;
    try {
      act(() => byId(t, 'feedback-prompt-close').props.onPress()); // 퇴장 시작(완료 전)
      expect(open(t)).toBe(true);
      act(() => byId(t, 'feedback-send').props.onPress());
      expect(mockSubmit).not.toHaveBeenCalled();
    } finally {
      mockTiming.hold = false;
      act(() => mockTiming.pending.splice(0).forEach((cb) => cb(true)));
    }
    expect(open(t)).toBe(false);
  });

  it('다시 보지 않기 = 종료 기록 + never_again → 닫힘', async () => {
    const t = mount();
    await act(async () => { byId(t, 'feedback-prompt-never').props.onPress(); });
    expect((await stored())?.done).toBe(true);
    expect(events()).toEqual(['feedback_prompt_shown', 'feedback_prompt_never_again']);
    expect(open(t)).toBe(false);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it.each([['feedback-prompt-close', 'close'], ['feedback-prompt-backdrop', 'backdrop']])('%s = 종료 기록 0 · dismissed(via %s) — 본문은 계측에 0', async (id, via) => {
    const t = mount();
    type(t, '비밀 본문');
    await act(async () => { byId(t, id).props.onPress(); });
    expect(await stored()).toBeNull();
    expect(mockTrack.mock.calls.find((c) => c[0] === EVENTS.feedback_prompt_dismissed)![1]).toEqual({ via });
    expect(JSON.stringify(mockTrack.mock.calls)).not.toContain('비밀 본문');
    expect(open(t)).toBe(false);
  });

  it('키보드 = Modal 안 KAV(padding 계열 공용 값) · 제스처는 머리(핸들·제목)만 — 입력칸은 제스처 밖', () => {
    const t = mount();
    const { KAV_BEHAVIOR } = jest.requireActual<typeof import('@/lib/keyboardAvoid')>('@/lib/keyboardAvoid');
    expect(t.root.findAll((n) => n.props?.testID === 'feedback-prompt-kav')[0].props.behavior).toBe(KAV_BEHAVIOR);
    const gesture = t.root.findAll((n) => n.props?.testID === 'gesture-area')[0];
    expect(gesture.findAll((n) => n.props?.testID === 'feedback-prompt-head').length).toBeGreaterThan(0);
    expect(gesture.findAll((n) => n.props?.testID === 'feedback-body')).toHaveLength(0);
  });
});

describe('배선 소스 잠금', () => {
  const read = (p: string) => fs.readFileSync(p, 'utf8');
  const files = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) return e.name === '__tests__' ? [] : files(p);
      return /\.tsx?$/.test(e.name) ? [p] : [];
    });

  it('홈에서만 — 큐 마지막 스텝(코치마크 → 광고성 동의 → 피드백) · 블러 = abort · 다른 화면 배선 0', () => {
    const home = read('src/app/(tabs)/index.tsx');
    const i = (s: string) => home.indexOf(s);
    expect(i("key: 'packagedCoach'")).toBeLessThan(i("key: 'marketingConsent'"));
    expect(i("key: 'marketingConsent'")).toBeLessThan(i("key: 'feedbackPrompt', present: (done, signal) => presentHomeFeedbackPrompt(showFeedback, done, signal)"));
    expect(home).toContain('abortFeedback(); };');
    const users = files('src').filter((f) => /presentHomeFeedbackPrompt\(|<FeedbackPromptSheet/.test(read(f)));
    expect(users.sort()).toEqual(['src/app/(tabs)/index.tsx', 'src/features/feedback/feedbackPrompt.ts']);
    expect(read('src/app/_layout.tsx')).toContain('useEffect(() => void recordLaunch(), []);');
  });

  it('다른 일회성 시트 4종이 띄우기로 정한 순간 자리를 찍는다 · 스캔 종료 넛지·리뷰 유도는 피드백 시트가 떠 있으면 비켜 준다', () => {
    expect(read('src/lib/useReviewPrompt.ts')).toMatch(/markPromptShown\(\);[^\n]*\n\s*setTrigger\(t\);/);
    expect(read('src/features/push/MarketingConsentSheet.tsx')).toMatch(/markPromptShown\(\);[^\n]*\n\s*setOpen\(true\);/);
    expect(read('src/features/coach/PackagedCoach.tsx')).toMatch(/flowActive = true;\n\s*markPromptShown\(\);/);
    expect(read('src/app/scan.tsx')).toMatch(/markPromptShown\(\);[^\n]*\n\s*setCoachOpen\(true\);/);
    const exit = read('src/features/scan/ScanExitPrompts.tsx');
    expect(exit).toMatch(/markPromptShown\(\);[^\n]*\n\s*setNudgeMode\(m\);/);
    expect(exit).toContain('isMarketingConsentActive() || isFeedbackPromptActive() || (await shouldShowPackagedCoach())');
    expect(exit).toContain('blocked: () => isMarketingConsentActive() || isFeedbackPromptActive()');
  });

  it('입력칸은 문의 화면과 같은 공용 폼(useSubmitFeedback·업로드·공용 제출 가드) — 시트 자체 제출 구현 0', () => {
    const sheet = read('src/features/feedback/FeedbackPromptSheet.tsx');
    expect(sheet).toContain('useFeedbackForm()');
    expect(sheet).toContain('<FeedbackFields form={form} onSend={onSend} />');
    expect(sheet).not.toMatch(/useSubmitFeedback|mutateAsync|useSubmitGuard/);
    expect(read('src/app/profile/feedback/new.tsx')).toContain('<FeedbackFields form={form} onSend={onSend} />');
    const form = read('src/features/feedback/FeedbackForm.tsx');
    for (const s of ['useSubmitFeedback()', 'useSubmitGuard()', 'useUploadAbort()', 'signal: nextUploadSignal()']) expect(form).toContain(s);
  });

  it('문구 10로케일 · 이모지 0 · 가운데점 0 · 계측 속성 = 본문 없음', () => {
    for (const l of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
      const fp = (JSON.parse(read(`src/lib/i18n/${l}.json`)) as { feedbackPrompt: Record<string, string> }).feedbackPrompt;
      expect({ l, keys: Object.keys(fp).sort() }).toEqual({ l, keys: ['body', 'neverAgain', 'title'] });
      for (const v of Object.values(fp)) {
        expect(v.trim().length).toBeGreaterThan(0);
        expect(v).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(v).not.toContain('·');
      }
    }
    const ko = (JSON.parse(read('src/lib/i18n/ko.json')) as { feedbackPrompt: Record<string, string> }).feedbackPrompt;
    expect(ko).toEqual({ title: 'K-Bap 팀에게 바로 보내 주세요', body: '불편한 점, 바라는 기능, 무엇이든 좋아요.', neverAgain: '다시 보지 않기' });
    const a = read('src/lib/analytics.ts');
    expect(a).toContain("feedback_prompt_submitted: ['has_photos', 'photo_count']");
    expect(a).toContain("feedback_prompt_dismissed: ['via']");
    expect(a).not.toMatch(/feedback_prompt_\w+: \[[^\]]*(content|body|text)/);
  });
});

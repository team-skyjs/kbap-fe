/**
 * KB-968(P-581) 가공식품 출시 코치마크 2단계.
 *  - 1회(표시 즉시 기록) · 플래그 off 미노출 · X = 전체 건너뛰기
 *  - 1단계 탭 → (오버레이 완전히 닫힌 뒤) 다음 처리 = 음식 탭 2단계 예약 → 2단계 탭 → Packaged 선택
 *  - 스포트라이트 = 대상 measureInWindow 구멍 · 못 재면 딤 없이 말풍선만
 *  - 큐 직렬화(뒤 시트는 코치마크가 닫힌 뒤) · 스캔 뒤 넛지·리뷰 유도는 코치마크를 아직 안 봤으면 건너뜀(코치마크 우선)
 */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable import/first -- jest.mock 뒤 */
import * as React from 'react';
import { AppState, InteractionManager, Platform } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
const mockRequest = jest.fn();
jest.mock('@/lib/useReviewPrompt', () => ({ useReviewPrompt: () => ({ request: mockRequest, sheetProps: { open: false, onClose: () => {} } }) }));
const mockDecide = jest.fn();
jest.mock('@/lib/push/scanNudge', () => ({ decideScanNudge: (...a: unknown[]) => mockDecide(...a) }));
let mockSettle: Promise<void> = Promise.resolve();
jest.mock('@/lib/ads/adsSession', () => ({ whenAdsSettled: () => mockSettle }));
jest.mock('@/components/ReviewPromptSheet', () => ({ ReviewPromptSheet: () => null }));
jest.mock('@/features/push/PushPrimerModal', () => ({ PushPrimerModal: () => null }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PackagedCoachOverlay,
  bubbleX,
  holePath,
  markPackagedCoachSeen,
  presentHomeCoach,
  queuePackagedCoachStep2,
  shouldShowPackagedCoach,
  takePackagedCoachStep2,
  usePackagedCoach,
  type CoachStep,
} from '../PackagedCoach';
import { packagedCoachAnchor, scanCoachAnchor } from '@/lib/coachTargets';
import { createOneShotQueue } from '@/lib/oneShotQueue';
import { pushOcclusion, _resetOcclusionForTest } from '@/lib/engagement/occlusion';
import { ScanExitPrompts, armScanExitPrompt, fireScanExitPrompt } from '@/features/scan/ScanExitPrompts';

const { FLAGS } = jest.requireActual('@/lib/flags') as { FLAGS: { processedFoodEnabled: boolean; pushEnabled: boolean } };
const prev = { ...FLAGS };
const prevOS = Platform.OS;
const setOS = (os: 'ios' | 'android') => Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
const flush = async () => { for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); }); };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  FLAGS.processedFoodEnabled = true;
  mockSettle = Promise.resolve();
  _resetOcclusionForTest();
  Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => 'active' }); // 전경(가림 없음)
  takePackagedCoachStep2();
  scanCoachAnchor(null);
  packagedCoachAnchor(null);
});
afterEach(() => {
  FLAGS.processedFoodEnabled = prev.processedFoodEnabled;
  FLAGS.pushEnabled = prev.pushEnabled;
  setOS(prevOS as 'ios' | 'android');
});

const events = (name: string) => mockTrack.mock.calls.filter((c) => c[0] === name).map((c) => c[1]);
const byId = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id);
const has = (tree: ReactTestRenderer, id: string) => byId(tree, id).length > 0;
const layout = (tree: ReactTestRenderer, step: CoachStep, width = 390, height = 844) =>
  act(() => { byId(tree, `packaged-coach-${step}`)[0].props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height } } }); });
const anchorAt = (anchor: typeof scanCoachAnchor, x: number, y: number, w: number, h: number) =>
  anchor({ measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(x, y, w, h) });

describe('1회 · 플래그', () => {
  it('플래그 off = 미노출 · on = 처음 1회 · 기록 뒤 = 다시 안 뜸', async () => {
    FLAGS.processedFoodEnabled = false;
    expect(await shouldShowPackagedCoach()).toBe(false);
    FLAGS.processedFoodEnabled = true;
    expect(await shouldShowPackagedCoach()).toBe(true);
    markPackagedCoachSeen();
    await flush();
    expect(await AsyncStorage.getItem('kbap.packagedCoach.v1')).toBe('1');
    expect(await shouldShowPackagedCoach()).toBe(false);
  });

  it('스토리지 오류 = 안 뜸(흐름 방해 금지)', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('io'));
    expect(await shouldShowPackagedCoach()).toBe(false);
  });

  it('2단계 예약은 한 번만 가져간다', () => {
    expect(takePackagedCoachStep2()).toBe(false);
    queuePackagedCoachStep2();
    expect(takePackagedCoachStep2()).toBe(true);
    expect(takePackagedCoachStep2()).toBe(false);
  });
});

describe('스포트라이트 위치', () => {
  it('말풍선은 화면 여백 16 안 · 꼬리는 말풍선 안에서 대상 가운데를 가리킨다', () => {
    const w = 288;
    const mid = bubbleX(390, 195, w);
    expect(mid.left).toBe(51);
    expect(mid.tailX + 8).toBe(195 - 51); // 꼬리 가운데 = 대상 가운데
    const edge = bubbleX(390, 380, w);
    expect(edge.left).toBe(390 - 16 - w);
    expect(edge.tailX).toBeLessThanOrEqual(w - 16 - 16);
  });

  it('구멍 경로 = 바깥 사각형 + 둥근 구멍(evenodd 두 고리)', () => {
    const d = holePath(390, 844, { x: 163, y: 760, width: 64, height: 64 }, 32);
    expect(d.startsWith('M0 0H390V844H0Z')).toBe(true);
    expect(d).toContain('M195 760'); // 반지름 32 = 원 — 위 가운데에서 시작
    expect(d.match(/Z/g)).toHaveLength(2);
  });

  it('1단계: 잰 스캔 버튼 위에 구멍 + 그 위 말풍선(제목·본문)', async () => {
    anchorAt(scanCoachAnchor, 169, 766, 52, 52);
    let tree!: ReactTestRenderer;
    act(() => { tree = renderer.create(<PackagedCoachOverlay step="home" open onNext={() => {}} onSkip={() => {}} />); });
    layout(tree, 'home');
    await flush();
    expect(has(tree, 'packaged-coach-scrim')).toBe(true);
    const bubble = byId(tree, 'packaged-coach-bubble')[0];
    const style = Object.assign({}, ...[bubble.props.style].flat(3).filter(Boolean));
    expect(style.bottom).toBe(844 - (766 - 6) + 12); // 구멍 위 끝(패딩 6) 위로 12
    const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children);
    expect(texts).toEqual(expect.arrayContaining(['packagedCoach.homeTitle', 'packagedCoach.homeBody']));
  });

  it('2단계: Packaged 탭 아래로 말풍선', async () => {
    anchorAt(packagedCoachAnchor, 120, 60, 80, 34);
    let tree!: ReactTestRenderer;
    act(() => { tree = renderer.create(<PackagedCoachOverlay step="food" open onNext={() => {}} onSkip={() => {}} />); });
    layout(tree, 'food');
    await flush();
    const bubble = byId(tree, 'packaged-coach-bubble')[0];
    const style = Object.assign({}, ...[bubble.props.style].flat(3).filter(Boolean));
    expect(style.top).toBe(60 + 34 + 6 + 12);
    expect(tree.root.findAll((n) => n.props?.children === 'packagedCoach.foodBody').length).toBeGreaterThan(0);
  });

  it('대상을 못 재면(미등록·크기 0) 딤 없이 말풍선만', async () => {
    let tree!: ReactTestRenderer;
    act(() => { tree = renderer.create(<PackagedCoachOverlay step="home" open onNext={() => {}} onSkip={() => {}} />); });
    layout(tree, 'home');
    await flush();
    expect(has(tree, 'packaged-coach-scrim')).toBe(false);
    expect(has(tree, 'packaged-coach-bubble')).toBe(true);
    anchorAt(scanCoachAnchor, 0, 0, 0, 0);
    act(() => { tree.update(<PackagedCoachOverlay step="home" open={false} onNext={() => {}} onSkip={() => {}} />); });
    act(() => { tree.update(<PackagedCoachOverlay step="home" open onNext={() => {}} onSkip={() => {}} />); });
    await flush();
    expect(has(tree, 'packaged-coach-scrim')).toBe(false);
  });

  it('닫기 = 44pt · 스크린리더 라벨', async () => {
    let tree!: ReactTestRenderer;
    act(() => { tree = renderer.create(<PackagedCoachOverlay step="home" open onNext={() => {}} onSkip={() => {}} />); });
    layout(tree, 'home');
    await flush();
    const x = byId(tree, 'packaged-coach-skip')[0];
    expect(x.props.accessibilityLabel).toBe('common.close');
    const st = Object.assign({}, ...[x.props.style].flat(3).filter(Boolean));
    expect(st.width).toBeGreaterThanOrEqual(44);
    expect(st.height).toBeGreaterThanOrEqual(44);
    expect(byId(tree, 'packaged-coach-home')[0].props.accessibilityLabel).toBe('packagedCoach.homeTitle, packagedCoach.homeBody');
  });
});

/* ---- 흐름: 홈·음식 탭과 같은 훅 + 오버레이 ---- */
function Harness({ step, next, expose }: { step: CoachStep; next: () => void; expose: (show: (done?: () => void) => void) => void }) {
  const coach = usePackagedCoach(step, { next });
  const { show } = coach;
  React.useEffect(() => { expose(show); }, [expose, show]);
  return <PackagedCoachOverlay {...coach.props} />;
}
function mount(step: CoachStep, next = jest.fn()) {
  const api: { show?: (done?: () => void) => void } = {};
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Harness step={step} next={next} expose={(show) => { api.show = show; }} />); });
  return { tree, api, next };
}
const tapBackdrop = (tree: ReactTestRenderer, step: CoachStep) => act(() => { byId(tree, `packaged-coach-${step}`)[0].props.onPress(); });
const modal = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props?.transparent === true && 'visible' in n.props)[0];

describe('흐름', () => {
  it('iOS: 표시 즉시 기록·shown · 탭 = next 계측, 다음 처리는 dismiss 완료 뒤 1번(연타 무시)', async () => {
    setOS('ios');
    const done = jest.fn();
    const { tree, api, next } = mount('home');
    act(() => api.show!(done));
    await flush();
    expect(await AsyncStorage.getItem('kbap.packagedCoach.v1')).toBe('1');
    expect(events('food_packaged_coach_shown')).toEqual([{ step: 'home' }]);
    const press = byId(tree, 'packaged-coach-home')[0].props.onPress;
    act(() => { press(); press(); }); // 연타 = 닫힘 렌더 전 두 번
    expect(events('food_packaged_coach_next')).toEqual([{ step: 'home' }]);
    expect(modal(tree).props.visible).toBe(false);
    expect(next).not.toHaveBeenCalled(); // 아직 dismiss 전 — 다음 화면·모달 금지(KB-377)
    expect(done).not.toHaveBeenCalled();
    act(() => { modal(tree).props.onDismiss(); });
    expect(done).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('Android: 닫으면 바로 다음 처리 · X = 건너뛰기(skip 계측, 다음 단계 없음)', async () => {
    setOS('android');
    const done = jest.fn();
    const { tree, api, next } = mount('home');
    act(() => api.show!(done));
    layout(tree, 'home');
    await flush();
    act(() => { byId(tree, 'packaged-coach-skip')[0].props.onPress(); });
    expect(events('food_packaged_coach_skip')).toEqual([{ step: 'home' }]);
    expect(events('food_packaged_coach_next')).toEqual([]);
    expect(done).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('1단계 탭 → 음식 탭 2단계 → 탭 = Packaged 선택', () => {
    setOS('android');
    let segment = 'dishes';
    const home = mount('home', jest.fn(() => queuePackagedCoachStep2()));
    act(() => home.api.show!());
    tapBackdrop(home.tree, 'home');
    expect(home.next).toHaveBeenCalledTimes(1);
    // 음식 탭 포커스: 예약이 있으면 2단계
    const food = mount('food', jest.fn(() => { segment = 'packaged'; }));
    expect(takePackagedCoachStep2()).toBe(true);
    act(() => food.api.show!());
    expect(modal(food.tree).props.visible).toBe(true);
    expect(events('food_packaged_coach_shown')).toEqual([{ step: 'home' }, { step: 'food' }]);
    tapBackdrop(food.tree, 'food');
    expect(segment).toBe('packaged');
    expect(events('food_packaged_coach_next')).toEqual([{ step: 'home' }, { step: 'food' }]);
  });
});

describe('직렬화 · 우선순위', () => {
  it('홈 큐: 뒤 시트는 코치마크가 완전히 닫힌 뒤에야 present', async () => {
    setOS('ios');
    const { tree, api } = mount('home');
    const queue = createOneShotQueue();
    const other = jest.fn(() => false);
    queue.add({ key: 'packagedCoach', present: (done, signal) => presentHomeCoach(api.show!, done, signal) });
    queue.add({ key: 'other', present: other });
    await flush();
    expect(modal(tree).props.visible).toBe(true);
    expect(other).not.toHaveBeenCalled();
    tapBackdrop(tree, 'home');
    await flush();
    expect(other).not.toHaveBeenCalled(); // iOS dismiss 전
    act(() => { modal(tree).props.onDismiss(); });
    await flush();
    expect(other).toHaveBeenCalledTimes(1);
  });

  it('이미 본 뒤 = 코치마크 스텝은 소모 0으로 넘어간다', async () => {
    markPackagedCoachSeen();
    await flush();
    const { tree, api } = mount('home');
    const queue = createOneShotQueue();
    const other = jest.fn(() => false);
    queue.add({ key: 'packagedCoach', present: (done, signal) => presentHomeCoach(api.show!, done, signal) });
    queue.add({ key: 'other', present: other });
    await flush();
    expect(modal(tree).props.visible).toBe(false);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it('첫 실행: 광고 동의 흐름(UMP 폼·ATT)이 끝날 때까지 기다린 뒤에야 띄운다(그 전엔 기록도 안 함)', async () => {
    let settle!: () => void;
    mockSettle = new Promise<void>((r) => { settle = r; });
    const { tree, api } = mount('home');
    const queue = createOneShotQueue();
    queue.add({ key: 'packagedCoach', present: (done, signal) => presentHomeCoach(api.show!, done, signal) });
    await flush();
    expect(modal(tree).props.visible).toBe(false);
    expect(await AsyncStorage.getItem('kbap.packagedCoach.v1')).toBeNull();
    settle();
    await flush();
    expect(modal(tree).props.visible).toBe(true);
    expect(await AsyncStorage.getItem('kbap.packagedCoach.v1')).toBe('1');
  });

  it('다른 덮개가 떠 있거나 화면을 떠나면(큐 clear) 건너뜀 — 기록 안 함 → 다음 홈 포커스에 다시', async () => {
    const show = jest.fn();
    const release = pushOcclusion();
    expect(await presentHomeCoach(show, () => {}, new AbortController().signal)).toBe(false);
    release();
    const ac = new AbortController();
    mockSettle = new Promise<void>(() => {});
    const p = presentHomeCoach(show, () => {}, ac.signal);
    await flush();
    ac.abort();
    expect(await p).toBe(false);
    expect(show).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('kbap.packagedCoach.v1')).toBeNull();
  });

  it('스캔 뒤 넛지·리뷰 유도: 코치마크를 아직 안 봤으면 건너뜀 · 본 뒤엔 그대로', async () => {
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(((cb: () => void) => { cb(); return { then: () => {}, done: () => {}, cancel: () => {} }; }) as never);
    FLAGS.pushEnabled = false;
    mockRequest.mockResolvedValue(false);
    act(() => { renderer.create(<ScanExitPrompts />); });
    armScanExitPrompt({ isGuest: false, ready: Promise.resolve() });
    act(() => fireScanExitPrompt());
    await flush();
    expect(mockRequest).not.toHaveBeenCalled();
    markPackagedCoachSeen();
    await flush();
    armScanExitPrompt({ isGuest: false, ready: Promise.resolve() });
    act(() => fireScanExitPrompt());
    await flush();
    expect(mockRequest).toHaveBeenCalledWith('scan', expect.anything());
  });
});

describe('#398 Codex 1차', () => {
  it('코치마크가 떠 있는 동안(봤음 키는 이미 기록) 스캔 뒤 넛지·리뷰 유도 없음 · 1→2단계 사이도 · 흐름이 끝나면 다시', async () => {
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(((cb: () => void) => { cb(); return { then: () => {}, done: () => {}, cancel: () => {} }; }) as never);
    FLAGS.pushEnabled = false;
    mockRequest.mockResolvedValue(false);
    setOS('android');
    act(() => { renderer.create(<ScanExitPrompts />); });
    const exit = async () => { armScanExitPrompt({ isGuest: false, ready: Promise.resolve() }); act(() => fireScanExitPrompt()); await flush(); };
    const home = mount('home', jest.fn(() => queuePackagedCoachStep2()));
    act(() => home.api.show!());
    await flush();
    expect(await AsyncStorage.getItem('kbap.packagedCoach.v1')).toBe('1'); // 키만 보면 통과했을 상황
    await exit();
    expect(mockRequest).not.toHaveBeenCalled();
    tapBackdrop(home.tree, 'home'); // 1단계 탭 → 2단계 대기(음식 탭 전)
    await exit();
    expect(mockRequest).not.toHaveBeenCalled();
    const food = mount('food', jest.fn());
    expect(takePackagedCoachStep2()).toBe(true);
    act(() => food.api.show!());
    await exit();
    expect(mockRequest).not.toHaveBeenCalled();
    tapBackdrop(food.tree, 'food'); // 흐름 끝
    await exit();
    expect(mockRequest).toHaveBeenCalled(); // 앞 테스트의 호스트도 구독 중이라 횟수 대신 "다시 뜸"만
  });
});

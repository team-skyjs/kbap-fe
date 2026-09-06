/**
 * P-051 원칙(화면 그대로 제출) × P-081(KB-261 후속) enum 잠금:
 *  - 미조작 + Continue → 요약 → 제출: 기본 **MEDIUM** (와이어 5는 submit.test/어댑터가 잠금)
 *  - 스톱 조작(Hot) → **HOT** 제출 (enum 그대로 — 정수 변환은 spiceAdapter 격리)
 *  - Skip → **SKIP** (body -1은 submit.test가 잠금)
 * P-080 구조: 제출은 spice 스텝이 아니라 **요약 카드 CTA에서만** — 이 하네스가
 * spice→summary→제출 동선(1회 제출 회귀 0)도 겸해서 잠근다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

// onboardingRestrictionsCta.test 프렐류드 재사용
jest.mock('@/lib/data/useDietPresets', () => {
  // P-208: 프리셋 서버 훅 표면 목 — 상수 폴백 형태(react-query 무의존)
  const { DIET_PRESETS, presetSubstanceCodes } = jest.requireActual('@/lib/onboarding/dietPresets');
  return { useDietPresets: () => DIET_PRESETS.map((p: { id: string; group: string; labelKey: string }) => ({ ...p, codes: presetSubstanceCodes(p), serverName: null })) };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['springify', 'damping', 'stiffness', 'mass', 'duration', 'delay', 'easing']) b[k] = () => b;
    return b;
  };
  return {
    __esModule: true,
    withSpring: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeIn: chain(),
    FadeOut: chain(),
    FadeInDown: chain(),
    SlideInDown: chain(),
    ZoomIn: chain(),
    ZoomOut: chain(),
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    cancelAnimation: () => {},
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k },
}));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en', regionCode: 'US' }] }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/lib/data/profileImage', () => ({ pickProfileImage: jest.fn(), uploadProfileImage: jest.fn() }));
const mockSubmit = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/onboarding/submit', () => ({ UNSET: 'UNSET', submitOnboardingProfile: (p: unknown) => mockSubmit(p) }));
jest.mock('@/lib/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: undefined }),
  useMyReviews: () => ({ data: [] }),
  useUpdateMe: () => ({ mutate: jest.fn() }),
}));
// 드래프트 복귀로 spice 스텝에 미조작 상태로 직행
jest.mock('@/lib/onboarding/draft', () => ({
  loadOnboardingDraft: jest.fn().mockResolvedValue({
    consented: true,
    step: 'spice',
    nickname: 'Yejin',
    nationality: 'KR',
    language: 'en',
    restrictions: [],
    spice: null,
    updatedAt: '2026-07-20T00:00:00Z',
  }),
  saveOnboardingDraft: jest.fn(),
  clearOnboardingDraft: jest.fn(),
}));

import Onboarding from '../onboarding/index';
import { Btn } from '@/components/Btn';

async function renderSpiceStep(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Onboarding />);
  });
  return tree;
}
const btnWith = (tree: ReactTestRenderer, key: string) =>
  tree.root.findAllByType(Btn).find((b) => {
    const c = b.props.children;
    return (Array.isArray(c) ? c.join('') : String(c ?? '')).includes(key);
  })!;
// P-088⑤: 슬라이더 = 트랙 레벨 제스처 단일 — onLayout으로 폭 확정 후 릴리즈로 스냅
// (onLayout과 responder props는 같은 View에 있으나 test renderer 노드가 분리될 수
// 있어 각각 탐색)
async function selectStop(tree: ReactTestRenderer, index: 0 | 1 | 2 | 3 | 4) {
  // P-262: 팬 래퍼 지문 = paddingVertical 32(±32 확장) + responder — ScrollView 등
  // 다른 responder 보유 노드 오탐 방지. onLayout은 내부 트랙 래퍼(자식)로 분리됨.
  const isPan = (n: { props?: { style?: unknown; onResponderRelease?: unknown } }) =>
    typeof n.props?.onResponderRelease === 'function' &&
    (StyleSheet.flatten(n.props?.style as never) as { paddingVertical?: number } | undefined)?.paddingVertical === 32;
  const pan = tree.root.findAll(isPan)[0];
  const layoutNode = pan.findAll((n) => typeof n.props?.onLayout === 'function')[0];
  await act(async () => {
    layoutNode.props.onLayout({ nativeEvent: { layout: { width: 300, height: 44 } } });
  });
  await act(async () => {
    tree.root.findAll(isPan)[0].props.onResponderRelease({ nativeEvent: { pageX: (300 * index) / 4 } }); // P-098 pageX
  });
}
const skipLink = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => ['onboarding.skip','onboarding.skipDecideLater','onboarding.nothingToAvoid'].includes(c.props?.children)).length > 0);
// P-130(v3): 맵기 = 마지막 스텝 — CTA(onboarding.finishSetup)가 즉시 제출(요약 소멸)
async function submitFromSpice(tree: ReactTestRenderer) {
  await act(async () => {
    btnWith(tree, 'onboarding.finishSetup').props.onPress();
  });
}

beforeEach(() => {
  mockSubmit.mockClear();
});

it('미조작 + 시작하기 → 즉시 제출: 기본 MEDIUM + 자동 닉네임 형식 (P-130)', async () => {
  const tree = await renderSpiceStep();
  await submitFromSpice(tree);
  expect(mockSubmit).toHaveBeenCalledTimes(1); // 맵기 완료 = 제출 1회
  expect(mockSubmit.mock.calls[0][0].spiceTolerance).toBe('MEDIUM');
  // P-209: 닉네임·아바타 = 서버 자동 지정(1.1) — 화면은 미전달(prod 폴백 생성은 submit 내부)
  expect(mockSubmit.mock.calls[0][0].nickname).toBeUndefined();
  expect(mockSubmit.mock.calls[0][0].profileImageUrl).toBeUndefined();
});

it('Hot 스톱 조작 → HOT 제출 (P-081 enum — 내부에 정수 없음)', async () => {
  const tree = await renderSpiceStep();
  await selectStop(tree, 3); // Hot — 릴리즈 스냅 (P-088⑤ 트랙 제스처)
  await submitFromSpice(tree);
  expect(mockSubmit.mock.calls[0][0].spiceTolerance).toBe('HOT');
});

it('Skip → 즉시 제출 SKIP (스킵도 제출 트리거 — v3)', async () => {
  const tree = await renderSpiceStep();
  const skips = skipLink(tree);
  expect(skips.length).toBeGreaterThanOrEqual(1);
  await act(async () => {
    skips[skips.length - 1].props.onPress();
  });
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(mockSubmit.mock.calls[0][0].spiceTolerance).toBe('SKIP');
});

/* ---- P-119(테플 빌드14 반려) → KB-433: 히어로 프레임 불변 — NONE 전환 하강 봉쇄 ---- */
it('P-119 → KB-433: 히어로 프레임 고정 · NONE(0)↔HOT(3) 스타일 완전 동일', async () => {
  const flat = (s: unknown) => StyleSheet.flatten(s) as Record<string, number | undefined>;
  const heroStyles = (tree: ReactTestRenderer) => {
    // KB-433: 고추 행 28 고정 · 레벨명 28 고정 · 설명 슬롯 36 고정
    const chiliRow = tree.root.findAll((n) => n.type === 'View' && flat(n.props.style)?.height === 28 && flat(n.props.style)?.flexDirection === 'row')[0];
    const band = tree.root.findAll((n) => n.type === 'Text' && flat(n.props.style)?.height === 28)[0];
    const desc = tree.root.findAll((n) => n.type === 'Text' && flat(n.props.style)?.height === 36)[0];
    return { chiliRow: flat(chiliRow.props.style), band: flat(band.props.style), desc: flat(desc.props.style) };
  };
  const a = await renderSpiceStep();
  await selectStop(a, 0); // NONE — 반려 지점
  const b = await renderSpiceStep();
  await selectStop(b, 3); // HOT
  const ha = heroStyles(a);
  const hb = heroStyles(b);
  expect(ha).toEqual(hb); // 단계 전환에도 프레임 스타일 픽셀 동일
  expect(ha.band.lineHeight).toBe(28);
  expect(ha.desc.height).toBe(36); // 설명 슬롯 고정
});

/* ---- KB-433 §4-②: SVG 고추 점등 · 예시 타일 3개 고정 행 + 레벨 전환 교체 ---- */
it('KB-433: SVG 고추 점등 = rank(HOT=3점등) — 이모지·kids 배지 소멸', async () => {
  const a = await renderSpiceStep();
  await selectStop(a, 3); // HOT
  const ons = new Set(a.root.filter ? [] : a.root.findAll((n) => typeof n.props?.testID === 'string' && /^spice-pepper-\d-on$/.test(n.props.testID)).map((n) => n.props.testID as string));
  expect(ons.size).toBe(3);
  expect(a.root.findAll((n) => n.props?.testID === 'spice-pepper-3-off').length).toBeGreaterThanOrEqual(1);
  expect(a.root.findAll((n) => n.props?.testID === 'kid-badge')).toHaveLength(0);
});

it('KB-433: 예시 타일 3개(107×133) 고정 행 + 레벨 전환 시 타일 교체', async () => {
  const tree = await renderSpiceStep();
  const cards = () => tree.root.findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('rail-'));
  expect(cards().length).toBeGreaterThanOrEqual(3);
  const w = (StyleSheet.flatten(cards()[0].props.style) as { width?: number }).width!;
  expect(w).toBe(107); // 시안 타일 폭
  const before = cards().map((n) => n.props.testID as string);
  await selectStop(tree, 3); // HOT — 타일 교체
  const after = cards().map((n) => n.props.testID as string);
  expect(after).not.toEqual(before);
});

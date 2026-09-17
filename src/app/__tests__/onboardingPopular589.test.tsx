/**
 * P-395(KB-589) — 온보딩 국적 선택 "Popular" 그룹(2025 KTO 방한 상위 10개국).
 * ① 감지국이 10개 안(US)이면 9개 + 순위 순서 그대로 / ② 감지국이 밖(DE)이면 10개
 * ③ 검색 중엔 핀과 함께 숨김(기존 규칙) / ④ A–Z 전체 리스트는 무변(상위 10개국도 남는다)
 */
import * as React from 'react';
import { TextInput } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// P-174: 재료 카탈로그 훅 표면 목 — 폴백 경로(서버 무데이터) = 종전 렌더와 동일
jest.mock('@/lib/data/useDietPresets', () => {
  // P-208: 프리셋 서버 훅 표면 목 — 상수 폴백 형태(react-query 무의존)
  const { DIET_PRESETS, presetSubstanceCodes } = jest.requireActual('@/lib/onboarding/dietPresets');
  return { useDietPresets: () => DIET_PRESETS.map((p: { id: string; group: string; labelKey: string }) => ({ ...p, codes: presetSubstanceCodes(p), serverName: null })) };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({
    name: (c: string) => (require('@/lib/mocks/ingredients') as typeof import('@/lib/mocks/ingredients')).ingredientLabel(c),
    imageUrl: () => null,
  }),
}));
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
const mockRegion = { code: 'US' };
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en', regionCode: mockRegion.code }] }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/lib/data/profileImage', () => ({ choosePhotoSource: jest.fn(), pickBySource: jest.fn(), uploadProfileImage: jest.fn() }));
jest.mock('@/lib/onboarding/submit', () => ({ UNSET: 'UNSET', submitOnboardingProfile: jest.fn() }));
jest.mock('@/lib/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: undefined }),
  useMyReviews: () => ({ data: [] }),
  useUpdateMe: () => ({ mutate: jest.fn() }),
}));
// 테스트별 드래프트 전환: null = 신규(약관 스텝), 'riskdemo' = 데모 직행
let mockDraft: Record<string, unknown> | null = null;
jest.mock('@/lib/onboarding/draft', () => ({
  loadOnboardingDraft: jest.fn(() => Promise.resolve(mockDraft)),
  saveOnboardingDraft: jest.fn(),
  clearOnboardingDraft: jest.fn(),
}));

import Onboarding from '../onboarding/index';
import { POPULAR_COUNTRIES } from '@/lib/onboarding/countries';

const NAT_DRAFT = { consented: true, step: 'nationality', nickname: '', nationality: 'US', language: 'en', restrictions: [], spice: 'MEDIUM', updatedAt: '' };

async function render(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Onboarding />); });
  return tree;
}
// react-test-renderer의 findAll은 컴포지트(Pressable)와 호스트(View) 노드를 **둘 다** 잡는다 —
// 호스트만 세지 않으면 모든 개수가 2배로 나온다.
const hosts = (tree: ReactTestRenderer, pred: (n: { props: Record<string, unknown> }) => boolean) =>
  tree.root.findAll((n) => typeof n.type === 'string' && pred(n as never));
const ids = (tree: ReactTestRenderer, prefix: string) =>
  hosts(tree, (n) => typeof n.props?.testID === 'string' && (n.props.testID as string).startsWith(prefix))
    .map((n) => n.props.testID as string);
const popularCodes = (tree: ReactTestRenderer) => ids(tree, 'nat-pop-').map((s) => s.replace('nat-pop-', ''));

beforeEach(() => { mockRegion.code = 'US'; mockDraft = NAT_DRAFT; });

it('① 감지국이 상위 10개국 안(US) → Popular 9개, 순위 순서 그대로(핀이 US 담당)', async () => {
  const tree = await render();
  expect(popularCodes(tree)).toEqual(['CN', 'JP', 'TW', 'HK', 'PH', 'VN', 'SG', 'ID', 'TH']);
  // 정렬이 아니라 상수 배열 순서 — 알파벳순이면 CN,HK,ID,JP…가 됐을 것
  expect(popularCodes(tree)).not.toEqual([...popularCodes(tree)].sort());
});

it('② 감지국이 밖(DE) → 10개 전부 + 상수와 완전히 같은 순서', async () => {
  mockRegion.code = 'DE';
  const tree = await render();
  expect(popularCodes(tree)).toEqual([...POPULAR_COUNTRIES]);
});

it('③ 검색어를 넣으면 Popular 그룹·라벨이 핀과 함께 사라진다', async () => {
  const tree = await render();
  expect(hosts(tree, (n) => n.props?.testID === 'nat-popular-grid')).toHaveLength(1);
  const input = tree.root.findAllByType(TextInput).find((n) => n.props.placeholder === 'onboarding.nationalitySearch')!;
  await act(async () => { input.props.onChangeText('jap'); });
  expect(hosts(tree, (n) => n.props?.testID === 'nat-popular-grid')).toHaveLength(0);
  expect(popularCodes(tree)).toEqual([]);
  // 핀도 함께 숨는다(기존 규칙 무변)
  expect(hosts(tree, (n) => n.props?.children === 'onboarding.fromYourPhone')).toHaveLength(0);
});

it('④ A–Z 구성 — Popular·감지국은 빠진다(featured에 있으면 A–Z에서 제외, 한 규칙)', async () => {
  const tree = await render();
  const az = ids(tree, 'nat-').filter((s) => !s.startsWith('nat-pop') && s !== 'nat-US' && s !== 'nat-clear');
  for (const c of POPULAR_COUNTRIES) expect(az).not.toContain(`nat-${c}`);
  expect(az).not.toContain('nat-US'); // 감지국은 핀이 담당(기존 규칙)
  expect(az.length).toBeGreaterThan(100); // 나머지 전 국가는 그대로
  expect(az).toContain('nat-KR'); // Popular 밖 국가는 A–Z에 남는다
});

it('④ 검색하면 Popular·감지국 국가도 전부 찾힌다(제외는 기본 목록에만 적용)', async () => {
  const tree = await render();
  const input = tree.root.findAllByType(TextInput).find((n) => n.props.placeholder === 'onboarding.nationalitySearch')!;
  await act(async () => { input.props.onChangeText('japan'); });
  expect(ids(tree, 'nat-')).toContain('nat-JP'); // Popular 소속이어도 검색 결과엔 나온다
  await act(async () => { input.props.onChangeText('united states'); });
  expect(ids(tree, 'nat-')).toContain('nat-US'); // 감지국도 마찬가지
});

// P-154 "강조 1곳": 같은 나라가 두 곳에 보이면 라디오가 둘 켜진 것처럼 읽힌다(Codex #171)
it('④ 강조는 1곳 — Popular에서 고른 나라가 A–Z에 중복 강조되지 않는다', async () => {
  const tree = await render();
  const { StyleSheet } = require('react-native') as typeof import('react-native');
  const flat = (st: unknown) => StyleSheet.flatten(st) as Record<string, unknown>;
  const jp = tree.root.findAll((n) => n.props?.testID === 'nat-pop-JP')[0];
  await act(async () => { jp.props.onPress(); });
  const highlighted = hosts(tree, (n) => typeof n.props?.testID === 'string' && (n.props.testID as string).startsWith('nat-'))
    .filter((n) => flat(n.props.style)?.borderColor === '#FF7134');
  expect(highlighted).toHaveLength(1);
  expect(highlighted[0].props.testID).toBe('nat-pop-JP');
});

it('④ 홀수 자리표시자 — Popular 9개면 2열 유지용 패드가 붙고, 10개면 안 붙는다', async () => {
  const tree = await render(); // US 감지 → 9개
  expect(hosts(tree, (n) => n.props?.testID === 'nat-popular-pad')).toHaveLength(1);
  mockRegion.code = 'DE';
  const tree2 = await render(); // → 10개
  expect(hosts(tree2, (n) => n.props?.testID === 'nat-popular-pad')).toHaveLength(0);
});

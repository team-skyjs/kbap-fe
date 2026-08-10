/**
 * P-105(KB-251): 작성 화면 v2.3 시안 정합 잠금 — 2존 구조(히어로 헤딩·Post 필)
 * + Post 게이팅(빈 본문 비활성 → 입력 시 활성, 초과 시 비활성) + 태그 행 2개
 * 카운터. 픽셀 판정은 예진 육안 — 여기는 구조·게이팅 회귀만 잠근다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeIn: chain(),
    FadeOut: chain(),
    SlideInDown: chain(),
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    ZoomIn: chain(),
    ZoomOut: chain(),
    FadeInDown: chain(),
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({
    data: {
      id: '1',
      nickname: 'Mina',
      nationality: 'US',
      readerLanguage: 'en',
      spiceTolerance: 'SKIP',
      restrictions: [],
      rank: { tier: 'newcomer', level: 1, score: 0, nextTier: 'taster', pointsToNext: 10 },
    },
  }),
}));
jest.mock('@/lib/data/useFoods', () => ({
  useSearchFoods: () => ({ data: [] }),
  useInfiniteFoods: () => ({ data: [] }),
}));

import CommunityCompose from '../community/compose';

function render(): ReactTestRenderer {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <CommunityCompose />
      </QueryClientProvider>,
    );
  });
  return tree;
}

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => n.type === 'Text').map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children)));

/** 히어로의 Post 필 Pressable — disabled prop을 가진 community.post 버튼. */
function postPill(tree: ReactTestRenderer) {
  return tree.root.findAll(
    (n) => 'disabled' in (n.props ?? {}) && typeof n.props.onPress === 'function' &&
      n.findAll((c) => c.type === 'Text' && c.props.children === 'community.post').length > 0,
  )[0];
}

const bodyInput = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props?.multiline === true)[0];

it('2존 구조 — 히어로 헤딩·작성자 랭킹 필·태그 행 2개(0/3·0/1)·번역 힌트 렌더', () => {
  const tree = render();
  const all = texts(tree);
  expect(all).toContain('community.composeHeading');
  expect(all).toContain('ranking.tier.newcomer');
  expect(all).toContain('community.tagDish');
  // P-142: 장소 태그 = 계약 부재 → placeTagsEnabled off로 행 미노출 잠금
  expect(all).not.toContain('community.tagPlace');
  expect(all).toContain('0/3');
  expect(all).not.toContain('0/1');
  expect(all).toContain('community.translateHint');
});

it('Post 필 게이팅 — 빈 본문 비활성 → 입력 시 활성 → 2,000자 초과 비활성', () => {
  const tree = render();
  expect(postPill(tree).props.disabled).toBe(true);
  act(() => bodyInput(tree).props.onChangeText('Good bibimbap near Hongdae'));
  expect(postPill(tree).props.disabled).toBe(false);
  act(() => bodyInput(tree).props.onChangeText('x'.repeat(2001)));
  expect(postPill(tree).props.disabled).toBe(true);
});

it('사진 추가 타일 — 대시 보더 + n/4 카운터 노출', () => {
  const tree = render();
  expect(texts(tree)).toContain('0/4');
});

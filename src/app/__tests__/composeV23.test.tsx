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
let mockComposeParams: { editId?: string } = {}; // KB-708: 수정 모드 이탈 확인 테스트만 editId를 준다
jest.mock('expo-router', () => ({
  useNavigation: () => ({ dispatch: (a: unknown) => mockNavDispatch(a) }), // KB-708 이탈 확인
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockComposeParams,
  usePathname: () => '/', // 게스트 분기 AuthGateSheet
  useSegments: () => [],
}));
// KB-708: 이탈 확인 — usePreventRemove(번들 react-navigation) 목: 마지막 호출의 (막는지, 콜백)을 기록 → 테스트가 뒤로 가기를 흉내
const mockNavDispatch = jest.fn();
const mockPrevent: { on: boolean; cb: ((o: { data: { action: unknown } }) => void) | null } = { on: false, cb: null };
jest.mock('expo-router/build/react-navigation/core', () => ({
  usePreventRemove: (on: boolean, cb: (o: { data: { action: unknown } }) => void) => {
    mockPrevent.on = on;
    mockPrevent.cb = cb;
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
const mockSession = { guest: false }; // KB-708 B: 작성 중 세션 만료(게스트 전환) 시나리오만 true
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockSession.guest }));
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
  useScannedFoods: () => ({ data: [] }), // P-238: 픽커 초기 스캔 목록 표면 목
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
  // P-142: 장소 태그 = 계약 부재 → COMMUNITY_POST_PLACE_CONTRACT(KB-674 분리) false로 행 미노출 잠금
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

// ── KB-708 (4) 보강 — 커뮤니티 글쓰기: X뿐 아니라 스와이프·하드웨어 뒤로까지 같은 확인 · 수정은 고쳤을 때만
describe('KB-708 이탈 확인(커뮤니티)', () => {
  afterEach(() => {
    mockComposeParams = {};
    mockNavDispatch.mockClear();
  });
  it('작성: 빈 초안 = 막지 않음 · 쓰면 막음(헤더 X·스와이프·하드웨어 공통 경로) → 확인 시트 → 그만두기 = 막은 이동 진행', () => {
    const tree = render();
    expect(mockPrevent.on).toBe(false);
    act(() => bodyInput(tree).props.onChangeText('draft'));
    expect(mockPrevent.on).toBe(true);
    const action = { type: 'POP' };
    act(() => mockPrevent.cb!({ data: { action } }));
    expect(tree.root.findAll((n) => n.props?.testID === 'leave-confirm').length).toBeGreaterThan(0);
    act(() => tree.root.findAll((n) => n.props?.testID === 'discard-go' && typeof n.props?.onPress === 'function')[0].props.onPress());
    expect(mockNavDispatch).toHaveBeenCalledWith(action);
  });
  it('B: 작성 중 세션 만료(게스트 전환) = 막지 않음 — 게스트 분기엔 확인 창이 없다', () => {
    const tree = render();
    act(() => bodyInput(tree).props.onChangeText('draft'));
    expect(mockPrevent.on).toBe(true);
    mockSession.guest = true;
    try {
      act(() => bodyInput(tree).props.onChangeText('draft 2')); // 앱에선 useIsGuest 구독이 다시 그림 — 목은 구독이 없어 상태 변화로
      expect(tree.root.findAll((n) => n.props?.testID === 'leave-confirm')).toHaveLength(0);
      expect(mockPrevent.on).toBe(false);
    } finally {
      mockSession.guest = false;
    }
  });
  it('수정: 프리필만 = 막지 않음(안 고친 수정은 조용히 닫힘) · 고치면 막음 · 되돌리면 다시 안 막음', async () => {
    mockComposeParams = { editId: 'p1' };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    qc.setQueryData(['community', 'post', 'p1'], { id: 'p1', body: 'old body', photos: [], foodTags: [], placeTag: null });
    let tree!: ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <QueryClientProvider client={qc}>
          <CommunityCompose />
        </QueryClientProvider>,
      );
    });
    expect(bodyInput(tree).props.value).toBe('old body');
    expect(mockPrevent.on).toBe(false);
    act(() => bodyInput(tree).props.onChangeText('old body!'));
    expect(mockPrevent.on).toBe(true);
    act(() => bodyInput(tree).props.onChangeText('old body'));
    expect(mockPrevent.on).toBe(false);
    // #236 /review G: 재조회로 서버 값이 바뀌어도(프리필은 1회라 화면 값 그대로) 안 고쳤으면 dirty 아님 — 기준 = 프리필 시점 스냅샷
    await act(async () => {
      qc.setQueryData(['community', 'post', 'p1'], { id: 'p1', body: 'server changed', photos: [], foodTags: [], placeTag: null });
      await new Promise((r) => setTimeout(r, 0)); // TanStack 알림은 다음 틱
    });
    expect(bodyInput(tree).props.value).toBe('old body');
    expect(mockPrevent.on).toBe(false);
  });
});

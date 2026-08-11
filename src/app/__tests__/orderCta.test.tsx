/**
 * P-030(KB-205) → P-162 → P-167: 상세 하단 CTA = 사장님 확인(Ask the owner) + 원카드 화면 잠금.
 *  - P-167: 위험도 분기 제거 — **전 위험도 노출**(확인 버튼은 위험할수록 필요), 게스트만 제외
 *  - 게스트 미노출 (프로필 기피 없이는 고지 카드가 성립 안 함)
 *  - 카드: 기피 0개 → 고지 문단 생략(순수 주문), 보유 → 고지 렌더
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// tabStates.test 프렐류드 재사용
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
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canDismiss: () => true, dismissAll: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: '7' }),
  usePathname: () => '/',
  useFocusEffect: () => {},
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// orderCard.ts의 getFixedT('ko')까지 커버하는 i18n 표면 mock — 라벨은 defaultValue(영문)로
// 떨어지지만 이 테스트는 문단 유무만 잠근다 (ko 라벨 정확성은 orderCard.test.ts 몫).
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: {
    language: 'en',
    t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
    getFixedT: () => (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
  },
}));
const mockIsGuest = jest.fn(() => false);
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockIsGuest() }));

const mockUseFoodDetail = jest.fn();
jest.mock('@/lib/data/useFoods', () => ({ useFoodDetail: () => mockUseFoodDetail() }));
const mockUseMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({ useMe: () => mockUseMe() }));
jest.mock('@/lib/data/bookmarks', () => ({ useToggleBookmark: () => ({ mutate: jest.fn() }) }));
// P-139: 상세가 리뷰 프리뷰 프리페치 — 표면 목
jest.mock('@/lib/data/useFoodReviews', () => ({ useFoodReviews: () => ({ data: undefined }) }));

import FoodDetailScreen from '../food/[id]/index';
import OrderCard from '../food/[id]/order';
import type { FoodDetail, RiskState } from '@/lib/api/types';

const FOOD = (risk: RiskState): FoodDetail => ({
  foodId: '7',
  name: 'Kimchi Jjigae',
  nameKo: '김치찌개',
  risk,
  riskBasis: [],
  overall: { average: null, count: 0 },
  sameNationality: { average: null, count: 0 },
  description: 'desc',
  spiceLevel: null,
  photoUrl: null,
  ingredients: [],
  isRegistered: true,
  bookmarked: false,
});

const ME = (codes: string[]) => ({
  data: {
    id: '1', nickname: 'A', nationality: 'US', readerLanguage: 'en', spiceTolerance: null,
    restrictions: codes.map((code) => ({ kind: 'allergy' as const, code })),
    rank: { tier: 'bronze', level: 1, score: 0, nextTier: null, pointsToNext: null },
  },
});

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const flat = (tree: ReactTestRenderer) => JSON.stringify(tree.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockIsGuest.mockReturnValue(false);
  mockUseMe.mockReturnValue(ME(['EGG']));
  mockUseFoodDetail.mockReturnValue({ data: FOOD('safe'), isLoading: false, error: null, refetch: jest.fn() });
});

describe('상세 CTA 노출 조건 — P-167: 전 위험도, 게스트만 제외', () => {
  it.each<[RiskState, boolean]>([
    ['safe', true],
    ['caution', true],
    ['danger', true], // P-167: 위험할수록 확인 필요 — 구 주문 CTA 잔재 분기 제거
    ['unable', true],
  ])('%s → CTA %s', (risk, shown) => {
    mockUseFoodDetail.mockReturnValue({ data: FOOD(risk), isLoading: false, error: null, refetch: jest.fn() });
    const s = flat(render(<FoodDetailScreen />));
    expect(s.includes('detail.askOwner')).toBe(shown);
  });

  it('게스트 → 미노출 (판정 safe여도)', () => {
    mockIsGuest.mockReturnValue(true);
    expect(flat(render(<FoodDetailScreen />))).not.toContain('detail.askOwner');
  });

  it('기피 프로필 없음 → BE 판정 그대로 safe 표시 (헌법 v2.1.0 — 강등 폐지) + CTA 노출', () => {
    mockUseMe.mockReturnValue(ME([]));
    const s = flat(render(<FoodDetailScreen />));
    expect(s).toContain('detail.verdictSafe'); // v2.1.0: 미설정=BE 그대로
    expect(s).not.toContain('detail.verdictCaution');
    expect(s).toContain('detail.askOwner');
  });
});

describe('원카드 화면', () => {
  it('기피 보유 → 주문 문장 + 고지 문단 렌더 (P-136: 캡션→정방향 미러)', () => {
    const s = flat(render(<OrderCard />));
    expect(s).toContain('김치찌개');
    expect(s).toContain('개 주세요.');
    expect(s).toContain('저는 ');
    expect(s).toContain('order.mirrorTitle');
    expect(s).toContain('order.mirrorAvoid');
    // P-138 ⑥: 콰이엇 헤더(타이틀+서브) — 모달풍 X 소멸
    expect(s).toContain('order.title');
    expect(s).toContain('order.headerSub');
  });

  it('기피 0개 → 고지 생략 (순수 주문 카드)', () => {
    mockUseMe.mockReturnValue(ME([]));
    const s = flat(render(<OrderCard />));
    expect(s).toContain('개 주세요.');
    expect(s).not.toContain('저는 ');
  });
});

describe('P-162: 상세 CTA 목적지·주문 완료 모달·저장 스낵바', () => {
  const pressByText = (tree: ReactTestRenderer, text: string) =>
    tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === text).length > 0).pop()!;

  it('상세 CTA 탭 → 사장님 확인 화면(재료 행 링크와 동일 목적지, 파라미터 없음 = 일반 질문)', () => {
    const tree = render(<FoodDetailScreen />);
    act(() => pressByText(tree, 'detail.askOwner').props.onPress());
    expect(mockRouter.push).toHaveBeenCalledWith('/food/7/owner');
  });

  it('회피 매칭 0(safe) → CTA 동일 노출·동일 목적지 (orderCard.ts 일반 질문 경로)', () => {
    mockUseMe.mockReturnValue(ME([]));
    const tree = render(<FoodDetailScreen />);
    act(() => pressByText(tree, 'detail.askOwner').props.onPress());
    expect(mockRouter.push).toHaveBeenCalledWith('/food/7/owner');
  });

  it('Done 탭 → 완료 확인 모달 노출(즉시 이동 아님) → 확인 시 홈 이동', () => {
    const tree = render(<OrderCard />);
    expect(tree.root.findAll((n) => n.props?.testID === 'order-done-confirm').length).toBe(0);
    act(() => pressByText(tree, 'order.done').props.onPress());
    expect(tree.root.findAll((n) => n.props?.testID === 'order-done-confirm').length).toBeGreaterThanOrEqual(1);
    expect(flat(tree)).toContain('order.doneTitle');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    act(() => pressByText(tree, 'order.doneHome').props.onPress());
    expect(mockRouter.dismissAll).toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('저장(별) 토글 성공 → 스낵바 없음 (실패 스낵바만 유지)', () => {
    const tree = render(<FoodDetailScreen />);
    act(() => tree.root.findAll((n) => n.props?.testID === 'detail-save')[0].props.onPress());
    const s = flat(tree);
    expect(s).not.toContain('saved.toast');
    expect(s).not.toContain('saved.error');
  });
});

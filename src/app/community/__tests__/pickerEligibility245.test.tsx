/**
 * P-245(KB-361 1차): 리뷰 픽커 자격 UX — 스캔분 활성 / 전체 비활성(흐림·탭 = 안내
 * 강조) + 스캔 CTA. 스캔 0건 = 안내 메인(인기 폴백 폐기). 검색 "전체에서 찾기"
 * 결과 = 비활성 + 같은 안내. **필터('filter')·글 작성('compose') 컨텍스트 무변**
 * — 필터 픽커에서 전체가 비활성이 되면 반려감(컨텍스트 분기 잠금).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-image-picker', () => ({}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: mockPush, navigate: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/community',
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@/components/SuccessCheck', () => ({ SuccessCheck: () => null }));
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));
jest.mock('@/lib/analytics', () => ({ EVENTS: new Proxy({}, { get: (_t, k) => k }), track: jest.fn() }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '9', restrictions: [] } }) }));
jest.mock('@/lib/community/hooks', () => ({
  useCommunityPost: () => ({ data: null }),
  useCreatePost: () => ({ mutate: jest.fn() }),
  useUpdatePost: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/community/places', () => ({ searchPlaces: () => [] }));
const mockIsGuest = jest.fn(() => false);
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockIsGuest() }));

const SCANNED = [
  { foodId: '1', name: 'Kimchi Stew', nameKo: '김치찌개', photoUrl: null },
  { foodId: '2', name: 'Bibimbap', nameKo: '비빔밥', photoUrl: null },
];
const POPULAR = [
  { foodId: '10', name: 'Tteokbokki', nameKo: '떡볶이', photoUrl: null },
  { foodId: '11', name: 'Gimbap', nameKo: '김밥', photoUrl: null },
];
const mockScanned = jest.fn(() => ({ data: SCANNED }));
const mockSearch = jest.fn((_q: string, _scope?: string) => ({ data: [] as typeof POPULAR }));
jest.mock('@/lib/data/useFoods', () => ({
  useScannedFoods: (enabled: boolean) => (enabled ? mockScanned() : { data: undefined }),
  useSearchFoods: (q: string, scope?: string) => mockSearch(q, scope),
  useInfiniteFoods: () => ({ data: POPULAR }),
}));

import { TagPickerSheet } from '../compose';

const t = (k: string) => k;

const trees: ReactTestRenderer[] = [];
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });

const sheet = (over: Partial<React.ComponentProps<typeof TagPickerSheet>> = {}) => (
  <TagPickerSheet
    kind="food"
    foodTags={[]}
    placeTag={null}
    onToggleFood={over.onToggleFood ?? jest.fn()}
    onTogglePlace={jest.fn()}
    onClose={over.onClose ?? jest.fn()}
    t={t}
    context={over.context ?? 'review'}
  />
);
const flat = (tree: ReactTestRenderer) => JSON.stringify(tree.toJSON());
const tapRow = (tree: ReactTestRenderer, name: string) => {
  // 행 = Pressable(styles.resultRow) — 이름 텍스트를 품은 가장 안쪽 Pressable 탭
  const texts = tree.root.findAll((n) => n.type === 'Text' && n.children.join('') === name);
  expect(texts.length).toBeGreaterThan(0);
  let cur: renderer.ReactTestInstance | null = texts[0];
  while (cur && typeof cur.props?.onPress !== 'function') cur = cur.parent;
  expect(cur).toBeTruthy();
  act(() => cur!.props.onPress());
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIsGuest.mockReturnValue(false);
  mockScanned.mockReturnValue({ data: SCANNED });
  mockSearch.mockImplementation(() => ({ data: [] }));
});

it('리뷰 컨텍스트 브라우즈 = 2구역 — 스캔분 활성 / ALL FOODS 비활성 + 안내·CTA', () => {
  const onToggleFood = jest.fn();
  const tree = render(sheet({ onToggleFood }));
  const s = flat(tree);
  expect(s).toContain('community.sectionRecentlyScanned');
  expect(s).toContain('community.sectionAllFoods');
  expect(s).toContain('community.reviewEligibleNote');
  // 스캔분 = 탭하면 선택
  tapRow(tree, 'Kimchi Stew');
  expect(onToggleFood).toHaveBeenCalledWith({ foodId: '1', name: 'Kimchi Stew' });
  // 전체 구역 = 탭해도 선택 안 됨(안내 강조만)
  tapRow(tree, 'Tteokbokki');
  expect(onToggleFood).toHaveBeenCalledTimes(1);
});

it('스캔 CTA = 시트 닫기 + 스캔 화면 이동', () => {
  const onClose = jest.fn();
  const tree = render(sheet({ onClose }));
  const cta = tree.root.findAll((n) => n.props?.testID === 'picker-go-scan' && typeof n.props?.onPress === 'function')[0];
  act(() => cta.props.onPress());
  expect(onClose).toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith('/scan');
});

it('스캔 0건 = 안내가 메인(인기 폴백 폐기 — 활성 행 0) + 비활성 전체 목록은 참고 유지', () => {
  mockScanned.mockReturnValue({ data: [] });
  const onToggleFood = jest.fn();
  const tree = render(sheet({ onToggleFood }));
  const s = flat(tree);
  expect(s).not.toContain('community.sectionRecentlyScanned'); // 빈 활성 구역 헤더 금지(P-210)
  expect(s).toContain('community.reviewEligibleNote');
  expect(s).toContain('community.sectionAllFoods');
  tapRow(tree, 'Tteokbokki'); // 전체 목록은 여전히 선택 불가
  expect(onToggleFood).not.toHaveBeenCalled();
});

it('검색 "전체에서 찾기" 결과 = 비활성 + 같은 안내(학습 역할)', () => {
  // scanned scope 검색 = 0건 → searchAll 행 → all 결과는 비활성
  mockSearch.mockImplementation((q: string, scope?: string) =>
    q === 'tteok' ? { data: scope === 'scanned' ? [] : [POPULAR[0]] } : { data: [] });
  const onToggleFood = jest.fn();
  const tree = render(sheet({ onToggleFood }));
  const input = tree.root.findAll((n) => typeof n.props?.onChangeText === 'function')[0];
  act(() => input.props.onChangeText('tteok'));
  const allRow = tree.root.findAll((n) => n.props?.testID === 'picker-search-all' && typeof n.props?.onPress === 'function')[0];
  act(() => allRow.props.onPress());
  expect(flat(tree)).toContain('community.reviewEligibleNote'); // 비활성 결과 위 안내
  tapRow(tree, 'Tteokbokki');
  expect(onToggleFood).not.toHaveBeenCalled(); // 전체 결과 = 선택 불가
});

it('필터 컨텍스트(P-229) 무변 — 전체 선택 가능·자격 UI 잔존 0 (반려 잠금)', () => {
  const onToggleFood = jest.fn();
  mockScanned.mockReturnValue({ data: [] }); // 스캔 0건이어도 인기 폴백(활성) 유지
  const tree = render(sheet({ context: 'filter', onToggleFood }));
  const s = flat(tree);
  expect(s).not.toContain('community.reviewEligibleNote');
  expect(s).not.toContain('community.sectionAllFoods');
  tapRow(tree, 'Tteokbokki'); // 인기 목록 = 활성(필터는 자격 무관)
  expect(onToggleFood).toHaveBeenCalledWith({ foodId: '10', name: 'Tteokbokki' });
});

it('글 작성(compose) 컨텍스트 무변 — 인기 목록 활성 + 캡션 렌더', () => {
  const onToggleFood = jest.fn();
  const tree = render(sheet({ context: 'compose', onToggleFood }));
  const s = flat(tree);
  expect(s).not.toContain('community.reviewEligibleNote');
  expect(s).toContain('community.sectionPopular');
  expect(tree.root.findAll((n) => n.props?.testID === 'picker-caption').length).toBeGreaterThanOrEqual(1);
  tapRow(tree, 'Gimbap');
  expect(onToggleFood).toHaveBeenCalledWith({ foodId: '11', name: 'Gimbap' });
});

it('배선 소스 잠금 — 작성 픽커 = context="review" (KB-430: 피드 음식 필터 UI 숨김 — filter 컨텍스트는 컴포넌트 계약으로 존치)', () => {
  const fs = require('fs');
  const feed = fs.readFileSync('src/features/community/ReviewFeed.tsx', 'utf8') as string;
  expect(feed).toContain('context="review"'); // 작성 픽커는 자격 UX 대상 유지
});

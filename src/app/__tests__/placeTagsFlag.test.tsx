/**
 * P-116(KB-249): 리뷰 장소 태그 전면 숨김 잠금 — placeTagsEnabled off면
 * ① 작성 폼 장소 행 ② 디테일 장소 섹션 ③ 목록 행 장소 한 줄 전부 미렌더,
 * on이면 현행 렌더(기능 회귀 0). 코드 삭제 아님 — 플래그 숨김.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/flags', () => ({
  FLAGS: { reviewsEnabled: true, reviewsLiveEnabled: false, placeTagsEnabled: false, reviewTranslationEnabled: false, guestMode: true, communityEnabled: true },
  isProdChannel: () => false,
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockFlags = (jest.requireMock('@/lib/flags') as { FLAGS: { placeTagsEnabled: boolean } }).FLAGS;

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    withSpring: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    withTiming: (v: unknown) => v,
    cancelAnimation: () => {},
    useReducedMotion: () => false,
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
  Redirect: () => null,
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'r1', foodId: '7' }),
  useFocusEffect: () => {},
  usePathname: () => '/review/r1',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));

jest.mock('@/lib/data/useMe', () => {
  const place = { name: 'Gwangjang Market', roadAddress: '88 Changgyeonggung-ro' };
  const review = {
    id: 'r1', foodId: '7', rating: 5, body: 'good', photos: [], memberId: '9',
    authorNationality: 'US', authorRankTier: 'taster', anonymized: false,
    createdAt: '2026-08-01T00:00:00Z', place, likes: 1, myLike: false,
  };
  return {
    __review: review,
    useMe: () => ({ data: { id: '9', nickname: 'A', nationality: 'US', restrictions: [], rank: { tier: 'taster', level: 2 }, spiceTolerance: 'SKIP' } }),
    useMyReviews: () => ({ data: [review] }),
  };
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PLACE = (jest.requireMock('@/lib/data/useMe') as { __review: { place: { name: string; roadAddress: string } } }).__review.place;
jest.mock('@/lib/data/useFoodReviews', () => ({
  useFoodReviews: () => ({ data: { pages: [] }, isLoading: false, fetchNextPage: jest.fn() }),
}));
jest.mock('@/lib/data/useFoods', () => ({
  useFoods: () => ({ data: [{ foodId: '7', name: 'Bibimbap', nameKo: '비빔밥' }] }),
  useFoodDetail: () => ({ data: undefined }),
  useSearchFoods: () => ({ data: [] }),
  useInfiniteFoods: () => ({ data: [] }),
}));
jest.mock('@/lib/data/useReviewMutations', () => ({
  useCreateReview: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateReview: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteReview: () => ({ mutate: jest.fn(), isPending: false }),
  useToggleReviewLike: () => ({ mutate: jest.fn() }),
}));

import ReviewDetail from '../review/[id]';

function render(el: React.ReactElement): ReactTestRenderer {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
  });
  return tree;
}

const textsOf = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => n.type === 'Text').map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children)));

it('off — 디테일에 장소 섹션(이름·주소·지도 버튼) 미렌더', () => {
  mockFlags.placeTagsEnabled = false;
  const all = textsOf(render(<ReviewDetail />));
  expect(all.join(' ')).not.toContain(PLACE.name);
  expect(all.join(' ')).not.toContain(PLACE.roadAddress);
});

it('on — 디테일 장소 섹션 현행 렌더(회귀 0)', () => {
  mockFlags.placeTagsEnabled = true;
  const all = textsOf(render(<ReviewDetail />));
  expect(all.join(' ')).toContain(PLACE.name);
});

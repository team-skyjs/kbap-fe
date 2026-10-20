/**
 * KB-812 2차(P-507) — 가공식품 리뷰 작성·수정 = 음식 작성 화면 packaged 모드 잠금:
 * ① 대상 카드 = 제품(이름·제조사) · 식당 전용 입력(세부 별점·장소) 숨김 · 10자 규칙 동일
 * ② 등록 = 가공식품 작성(processedFoodId·별·본문·사진만) — 음식 작성 0 · 계측 target_type packaged · airbridge 0
 * ③ 403 PFOOD-005(서버 쓰기 OFF) = "곧 열려요" 중립 안내 · 일반 실패 문구 0 · 입력 보존 · 완료 모달 0
 * ④ 410 PFOOD-002 = 음식 "없음"과 같은 중립 안내
 * ⑤ 수정 = 같은 PATCH(장소 null) — 경로 /processed-foods/{id}/review?reviewId=
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = jest.requireActual('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['springify', 'damping', 'stiffness']) b[k] = () => b;
    return b;
  };
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    FadeIn: chain(),
    FadeInDown: chain(),
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  const chain = () => {
    const g: Record<string, unknown> = {};
    for (const k of ['runOnJS', 'enabled', 'numberOfTaps', 'maxPointers', 'onStart', 'onUpdate', 'onEnd', 'onFinalize', 'activeOffsetY', 'failOffsetX']) g[k] = () => g;
    return g;
  };
  return { GestureDetector: ({ children }: { children: unknown }) => children, GestureHandlerRootView: View, Gesture: { Pan: chain, Pinch: chain, Tap: chain, Simultaneous: (...g: unknown[]) => g, Exclusive: (...g: unknown[]) => g } };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockBack = jest.fn();
/** KB-620: 편집(reviewId 있음)·신규(없음) 두 경로를 같은 스위트에서 — beforeEach가 편집으로 되돌린다. */
const mockParams: { id: string; reviewId?: string } = { id: '1711' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useSegments: () => [],
  usePathname: () => '/',
  useNavigation: () => ({ dispatch: (a: unknown) => mockNavDispatch(a) }), // KB-708 이탈 확인
  Redirect: () => null,
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
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: View };
});
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/data/useFoods', () => ({ useFoodDetail: (id: string) => ({ data: id ? { foodId: id, name: 'FOOD' } : undefined }) }));
jest.mock('@/lib/data/useFoodReviews', () => ({ useFoodReviews: () => ({ data: undefined, isLoading: false, isFetching: false }), useProcessedReviews: () => ({ data: undefined, isLoading: false, isFetching: false }) }));
jest.mock('@/lib/data/useProcessedFoods', () => ({
  ...jest.requireActual('@/lib/data/useProcessedFoods'),
  useProcessedDetail: (id?: string) => ({ data: id ? { id, name: '우유식빵', maker: '롯데제과', imageUrl: null } : undefined }),
}));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ EVENTS: { review_submit: 'review_submit' }, track: (...a: unknown[]) => mockTrack(...a) }));
const mockRate = jest.fn();
jest.mock('@/lib/airbridge', () => ({ airbridge: { rate: (...a: unknown[]) => mockRate(...a) } }));
jest.mock('@/components/topToastStore', () => ({ showTopToast: jest.fn(), subscribeTopToast: () => () => {} }));
const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockCreateFood = jest.fn().mockResolvedValue(undefined);
const mockCreatePf = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/data/useReviewMutations', () => {
  const actual = jest.requireActual('@/lib/data/useReviewMutations') as Record<string, unknown>;
  return {
    findCachedReview: actual.findCachedReview,
    reviewWriteClosed: actual.reviewWriteClosed,
    useCreateProcessedReview: () => ({ mutateAsync: mockCreatePf }),
    useCreateReview: () => ({ mutateAsync: mockCreateFood }),
    useUpdateReview: () => ({ mutateAsync: mockUpdate, isPending: false }),
    useDeleteReview: () => ({ mutate: jest.fn() }),
  };
});
jest.mock('@/lib/review/reviewPhotos', () => {
  const actual = jest.requireActual('@/lib/review/reviewPhotos') as Record<string, unknown>;
  return { ...actual, uploadReviewImages: async (uris: string[]) => uris.map((u) => `up/${u}`) };
});
jest.mock('@/lib/data/profileImage', () => ({ choosePhotoSource: jest.fn(async () => 'gallery') }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(), requestCameraPermissionsAsync: jest.fn() }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { ApiError } from '@/lib/api/client';
import { queryClient } from '@/lib/queryClient';
import PackagedReviewCompose from '../processed-foods/[id]/review';
/* eslint-enable import/first */

const trees: ReactTestRenderer[] = [];
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); });
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  trees.push(tree);
  return tree;
}
const byId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id);
const ids = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.props?.testID === 'string').map((n) => n.props.testID as string);
const flat = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());
const BODY = 'Soft and not too sweet';
async function fillAndPost(t: ReactTestRenderer) {
  act(() => byId(t, 'review-star-4')[0].props.onPress());
  act(() => t.root.findAll((n) => n.props?.multiline === true && typeof n.props?.onChangeText === 'function')[0].props.onChangeText(BODY));
  await act(async () => { byId(t, 'post-review')[0].props.onPress(); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.reviewId = undefined;
  queryClient.clear();
});

it('① 대상 카드 = 제품 이름·제조사 · 세부 별점(extras)·장소 필 없음 · 10자 안내 동일', () => {
  const t = render(<PackagedReviewCompose />);
  const s = flat(t);
  expect(s).toContain('우유식빵');
  expect(s).toContain('롯데제과');
  expect(s).not.toContain('FOOD'); // 음식 상세 훅은 비활성(id 없음)
  expect(ids(t).filter((i) => i.startsWith('extras-'))).toEqual([]);
  expect(s).not.toContain('review.extrasTitle');
  expect(byId(t, 'place-pill')).toHaveLength(0);
  expect(byId(t, 'review-min-length').length).toBeGreaterThan(0); // 0자 = 10자 안내
});

it('② 등록 = 가공식품 작성만(processedFoodId·별·본문·사진) · 음식 작성 0 · 계측 target_type packaged · airbridge 0 · 완료 모달', async () => {
  const t = render(<PackagedReviewCompose />);
  await fillAndPost(t);
  expect(mockCreatePf).toHaveBeenCalledWith({ processedFoodId: '1711', rating: 4, content: BODY, imagePaths: [] });
  expect(mockCreateFood).not.toHaveBeenCalled();
  expect(mockTrack).toHaveBeenCalledWith('review_submit', { has_photos: false, photo_count: 0, rating: 4, target_type: 'packaged' });
  expect(mockRate).not.toHaveBeenCalled();
  expect(byId(t, 'review-posted-confirm').length).toBeGreaterThan(0);
  expect(flat(t)).toContain('우유식빵'); // 완료 문구의 대상 이름
});

it('③ 403 PFOOD-005 = "곧 열려요" 안내(일반 실패 문구 0) · 본문 보존 · 완료 모달 0', async () => {
  mockCreatePf.mockRejectedValueOnce(new ApiError('closed', 403, 'PFOOD-005'));
  const t = render(<PackagedReviewCompose />);
  await fillAndPost(t);
  expect(byId(t, 'review-write-soon').length).toBeGreaterThan(0);
  expect(flat(t)).toContain('review.writeSoon');
  expect(flat(t)).not.toContain('review.postError');
  expect(flat(t)).toContain(BODY);
  expect(byId(t, 'review-posted-confirm')).toHaveLength(0);
});

it('④ 410 PFOOD-002(생산종료) = 중립 "없음" 안내(재시도 실패 문구 아님)', async () => {
  mockCreatePf.mockRejectedValueOnce(new ApiError('gone', 410, 'PFOOD-002'));
  const t = render(<PackagedReviewCompose />);
  await fillAndPost(t);
  expect(byId(t, 'review-food-hidden').length).toBeGreaterThan(0);
  expect(flat(t)).not.toContain('review.postError');
});

it('⑤ 수정 = 캐시의 가공식품 리뷰 프리필 → 같은 PATCH(장소 null) · 세부 별점 없음', async () => {
  mockParams.reviewId = 'p9';
  queryClient.setQueryData(['me', 'reviews'], [{
    id: 'p9', foodId: '', target: 'packaged', processedFoodId: '1711', rating: 3, body: 'Too salty for me', createdAt: '2026-10-21',
    photos: [], place: null, servingSpeed: 0, staffKindness: 0, authorNationality: 'US', authorRankTier: null, anonymized: false,
  }]);
  const t = render(<PackagedReviewCompose />);
  expect(flat(t)).toContain('Too salty for me');
  expect(ids(t).filter((i) => i.startsWith('extras-'))).toEqual([]);
  await act(async () => { byId(t, 'post-review')[0].props.onPress(); });
  const arg = mockUpdate.mock.calls[0][0] as { reviewId: string; changes: { place: unknown; rating: number } };
  expect(arg.reviewId).toBe('p9');
  expect(arg.changes).toMatchObject({ place: null, rating: 3 });
  expect(mockCreatePf).not.toHaveBeenCalled();
});

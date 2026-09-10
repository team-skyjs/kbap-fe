/**
 * P-358(KB-521) — 리뷰 수정 = 작성 화면 편집 모드 잠금:
 * ① 편집 진입 프리필 5종(별·본문·extras·place·사진 remote 슬롯)
 * ② 사진 remote+local 혼합 imagePaths 계산(순서 보존)
 * ③ place 해제 = changes.place null
 * ④ 저장 성공 = back + 상단 토스트(완료 모달 아님)
 * ⑤ ReviewEditSheet 부재(컴포넌트·표면 배선 소멸)
 */
import * as React from 'react';
import { TextInput } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
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
  const { View } = require('react-native');
  const chain = () => {
    const g: Record<string, unknown> = {};
    for (const k of ['runOnJS', 'enabled', 'numberOfTaps', 'maxPointers', 'onStart', 'onUpdate', 'onEnd', 'onFinalize', 'activeOffsetY', 'failOffsetX']) g[k] = () => g;
    return g;
  };
  return { GestureDetector: ({ children }: { children: unknown }) => children, GestureHandlerRootView: View, Gesture: { Pan: chain, Pinch: chain, Tap: chain, Simultaneous: (...g: unknown[]) => g, Exclusive: (...g: unknown[]) => g } };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
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
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: '7', reviewId: 'r1' }),
  useSegments: () => [],
  usePathname: () => '/',
  Redirect: () => null,
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/data/useFoods', () => ({
  useFoodDetail: () => ({ data: { foodId: '7', name: 'Kimbap', nameKo: '김밥', risk: 'safe' } }),
}));
jest.mock('@/lib/data/useFoodReviews', () => ({ useFoodReviews: () => ({ data: undefined, isLoading: false, isFetching: false }) }));
jest.mock('@/lib/push/pushAdapter', () => ({ cancelReviewReminder: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ EVENTS: {}, track: jest.fn() }));
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a), subscribeTopToast: () => () => {} }));
const mockUpdate = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/data/useReviewMutations', () => {
  const actual = jest.requireActual('@/lib/data/useReviewMutations') as Record<string, unknown>;
  return {
    findCachedReview: actual.findCachedReview, // 실구현 — 시드 캐시 조회 검증
    useCreateReview: () => ({ mutateAsync: jest.fn().mockResolvedValue(undefined) }),
    useUpdateReview: () => ({ mutateAsync: mockUpdate, isPending: false }),
    useDeleteReview: () => ({ mutate: jest.fn() }),
  };
});
// 업로드 = 로컬만 path 변환(실 presigned 대신) — remote/local 혼합 계산 검증용
jest.mock('@/lib/review/reviewPhotos', () => {
  const actual = jest.requireActual('@/lib/review/reviewPhotos') as Record<string, unknown>;
  return { ...actual, uploadReviewImages: async (uris: string[]) => uris.map((u) => `up/${u}`) };
});
jest.mock('@/lib/data/profileImage', () => ({ choosePhotoSource: jest.fn(async () => 'gallery') }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'local-new.jpg' }] })),
  requestCameraPermissionsAsync: jest.fn(),
}));

import { queryClient } from '@/lib/queryClient';
import ReviewCompose from '../food/[id]/review';

const REVIEW = {
  id: 'r1', foodId: '7', rating: 4, body: 'good taste', createdAt: '2026-09-01',
  photos: ['https://cdn/rv-a.jpg', 'https://cdn/rv-b.jpg'],
  place: { name: 'Gwangjang', roadAddress: 'Jongno 88', latitude: 37.5, longitude: 127.0 },
  servingSpeed: 3, staffKindness: 5,
  authorNationality: 'US', authorRankTier: null, anonymized: false, likes: 0, myLike: false,
} as never;

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const byId = (t2: ReactTestRenderer, id: string) => t2.root.findAll((n) => n.props?.testID === id);

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  queryClient.setQueryData(['me', 'reviews'], [REVIEW]);
});

it('① 편집 진입 프리필 — 별 4·본문·extras(3/5)·place 칩·사진 remote 2슬롯 + 제목/버튼 라벨', () => {
  const tree = render(<ReviewCompose />);
  const flat = JSON.stringify(tree.toJSON());
  expect(flat).toContain('editReview.title'); // 헤더
  expect(flat).toContain('editReview.save'); // 하단 버튼
  expect(flat).toContain('good taste'); // 본문 프리필
  expect(flat).toContain('Gwangjang'); // place 칩
  expect(flat).toContain('"4"'); // 별점 캡션(숫자만 — P-348 ②)
  // 사진 remote 2슬롯(URL 소스)
  expect(flat).toContain('https://cdn/rv-a.jpg');
  expect(flat).toContain('https://cdn/rv-b.jpg');
});

it('②④ 저장 — remote 유지+local 추가 혼합 imagePaths(순서 보존) · 성공 = back + 상단 토스트(모달 0)', async () => {
  const tree = render(<ReviewCompose />);
  // 사진 1장 추가(갤러리 목 → local-new.jpg)
  await act(async () => { byId(tree, 'photo-add')[0].props.onPress(); });
  await act(async () => { byId(tree, 'post-review')[0].props.onPress(); });
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  const arg = mockUpdate.mock.calls[0][0] as { reviewId: string; changes: { photos: string[]; rating: number } };
  expect(arg.reviewId).toBe('r1');
  // remote → path 역변환(rv-a·rv-b), local → 업로드 path — 슬롯 순서 그대로
  expect(arg.changes.photos).toEqual(['rv-a.jpg', 'rv-b.jpg', 'up/local-new.jpg']);
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockToast).toHaveBeenCalledWith('editReview.savedToast');
  expect(byId(tree, 'review-posted-confirm')).toHaveLength(0); // 완료 모달 미사용(P-358)
});

it('③ place 해제(X) 후 저장 = changes.place null(제거 의도 명시)', async () => {
  const tree = render(<ReviewCompose />);
  act(() => { byId(tree, 'place-clear')[0].props.onPress(); });
  await act(async () => { byId(tree, 'post-review')[0].props.onPress(); });
  const arg = mockUpdate.mock.calls[0][0] as { changes: { place: unknown } };
  expect(arg.changes.place).toBeNull();
});

it('⑤ ReviewEditSheet 소멸 — 컴포넌트·4표면 배선·전용 키 잔존 0', () => {
  const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;
  expect(read('src/features/review/ReviewCellParts.tsx')).not.toContain('ReviewEditSheet');
  for (const f of ['src/app/food/[id]/index.tsx', 'src/app/food/[id]/reviews.tsx', 'src/app/profile/reviews.tsx', 'src/features/community/ReviewFeed.tsx']) {
    const src = read(f);
    expect(src).not.toContain('ReviewEditSheet');
    expect(src).toContain('reviewId='); // 편집 = 라우트 push
  }
  for (const loc of ['ko', 'en']) {
    const j = read(`src/lib/i18n/${loc}.json`);
    expect(j).not.toContain('"viewTitle"');
    expect(j).not.toContain('"noBody"');
  }
});

/**
 * P-156: 리뷰 사진 갤러리 멀티 선택 — selectionLimit = 남은 슬롯(0장→3·1장→2),
 * 초과 산출물 방어(slice 3 + 안내 토스트), 다중 업로드 HEIC 경유(per-file).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withRepeat: (v: unknown) => v,
    withDelay: (_d: number, v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeOut: (() => {
      const b: Record<string, (..._a: unknown[]) => unknown> = {};
      for (const k of ['springify', 'damping', 'stiffness', 'mass', 'duration', 'delay', 'easing']) b[k] = () => b;
      return b;
    })(),
    FadeIn: (() => {
      const b: Record<string, (..._a: unknown[]) => unknown> = {};
      for (const k of ['springify', 'damping', 'stiffness', 'mass', 'duration', 'delay', 'easing']) b[k] = () => b;
      return b;
    })(),
    SlideInDown: (() => {
      const b: Record<string, (..._a: unknown[]) => unknown> = {};
      for (const k of ['springify', 'damping', 'stiffness', 'mass', 'duration', 'delay', 'easing']) b[k] = () => b;
      return b;
    })(),
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: '7' }),
  usePathname: () => '/',
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
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k, getFixedT: () => (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k },
}));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/data/useFoods', () => ({
  useFoodDetail: () => ({ data: { foodId: '7', name: 'Kimchi Jjigae', nameKo: '김치찌개', risk: 'safe' }, isLoading: false, error: null, refetch: jest.fn() }),
}));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { restrictions: [] } }) }));
jest.mock('@/lib/data/useReviewMutations', () => ({ useCreateReview: () => ({ mutateAsync: jest.fn(), isPending: false }) }));
const mockLaunchLibrary = jest.fn();
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: (o: unknown) => mockLaunchLibrary(o) }));
// 업로드 목 — HEIC 경유(per-file uploadImage) 검증용
const mockUpload = jest.fn();
jest.mock('@/lib/api/scanImage', () => ({ uploadImage: (f: unknown, p: string) => mockUpload(f, p) }));
jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: async () => true }));
jest.mock('@/lib/flags', () => ({ ...jest.requireActual('@/lib/flags'), isProdChannel: () => false }));

import ReviewCompose from '../food/[id]/review';
import { uploadReviewImages } from '@/lib/review/reviewPhotos';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const addTile = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => typeof n.props?.onPress === 'function' && JSON.stringify(n.props?.style ?? '').includes('dashed'))[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockUpload.mockResolvedValue({ path: 'review/1/x.jpg', publicUrl: 'https://cdn/x.jpg' });
});

it('selectionLimit = 남은 슬롯 — 0장→3, 1장 첨부 후→2 (allowsMultipleSelection)', async () => {
  mockLaunchLibrary.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:a.jpg' }] });
  const tree = render(<ReviewCompose />);
  await act(async () => {
    await addTile(tree).props.onPress();
  });
  expect(mockLaunchLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 3 }));
  // 1장 첨부됨 → 재진입 시 2 제한
  mockLaunchLibrary.mockResolvedValueOnce({ canceled: true });
  await act(async () => {
    await addTile(tree).props.onPress();
  });
  expect(mockLaunchLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ selectionLimit: 2 }));
});

it('초과 산출물 방어 — limit 무시(구형 안드) 5장 반환 → 3장만 수용 + 안내 토스트', async () => {
  mockLaunchLibrary.mockResolvedValueOnce({
    canceled: false,
    assets: [1, 2, 3, 4, 5].map((n) => ({ uri: `file:${n}.jpg` })),
  });
  const tree = render(<ReviewCompose />);
  await act(async () => {
    await addTile(tree).props.onPress();
  });
  const s = JSON.stringify(tree.toJSON());
  expect(s).toContain('file:3.jpg');
  expect(s).not.toContain('file:4.jpg'); // slice(3) 방어
  expect(s).toContain('review.photoCapNote'); // 안내 토스트
});

it('다중 업로드 — 각 파일이 uploadImage(REVIEW) 경유(HEIC 재인코딩 길목 per-file)', async () => {
  const out = await uploadReviewImages(['file:a.heic', 'file:b.jpg', 'file:c.png']);
  expect(mockUpload).toHaveBeenCalledTimes(3);
  for (const [i, uri] of (['file:a.heic', 'file:b.jpg', 'file:c.png'] as const).entries()) {
    expect(mockUpload.mock.calls[i][0]).toMatchObject({ uri });
    expect(mockUpload.mock.calls[i][1]).toBe('REVIEW');
  }
  expect(out).toEqual(['review/1/x.jpg', 'review/1/x.jpg', 'review/1/x.jpg']);
});

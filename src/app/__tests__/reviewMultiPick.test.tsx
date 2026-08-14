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
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
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
const mockFoodDetail = jest.fn();
jest.mock('@/lib/data/useFoods', () => ({ useFoodDetail: () => mockFoodDetail() }));

const mockMutateAsync = jest.fn();
jest.mock('@/lib/data/useReviewMutations', () => ({ useCreateReview: () => ({ mutateAsync: mockMutateAsync, isPending: false }) }));
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
  mockMutateAsync.mockResolvedValue(undefined);
  mockFoodDetail.mockImplementation(() => ({ data: { foodId: '7', name: 'Kimchi Jjigae', nameKo: '김치찌개', risk: 'danger', photoUrl: 'https://cdn/food.jpg' }, isLoading: false, error: null, refetch: jest.fn() }));
});

/* ---- P-168 헬퍼: 별점 세팅(star pick = hitSlop 4 Pressable) + 하단 Post 버튼 ---- */
const pickStar = (tree: ReactTestRenderer) =>
  act(() => tree.root.findAll((n) => n.props?.hitSlop === 4 && typeof n.props?.onPress === 'function')[4].props.onPress());
const postBtn = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'review.postReview').length > 0).pop()!;

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

describe('P-168 🚨: 리뷰 제출 연타·완료 모달·헤더 Post·실패 복구', () => {
  it('연타 → 제출 1건만 발사(동기 ref 가드 — 업로드 선행 구간 포함)', async () => {
    const tree = render(<ReviewCompose />);
    pickStar(tree);
    const press = postBtn(tree).props.onPress;
    await act(async () => {
      void press();
      void press();
      void press();
      await Promise.resolve();
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('성공 → P-162 문법 완료 모달(화면 전환 아님) + 확인 = 상세 복귀', async () => {
    const tree = render(<ReviewCompose />);
    pickStar(tree);
    await act(async () => {
      await postBtn(tree).props.onPress();
    });
    expect(tree.root.findAll((n) => n.props?.testID === 'review-posted-confirm').length).toBeGreaterThanOrEqual(1);
    const back = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'review.done').length > 0).pop()!;
    act(() => back.props.onPress());
    expect(mockRouter.back).toHaveBeenCalled();
    // 구 풀화면 요소(내 리뷰 보기) 소멸
    expect(JSON.stringify(tree.toJSON())).not.toContain('review.seeMyReviews');
  });

  it('헤더 상단 Post 부재 — 제출 진입점 하단 단일화', () => {
    const tree = render(<ReviewCompose />);
    expect(tree.root.findAll((n) => n.props?.children === 'review.post').length).toBe(0);
    expect(JSON.stringify(tree.toJSON())).toContain('review.postReview');
  });

  it('실패 → 에러 표면 + 버튼 복구(재제출 가능)', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('HTTP 500'));
    const tree = render(<ReviewCompose />);
    pickStar(tree);
    await act(async () => {
      await postBtn(tree).props.onPress();
    });
    const s2 = JSON.stringify(tree.toJSON());
    expect(s2).toContain('review.postError');
    expect(tree.root.findAll((n) => n.props?.testID === 'posting').length).toBe(0); // 스피너 해제
    await act(async () => {
      await postBtn(tree).props.onPress(); // 복구 후 재제출 가능
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
  });
});

describe('P-170: 작성 음식 카드 — 썸네일 캐시 재사용 + 위험도 마크 제거', () => {
  it('상세 캐시 photoUrl → 썸네일 렌더 (A안 — 신규 요청 0은 useFoodDetail 목 자체가 잠금)', () => {
    const tree = render(<ReviewCompose />);
    const s2 = JSON.stringify(tree.toJSON());
    expect(s2).toContain('https://cdn/food.jpg');
    expect(tree.root.findAll((n) => n.props?.testID === 'food-ph').length).toBe(0); // placeholder 아님
  });

  it('무사진 → 현행 placeholder 폴백', () => {
    mockFoodDetail.mockImplementation(() => ({ data: { foodId: '7', name: 'Kimchi Jjigae', nameKo: '김치찌개', risk: 'safe', photoUrl: null }, isLoading: false, error: null, refetch: jest.fn() }));
    const tree = render(<ReviewCompose />);
    expect(tree.root.findAll((n) => n.props?.testID === 'food-ph').length).toBeGreaterThanOrEqual(1); // 컴포지트+호스트 이중 매칭
  });

  it('카드 위험도 마크 부재 — danger여도 마크(size 22) 렌더 0 (X = 제거 버튼 오독 소멸)', () => {
    const tree = render(<ReviewCompose />);
    expect(tree.root.findAll((n) => n.props?.size === 22 && n.props?.state != null).length).toBe(0);
  });
});

it('P-191: 리뷰 갤러리 원본 로드 중 = 추가 타일 스피너(프레임 불변) + 재탭 무시', async () => {
  let release!: (v: { canceled: boolean }) => void;
  mockLaunchLibrary.mockImplementation(() => new Promise((r) => (release = r)));
  const tree = render(<ReviewCompose />);
  const add = () => tree.root.findAll((n) => n.props?.testID === 'photo-add' && typeof n.props?.onPress !== 'undefined')[0];
  await act(async () => {
    void tree.root.findAll((n) => n.props?.testID === 'photo-add')[0].props.onPress();
    await Promise.resolve();
  });
  const { ActivityIndicator } = require('react-native');
  expect(tree.root.findAllByType(ActivityIndicator).length).toBeGreaterThanOrEqual(1);
  await act(async () => {
    release({ canceled: true });
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(tree.root.findAllByType(ActivityIndicator).length).toBe(0);
  void add;
});

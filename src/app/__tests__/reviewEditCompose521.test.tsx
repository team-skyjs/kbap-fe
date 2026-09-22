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
/** KB-620: 편집(reviewId 있음)·신규(없음) 두 경로를 같은 스위트에서 — beforeEach가 편집으로 되돌린다. */
const mockParams: { id: string; reviewId?: string } = { id: '7', reviewId: 'r1' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
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
const mockCreate = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/data/useReviewMutations', () => {
  const actual = jest.requireActual('@/lib/data/useReviewMutations') as Record<string, unknown>;
  return {
    findCachedReview: actual.findCachedReview, // 실구현 — 시드 캐시 조회 검증
    useCreateReview: () => ({ mutateAsync: mockCreate }),
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
  mockParams.reviewId = 'r1';
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

/* ────────────────────────────────────────────────────────────────────────────
 * KB-620(9/22 예진) — 제출 중 음식이 이미지 재생성으로 **일시 숨김**(FOOD-001)이면
 * 에러 표면 대신 조용한 안내 + **화면 유지**.
 *
 * ⚠️ 닫지 않는 게 핵심이다: 리뷰엔 초안 저장소가 없어서 화면을 닫는 순간 본문·사진이
 * 사라진다. 원 발주는 "닫고 목록으로"였으나 그러면 에러 대신 **사용자가 쓴 글이 사라진다**
 * — 지금보다 나빠진다. 화면에 두면 글이 남고, 음식이 돌아오면 그대로 다시 올릴 수 있다.
 * ──────────────────────────────────────────────────────────────────────────── */
describe('KB-620 리뷰 제출 — 음식 숨김(FOOD-001)은 조용한 안내 + 화면 유지', () => {
  const { ApiError } = jest.requireActual('@/lib/api/client') as typeof import('@/lib/api/client');
  const hidden = () => new ApiError('해당 음식 정보를 찾을 수 없습니다', 400, 'FOOD-001');

  /** 별점 n을 누른다 — 별 Pressable엔 testID가 없어 크기(48) 별을 가진 누름 노드로 찾는다. */
  const pressStar = (tree: ReactTestRenderer, n: number) => {
    const stars = tree.root.findAll(
      (x) => typeof x.props?.onPress === 'function' && x.findAll((c) => c.props?.size === 48 && c.props?.fillPct !== undefined).length === 1,
    );
    act(() => { stars[n - 1].props.onPress(); });
  };
  const typeBody = (tree: ReactTestRenderer, text: string) => {
    const input = tree.root.findAllByType(TextInput)[0];
    act(() => { input.props.onChangeText(text); });
  };

  it('편집 저장 중 FOOD-001 → 숨김 안내 · 에러 안내 없음 · 화면 유지 · 본문 보존', async () => {
    mockUpdate.mockRejectedValueOnce(hidden());
    const tree = render(<ReviewCompose />);
    await act(async () => { byId(tree, 'post-review')[0].props.onPress(); });

    expect(byId(tree, 'review-food-hidden').length).toBeGreaterThan(0);
    const flat = JSON.stringify(tree.toJSON());
    expect(flat).toContain('review.foodHidden');
    expect(flat).not.toContain('review.postError'); // 빨간 에러 안내가 아니다
    expect(mockBack).not.toHaveBeenCalled(); // 닫지 않는다 — 초안 저장소가 없다
    expect(flat).toContain('good taste'); // 사용자가 쓴 글이 그대로 있다
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('신규 작성 중 FOOD-001 → 같은 처리(같은 catch를 지난다) · 입력한 글 보존 · 완료 모달 없음', async () => {
    mockParams.reviewId = undefined;
    mockCreate.mockRejectedValueOnce(hidden());
    const tree = render(<ReviewCompose />);
    pressStar(tree, 4);
    typeBody(tree, 'my unsent draft');
    await act(async () => { byId(tree, 'post-review')[0].props.onPress(); });

    expect(mockCreate).toHaveBeenCalledTimes(1); // 실제로 제출 경로를 탔다(별점 미입력으로 막힌 게 아니다)
    expect(byId(tree, 'review-food-hidden').length).toBeGreaterThan(0);
    expect(mockBack).not.toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain('my unsent draft');
    expect(byId(tree, 'review-posted-confirm')).toHaveLength(0);
  });

  it('다른 에러는 기존 에러 안내 그대로(숨김 안내 아님)', async () => {
    mockUpdate.mockRejectedValueOnce(new ApiError('boom', 500, 'COMMON-001'));
    const tree = render(<ReviewCompose />);
    await act(async () => { byId(tree, 'post-review')[0].props.onPress(); });
    const flat = JSON.stringify(tree.toJSON());
    expect(flat).toContain('review.postError');
    expect(byId(tree, 'review-food-hidden')).toHaveLength(0);
  });

  it('숨김 안내에는 안전 판정 아이콘(RiskMark)이 없다 — 음식에 대한 판정으로 읽히면 안 된다', async () => {
    mockUpdate.mockRejectedValueOnce(hidden());
    const tree = render(<ReviewCompose />);
    await act(async () => { byId(tree, 'post-review')[0].props.onPress(); });
    const note = byId(tree, 'review-food-hidden')[0];
    // RiskMark는 `state` prop(safe/caution/danger/unable)을 받는다 — 안내 안에 그런 노드가 0이어야 한다
    const verdictNodes = note.findAll((n) => ['safe', 'caution', 'danger', 'unable'].includes(n.props?.state as string));
    expect(verdictNodes).toHaveLength(0);
  });

  it('다시 누르면 안내가 지워진다 — 음식이 돌아와 성공하면 흔적이 남지 않는다', async () => {
    mockUpdate.mockRejectedValueOnce(hidden()).mockResolvedValueOnce(undefined);
    const tree = render(<ReviewCompose />);
    await act(async () => { byId(tree, 'post-review')[0].props.onPress(); });
    expect(byId(tree, 'review-food-hidden').length).toBeGreaterThan(0);
    await act(async () => { byId(tree, 'post-review')[0].props.onPress(); });
    expect(byId(tree, 'review-food-hidden')).toHaveLength(0);
    expect(mockBack).toHaveBeenCalledTimes(1); // 두 번째는 정상 저장 → 복귀
  });
});

/* eslint-disable import/first, @typescript-eslint/no-require-imports -- jest.mock 팩토리 안 require · 목 등록 뒤 import(레포 테스트 관례) */
/**
 * KB-802 리뷰 상세(app/review/[id]) — 시드 즉시 렌더 + 백그라운드 단건 · 캐시 없음 스켈레톤 · REVIEW-001 notFound + 피드 제거 ·
 * 그 밖 오류 = 오류 블록 + 재시도 · 사진 이어받기·뷰어 · 본문 전문 · ⋯ 배선 · 음식 칩 source · Helpful 게스트 게이트.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, FlatList: require('react-native').FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
    useReducedMotion: () => true,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
const mockParams: { id: string; photo?: string } = { id: '42' };
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  useSegments: () => ['review', '[id]'],
  usePathname: () => '/review/42',
  Redirect: () => null,
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
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('@/lib/data/useContentTranslation', () => ({ useContentTranslation: () => ({ translatedText: null, showingTranslated: false, loading: false, toggle: jest.fn() }) }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '7' } }) }));
const mockIsGuest = jest.fn(() => false);
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockIsGuest(), useSession: () => null }));
const mockMod = jest.fn((_p: unknown) => null);
jest.mock('@/features/community/moderation', () => ({ ModerationFlow: (p: unknown) => mockMod(p) }));
const mockViewer = jest.fn((_p: unknown) => null);
jest.mock('@/components/PhotoViewer', () => ({ PhotoViewer: (p: unknown) => mockViewer(p) }));
const mockGate = jest.fn((_p: unknown) => null);
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: (p: unknown) => mockGate(p) }));
jest.mock('@/components/topToastStore', () => ({ showTopToast: jest.fn() }));
jest.mock('@/lib/api/client', () => {
  class ApiError extends Error {
    status?: number;
    code?: string;
    constructor(message: string, mockStatus?: number, mockCode?: string) {
      super(message);
      this.status = mockStatus;
      this.code = mockCode;
    }
  }
  return {
    ApiError,
    api: { get: jest.fn(), post: jest.fn().mockResolvedValue(undefined), patch: jest.fn(), del: jest.fn().mockResolvedValue(undefined) },
    apiLang: () => 'en',
  };
});

import ReviewDetailRoute from '../review/[id]';
import type { Review, ReviewPage } from '@/lib/api/types';
import type { ReviewWire } from '@/lib/api/reviewAdapter';

const { api, ApiError } = require('@/lib/api/client');

const SEED = {
  id: '42', foodId: '1', rating: 5, servingSpeed: 4, staffKindness: 0, body: 'Broth was rich.', photos: ['https://cdn/a.jpg', 'https://cdn/b.jpg', 'https://cdn/c.jpg'],
  memberId: '7', foodName: 'Seolleongtang', foodKoreanName: '설렁탕', foodImageUrl: 'https://cdn/f.jpg',
  author: { memberId: '7', nickname: 'foodie', nationality: 'VN', tier: 'GOURMET', level: 2 },
  authorNationality: 'VN', authorRankTier: 'GOURMET', anonymized: false, createdAt: '2026-10-16T00:00:00Z', likes: 34, myLike: false, place: null,
} as Review;
const WIRE: ReviewWire = {
  reviewId: 42, rating: 5, servingSpeed: 4, staffKindness: 0, content: 'Fresh from server.', language: 'en', imageUrls: SEED.photos!,
  createdAt: SEED.createdAt, author: { memberId: 7, nickname: 'foodie', countryCode: 'VN', tier: 'GOURMET', level: 2, score: 15 },
  authorWithdrawn: false, likeCount: 35, likedByMe: false, food: { foodId: 1, name: 'Seolleongtang', koreanName: '설렁탕', imageUrl: null }, place: null,
};
const FEED_KEY = ['reviews', 'global', 'all', 'all', 'latest', 0, 5];

const mounted: ReactTestRenderer[] = [];
let qc: QueryClient;
beforeEach(() => {
  jest.clearAllMocks();
  mockParams.id = '42';
  mockParams.photo = undefined;
  mockIsGuest.mockReturnValue(false);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
});
afterEach(() => act(() => mounted.splice(0).forEach((m) => m.unmount())));

async function render(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <ReviewDetailRoute />
      </QueryClientProvider>,
    );
  });
  mounted.push(tree);
  return tree;
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const byId = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.type !== 'string');
const texts = (tree: ReactTestRenderer) => tree.root.findAll((n) => typeof n.type === 'string' && typeof n.props?.children === 'string').map((n) => n.props.children as string);

it('시드 있음 = 첫 렌더 완성(스켈레톤 없음) + 백그라운드 단건으로 갱신', async () => {
  qc.setQueryData(['reviews', 'detail', '42'], SEED);
  let resolve!: (w: ReviewWire) => void;
  api.get.mockReturnValueOnce(new Promise((r) => (resolve = r)));
  const tree = await render();
  expect(byId(tree, 'skeleton-review-detail')).toHaveLength(0);
  expect(texts(tree)).toContain('Broth was rich.');
  expect(api.get).toHaveBeenCalledWith('/api/reviews/42?lang=en');
  await act(async () => resolve(WIRE));
  await flush();
  expect(texts(tree)).toContain('Fresh from server.');
});

it('캐시 없음(딥링크) = 스켈레톤 → 단건 로드 후 렌더', async () => {
  let resolve!: (w: ReviewWire) => void;
  api.get.mockReturnValueOnce(new Promise((r) => (resolve = r)));
  const tree = await render();
  expect(tree.root.findAll((n) => n.props?.testID === 'skeleton-review-detail')).not.toHaveLength(0);
  await act(async () => resolve(WIRE));
  await flush();
  expect(tree.root.findAll((n) => n.props?.testID === 'skeleton-review-detail')).toHaveLength(0);
  expect(texts(tree)).toContain('Fresh from server.');
});

it('REVIEW-001 = notFound 문구(시드가 있어도) + 전역 피드 캐시에서 그 리뷰 제거', async () => {
  qc.setQueryData(['reviews', 'detail', '42'], SEED);
  qc.setQueryData<InfiniteData<ReviewPage>>(FEED_KEY, { pages: [{ items: [SEED, { ...SEED, id: '43' }], hasNext: false, nextCursor: null }], pageParams: [null] });
  api.get.mockRejectedValueOnce(new ApiError('gone', 400, 'REVIEW-001'));
  const tree = await render();
  await flush();
  expect(tree.root.findAll((n) => n.props?.testID === 'review-detail-not-found')).not.toHaveLength(0);
  expect(texts(tree)).toContain('reviewDetail.notFound');
  expect(byId(tree, 'review-detail-more')).toHaveLength(0); // 볼 수 없는 리뷰엔 ⋯ 없음
  expect(qc.getQueryData<InfiniteData<ReviewPage>>(FEED_KEY)!.pages[0].items.map((r) => r.id)).toEqual(['43']);
  expect(api.get).toHaveBeenCalledTimes(1);
});

it('그 밖 오류(캐시 없음, 5xx) = 1회 재시도 뒤 오류 블록 → 재시도 버튼 = 단건 재호출', async () => {
  api.get.mockRejectedValue(new ApiError('boom', 500, 'COMMON-001'));
  const tree = await render();
  await act(async () => { await new Promise((r) => setTimeout(r, 1200)); }); // 5xx 는 전역 규칙대로 1회 재시도(기본 지연 1s)
  expect(api.get).toHaveBeenCalledTimes(2);
  const retry = tree.root.findAll((n) => n.props?.testID === 'state-retry' && typeof n.props?.onPress === 'function')[0];
  expect(retry).toBeDefined();
  api.get.mockReset();
  api.get.mockResolvedValueOnce(WIRE);
  await act(async () => retry.props.onPress());
  await flush();
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(texts(tree)).toContain('Fresh from server.');
});

it('백그라운드 갱신 실패(시드 있음, 5xx) = 시드 화면 유지(오류 블록으로 덮지 않음)', async () => {
  qc.setQueryData(['reviews', 'detail', '42'], SEED);
  api.get.mockRejectedValueOnce(new ApiError('boom', 500));
  const tree = await render();
  await flush();
  expect(texts(tree)).toContain('Broth was rich.');
  expect(tree.root.findAll((n) => n.props?.testID === 'query-error-block')).toHaveLength(0);
});

it('사진 = query photo 장부터(이어받기) · 탭 = PhotoViewer 그 장 · 본문 전문(클램프·See more 없음)', async () => {
  mockParams.photo = '2';
  qc.setQueryData(['reviews', 'detail', '42'], SEED);
  api.get.mockReturnValueOnce(new Promise(() => {}));
  const tree = await render();
  expect(byId(tree, 'review-detail-photo-list')[0].props.initialScrollIndex).toBe(2);
  const adj = tree.root.findAll((n) => n.props?.testID === 'review-detail-photo' && n.props?.accessibilityRole === 'adjustable')[0];
  expect(adj.props.accessibilityLabel).toBe('reviewDetail.photoA11y'); // 상세 캐러셀 = adjustable 요소 하나
  await act(async () => byId(tree, 'review-detail-photo-2')[0].props.onPress()); // initialScrollIndex 2 = 그 장부터 렌더
  expect(mockViewer).toHaveBeenLastCalledWith(expect.objectContaining({ uris: SEED.photos, index: 2 }));
  expect(tree.root.findAll((n) => n.props?.testID === 'body-full')).not.toHaveLength(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'body-toggle')).toHaveLength(0);
});

it('Codex #288: 뷰어가 열린 채 재조회로 사진이 줄면 뷰어 index 클램프 · 0장이면 닫힘', async () => {
  mockParams.photo = '2';
  qc.setQueryData(['reviews', 'detail', '42'], SEED);
  api.get.mockReturnValueOnce(new Promise(() => {}));
  const tree = await render();
  await act(async () => byId(tree, 'review-detail-photo-2')[0].props.onPress());
  expect(mockViewer).toHaveBeenLastCalledWith(expect.objectContaining({ index: 2 }));
  await act(async () => { qc.setQueryData(['reviews', 'detail', '42'], { ...SEED, photos: SEED.photos!.slice(0, 2) }); });
  await flush(); // react-query 알림은 다음 틱
  expect(mockViewer).toHaveBeenLastCalledWith(expect.objectContaining({ uris: SEED.photos!.slice(0, 2), index: 1 }));
  const calls = mockViewer.mock.calls.length;
  await act(async () => { qc.setQueryData(['reviews', 'detail', '42'], { ...SEED, photos: [] }); });
  await flush();
  expect(mockViewer.mock.calls.length).toBe(calls); // 0장 = 뷰어 렌더 없음
});

it('음식 칩 = /food/{id}?src=review_detail', async () => {
  qc.setQueryData(['reviews', 'detail', '42'], SEED);
  api.get.mockReturnValueOnce(new Promise(() => {}));
  const tree = await render();
  await act(async () => byId(tree, 'feed-food-42')[0].props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith('/food/1?src=review_detail');
});

describe('⋯ = ModerationFlow 배선', () => {
  const lastMod = () => mockMod.mock.calls.at(-1)![0] as {
    target: { mine: boolean; anonymized: boolean; type: string } | null;
    onEdit: () => void; onDelete: () => void; onBlocked: () => void;
  };

  it('내 리뷰 = mine · 수정 = 편집 라우트 · 삭제 성공 = 뒤로', async () => {
    qc.setQueryData(['reviews', 'detail', '42'], SEED);
    api.get.mockReturnValueOnce(new Promise(() => {}));
    const tree = await render();
    await act(async () => byId(tree, 'review-detail-more')[0].props.onPress());
    expect(lastMod().target).toMatchObject({ type: 'review', mine: true, anonymized: false });
    act(() => lastMod().onEdit());
    expect(mockRouter.push).toHaveBeenCalledWith('/food/1/review?reviewId=42');
    await act(async () => lastMod().onDelete());
    await flush();
    expect(api.del).toHaveBeenCalledWith('/api/reviews/42');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('타인 = mine false · 차단 = 뒤로 + 전역 피드 무효화 / 탈퇴 작성자 = anonymized(신고만)', async () => {
    qc.setQueryData(['reviews', 'detail', '42'], { ...SEED, memberId: '5', author: { ...SEED.author!, memberId: '5' } });
    qc.setQueryData(FEED_KEY, { pages: [], pageParams: [] });
    api.get.mockReturnValue(new Promise(() => {}));
    const tree = await render();
    await act(async () => byId(tree, 'review-detail-more')[0].props.onPress());
    expect(lastMod().target).toMatchObject({ mine: false, anonymized: false });
    act(() => lastMod().onBlocked());
    expect(mockRouter.back).toHaveBeenCalled();
    expect(qc.getQueryState(FEED_KEY)?.isInvalidated).toBe(true);

    qc.setQueryData(['reviews', 'detail', '42'], { ...SEED, memberId: undefined, author: null, anonymized: true });
    await flush();
    await act(async () => byId(tree, 'review-detail-more')[0].props.onPress());
    expect(lastMod().target).toMatchObject({ mine: false, anonymized: true });
    api.get.mockReset();
  });
});

it('게스트 Helpful = 로그인 게이트(helpful) · 뮤테이션 0', async () => {
  mockIsGuest.mockReturnValue(true);
  qc.setQueryData(['reviews', 'detail', '42'], { ...SEED, memberId: '5' });
  api.get.mockReturnValueOnce(new Promise(() => {}));
  const tree = await render();
  await act(async () => tree.root.findAll((n) => n.props?.testID === 'helpful-42' && typeof n.props?.onPress === 'function')[0].props.onPress());
  expect(mockGate).toHaveBeenLastCalledWith(expect.objectContaining({ context: 'helpful', open: true }));
  expect(api.post).not.toHaveBeenCalled();
});

it('R-13: 상세 screen_view = 루트 자동 계측의 라우트 패턴 review/[id](실제 id 없음) — 화면 코드에 계측 추가 없음', () => {
    const { screenFromSegments } = require('@/lib/uiClick') as typeof import('@/lib/uiClick');
  expect(screenFromSegments(['review', '[id]'])).toBe('review/[id]');
  expect(require('fs').readFileSync('src/app/review/[id].tsx', 'utf8')).not.toContain('screen_view');
});

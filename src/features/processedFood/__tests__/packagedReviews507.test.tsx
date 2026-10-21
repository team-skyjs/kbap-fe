/**
 * KB-812 2차(P-507) — 가공식품 리뷰 데이터·대상 분기·상세 섹션 잠금:
 * ① 어댑터: targetType PROCESSED_FOOD + processedFood → target packaged(foodId '' · 제품명·https 사진·제조사) · FOOD·구응답 = food
 * ② 대상 링크·수정 경로: 가공식품 = /processed-foods/{id}(…/review?reviewId=) · 음식 = 기존 ?src= · 미상 = null
 * ③ 요청: 제품 리뷰 목록·작성 = 3.2 헤더 · 작성 본문 = 별·본문·사진만(서빙·친절·위치 0) · 403 PFOOD-005 판별
 * ④ 섹션: 요약 null = 숨김 · 0건 = 첫 리뷰 문구 · 3개 → 더 보기 → 받은 전부 → 다음 페이지 · 쓰기 버튼 = 플래그 · 계측 target_type
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api/client', () => {
  class MockApiError extends Error { status?: number; code?: string; constructor(m: string, s?: number, c?: string) { super(m); this.status = s; this.code = c; } }
  return { api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) }, apiLang: () => 'en', ApiError: MockApiError };
});
type RQ = { isPending: boolean; isError: boolean; data?: unknown; error?: unknown; hasNextPage?: boolean; isFetchingNextPage?: boolean; refetch: jest.Mock; fetchNextPage: jest.Mock };
let mockReviewsQ: RQ;
jest.mock('@/lib/data/useFoodReviews', () => ({ ...jest.requireActual('@/lib/data/useFoodReviews'), useProcessedReviews: () => mockReviewsQ }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '41' } }) }));
const mockDelete = jest.fn();
jest.mock('@/lib/data/useReviewMutations', () => ({ ...jest.requireActual('@/lib/data/useReviewMutations'), useDeleteReview: () => ({ mutate: (...a: unknown[]) => mockDelete(...a) }) }));
jest.mock('@/features/review/FeedCard', () => {
  const { View } = jest.requireActual('react-native');
  return { FeedCard: (p: { review: { id: string }; showFood: boolean; mine: boolean }) => <View testID={`card-${p.review.id}`} accessibilityLabel={`${p.showFood}|${p.mine}`} /> };
});
let mockModProps: { onEdit: (m: { id: string }) => void; onDelete: (m: { id: string }) => void } | null = null;
jest.mock('@/features/community/moderation', () => ({ ModerationFlow: (p: never) => { mockModProps = p; return null; } }));
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));
jest.mock('@/components/Skeleton', () => { const { View } = jest.requireActual('react-native'); return { Shimmer: (p: object) => <View {...p} /> }; });
jest.mock('@/components/StateBlock', () => { const { View } = jest.requireActual('react-native'); return { QueryErrorBlock: () => <View testID="qeb" /> }; });
jest.mock('@/components', () => { const { View } = jest.requireActual('react-native'); return { Stars: (p: { value: number }) => <View testID={`stars-${p.value}`} /> }; });
jest.mock('@/components/Btn', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return { Btn: (p: { testID: string; onPress?: () => void; children?: React.ReactNode }) => <Pressable testID={p.testID} onPress={p.onPress}><Text>{p.children}</Text></Pressable> };
});

/* eslint-disable import/first -- jest.mock 뒤 */
import { ApiError } from '@/lib/api/client';
import { adaptReview, type ReviewWire } from '@/lib/api/reviewAdapter';
import { reviewEditHref, reviewTargetHref, reviewTargetType } from '@/lib/review/reviewTarget';
import { fetchProcessedReviewsPage } from '@/lib/data/useFoodReviews';
import { reviewWriteClosed, useCreateProcessedReview } from '@/lib/data/useReviewMutations';
import { FLAGS } from '@/lib/flags';
import { PackagedReviews } from '../PackagedReviews';
/* eslint-enable import/first */

const V32 = { headers: { 'X-API-Version': '3.2' } };
const BASE: ReviewWire = { reviewId: 5, rating: 4, content: 'crunchy and salty', imageUrls: [], createdAt: '1755142800000', author: { memberId: 41, nickname: 'n', countryCode: 'US', tier: 'BRONZE', level: 1, score: 0 } as never };
const trees: ReactTestRenderer[] = [];
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); jest.clearAllMocks(); });
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(el); }); trees.push(t); return t; };
const ids = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string').map((n) => n.props.testID as string);
const rq = (over: Partial<RQ>): RQ => ({ isPending: false, isError: false, refetch: jest.fn(), fetchNextPage: jest.fn(), ...over });
const pageOf = (n: number) => ({ pages: [{ items: Array.from({ length: n }, (_, i) => adaptReview({ ...BASE, reviewId: i + 1, targetType: 'PROCESSED_FOOD', processedFood: { processedFoodId: 1711, productName: 'x' } })), hasNext: false }] });

describe('① 어댑터', () => {
  it('PROCESSED_FOOD + processedFood = packaged · foodId 비움 · 제품명·https 사진·제조사(부제)', () => {
    const r = adaptReview({ ...BASE, targetType: 'PROCESSED_FOOD', servingSpeed: 0, staffKindness: 0, processedFood: { processedFoodId: 1711, reportNo: '19700001001', productName: '우유식빵', maker: '롯데제과', imageUrl: 'http://haccp/a.jpg' } });
    expect(r).toMatchObject({ target: 'packaged', processedFoodId: '1711', foodId: '', foodName: '우유식빵', foodImageUrl: 'https://haccp/a.jpg' });
  });
  it('FOOD · 필드 없는 구응답 · PROCESSED_FOOD인데 요약 없음 = food 축 그대로', () => {
    const food = { foodId: 7, name: 'Kimbap', koreanName: '김밥', imageUrl: 'https://x/k.jpg' };
    expect(adaptReview({ ...BASE, targetType: 'FOOD', food })).toMatchObject({ target: 'food', foodId: '7', foodName: 'Kimbap' });
    expect(adaptReview({ ...BASE, food })).toMatchObject({ target: 'food', foodId: '7' });
    const orphan = adaptReview({ ...BASE, targetType: 'PROCESSED_FOOD' });
    expect(orphan.target).toBe('food');
    expect(reviewTargetHref(orphan, 'feed')).toBeNull(); // 대상 미상 = 탭 무동작(빈 id 링크 0)
  });
});

describe('② 대상 링크', () => {
  it('가공식품 = 제품 상세·제품 작성 화면 편집 / 음식 = 기존 경로 / id 없음 = null', () => {
    const pf = { id: 'r1', target: 'packaged' as const, foodId: '', processedFoodId: '9' };
    expect(reviewTargetHref(pf, 'feed')).toBe('/processed-foods/9');
    expect(reviewEditHref(pf)).toBe('/processed-foods/9/review?reviewId=r1');
    expect(reviewTargetType(pf)).toBe('packaged');
    const food = { id: 'r2', target: 'food' as const, foodId: '7' };
    expect(reviewTargetHref(food, 'my_reviews')).toBe('/food/7?src=my_reviews');
    expect(reviewEditHref(food)).toBe('/food/7/review?reviewId=r2');
    expect(reviewTargetType({})).toBe('food'); // 필드 없음(목·구캐시) = food
    expect(reviewEditHref({ id: 'r3', target: 'packaged', foodId: '' })).toBeNull();
  });
});

describe('③ 요청', () => {
  it('제품 리뷰 목록 = GET /api/processed-foods/{id}/reviews?lang=&cursor= · 3.2', async () => {
    mockGet.mockResolvedValue({ items: [], hasNext: false });
    await fetchProcessedReviewsPage('1711', 'c2');
    expect(mockGet).toHaveBeenCalledWith('/api/processed-foods/1711/reviews?lang=en&cursor=c2', V32);
  });
  it('작성 = POST /api/processed-foods/{id}/reviews · 3.2 · 별·본문·사진만(서빙·친절·위치 0) · 403 PFOOD-005 = reviewWriteClosed', async () => {
    mockPost.mockResolvedValue({});
    let run!: (v: { processedFoodId: string; rating: number; content?: string; imagePaths?: string[] }) => Promise<unknown>;
    function Probe() { run = useCreateProcessedReview().mutateAsync; return null; }
    render(<QueryClientProvider client={new QueryClient()}><Probe /></QueryClientProvider>);
    await act(async () => { await run({ processedFoodId: '1711', rating: 5, content: 'crunchy and salty', imagePaths: ['p/a.jpg'] }); });
    expect(mockPost).toHaveBeenCalledWith('/api/processed-foods/1711/reviews', { rating: 5, content: 'crunchy and salty', imagePaths: ['p/a.jpg'] }, V32);
    expect(reviewWriteClosed(new ApiError('x', 403, 'PFOOD-005'))).toBe(true);
    // Codex #314: 롤백 스위치 off = 성공으로 끝내지 않는다(완료 모달·계측 뒤 글 증발 방지) · 요청 0
    const live = FLAGS.reviewsLiveEnabled;
    (FLAGS as { reviewsLiveEnabled: boolean }).reviewsLiveEnabled = false;
    mockPost.mockClear();
    await act(async () => { await expect(run({ processedFoodId: '1711', rating: 5, content: 'crunchy and salty' })).rejects.toThrow(); });
    expect(mockPost).not.toHaveBeenCalled();
    (FLAGS as { reviewsLiveEnabled: boolean }).reviewsLiveEnabled = live;
    expect(reviewWriteClosed(new ApiError('x', 403, 'REVIEW-004'))).toBe(false);
  });
});

describe('④ 상세 섹션', () => {
  const writeFlag = FLAGS.packagedReviewWrite;
  afterEach(() => { (FLAGS as { packagedReviewWrite: boolean }).packagedReviewWrite = writeFlag; });

  it('요약 null(구서버) = 별·수 숨김 · 0건 = 첫 리뷰 문구', () => {
    mockReviewsQ = rq({ data: pageOf(0) });
    const t = render(<PackagedReviews productId="1711" summary={null} />);
    expect(ids(t)).not.toContain('pf-reviews-summary');
    expect(ids(t)).toContain('pf-reviews-empty');
  });
  it('요약 있음 = 별 평균·(수) · 카드는 대상 칩 숨김 · 내 리뷰 판별', () => {
    mockReviewsQ = rq({ data: pageOf(2) });
    const t = render(<PackagedReviews productId="1711" summary={{ count: 2, avgRating: 4.5 }} />);
    expect(ids(t)).toContain('stars-4.5');
    expect(JSON.stringify(t.toJSON())).toContain('4.5');
    expect(t.root.findAll((n) => n.props?.testID === 'card-1' && typeof n.type === 'string')[0].props.accessibilityLabel).toBe('false|true');
  });
  it('3개 → 더 보기 → 받은 전부 → 다음 페이지', () => {
    mockReviewsQ = rq({ data: pageOf(5), hasNextPage: true });
    const t = render(<PackagedReviews productId="1711" summary={{ count: 60, avgRating: 4 }} />);
    expect(ids(t).filter((i) => i.startsWith('card-'))).toHaveLength(3);
    expect(ids(t)).not.toContain('pf-reviews-load-more');
    act(() => t.root.findAll((n) => n.props?.testID === 'pf-reviews-more' && typeof n.props.onPress === 'function')[0].props.onPress());
    expect(ids(t).filter((i) => i.startsWith('card-'))).toHaveLength(5);
    act(() => t.root.findAll((n) => n.props?.testID === 'pf-reviews-load-more' && typeof n.props.onPress === 'function')[0].props.onPress());
    expect(mockReviewsQ.fetchNextPage).toHaveBeenCalledTimes(1);
  });
  it('로딩 = 스켈레톤 · 첫 페이지 실패 = 에러 블록(빈 상태 아님)', () => {
    mockReviewsQ = rq({ isPending: true });
    expect(ids(render(<PackagedReviews productId="1711" summary={null} />))).toContain('pf-reviews-skeleton');
    mockReviewsQ = rq({ isError: true, error: new Error('x') });
    const t = render(<PackagedReviews productId="1711" summary={null} />);
    expect(ids(t)).toContain('pf-reviews-error');
    expect(ids(t)).not.toContain('pf-reviews-empty');
  });
  it('쓰기 버튼 = 플래그 · 탭 = 제품 작성 화면 + review_write_tap(target_type packaged) · 편집·삭제 = 제품 경로·대상 무관 삭제', () => {
    mockReviewsQ = rq({ data: pageOf(1) });
    (FLAGS as { packagedReviewWrite: boolean }).packagedReviewWrite = false;
    expect(ids(render(<PackagedReviews productId="1711" summary={null} />))).not.toContain('pf-write-review');
    (FLAGS as { packagedReviewWrite: boolean }).packagedReviewWrite = true;
    (FLAGS as { reviewsLiveEnabled: boolean }).reviewsLiveEnabled = false; // Codex #314: 롤백 스위치 off = 버튼 없음
    expect(ids(render(<PackagedReviews productId="1711" summary={null} />))).not.toContain('pf-write-review');
    (FLAGS as { reviewsLiveEnabled: boolean }).reviewsLiveEnabled = true;
    const t = render(<PackagedReviews productId="1711" summary={null} />);
    act(() => t.root.findAll((n) => n.props?.testID === 'pf-write-review' && typeof n.props.onPress === 'function')[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/processed-foods/1711/review');
    expect(mockTrack).toHaveBeenCalledWith('review_write_tap', { source: 'detail', target_type: 'packaged' });
    act(() => mockModProps?.onEdit({ id: 'r9' }));
    expect(mockPush).toHaveBeenLastCalledWith('/processed-foods/1711/review?reviewId=r9');
    act(() => mockModProps?.onDelete({ id: 'r9' }));
    expect(mockDelete).toHaveBeenCalledWith({ reviewId: 'r9', foodId: '' });
  });
});

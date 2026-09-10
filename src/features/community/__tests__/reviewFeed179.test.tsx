/**
 * P-179: 커뮤니티 탭 = 전역 리뷰 피드 — 카드(서버 food·Helpful)·FAB 플로우·
 * 게스트 게이트(인증 필수 계약 = 호출 0)·글 기능 플래그 숨김/채널 분기 소스 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockBlocked = jest.fn(() => ({ data: [] as { id: string }[] }));
jest.mock('@/lib/community/hooks', () => ({
  useBlockedUsers: () => mockBlocked(),
})); // P-186: 차단 숨김
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, FlatList: require('react-native').FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedScrollHandler: () => () => {},
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
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
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useSegments: () => [], // P-214: 계측 화면 식별(StateBlock·HelpfulButton)
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/community',
  // P-194: 포커스 재조회 — 렌더마다 cb 즉시 발화 = "포커스 중" 시뮬레이션
  useFocusEffect: (cb: () => void) => cb(),
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
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));
// 픽커 = 작성 시트 재사용 — 표면 목(kind 전달만 검사)
const mockSheet = jest.fn(() => null);
jest.mock('@/app/community/compose', () => ({ TagPickerSheet: (p: unknown) => mockSheet(p) }));
const mockIsGuest = jest.fn(() => false);
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockIsGuest() }));
const mockToggle = jest.fn();
jest.mock('@/lib/data/useReviewMutations', () => ({
  useToggleReviewLike: () => ({ mutate: mockToggle }),
  useUpdateReview: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteReview: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/features/community/moderation', () => ({ ModerationFlow: () => null }));
const mockMe = jest.fn(() => ({ data: { id: '9', nationality: 'US' } as { id: string; nationality: string | null } | undefined }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => mockMe() }));
const mockFeed = jest.fn();
jest.mock('@/lib/data/useFoodReviews', () => ({ useGlobalReviews: (enabled: boolean, filters: unknown) => mockFeed(enabled, filters) }));

import { ReviewFeed } from '../ReviewFeed';

const REVIEW = {
  id: 'r1', foodId: '7', rating: 4, body: 'Great dish', photos: [], memberId: '9',
  foodName: 'Server Kimbap', foodImageUrl: 'https://cdn/kimbap.jpg',
  author: { memberId: '9', nickname: 'Amy', nationality: 'US', tier: 'taster', level: 2 },
  authorNationality: 'US', authorRankTier: 'taster', anonymized: false,
  createdAt: '2026-08-11T00:00:00Z', likes: 3, myLike: false,
};

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<ReviewFeed />);
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBlocked.mockReturnValue({ data: [] });
  mockIsGuest.mockReturnValue(false);
  mockMe.mockReturnValue({ data: { id: '9', nationality: 'US' } });
  mockFeed.mockReturnValue({
    data: { pages: [{ items: [REVIEW], hasNext: false, nextCursor: null }] },
    isLoading: false, isError: false, error: null, refetch: jest.fn(),
    hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
  });
});

it('카드 = P-169 문법 — 작성자·별점·서버 음식 카드·Helpful, 탭 라우팅 3종', () => {
  const tree = render();
  // FlatList 엘리먼트 prop(circular) 회피 — 텍스트/이미지 노드 직접 수집
  const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string);
  expect(texts).toContain('Amy');
  expect(texts).toContain('Server Kimbap');
  expect(texts).toContain('3'); // P-342 ①: Helpful = 아이콘+숫자(텍스트 라벨 소멸 — likes 3)
  // CardPhoto(expo-image)는 source가 문자열 — 양쪽 형태 수집
  const imgs = tree.root
    .findAll((n) => n.props?.source != null)
    .map((n) => (typeof n.props.source === 'string' ? n.props.source : (n.props.source?.uri as string)))
    .filter(Boolean);
  expect(imgs).toContain('https://cdn/kimbap.jpg');
  // P-182: 카드 전체 탭 제거 — feed 카드에 onPress 없음, ⋯는 본인(memberId 9 = me) 셀에 존재
  const card = tree.root.findAll((n) => n.props?.testID === 'feed-r1');
  expect(card.every((n) => typeof n.props?.onPress !== 'function')).toBe(true);
  expect(tree.root.findAll((n) => n.props?.testID === 'feed-more-r1').length).toBeGreaterThanOrEqual(1);
  act(() => tree.root.findAll((n) => n.props?.testID === 'feed-food-r1')[0].props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/food/7?src=feed'); // P-213: 유입 source 부여
  // P-196: 본인 리뷰(memberId 9 = me) Helpful = 카운트 표시 전용 — 탭 무반응
  act(() => tree.root.findAll((n) => n.props?.testID === 'helpful-r1' && typeof n.props?.onPress === 'function')[0].props.onPress());
  expect(mockToggle).not.toHaveBeenCalled();
});

it('P-196: 타인 리뷰 Helpful = 공용 버튼 경유 토글 · 본인 = 비활성(위 케이스)', () => {
  mockFeed.mockReturnValue({
    data: { pages: [{ items: [{ ...REVIEW, id: 'r3', memberId: '5', author: { ...REVIEW.author, memberId: '5', nickname: 'Bob' } }], hasNext: false, nextCursor: null }] },
    isLoading: false, isError: false, error: null, refetch: jest.fn(),
    hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
  });
  const tree = render();
  act(() => tree.root.findAll((n) => n.props?.testID === 'helpful-r3' && typeof n.props?.onPress === 'function')[0].props.onPress());
  expect(mockToggle).toHaveBeenCalledWith({ reviewId: 'r3', foodId: '7' }, expect.objectContaining({ onSuccess: expect.any(Function) })); // #131 P2
});

it('FAB → 음식 픽커(작성 시트 재사용, kind=food) → 선택 = 리뷰 작성 라우팅', () => {
  const tree = render();
  act(() => tree.root.findAll((n) => n.props?.testID === 'feed-write-fab')[0].props.onPress());
  const props = mockSheet.mock.calls.at(-1)![0] as { kind: string; onToggleFood: (f: { foodId: string; name: string }) => void };
  expect(props.kind).toBe('food');
  act(() => props.onToggleFood({ foodId: '7', name: 'Kimbap' }));
  expect(mockPush).toHaveBeenCalledWith('/food/7/review');
});

it('P-235: 게스트 = 열람 개방(무토큰 200) — 실데이터 렌더 + 게이트 카드 소멸', () => {
  mockIsGuest.mockReturnValue(true);
  const tree = render();
  expect(mockFeed).toHaveBeenCalledWith(true, expect.objectContaining({ countryCode: undefined })); // 게스트도 호출(필터 없음)
  const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string);
  expect(texts).toContain('Amy'); // 실데이터
  expect(tree.root.findAll((n) => n.props?.testID === 'feed-guest-gate')).toHaveLength(0);
});

it('P-181 ③: 헤더 장식 벨 부재(피드·구 글 피드 소스 모두)', () => {
  const tree = render();
  expect(tree.root.findAll((n) => n.props?.testID === 'review-feed').length).toBeGreaterThanOrEqual(1);
  const fs = require('fs');
  expect(fs.readFileSync('src/features/community/ReviewFeed.tsx', 'utf8')).not.toContain('IconBell');
  const tab = fs.readFileSync('src/app/(tabs)/community.tsx', 'utf8') as string;
  expect(tab.includes('<IconBell')).toBe(false);
});

it('소스 잠금(P-289 재잠금) — 리뷰 생존 분기가 coming-soon 가드보다 먼저(순서 회귀 방지)', () => {
  const fs = require('fs');
  const flags = fs.readFileSync('src/lib/flags.ts', 'utf8') as string;
  expect(flags).toContain('communityPostsEnabled: false');
  const tab = fs.readFileSync('src/app/(tabs)/community.tsx', 'utf8') as string;
  // P-289(구 KB-436 #34): reviewsLiveEnabled 분기 선행 — 구 순서는 prod 리뷰 탭 전체 잠금(b22)
  const liveIdx = tab.indexOf('FLAGS.reviewsLiveEnabled && !FLAGS.communityPostsEnabled) return <ReviewFeed');
  const guardIdx = tab.indexOf('FLAGS.communityEnabled) return <ComingSoon');
  expect(liveIdx).toBeGreaterThan(-1);
  expect(guardIdx).toBeGreaterThan(liveIdx);
  expect(tab).toContain('PostCard'); // 글 피드 코드 보존
});

describe('P-194: 당겨서 새로고침 + 포커스 stale 재조회', () => {
  it('RefreshControl 존재 — 당김 = refetch(1페이지부터)', () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    mockFeed.mockReturnValue({
      data: { pages: [{ items: [REVIEW], hasNext: false, nextCursor: null }] },
      isLoading: false, isError: false, error: null, refetch, isStale: false,
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    const tree = render();
    const { RefreshControl } = require('react-native') as typeof import('react-native');
    const rc = tree.root.findAllByType(RefreshControl);
    expect(rc.length).toBeGreaterThanOrEqual(1);
    act(() => rc[0].props.onRefresh());
    expect(refetch).toHaveBeenCalled();
  });

  it('P-235: 게스트도 RefreshControl 존재 + 포커스 stale 재조회(열람 개방)', () => {
    mockIsGuest.mockReturnValue(true);
    const refetch = jest.fn().mockResolvedValue(undefined);
    mockFeed.mockReturnValue({
      data: undefined, isLoading: false, isError: false, error: null, refetch, isStale: true,
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    const tree = render();
    const { RefreshControl } = require('react-native') as typeof import('react-native');
    expect(tree.root.findAllByType(RefreshControl).length).toBeGreaterThanOrEqual(1);
    expect(refetch).toHaveBeenCalled(); // stale = 포커스 재조회(게스트 포함)
  });

  it('탭 포커스(KB-68 문법) — stale이면 재조회, fresh면 no-op', () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    mockFeed.mockReturnValue({
      data: { pages: [{ items: [REVIEW], hasNext: false, nextCursor: null }] },
      isLoading: false, isError: false, error: null, refetch, isStale: true,
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    render();
    expect(refetch).toHaveBeenCalled(); // stale + 포커스 = 재조회
    const fresh = jest.fn().mockResolvedValue(undefined);
    mockFeed.mockReturnValue({
      data: { pages: [{ items: [REVIEW], hasNext: false, nextCursor: null }] },
      isLoading: false, isError: false, error: null, refetch: fresh, isStale: false,
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    render();
    expect(fresh).not.toHaveBeenCalled(); // fresh = no-op(폴링 아님)
  });
});

describe('P-186: 타 유저 신고·차단', () => {
  it('차단 회원 리뷰 = 피드에서 클라 숨김', () => {
    mockBlocked.mockReturnValue({ data: [{ id: '9' }] }); // REVIEW 작성자 memberId 9
    const tree = render();
    expect(tree.root.findAll((n) => n.props?.testID === 'feed-r1').length).toBe(0);
  });

  it('P-339 ②: 익명(탈퇴) 리뷰도 ⋯ 존재(신고만 — 위치 통일) + anonymized 플래그 전달', () => {
    const tree = render();
    expect(tree.root.findAll((n) => n.props?.testID === 'feed-more-r1').length).toBeGreaterThanOrEqual(1);
    mockFeed.mockReturnValue({
      data: { pages: [{ items: [{ ...REVIEW, id: 'r2', memberId: undefined, author: null, anonymized: true }], hasNext: false, nextCursor: null }] },
      isLoading: false, isError: false, error: null, refetch: jest.fn(),
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    const anon = render();
    const more = anon.root.findAll((n) => n.props?.testID === 'feed-more-r2' && typeof n.props?.onPress === 'function');
    expect(more.length).toBeGreaterThanOrEqual(1); // 구 "부재" 계약 대체(P-339 ②)
  });
});

describe('P-297: 에러 오버레이 = 빈 목록일 때만(캐시 리스트 겹침 결함)', () => {
  it('캐시 페이지 존재 + isError → 리스트 유지·에러 블록 0(겹침 금지)', () => {
    mockFeed.mockReturnValue({
      data: { pages: [{ items: [REVIEW], hasNext: false, nextCursor: null }] },
      isLoading: false, isError: true, error: new Error('NETWORK: offline'), refetch: jest.fn(),
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    const tree = render();
    expect(tree.root.findAll((n) => n.props?.testID === 'feed-r1').length).toBeGreaterThanOrEqual(1);
    const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string);
    expect(texts.some((x) => x.includes('common.retry'))).toBe(false); // 에러 블록 미렌더
  });


  it('Codex P2: 다음 페이지 실패(isFetchNextPageError) → 푸터 소형 에러+재시도(전체 블록 0)', () => {
    const fetchNextPage = jest.fn();
    mockFeed.mockReturnValue({
      data: { pages: [{ items: [REVIEW], hasNext: true, nextCursor: 'c2' }] },
      isLoading: false, isError: true, isFetchNextPageError: true, error: new Error('HTTP 500'), refetch: jest.fn(),
      hasNextPage: true, isFetchingNextPage: false, fetchNextPage,
    });
    const tree = render();
    expect(tree.root.findAll((n) => n.props?.testID === 'feed-r1').length).toBeGreaterThanOrEqual(1); // 리스트 유지
    expect(tree.root.findAll((n) => n.props?.testID === 'feed-next-error').length).toBeGreaterThanOrEqual(1); // 푸터 에러(host+composite 중복 수용)
    const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string);
    expect(texts.some((x) => x.includes('states.errorBody'))).toBe(false); // 전체 블록(본문 포함) 미렌더 — 푸터 소형만
    act(() => tree.root.findAll((n) => n.props?.testID === 'feed-next-retry')[0].props.onPress());
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });


  it('Codex P2-2: 에러 상태 onEndReached → fetchNextPage 0(자동 재시도 루프 차단, 버튼만)', () => {
    const fetchNextPage = jest.fn();
    mockFeed.mockReturnValue({
      data: { pages: [{ items: [REVIEW], hasNext: true, nextCursor: 'c2' }] },
      isLoading: false, isError: true, isFetchNextPageError: true, error: new Error('HTTP 500'), refetch: jest.fn(),
      hasNextPage: true, isFetchingNextPage: false, fetchNextPage,
    });
    const tree = render();
    const list = tree.root.findAll((n) => n.props?.testID === undefined && typeof n.props?.onEndReached === 'function')[0];
    act(() => list.props.onEndReached());
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('목록 0 + isError → 에러 블록 단독 렌더(기존 시맨틱 유지)', () => {
    mockFeed.mockReturnValue({
      data: { pages: [] },
      isLoading: false, isError: true, error: new Error('NETWORK: offline'), refetch: jest.fn(),
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    const tree = render();
    const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string);
    expect(texts.some((x) => x.includes('common.retry'))).toBe(true);
    expect(tree.root.findAll((n) => n.props?.testID === 'feed-r1').length).toBe(0);
  });
});

// P-331(KB-487): "Filter by profile" = 같은 국적 필터
describe('P-331: 프로필 토글 = 같은 국적 리뷰 필터', () => {
  it('토글 on → useGlobalReviews에 countryCode=내 국적 전달(off = undefined)', () => {
    const tree = render();
    expect(mockFeed).toHaveBeenLastCalledWith(true, expect.objectContaining({ countryCode: undefined }));
    act(() => tree.root.findAll((n) => n.props?.testID === 'feed-profile-toggle' && typeof n.props?.onPress === 'function')[0].props.onPress());
    expect(mockFeed).toHaveBeenLastCalledWith(true, expect.objectContaining({ countryCode: 'US' }));
  });

  it('게스트·국적 없음 = 토글 미렌더(KB-448 규칙) — 정렬 드롭다운은 유지', () => {
    mockIsGuest.mockReturnValue(true);
    let tree = render();
    expect(tree.root.findAll((n) => n.props?.testID === 'feed-profile-toggle').length).toBe(0);
    expect(tree.root.findAll((n) => n.props?.testID === 'feed-sort').length).toBeGreaterThanOrEqual(1);
    mockIsGuest.mockReturnValue(false);
    mockMe.mockReturnValue({ data: { id: '9', nationality: null } });
    tree = render();
    expect(tree.root.findAll((n) => n.props?.testID === 'feed-profile-toggle').length).toBe(0);
  });

  it('Codex #94 P2: on 상태에서 게스트 전환 → 필터 리셋(잔존 emptySameNat 오노출 금지)', () => {
    mockFeed.mockReturnValue({
      data: { pages: [{ items: [], hasNext: false, nextCursor: null }] },
      isLoading: false, isError: false, error: null, refetch: jest.fn(),
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    const tree = render();
    act(() => tree.root.findAll((n) => n.props?.testID === 'feed-profile-toggle' && typeof n.props?.onPress === 'function')[0].props.onPress());
    expect(mockFeed).toHaveBeenLastCalledWith(true, expect.objectContaining({ countryCode: 'US' }));
    // 세션 만료 → 게스트 전환 시뮬레이션(리렌더)
    mockIsGuest.mockReturnValue(true);
    act(() => { tree.update(<ReviewFeed />); });
    expect(mockFeed).toHaveBeenLastCalledWith(true, expect.objectContaining({ countryCode: undefined }));
    const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string);
    expect(texts).toContain('reviews.emptyTitle'); // P-359: EmptyBlock 단일 라벨
    expect(texts).not.toContain('reviews.emptySameNat');
  });

  it('토글 on + 0건 → emptySameNat 카피(off 빈 상태는 emptyBody 유지)', () => {
    mockFeed.mockReturnValue({
      data: { pages: [{ items: [], hasNext: false, nextCursor: null }] },
      isLoading: false, isError: false, error: null, refetch: jest.fn(),
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    const tree = render();
    let texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string);
    expect(texts).toContain('reviews.emptyTitle'); // P-359: EmptyBlock 단일 라벨
    act(() => tree.root.findAll((n) => n.props?.testID === 'feed-profile-toggle' && typeof n.props?.onPress === 'function')[0].props.onPress());
    texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string);
    expect(texts).toContain('reviews.emptySameNat');
  });
});

describe('P-371(KB-534): 컨트롤 행 좌측 — 게스트/국적 없음 = 라벨, 회원 = 토글', () => {
  // Txt 래퍼 경유라 합성/호스트 노드가 함께 잡힘 — 호스트 노드만 센다
  const labels = (tree: ReactTestRenderer) =>
    tree.root.findAll((n) => n.props?.testID === 'feed-all-reviews-label' && typeof n.type === 'string');

  it('게스트 = "All reviews" 라벨 렌더 + 토글 스위치 없음', () => {
    mockIsGuest.mockReturnValue(true);
    const tree = render();
    expect(labels(tree)).toHaveLength(1);
    expect(labels(tree)[0].props.children).toBe('reviews.allReviews');
    expect(tree.root.findAll((n) => n.props?.testID === 'feed-profile-toggle')).toHaveLength(0);
  });

  it('회원 국적 null = 라벨(토글 조건 동일)', () => {
    mockMe.mockReturnValue({ data: { id: '9', nationality: null } });
    const tree = render();
    expect(labels(tree)).toHaveLength(1);
    expect(tree.root.findAll((n) => n.props?.testID === 'feed-profile-toggle')).toHaveLength(0);
  });

  it('회원 국적 있음 = 현행 토글, 라벨 없음', () => {
    const tree = render();
    expect(tree.root.findAll((n) => n.props?.testID === 'feed-profile-toggle').length).toBeGreaterThanOrEqual(1);
    expect(labels(tree)).toHaveLength(0);
  });
});

/**
 * KB-430(P-275) D-2 — 홈·리뷰 탭·알림 디자인 4차 잠금.
 * ① 홈 섹션 순서(검색→탭→칩→그리드→More→Recent→Reviews→More→면책)
 * ② 위험 칩 = personalRisk 클라 필터(4상태) ③ 알림 unread 스타일 분기
 * ④ 리뷰 탭 컨트롤 노출 조건(정렬만 — 프로필 토글·구 필터 칩 부재) 소스 잠금.
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
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  usePathname: () => '/',
  useFocusEffect: () => {},
  Redirect: () => null,
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
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));

const mockFood = (id: string, risk: string) => ({
  foodId: id,
  name: `Dish ${id}`,
  nameKo: `음식${id}`,
  photoUrl: `https://img/${id}.jpg`,
  risk,
  overall: { average: 4, count: 2 },
});
jest.mock('@/lib/data/useHome', () => ({
  useHome: () => ({
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    data: { authenticated: true, recent: [mockFood('r1', 'safe')], recommended: [], avoided: [] },
  }),
}));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: { nickname: 'A', restrictions: [{ code: 'PEANUT' }], nationality: 'US', id: '1' } }),
}));
const mockCatalog = [mockFood('1', 'safe'), mockFood('2', 'danger'), mockFood('3', 'caution'), mockFood('4', 'safe'), mockFood('5', 'unable'), mockFood('6', 'safe')];
jest.mock('@/lib/data/useFoods', () => ({ useInfiniteFoods: () => ({ data: mockCatalog }) }));
const mockBookmarks = {
  data: [] as ReturnType<typeof mockFood>[],
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: jest.fn(),
};
jest.mock('@/lib/data/bookmarks', () => ({
  useBookmarks: () => ({ ...mockBookmarks }),
  useToggleBookmark: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/data/useFoodReviews', () => ({
  useGlobalReviews: () => ({ data: { pages: [{ items: [] }] } }),
}));
jest.mock('@/lib/notifications/inbox', () => ({
  useUnreadCount: () => 2,
  useInbox: () => [
    { id: 'n1', read: false, titleKey: 'inbox.helpfulTitle', bodyKey: 'inbox.helpfulBody', at: new Date().toISOString(), data: {} },
    { id: 'n2', read: true, titleKey: 'inbox.noticeTitle', bodyKey: 'inbox.noticeBody', at: new Date().toISOString(), data: {} },
  ],
  markInboxRead: jest.fn(),
  markAllInboxRead: jest.fn(),
}));

import Home from '../(tabs)/index';
import Notifications from '../notifications';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
beforeEach(() => {
  mockBookmarks.data = [];
  mockBookmarks.hasNextPage = false;
  mockBookmarks.isFetchingNextPage = false;
  mockBookmarks.fetchNextPage = jest.fn();
});

const byId = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id);
// composite+host 중복 계수 방지 — 고유 testID 집합으로 센다
const uniqueIds = (tree: ReactTestRenderer, prefix: string) => [
  ...new Set(
    tree.root
      .findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith(prefix))
      .map((n) => n.props.testID as string),
  ),
];

it('① 홈 섹션 순서 — 검색→탭→칩→그리드→More→Recent 헤드→Reviews 없음(빈 피드)→면책', () => {
  const tree = render(<Home />);
  const flat = JSON.stringify(tree.toJSON());
  // 시각 순서 = 소스 내 testID/키 등장 순서로 잠금(전부 단일 스크롤 스택)
  const order = ['home-search', 'home-scan', 'home-tab-popular', 'home-chip-all', 'home-food-', 'home-recent-head', 'home-recent-r1', 'home.disclaimer'];
  let last = -1;
  for (const key of order) {
    const at = flat.indexOf(key);
    expect(at).toBeGreaterThan(last);
    last = at;
  }
  // 구 표면 소멸
  for (const gone of ['home.greeting', 'home.scanTitle', 'home.popularSub', 'home.avoidCount']) {
    expect(flat).not.toContain(gone);
  }
});

it('② 위험 칩 — danger 선택 시 personalRisk=danger 카드만, All 복귀 시 첫 4장', () => {
  const tree = render(<Home />);
  act(() => {
    byId(tree, 'home-tab-food')[0].props.onPress();
  });
  // Food 탭: 카탈로그 6 중 첫 4장
  expect(uniqueIds(tree, 'home-food-').length).toBe(4);
  act(() => {
    byId(tree, 'home-chip-danger')[0].props.onPress();
  });
  expect(uniqueIds(tree, 'home-food-')).toEqual(['home-food-2']); // danger 1건만
  act(() => {
    byId(tree, 'home-chip-all')[0].props.onPress();
  });
  expect(uniqueIds(tree, 'home-food-').length).toBe(4);
});

it('③ 알림 — unread 행 = primaryTint 배경 + 점, read 행 = 흰 배경 + 점 없음(프레임 불변)', () => {
  const tree = render(<Notifications />);
  const rowStyle = (id: string) => JSON.stringify(byId(tree, `inbox-${id}`)[0]?.props.style);
  expect(rowStyle('n1')).toContain('rgba(255,113,52,0.05)'); // primaryTint
  expect(rowStyle('n2')).not.toContain('rgba(255,113,52,0.05)');
  expect(byId(tree, 'unread-n1').length).toBeGreaterThanOrEqual(1);
  expect(byId(tree, 'unread-n2').length).toBe(0);
  // 구 좌측 벨 아이콘 소멸(시안) — 소스 잠금
  const src = require('fs').readFileSync('src/app/notifications.tsx', 'utf8') as string;
  expect(src).not.toContain('icUnread');
});

it('⑤ 북마크 전 페이지 드레인(Codex #28) — hasNextPage면 fetchNextPage + 후속 페이지 저장분이 그리드에 저장 표시', () => {
  // 2페이지째에서 합류한 저장분이라 가정(첫 페이지엔 없던 id 2)
  mockBookmarks.data = [mockFood('2', 'danger')];
  mockBookmarks.hasNextPage = true;
  const tree = render(<Home />);
  expect(mockBookmarks.fetchNextPage).toHaveBeenCalled(); // 드레인 개시(소진까지 페이지당 1회)
  // 저장 집합이 전 페이지 데이터 기준 — id 2 카드 = 저장 별(#FFE812 fill, 9/5 판정 4129:10701)
  const fills = (id: string) => {
    const bm = byId(tree, `home-bm-${id}`)[0];
    expect(bm).toBeTruthy();
    return bm.findAll((n) => n.props?.fill != null).map((n) => n.props.fill as string);
  };
  expect(fills('2')).toContain('#FFE812');
  expect(fills('1')).not.toContain('#FFE812'); // 미저장 카드 = 아웃라인(무채움)
});

it('⑥ 벨 NEW 배지 — i18n 키 경유(리터럴 금지) 소스 잠금', () => {
  const src = require('fs').readFileSync('src/components/StickyHeader.tsx', 'utf8') as string;
  expect(src).toContain("t('inbox.newBadge')");
  expect(src).not.toContain('>NEW<');
  const fs = require('fs') as typeof import('fs');
  for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
    const j = JSON.parse(fs.readFileSync(`src/lib/i18n/${loc}.json`, 'utf8')) as { inbox: { newBadge?: string } };
    expect((j.inbox.newBadge ?? '').length).toBeGreaterThan(0);
  }
});

it('④ 리뷰 탭 컨트롤 — 프로필 토글(시안 렌더·무동작) + 정렬 드롭다운, 구 필터 칩·원형 FAB 부재', () => {
  const feed = require('fs').readFileSync('src/features/community/ReviewFeed.tsx', 'utf8') as string;
  expect(feed).toContain('testID="feed-sort"');
  // 9/5 예진 확정: 토글 = 시안대로 렌더, 서버 파라미터 부재라 무동작(훅 미배선 잠금)
  expect(feed).toContain('testID="feed-profile-toggle"');
  expect(feed).toContain('useGlobalReviews(true, { sort })'); // 토글 = 훅 미배선(무동작)
  expect(feed).toContain("t('reviews.writeReview')"); // 플로팅 필 라벨
  for (const gone of ['feed-filter-country', 'feed-filter-food', 'feed-rating', 'IconPlus']) {
    expect(feed).not.toContain(gone);
  }
  // 정렬 5종 전부 시트에 노출
  expect(feed).toContain("['latest', 'rating_high', 'rating_low', 'food_review_count', 'helpful']");
});

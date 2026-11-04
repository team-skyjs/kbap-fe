/**
 * KB-430(P-275) D-2 — 홈·리뷰 탭·알림 디자인 4차 잠금.
 * ① 홈 섹션 순서(검색→탭→칩→그리드→More→Recent→Reviews→More→면책)
 * ② 위험 칩 = personalRisk 클라 필터(4상태) ③ 알림 unread 스타일 분기
 * ④ 리뷰 탭 컨트롤 노출 조건(정렬만 — 프로필 토글·구 필터 칩 부재) 소스 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// P-587: 가공식품 전 채널 ON → 홈 편의점 레일·Packaged 쿼리가 함께 마운트된다. 이 파일은 음식·홈 기존 표면만 본다 —
// 가공식품 0건 성공(레일 숨김)으로 둔다. 레일 자체는 homeCvsRail955.
jest.mock('@/lib/data/useProcessedFoods', () => {
  const empty = { isPending: false, isError: false, isSuccess: true, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: () => {}, refetch: () => {} };
  return {
    ...jest.requireActual('@/lib/data/useProcessedFoods'),
    useProcessedSearch: () => ({ ...empty, data: [] }),
    useProcessedSearchPaged: () => ({ ...empty, data: { items: [], pageSizes: [0] } }),
  };
});
jest.mock('@/features/push/MarketingConsentSheet', () => ({ ...jest.requireActual('@/features/push/MarketingConsentSheet'), InboxMarketingConsent: () => null })); // KB-979: 알림함 동의 시트(navigation 이벤트) — marketingConsent979 담당
jest.mock('@/features/curation/CurationSection', () => ({ CurationSection: () => null })); // KB-796: 홈 큐레이션(자체 쿼리) — 이 스위트 범위 밖
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => { const sv = { value: v, get: () => sv.value, set: (n: unknown) => { sv.value = n; } }; return sv; }, // KB-706 컴파일러 호환 .get/.set(KB-765 홈 뱃지 effect가 .set 호출)
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
jest.mock('@/features/community/moderation', () => ({ ModerationFlow: () => null })); // P-339 ②: 홈 신고 플로우 표면 목
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useScrollToTop: () => {},
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
  bookmarked: false,
});
// KB-986 #421: 시트가 열린 채 홈 요청 실패로 분기 전환 — 실제 쿼리처럼 구독으로 다시 그린다(렌더 메모이즈 우회)
const mockHomeErr = { on: false, subs: new Set<() => void>(), set(v: boolean) { this.on = v; this.subs.forEach((f) => f()); } };
jest.mock('@/lib/data/useHome', () => ({
  useHome: () => (jest.requireActual<typeof import('react')>('react').useSyncExternalStore((f: () => void) => { mockHomeErr.subs.add(f); return () => mockHomeErr.subs.delete(f); }, () => mockHomeErr.on)
    ? { isLoading: false, isPending: false, isError: true, error: new Error('NETWORK'), refetch: jest.fn(), data: undefined }
    : {
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      data: { authenticated: true, recent: [mockFood('r1', 'safe')], recommended: [], avoided: [] },
    }),
}));
// KB-986 #421: 피드백 시트를 연 상태로 고정(큐 판정은 feedbackPrompt986 담당) — 시트 자체는 실제 컴포넌트
jest.mock('react-native-gesture-handler', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const pan = () => {
    const b: Record<string, () => unknown> = {};
    for (const k of ['runOnJS', 'onUpdate', 'onFinalize', 'onStart', 'onEnd', 'onChange', 'enabled', 'minDistance', 'activeOffsetY']) b[k] = () => b;
    return b;
  };
  return { GestureDetector: ({ children }: { children: unknown }) => R.createElement(View, null, children), GestureHandlerRootView: View, Gesture: { Pan: pan, Tap: pan } };
});
const mockFeedbackOpen = { on: false };
jest.mock('@/features/feedback/FeedbackPromptSheet', () => ({
  ...jest.requireActual('@/features/feedback/FeedbackPromptSheet'),
  useFeedbackPromptSheet: () => ({ show: () => {}, abort: () => {}, props: { open: mockFeedbackOpen.on, onClose: () => {} } }),
}));
jest.mock('@/lib/data/useFeedback', () => ({ FEEDBACK_MAX_LEN: 2000, FEEDBACK_MAX_PHOTOS: 3, useSubmitFeedback: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: { nickname: 'A', restrictions: [{ code: 'PEANUT' }], nationality: 'US', id: '1' } }),
}));
const mockCatalog = [mockFood('1', 'safe'), mockFood('2', 'danger'), mockFood('3', 'caution'), mockFood('4', 'safe'), mockFood('5', 'unable'), mockFood('6', 'safe')];
// P-350(KB-492): 칩 = 서버 필터 — 목이 risk 인자로 서버 판정을 재현(클라 필터 소멸)
jest.mock('@/lib/data/useFoods', () => ({
  usePrefetchOtherFoodSorts: () => {}, // KB-830
  FOODS_PAGE_SIZE: 20,
  useInfiniteFoods: (risk?: string) => ({
    data: !risk || risk === 'all' ? mockCatalog : mockCatalog.filter((f: { risk: string }) => f.risk === risk),
  }),
}));
const mockBookmarks = {
  data: [] as ReturnType<typeof mockFood>[],
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: jest.fn(),
};
jest.mock('@/lib/data/bookmarks', () => ({
  // #116 P2 ①: 공용 훅 계약 재현 — 드레인 effect + Set(⑤ 테스트가 실행동 검증)
  useSavedIds: () => {
    const React = require('react') as typeof import('react');
    React.useEffect(() => {
      if (mockBookmarks.hasNextPage && !mockBookmarks.isFetchingNextPage) mockBookmarks.fetchNextPage({ cancelRefetch: false });
    });
    return { ids: new Set<string>(((mockBookmarks.data ?? []) as { foodId: string }[]).map((f) => f.foodId)), ready: !mockBookmarks.hasNextPage };
  },
  useBookmarks: () => ({ ...mockBookmarks }),
  useToggleBookmark: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/data/useFoodReviews', () => ({
  useGlobalReviews: () => ({ data: { pages: [{ items: [] }] } }),
}));
jest.mock('@/lib/data/useNotifications', () => ({
  useUnreadCount: () => 2,
  useInbox: () => ({
    data: [
      { id: 1, read: false, title: 'A', body: 'a', at: new Date().toISOString() },
      { id: 2, read: true, title: 'B', body: 'b', at: new Date().toISOString() },
    ],
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
  useMarkRead: () => ({ mutate: jest.fn() }),
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

// P-317: 홈 = Animated.FlatList — ListHeader/Footer 엘리먼트 prop이 순환 참조라
// 엘리먼트 prop은 버리고(렌더 트리만 — prop 순서로 시각 순서가 오염되지 않게) 직렬화.
const REACT_EL = new Set<symbol>([Symbol.for('react.element'), Symbol.for('react.transitional.element')]);
const safeFlat = (t: ReactTestRenderer) => {
  const seen = new WeakSet<object>();
  return JSON.stringify(t.toJSON(), (_k, v: unknown) => {
    if (typeof v === 'object' && v !== null) {
      if (REACT_EL.has((v as { $$typeof?: symbol }).$$typeof as symbol)) return undefined;
      if (seen.has(v)) return undefined;
      seen.add(v);
    }
    return v;
  });
};

it('① 홈 섹션 순서 — 검색→탭→칩→레일→Recent 헤드→Reviews 없음(빈 피드)→면책', () => {
  const tree = render(<Home />);
  const flat = safeFlat(tree);
  // 시각 순서 = 소스 내 testID/키 등장 순서로 잠금(전부 단일 스크롤 스택)
  const order = ['home-search', 'home-scan', 'home-tab-popular', 'home-chip-safe', 'home-food-', 'home-recent-head', 'home-recent-r1', 'home.disclaimer'];
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

it('② 위험 칩 — danger 선택 시 personalRisk=danger 카드만, KB-949 다시 누르면 해제 = 전체(레일 상한 10 내) · All 칩 0', () => {
  const tree = render(<Home />);
  act(() => {
    byId(tree, 'home-tab-food')[0].props.onPress();
  });
  // P-317: 4장 슬라이스 → 가로 레일(≤10) — 카탈로그 6장 전부
  expect(uniqueIds(tree, 'home-food-').length).toBe(6);
  act(() => {
    byId(tree, 'home-chip-danger')[0].props.onPress();
  });
  expect(uniqueIds(tree, 'home-food-')).toEqual(['home-food-2']); // danger 1건만
  act(() => {
    byId(tree, 'home-chip-danger')[0].props.onPress(); // KB-949: 다시 누름 = 해제
  });
  expect(uniqueIds(tree, 'home-food-').length).toBe(6);
  expect(byId(tree, 'home-chip-all')).toHaveLength(0);
});

it('③ 알림 — unread 행 = primaryTint 배경 + 점, read 행 = 흰 배경 + 점 없음(프레임 불변)', () => {
  const tree = render(<Notifications />);
  const rowStyle = (id: string) => JSON.stringify(byId(tree, `inbox-${id}`)[0]?.props.style);
  expect(rowStyle('1')).toContain('rgba(255,113,52,0.05)'); // primaryTint
  expect(rowStyle('2')).not.toContain('rgba(255,113,52,0.05)');
  expect(byId(tree, 'unread-1').length).toBeGreaterThanOrEqual(1);
  expect(byId(tree, 'unread-2').length).toBe(0);
  // 구 좌측 벨 아이콘 소멸(시안) — 소스 잠금
  const src = require('fs').readFileSync('src/app/notifications.tsx', 'utf8') as string;
  expect(src).not.toContain('icUnread');
});

it('⑤ KB-959(예진 11/2): 홈 레일 카드 저장 별 소멸 — 저장 카드여도 카드엔 버튼 0(저장·해제 = 상세)', () => {
  mockCatalog[0].bookmarked = true;
  const tree = render(<Home />);
  expect(tree.root.findAll((n) => /^home-bm-/.test(n.props?.testID ?? ''))).toHaveLength(0);
  expect(byId(tree, 'home-food-1').length).toBeGreaterThan(0); // 카드 자체는 그대로
  mockCatalog[0].bookmarked = false;
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

it('④ 리뷰 탭 컨트롤 — 프로필 토글(P-331: 같은 국적 필터 배선) + 정렬 드롭다운, 구 필터 칩·원형 FAB 부재', () => {
  const feed = require('fs').readFileSync('src/features/community/ReviewFeed.tsx', 'utf8') as string;
  expect(feed).toContain('testID="feed-sort"');
  // P-331(KB-487): 토글 = 같은 국적 필터 — countryCode 배선 잠금(게스트·국적 없음 미렌더는 유닛)
  expect(feed).toContain('testID="feed-profile-toggle"');
  expect(feed).toContain("countryCode: filterActive ? myNat : undefined");
  expect(feed).toContain("t('reviews.writeReview')"); // 플로팅 필 라벨
  for (const gone of ['feed-filter-country', 'feed-filter-food', 'feed-rating', 'IconPlus']) {
    expect(feed).not.toContain(gone);
  }
  // 정렬 5종 전부 시트에 노출
  expect(feed).toContain("['latest', 'rating_high', 'rating_low', 'food_review_count', 'helpful']");
});

it('KB-986 #421 Codex P2: 피드백 시트가 열린 채 홈 요청이 실패해 에러 화면으로 바뀌어도 시트는 같은 인스턴스(본문 유지)', () => {
  mockFeedbackOpen.on = true;
  try {
    const tree = render(<Home />);
    const body = () => tree.root.findAll((n) => n.props?.testID === 'feedback-body' && typeof n.props.onChangeText === 'function');
    expect(body().length).toBeGreaterThan(0); // Input 래퍼·TextInput·호스트 = 한 입력칸
    const sheets = () => tree.root.findAll((n) => n.props?.testID === 'feedback-prompt' && typeof n.type === 'string');
    expect(sheets()).toHaveLength(1);
    act(() => body()[0].props.onChangeText('검색이 느려요'));
    act(() => mockHomeErr.set(true));
    expect(tree.root.findAll((n) => typeof n.props?.onRetry === 'function').length).toBeGreaterThan(0); // 에러 화면으로 실제 전환
    expect(tree.root.findAll((n) => n.props?.testID === 'feedback-body')[0].props.value).toBe('검색이 느려요');
    expect(sheets()).toHaveLength(1);
    act(() => mockHomeErr.set(false));
    expect(tree.root.findAll((n) => n.props?.testID === 'feedback-body')[0].props.value).toBe('검색이 느려요');
  } finally {
    mockFeedbackOpen.on = false;
    mockHomeErr.on = false;
  }
});

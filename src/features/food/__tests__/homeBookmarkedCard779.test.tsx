/**
 * KB-779 — 홈(embedded)은 /home·/foods 카드의 `bookmarked`로 별·토글 방향을 정한다.
 * 회원 홈 콜드 스타트(Popular·All)에 GET /bookmarks(전 페이지 드레인) 0회 — Saved 탭을 눌렀을 때만.
 * 실제 QueryClient + 실제 useToggleBookmark 위에서 발사되는 HTTP까지 잠근다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api/client'; // jest.mock 호이스팅 — 아래 팩토리의 mock
import { FoodExplorer } from '@/features/food/FoodExplorer';
import type { FoodCard } from '@/lib/api/types';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = jest.requireActual('react-native');
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
    cancelAnimation: () => {},
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: View };
});
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  usePathname: () => '/',
  useFocusEffect: () => {},
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '9', restrictions: [] } }) }));
jest.mock('@/lib/api/client', () => ({
  api: { get: jest.fn(), post: jest.fn().mockResolvedValue(undefined), patch: jest.fn().mockResolvedValue(undefined) },
  apiLang: () => 'en',
}));

const WIRE = (id: number, bookmarked?: boolean) => ({
  foodId: id, name: `F${id}`, koreanName: `푸${id}`, imageRef: null, spiciness: 0, overallRiskStatus: 'SAFE', bookmarked,
});
const CARD = (foodId: string, bookmarked: boolean): FoodCard => ({
  foodId, name: foodId, nameKo: foodId, photoUrl: null, risk: 'safe', overall: { average: null, count: 0 }, bookmarked,
});

/** /bookmarks: 1페이지 종결 · /foods: 11(저장됨)·12(미저장) 단일 페이지. */
function serveApi() {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 3));
    if (url.startsWith('/bookmarks')) return delay({ items: [WIRE(1, true)], hasNext: false, nextCursor: null });
    return delay({ items: [WIRE(11, true), WIRE(12)], hasNext: false, nextCursor: null });
  });
}
const bookmarkCalls = () => (api.get as jest.Mock).mock.calls.filter(([u]) => String(u).startsWith('/bookmarks')).length;
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 8)); });
const press = (t: ReactTestRenderer, testID: string) =>
  act(async () => { t.root.findAll((n) => n.props?.testID === testID && typeof n.props?.onPress === 'function')[0].props.onPress(); });

async function mount(popular: FoodCard[]) {
  const qc = client();
  let t!: ReactTestRenderer;
  await act(async () => {
    t = renderer.create(
      <QueryClientProvider client={qc}>
        <FoodExplorer variant="embedded" guest={false} srcTag="home" popular={popular} />
      </QueryClientProvider>,
    );
  });
  await flush(); await flush(); await flush();
  return t;
}

beforeEach(() => {
  jest.clearAllMocks();
  (api.post as jest.Mock).mockResolvedValue(undefined);
  (api.patch as jest.Mock).mockResolvedValue(undefined);
  serveApi();
});

it('① 회원 홈 콜드 스타트(Popular·All) = GET /bookmarks 0회 · Saved 탭을 누르면 그때 호출', async () => {
  const t = await mount([CARD('30', true), CARD('31', false)]);
  expect((api.get as jest.Mock).mock.calls.length).toBeGreaterThan(0); // /foods(Safe picks 소스)는 돈다 — 스파이 실효
  expect(bookmarkCalls()).toBe(0);
  await press(t, 'home-tab-saved');
  await flush(); await flush(); await flush();
  expect(bookmarkCalls()).toBeGreaterThan(0);
});

// KB-959(예진 11/2): 카드 저장(별) 버튼 소멸 — 저장·해제는 상세에서만. 홈 레일·Food 탭 카드엔 별 0, 카드에서 북마크 요청 0
const stars = (t: Awaited<ReturnType<typeof mount>>) => t.root.findAll((n) => /^home-bm-/.test(n.props?.testID ?? ''));
it('② 레일 카드 = 저장 여부와 무관하게 별 0', async () => {
  const t = await mount([CARD('30', true), CARD('31', false)]);
  expect(stars(t)).toHaveLength(0);
});

it('③ 카드 저장 토글 경로 소멸 — 홈·Food 탭 어느 카드에서도 POST·PATCH /bookmarks 0', async () => {
  const t = await mount([CARD('30', true), CARD('31', false)]);
  await press(t, 'home-tab-food');
  await flush(); await flush();
  expect(stars(t)).toHaveLength(0);
  expect(api.post).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
});

it('④ Food 탭(/foods 소스) = 드레인 0(카드 별이 없어 북마크 판정 목록이 필요 없다)', async () => {
  const t = await mount([CARD('30', true)]);
  await press(t, 'home-tab-food');
  await flush(); await flush();
  expect(bookmarkCalls()).toBe(0);
});

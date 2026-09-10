/**
 * P-332(KB-488) 홈 프리징 — 홈 embedded·음식 탭(탭 네비가 동시 마운트 유지)이 같은
 * ['bookmarks'] 무한 쿼리를 구독 + 각자 전 페이지 드레인 effect + 북마크 토글
 * (낙관 삽입 → onSettled invalidate 전 페이지 재조회) 경로에서 fetch·렌더가
 * 유한한지 잠근다. ①은 effect 메커니즘(수정본 복제), ②는 실제 FoodExplorer 통합.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
    cancelAnimation: () => {},
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
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
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '9', restrictions: [] } }) }));
jest.mock('@/lib/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn().mockResolvedValue(undefined),
    patch: jest.fn().mockResolvedValue(undefined),
  },
  apiLang: () => 'en',
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { api } = require('@/lib/api/client');
/* eslint-enable @typescript-eslint/no-require-imports */

import { useBookmarks, useToggleBookmark, type BookmarkSnapshot } from '../bookmarks';
import { FoodExplorer } from '@/features/food/FoodExplorer';

const WIRE = (id: number) => ({
  foodId: id, name: `F${id}`, koreanName: `푸${id}`, imageRef: null, spiciness: 0, overallRiskStatus: 'SAFE',
});

/** 커서 서버 — /bookmarks: p0(1..2, next=2) → p1(3, end) / /foods: 단일 페이지 종결.
 *  60회 초과 = 루프로 간주(프리징 재현) — 즉시 던져 표면화. */
function serveApi() {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    if ((api.get as jest.Mock).mock.calls.length > 60) throw new Error(`LOOP: api.get 60회 초과 (${url})`);
    const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 3)); // in-flight 중첩 재현
    if (url.startsWith('/bookmarks')) {
      const cursor = /cursor=(\d+)/.exec(url)?.[1];
      if (cursor == null) return delay({ items: [WIRE(1), WIRE(2)], hasNext: true, nextCursor: 2 });
      return delay({ items: [WIRE(3)], hasNext: false, nextCursor: null });
    }
    return delay({ items: [WIRE(11), WIRE(12)], hasNext: false, nextCursor: null });
  });
}

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 8)); });

const renders = { a: 0, b: 0 };

/** FoodExplorer 드레인 effect(P-332 수정본) 복제 — 소스가 바뀌면 이 복제와 기대를 함께 갱신. */
function Drainer({ tag }: { tag: 'a' | 'b' }) {
  const saved = useBookmarks();
  renders[tag] += 1;
  if (renders[tag] > 300) throw new Error(`LOOP: ${tag} 렌더 300회 초과`);
  React.useEffect(() => {
    if (saved.hasNextPage && !saved.isFetchingNextPage && !saved.isFetching)
      void saved.fetchNextPage({ cancelRefetch: false });
  }, [saved.hasNextPage, saved.isFetchingNextPage, saved.isFetching, saved.fetchNextPage]);
  return null;
}

function Toggler({ fire, onSettled }: { fire: boolean; onSettled: () => void }) {
  const toggle = useToggleBookmark();
  React.useEffect(() => {
    if (!fire) return;
    const snap: BookmarkSnapshot = { foodId: '9', name: 'New', nameKo: '새', risk: 'safe', photoUrl: null };
    toggle.mutate({ snap, add: true }, { onSettled });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire]);
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  (api.post as jest.Mock).mockResolvedValue(undefined);
  (api.patch as jest.Mock).mockResolvedValue(undefined);
  serveApi();
  renders.a = 0; renders.b = 0;
});

it('① 드레인 effect 메커니즘 — 동시 2구독 + 토글 invalidate 후 fetch·렌더 유한', async () => {
  const qc = client();
  let tree!: ReactTestRenderer;
  let settled!: () => void;
  const done = new Promise<void>((r) => (settled = r));
  const ui = (fire: boolean) => (
    <QueryClientProvider client={qc}>
      <Drainer tag="a" />
      <Drainer tag="b" />
      <Toggler fire={fire} onSettled={settled} />
    </QueryClientProvider>
  );
  await act(async () => { tree = renderer.create(ui(false)); });
  await flush(); await flush();
  const callsAfterDrain = (api.get as jest.Mock).mock.calls.length;
  expect(callsAfterDrain).toBeLessThanOrEqual(3); // p0 + p1(+여유)

  await act(async () => { tree.update(ui(true)); });
  await act(async () => { await done; });
  await flush(); await flush(); await flush();

  expect((api.get as jest.Mock).mock.calls.length - callsAfterDrain).toBeLessThanOrEqual(6);
  expect(renders.a).toBeLessThan(60);
  expect(renders.b).toBeLessThan(60);
});

/** 커서 에코 서버 — 페이지 경계에서 nextCursor가 전진하지 않고 hasNext true 지속(BE 경계 의심 재현). */
function serveCursorEcho() {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    if ((api.get as jest.Mock).mock.calls.length > 60) throw new Error(`LOOP: api.get 60회 초과 (${url})`);
    const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 3));
    if (url.startsWith('/bookmarks')) {
      const cursor = /cursor=(\d+)/.exec(url)?.[1];
      if (cursor == null) return delay({ items: [WIRE(1), WIRE(2)], hasNext: true, nextCursor: 2 });
      return delay({ items: [WIRE(3)], hasNext: true, nextCursor: 2 }); // 커서 에코 — 전진 없음
    }
    return delay({ items: [WIRE(11), WIRE(12)], hasNext: false, nextCursor: null });
  });
}

it('③ 커서 미전진(hasNext 지속) 서버 경계에서도 드레인이 유한 종료 — 프리징 봉인', async () => {
  serveCursorEcho();
  const qc = client();
  let tree!: ReactTestRenderer;
  const ui = (
    <QueryClientProvider client={qc}>
      <FoodExplorer variant="embedded" guest={false} srcTag="home" />
    </QueryClientProvider>
  );
  await act(async () => { tree = renderer.create(ui); });
  for (let i = 0; i < 12; i++) await flush();
  // 종료 가드(커서 미전진·빈 페이지 = next 없음) — 폭주면 60 캡이 던져 실패
  expect((api.get as jest.Mock).mock.calls.length).toBeLessThanOrEqual(6);
});

it('② 실제 FoodExplorer 2식(홈 embedded + 음식 탭 screen 동시 마운트) — 북마크 탭 후 유한 수렴', async () => {
  const qc = client();
  let tree!: ReactTestRenderer;
  const ui = (
    <QueryClientProvider client={qc}>
      <FoodExplorer variant="embedded" guest={false} srcTag="home" />
      <FoodExplorer variant="screen" guest={false} srcTag="list" />
    </QueryClientProvider>
  );
  await act(async () => { tree = renderer.create(ui); });
  await flush(); await flush(); await flush();

  // 홈 카드 별(북마크) 탭 — 낙관 삽입 + onSettled invalidate 경로 실발화
  const star = tree.root.findAll((n) => n.props?.testID === 'home-bm-11' && typeof n.props?.onPress === 'function')[0];
  expect(star).toBeTruthy();
  await act(async () => { star.props.onPress(); });
  await flush(); await flush(); await flush(); await flush();

  // 프리징 = api.get 폭주(60 초과 시 mock이 던져 실패) — 수렴 상한 잠금
  expect((api.get as jest.Mock).mock.calls.length).toBeLessThanOrEqual(12);
  // 낙관 삽입 경로의 실요청까지 실발화 확인
  expect(api.post).toHaveBeenCalledWith('/bookmarks', { foodId: 11 });
});

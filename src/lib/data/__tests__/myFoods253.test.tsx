/**
 * P-253(KB-360 1차): My Foods — 주문 훅(커서·어댑터 null 방어)·화면(세그 전환·
 * 썸네일 1~4·빈 상태·상세 라우팅)·read-only(비범위 어포던스 잔존 0).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    useAnimatedProps: () => ({}),
    useReducedMotion: () => false,
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, back: jest.fn() }),
  useLocalSearchParams: () => ({ id: '123' }),
  usePathname: () => '/profile/my-foods',
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { count?: number }) => (o?.count != null ? `${k}:${o.count}` : k), i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => ({ api: { get: (p: string) => mockGet(p) }, apiLang: () => 'en' }));

import MyFoodsScreen from '@/app/profile/my-foods';
import { useOrders } from '../useOrders';

const ORDER = (over: Record<string, unknown> = {}) => ({
  orderId: 123, orderedAt: 1765700640000, roadAddress: '서울 중구 소공로 51', totalQuantity: 6,
  thumbnails: ['https://cdn/a.jpg', 'https://cdn/b.jpg', 'https://cdn/c.jpg', 'https://cdn/d.jpg'],
  scanImageUrl: 'https://cdn/menu.jpg', ...over,
});

const trees: ReactTestRenderer[] = [];
function renderScreen(): ReactTestRenderer {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <MyFoodsScreen />
      </QueryClientProvider>,
    );
  });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
const flush = async () => {
  // react-query 반영이 act 경계를 넘어올 수 있어 매크로태스크 3턴 재플러시
  for (let i = 0; i < 3; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
};
const flat = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({ items: [ORDER()], hasNext: false, nextCursor: null });
});

it('훅 — 커서 페이징 쿼리 실측 + 어댑터 null 방어(주소·비URL 썸네일·scanImageUrl)', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  mockGet.mockResolvedValue({
    items: [ORDER({ roadAddress: null, thumbnails: ['https://cdn/a.jpg', 'bare.png', null], scanImageUrl: 'bare.jpg' })],
    hasNext: true,
    nextCursor: 'CUR-2',
  });
  let data: ReturnType<typeof useOrders>['data'];
  let fetchNext!: () => void;
  function H() {
    const q = useOrders();
    data = q.data;
    fetchNext = () => void q.fetchNextPage();
    return null;
  }
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <H />
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 0));
  });
  // react-query 반영이 렌더 act 밖으로 밀릴 수 있어 데이터 도착까지 짧게 재플러시
  for (let i = 0; i < 5 && data === undefined; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
  expect(mockGet).toHaveBeenCalledWith('/api/orders');
  expect(data![0].roadAddress).toBeNull();
  expect(data![0].thumbnails).toEqual(['https://cdn/a.jpg']); // 비URL·null 드롭
  expect(data![0].scanImageUrl).toBeNull(); // 비URL 방어
  await act(async () => { fetchNext(); await new Promise((r) => setTimeout(r, 0)); });
  expect(mockGet).toHaveBeenLastCalledWith('/api/orders?cursor=CUR-2'); // 커서 그대로 반환
  await act(async () => { tree.unmount(); });
  qc.clear();
});

it('Ordered 카드 — 4분할 썸네일·주소·수량 + 탭 = 상세 라우팅', async () => {
  const tree = renderScreen();
  await flush();
  expect(tree.root.findAll((n) => n.props?.testID === 'thumb-4').length).toBeGreaterThanOrEqual(1);
  const s = flat(tree);
  expect(s).toContain('서울 중구 소공로 51');
  expect(s).toContain('myFoods.itemCount:6');
  const card = tree.root.findAll((n) => n.props?.testID === 'order-123' && typeof n.props?.onPress === 'function')[0];
  act(() => card.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/profile/order/123');
});

it('썸네일 1장 = 크게(thumb-1) · roadAddress null = 주소 미표시', async () => {
  mockGet.mockResolvedValue({ items: [ORDER({ thumbnails: ['https://cdn/a.jpg'], roadAddress: null })], hasNext: false, nextCursor: null });
  const tree = renderScreen();
  await flush();
  expect(tree.root.findAll((n) => n.props?.testID === 'thumb-1').length).toBeGreaterThanOrEqual(1);
  expect(flat(tree)).not.toContain('소공로');
});

it('빈 상태 — 주문 0건 = 스캔 유도(P-210) + CTA = navigate(P-246)', async () => {
  mockGet.mockResolvedValue({ items: [], hasNext: false, nextCursor: null });
  const tree = renderScreen();
  await flush();
  const s = flat(tree);
  expect(s).toContain('myFoods.emptyOrdersTitle');
  expect(s).toContain('community.goScanCta'); // P-245 CTA 재사용(신규 키 0)
  const cta = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && flat(tree).length > 0 && n.props?.testID === undefined);
  // StateBlock primary 버튼 탭 — goScanCta 텍스트를 품은 Pressable
  const texts = tree.root.findAll((n) => n.type === 'Text' && n.children.join('') === 'community.goScanCta');
  let cur: renderer.ReactTestInstance | null = texts[0];
  while (cur && typeof cur.props?.onPress !== 'function') cur = cur.parent;
  act(() => cur!.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('/scan');
  void cta;
});

it('세그 전환 — Scanned 탭 = /foods/scanned 재사용(P-238)·행 탭 = 음식 상세', async () => {
  mockGet.mockImplementation(async (p: string) =>
    p.startsWith('/api/foods/scanned')
      ? { items: [{ foodId: 7, name: 'Kimchi Stew', koreanName: '김치찌개', imageRef: null }], hasNext: false, nextCursor: null }
      : { items: [], hasNext: false, nextCursor: null },
  );
  const tree = renderScreen();
  await flush();
  const seg = tree.root.findAll((n) => n.props?.testID === 'myfoods-tab-scanned' && typeof n.props?.onPress === 'function')[0];
  act(() => seg.props.onPress());
  await flush();
  expect(mockGet.mock.calls.some(([p]) => String(p).startsWith('/api/foods/scanned'))).toBe(true);
  const row = tree.root.findAll((n) => n.props?.testID === 'myfoods-food-7' && typeof n.props?.onPress === 'function')[0];
  act(() => row.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/food/7?src=list');
});

it('read-only 잠금 — 비범위 어포던스(장소 태그·사진 교체·공유·dish 위험도) 잔존 0', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  for (const f of ['src/app/profile/my-foods.tsx', 'src/app/profile/order/[id].tsx']) {
    const src = fs.readFileSync(f, 'utf8') as string;
    for (const banned of ['tag a place', 'Replace', 'Share', 'Download', 'RiskMark']) {
      expect(src).not.toContain(banned);
    }
    expect(src).not.toMatch(/api\.(post|patch|del)/); // read-only(조회 전용)
  }
  // 진입점 + 상세 리뷰 연결 배선
  expect(fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8')).toContain("'/profile/my-foods' as Href");
  expect(fs.readFileSync('src/app/profile/order/[id].tsx', 'utf8')).toContain('/review` as Href');
});

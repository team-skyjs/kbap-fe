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
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// KB-434: 화면이 useMe(개인화 위험)·RecentRow(FoodCards)를 소비 — 표면 목
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { restrictions: [] } }) }));
jest.mock('@/lib/analytics', () => ({ EVENTS: { review_write_tap: 'review_write_tap' }, track: jest.fn() }));
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
import OrderDetailScreen from '@/app/profile/order/[id]';
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

it('KB-434 D-6 주문 카드 — map-pin 박스·주소·수량 필 + 탭 = 상세 라우팅(구 4분할 썸네일 소멸)', async () => {
  const tree = renderScreen();
  await flush();
  const s = flat(tree);
  expect(s).toContain('서울 중구 소공로 51');
  expect(s).toContain('myFoods.itemCount:6');
  expect(s).not.toContain('thumb-4'); // ThumbGrid 소멸(시안 = map-pin 70 박스)
  const card = tree.root.findAll((n) => n.props?.testID === 'order-123' && typeof n.props?.onPress === 'function')[0];
  act(() => card.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/profile/order/123');
});

it('KB-434: roadAddress null = "+ tag a place" 아웃라인 필(무동작 — 태그 기능 부재, 시안 렌더)', async () => {
  mockGet.mockResolvedValue({ items: [ORDER({ roadAddress: null })], hasNext: false, nextCursor: null });
  const tree = renderScreen();
  await flush();
  expect(tree.root.findAll((n) => n.props?.testID === 'order-tag-place-123').length).toBeGreaterThanOrEqual(1);
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
  // KB-434: Scanned 행 = D-2 recent-row(RecentRow 재사용) — testID 홈 문법 승계
  const row = tree.root.findAll((n) => n.props?.testID === 'home-recent-7' && typeof n.props?.onPress === 'function')[0];
  act(() => row.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/food/7?src=list');
});

it('KB-360: 상세 메뉴판 사진 — scanImageUrl 렌더 게이트(있음 = 표시+뷰어, 부재 = 통째 미렌더)', async () => {
  // 서버 #192 실배포 정합 — 어댑터·렌더는 P-253 기배선, 여기서 게이트를 실측 잠금
  mockGet.mockImplementation(async (path: string) =>
    path === '/api/orders/123'
      ? { orderId: 123, orderedAt: 1765700640000, roadAddress: null, totalQuantity: 2, totalPrice: 18000,
          scanImageUrl: 'https://cdn/scan/42/menu.jpg',
          items: [{ menuName: '순두부찌개', quantity: 2, price: 9000, foodId: 7, imageRef: null }] }
      : { items: [], hasNext: false, nextCursor: null },
  );
  const qc1 = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <QueryClientProvider client={qc1}>
        <OrderDetailScreen />
      </QueryClientProvider>,
    );
  });
  trees.push(tree);
  await flush();
  const photo = tree.root.findAll((n) => n.props?.testID === 'order-scan-image' && typeof n.props?.onPress === 'function');
  expect(photo.length).toBeGreaterThanOrEqual(1); // CardPhoto 관례 계열(RemoteImage — 스켈레톤 공용 경유)
  act(() => photo[0].props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'order-viewer-close').length).toBeGreaterThanOrEqual(1); // 풀스크린 뷰어(contain)

  // 부재(구 주문·prod 구계약) = 사진 영역 통째 미렌더 — 빈 슬롯 금지
  mockGet.mockImplementation(async (path: string) =>
    path === '/api/orders/123'
      ? { orderId: 123, orderedAt: 1765700640000, roadAddress: null, totalQuantity: 1, totalPrice: null,
          items: [{ menuName: '수제비', quantity: 1, price: null, foodId: 9, imageRef: null }] }
      : { items: [], hasNext: false, nextCursor: null },
  );
  const qc2 = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let tree2!: ReactTestRenderer;
  act(() => {
    tree2 = renderer.create(
      <QueryClientProvider client={qc2}>
        <OrderDetailScreen />
      </QueryClientProvider>,
    );
  });
  trees.push(tree2);
  await flush();
  expect(tree2.root.findAll((n) => n.props?.testID === 'order-scan-image')).toHaveLength(0);
  expect(JSON.stringify(tree2.toJSON())).toContain('수제비'); // 사진만 빠지고 스냅샷은 정상
});

it('P-259: ready 게이트 — false = 행 비활성+배지+리뷰 숏컷 0 · true/부재 = 현행(소스 잠금)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  const detail = fs.readFileSync('src/app/profile/order/[id].tsx', 'utf8') as string;
  expect(detail).toContain('disabled={it.foodId == null || it.ready === false}'); // 진입 비활성
  expect(detail).toContain("it.ready !== false && router.push"); // 탭 무반응
  expect(detail).toContain("t('myFoods.itemPending')"); // 준비중 배지
  // KB-434: 행별 리뷰 숏컷 → FixedBottom 단일 버튼(첫 리뷰 가능 항목) — ready 게이트 승계
  expect(detail).toContain('(it) => it.foodId != null && it.ready !== false'); // 준비중 = 리뷰 대상 제외
  // 기본 이미지 URL 문자열로 준비중 판단 금지(종한 명시) — ready 필드가 유일 기준
  expect(detail).not.toMatch(/default[-_]?food|imageUrl[^\n]*(includes|match)/);
  const hooks = fs.readFileSync('src/lib/data/useOrders.ts', 'utf8') as string;
  expect(hooks).toContain("typeof i.ready === 'boolean'"); // boolean만 통과(부재 = 공개 폴백)
  // 카피 ×10 존재
  for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi']) {
    expect(typeof JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')).myFoods.itemPending).toBe('string');
  }
});

it('read-only 잠금 — 비범위 어포던스(장소 태그·사진 교체·공유·dish 위험도) 잔존 0', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  for (const f of ['src/app/profile/my-foods.tsx', 'src/app/profile/order/[id].tsx']) {
    const src = fs.readFileSync(f, 'utf8') as string;
    // KB-434: "+ tag a place" 필 = 시안 렌더·무동작(태그 기능 부재 — 발주 규정), 금지 목록에서 해제
    for (const banned of ['Replace', 'Share', 'Download', 'RiskMark']) {
      expect(src).not.toContain(banned);
    }
    expect(src).not.toMatch(/api\.(post|patch|del)/); // read-only(조회 전용)
  }
  // 진입점(P-254: 계정 메뉴 행 — P-253 헤더 링크 소멸) + 상세 리뷰 연결 배선
  const profile = fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8') as string;
  expect(profile).toContain("'/profile/my-foods' as Href");
  expect(profile).toContain("label={t('profile.myFoods')}"); // 메뉴 행 문법(KB-434 MenuRow)
  expect(profile).not.toContain('testID="profile-my-foods"'); // 구 헤더 링크 잔존 0
  expect(fs.readFileSync('src/app/profile/order/[id].tsx', 'utf8')).toContain('/review` as Href');
});

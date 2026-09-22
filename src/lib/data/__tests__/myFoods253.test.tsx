/**
 * P-253(KB-360 1차): My Foods — 주문 훅(커서·어댑터 null 방어)·화면(세그 전환·
 * 썸네일 1~4·빈 상태·상세 라우팅)·read-only(비범위 어포던스 잔존 0).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// P-348 ⑥: PhotoViewer(RNGH·reanimated) — jest 네이티브 부재 통짜 목
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const chain = () => {
    const g: Record<string, unknown> = {};
    for (const k of ['runOnJS', 'enabled', 'numberOfTaps', 'maxPointers', 'onStart', 'onUpdate', 'onEnd', 'onFinalize', 'activeOffsetY', 'failOffsetX']) g[k] = () => g;
    return g;
  };
  return {
    GestureDetector: ({ children }: { children: unknown }) => children,
    GestureHandlerRootView: View,
    Gesture: { Pan: chain, Pinch: chain, Tap: chain, Simultaneous: (...g: unknown[]) => g, Exclusive: (...g: unknown[]) => g },
  };
});
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
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ EVENTS: { review_write_tap: 'review_write_tap', order_share_view: 'order_share_view' }, track: (...a: unknown[]) => mockTrack(...a) }));
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
// 토스트는 상태만 — 호스트 애니메이션(reanimated)은 이 파일의 목 범위 밖
jest.mock('@/components/topToastStore', () => ({ showTopToast: jest.fn(), dismissTopToast: jest.fn(), subscribeTopToast: () => () => {} }));
// KB-636(#193 P2): 저장 진행 중 닫힘 방지 검증용 — 저장 결과를 테스트가 쥐고 있다가 풀어 준다
const mockSave = jest.fn(async (): Promise<string> => 'success');
jest.mock('@/features/order/shareExport', () => ({
  saveCardToPhotos: () => mockSave(),
  shareCardToStory: async () => 'success',
  storyShareAvailable: () => true,
  lastShareErrorHint: () => null,
}));

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

it('KB-434 → P-369 ③: roadAddress null = 날짜 제목 + items 필만(무동작 장소 필 소멸)', async () => {
  mockGet.mockResolvedValue({ items: [ORDER({ roadAddress: null })], hasNext: false, nextCursor: null });
  const tree = renderScreen();
  await flush();
  expect(tree.root.findAll((n) => n.props?.testID === 'order-tag-place-123')).toHaveLength(0); // 필 소멸
  expect(tree.root.findAll((n) => n.props?.testID === 'order-date-title-123').length).toBeGreaterThanOrEqual(1); // 제목 = 날짜
  expect(flat(tree)).not.toContain('소공로');
});

it('P-287: 빈 상태 — 주문 0건 = 공용 EmptyBlock(circle-dashed·버튼 없음, 탭 유지)', async () => {
  mockGet.mockResolvedValue({ items: [], hasNext: false, nextCursor: null });
  const tree = renderScreen();
  await flush();
  const s = flat(tree);
  expect(tree.root.findAll((n) => n.props?.testID === 'orders-empty').length).toBeGreaterThanOrEqual(1);
  expect(s).toContain('myFoods.emptyOrdersTitle');
  expect(s).not.toContain('community.goScanCta'); // 시안 = 버튼 없음(CTA 소멸)
  expect(s).toContain('myfoods-tab-ordered'); // 탭 유지
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
  expect(tree.root.findAll((n) => n.props?.testID === 'viewer-close').length).toBeGreaterThanOrEqual(1); // 풀스크린 뷰어(P-348 공용 PhotoViewer)

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
  // KB-636: 리뷰 숏컷(Write a review) 자체가 제거됨 — 준비중 항목의 리뷰 진입 경로 0은 행 비활성(위)으로 충족
  expect(detail).not.toContain('order-write-review');
  // 기본 이미지 URL 문자열로 준비중 판단 금지(종한 명시) — ready 필드가 유일 기준
  expect(detail).not.toMatch(/default[-_]?food|imageUrl[^\n]*(includes|match)/);
  const hooks = fs.readFileSync('src/lib/data/useOrders.ts', 'utf8') as string;
  expect(hooks).toContain("typeof i.ready === 'boolean'"); // boolean만 통과(부재 = 공개 폴백)
  // 카피 ×10 존재
  for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi']) {
    expect(typeof JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')).myFoods.itemPending).toBe('string');
  }
});

it('read-only 잠금 — 비범위 어포던스(장소 태그·사진 교체·dish 위험도) 잔존 0', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  for (const f of ['src/app/profile/my-foods.tsx', 'src/app/profile/order/[id].tsx']) {
    const src = fs.readFileSync(f, 'utf8') as string;
    // KB-434: "+ tag a place" 필 = 시안 렌더·무동작(태그 기능 부재 — 발주 규정), 금지 목록에서 해제
    // P-380(KB-518): 공유는 **도입됐다** — Share/Download 금지 해제(상세 하단 공유 섹션).
    // 나머지 read-only 계약(사진 교체·주문 수정 API)은 그대로다.
    for (const banned of ['Replace', 'RiskMark']) {
      expect(src).not.toContain(banned);
    }
    expect(src).not.toMatch(/api\.(post|patch|del)/); // read-only(조회 전용)
  }
  // 공유 섹션은 상세에만(목록 화면은 여전히 공유 어포던스 0)
  expect(fs.readFileSync('src/app/profile/my-foods.tsx', 'utf8')).not.toContain('Share');
  expect(fs.readFileSync('src/app/profile/order/[id].tsx', 'utf8')).toContain('<OrderShareSection');
  // 진입점(P-254: 계정 메뉴 행 — P-253 헤더 링크 소멸) + 상세 리뷰 연결 배선
  const profile = fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8') as string;
  expect(profile).toContain("'/profile/my-foods' as Href");
  expect(profile).toContain("label={t('profile.myFoods')}"); // 메뉴 행 문법(KB-434 MenuRow)
  expect(profile).not.toContain('testID="profile-my-foods"'); // 구 헤더 링크 잔존 0
  // KB-636: 주문 상세 → 리뷰 작성 직행 배선 제거(리뷰 진입 = 항목 행 → 음식 상세)
  expect(fs.readFileSync('src/app/profile/order/[id].tsx', 'utf8')).not.toContain('/review` as Href');
});

/* ---- KB-636(P-409, 예진 b36 실기): 공유 카드 = 시트. 본문 = 메뉴판·영수증·항목까지 ---- */
const SHARE_ORDER = {
  orderId: 123, orderedAt: 1765700640000, roadAddress: null, totalQuantity: 2, totalPrice: 12000,
  items: [
    { menuName: '순두부찌개', quantity: 1, price: 9000, foodId: 7, imageRef: 'https://cdn.example.com/a.webp', ready: true },
    { menuName: '공기밥', quantity: 1, price: 1000, foodId: 8, imageRef: 'https://cdn.example.com/b.webp', ready: true },
  ],
};
async function renderOrder(order: unknown): Promise<ReactTestRenderer> {
  mockGet.mockImplementation(async (path: string) => (path === '/api/orders/123' ? order : { items: [], hasNext: false, nextCursor: null }));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <OrderDetailScreen />
      </QueryClientProvider>,
    );
  });
  trees.push(tree);
  await flush();
  return tree;
}
const byTid = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id);
const press = (tree: ReactTestRenderer, id: string) =>
  act(() => { byTid(tree, id).find((n) => typeof n.props?.onPress === 'function')!.props.onPress(); });

describe('KB-636 공유 카드 시트', () => {
  beforeEach(() => mockTrack.mockClear());

  it('닫힘(기본) = 카드 미리보기·캡처 캔버스 **미마운트**(이미지 요청 0) · 노출 계측 0 · 하단 = Download image', async () => {
    const tree = await renderOrder(SHARE_ORDER);
    expect(byTid(tree, 'order-item-0').length).toBeGreaterThan(0); // 대조: 본문(항목)은 렌더됐다
    expect(byTid(tree, 'order-share-section')).toHaveLength(0);
    expect(byTid(tree, 'order-share-export-canvas')).toHaveLength(0);
    expect(byTid(tree, 'order-share-sheet')).toHaveLength(0);
    expect(mockTrack).not.toHaveBeenCalledWith('order_share_view', expect.anything());
    const btn = byTid(tree, 'order-share-open')[0];
    expect(btn).toBeTruthy();
    expect(btn.findAll((n) => n.props?.children === 'myFoods.shareDownloadInline').length).toBeGreaterThan(0); // P-411: 1줄 전용 키
  });

  it('열림 = 시트 안에 카드 + 캡처 캔버스 + 저장·스토리 버튼 · 노출 1회(다시 열어도 주문당 1회)', async () => {
    const tree = await renderOrder(SHARE_ORDER);
    press(tree, 'order-share-open');
    const sheet = byTid(tree, 'order-share-sheet')[0];
    expect(sheet).toBeTruthy();
    expect(sheet.findAll((n) => n.props?.testID === 'order-share-section').length).toBeGreaterThan(0);
    expect(sheet.findAll((n) => n.props?.testID === 'order-share-export-canvas').length).toBeGreaterThan(0);
    expect(sheet.findAll((n) => n.props?.testID === 'share-download').length).toBeGreaterThan(0);
    expect(mockTrack.mock.calls.filter((c) => c[0] === 'order_share_view')).toHaveLength(1);
    expect(mockTrack).toHaveBeenCalledWith('order_share_view', { item_count: 2, has_place: false });
    // 닫기(스크림 탭 = onRequestClose와 같은 onClose) → 다시 열기 — 노출은 그대로 1회
    const modal = tree.root.findAll((n) => typeof n.props?.onRequestClose === 'function' && n.props?.visible === true)[0];
    act(() => { modal.props.onRequestClose(); });
    expect(byTid(tree, 'order-share-sheet')).toHaveLength(0); // 닫힘 = 카드·캔버스 언마운트
    press(tree, 'order-share-open');
    expect(mockTrack.mock.calls.filter((c) => c[0] === 'order_share_view')).toHaveLength(1);
  });

  /* Codex #193 P2: 저장·스토리 진행 중 스크림 탭 → 캔버스 언마운트 → captureRef null → 실패. 진행 중엔 닫기 무시. */
  it('저장 진행 중엔 닫히지 않는다(캔버스 유지) · 끝나면 닫힌다', async () => {
    let finish!: (r: string) => void;
    mockSave.mockImplementationOnce(() => new Promise<string>((res) => (finish = res)));
    const tree = await renderOrder(SHARE_ORDER);
    press(tree, 'order-share-open');
    const close = () => act(() => {
      tree.root.findAll((n) => typeof n.props?.onRequestClose === 'function' && n.props?.visible === true)[0].props.onRequestClose();
    });
    act(() => { void byTid(tree, 'share-download').find((n) => typeof n.props?.onPress === 'function')!.props.onPress(); });
    expect(mockSave).toHaveBeenCalledTimes(1); // 대조: 저장이 실제로 진행 중
    close();
    expect(byTid(tree, 'order-share-export-canvas').length).toBeGreaterThan(0); // 캡처 대상 유지
    await act(async () => { finish('success'); await Promise.resolve(); });
    close();
    expect(byTid(tree, 'order-share-sheet')).toHaveLength(0); // 끝난 뒤엔 정상 닫힘
  });

  /* P-411(KB-636 후속, 예진 b36 실기): 하단 고정 바 → 가로 꽉 찬 주황 플로팅 알약(문의 "+ New"와 같은 형태). */
  it('P-411 알약 — 좌우 20 · h52 · r26 · C.primary · 하 인셋+24 · 라벨 17/600 흰색 1줄 · 고정 바·보더 없음 · 목록 하 96+인셋', async () => {
    const tree = await renderOrder(SHARE_ORDER);
    const host = tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'order-share-open')[0];
    const flat = (st: unknown) => Object.assign({}, ...[st].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
    expect(flat(host.props.style)).toMatchObject({
      position: 'absolute', left: 20, right: 20, height: 52, borderRadius: 26, backgroundColor: '#FF7134', bottom: 24, // 인셋 0(목) + 24
    });
    expect(flat(host.props.style).borderWidth).toBeUndefined(); // outline(ghost) 아님
    const label = host.findAll((n) => typeof n.type === 'string' && n.props.children === 'myFoods.shareDownloadInline')[0];
    expect(label.props.numberOfLines).toBe(1);
    expect(flat(label.props.style)).toMatchObject({ fontSize: 17, fontWeight: '600', color: '#FFFFFF' });
    expect(byTid(tree, 'order-bottom-bar')).toHaveLength(0); // 하단 고정 바·구분선 소멸
    const scroll = tree.root.findAll((n) => typeof n.type === 'string' && n.props.contentContainerStyle)[0];
    expect(flat(scroll.props.contentContainerStyle).paddingBottom).toBe(96); // 96 + 인셋(0)
  });

  it('P-411 1줄 라벨 키 10로케일 — 줄바꿈 없음 · 기존 2줄 키는 시트 버튼용 그대로', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es']) {
      const mf = JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')).myFoods;
      expect(typeof mf.shareDownloadInline).toBe('string');
      expect(mf.shareDownloadInline).not.toContain('\n');
      expect(mf.shareDownload).toContain('\n'); // 시트 버튼 2줄 고정(shareCard518과 같은 잠금)
    }
  });

  it('사진 0장 주문 = 하단 버튼 없음(빈 카드 금지 — P-380) · Write a review·음식 선택 시트 부재', async () => {
    const tree = await renderOrder({
      ...SHARE_ORDER,
      items: SHARE_ORDER.items.map((it) => ({ ...it, imageRef: null })),
    });
    expect(byTid(tree, 'order-item-0').length).toBeGreaterThan(0); // 대조
    expect(byTid(tree, 'order-share-open')).toHaveLength(0);
    expect(byTid(tree, 'order-bottom-bar')).toHaveLength(0);
    expect(byTid(tree, 'order-write-review')).toHaveLength(0);
    expect(byTid(tree, 'order-dish-sheet')).toHaveLength(0);
  });
});

describe('P-386(KB-456): 장소 라벨 = 식당명 → 주소 → 미렌더', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { orderPlaceLabel } = require('../useOrders') as typeof import('../useOrders');

  it('규칙 3분기 — 식당명 우선 · 없으면 주소 · 둘 다 없으면 null(빈 줄 금지)', () => {
    expect(orderPlaceLabel({ placeName: '홍대 김치집', roadAddress: '서울 중구 소공로 51' })).toBe('홍대 김치집');
    expect(orderPlaceLabel({ placeName: null, roadAddress: '서울 중구 소공로 51' })).toBe('서울 중구 소공로 51');
    expect(orderPlaceLabel({ placeName: null, roadAddress: null })).toBeNull();
    expect(orderPlaceLabel({})).toBeNull();
    expect(orderPlaceLabel({ placeName: '   ', roadAddress: '  ' })).toBeNull(); // 공백뿐 = 없음
  });

  async function ordersData() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    let data: ReturnType<typeof useOrders>['data'];
    function H() {
      data = useOrders().data;
      return null;
    }
    await act(async () => {
      renderer.create(
        <QueryClientProvider client={qc}>
          <H />
        </QueryClientProvider>,
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    for (let i = 0; i < 5 && data === undefined; i++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    }
    return data!;
  }

  it('어댑터 — place.name 매핑 · place null/부재(prod 구응답) = placeName null', async () => {
    mockGet.mockResolvedValue({ items: [ORDER({ place: { placeId: 'p1', name: '홍대 김치집', address: '서울 마포구', language: 'ko' } })], hasNext: false, nextCursor: null });
    expect((await ordersData())[0].placeName).toBe('홍대 김치집');

    mockGet.mockResolvedValue({ items: [ORDER({ place: null }), ORDER({ orderId: 124 })], hasNext: false, nextCursor: null });
    expect((await ordersData()).every((o) => o.placeName === null)).toBe(true);
  });

  it('주문 행 — 식당명이 있으면 주소 대신 식당명이 보인다', async () => {
    mockGet.mockResolvedValue({
      items: [ORDER({ place: { placeId: 'p1', name: '홍대 김치집', address: '서울 마포구', language: 'ko' } })],
      hasNext: false, nextCursor: null,
    });
    const tree = renderScreen();
    await flush();
    // 렌더된 텍스트 노드만 검사 — FlatList data prop 직렬화에는 원본 roadAddress가 남는다
    const texts = tree.root.findAll((n) => typeof n.type === 'string' && typeof n.props?.children === 'string').map((n) => n.props.children as string);
    expect(texts).toContain('홍대 김치집');
    expect(texts).not.toContain('서울 중구 소공로 51'); // roadAddress 폴백은 이때 쓰이지 않는다
  });
});

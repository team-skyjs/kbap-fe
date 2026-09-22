/**
 * KB-638(P-413) — 주문 편집 데이터 층.
 * ① 어댑터: id·userImageUrl 통과(구응답 부재 = null) · 편집 응답도 같은 어댑터
 * ② 표시 헬퍼 orderItemImage = 회원 사진 > 카탈로그 — 상세·공유 카드 둘 다 이 한 곳(sharePhotos 우회 금지)
 * ③ 뮤테이션: PATCH 페이로드(placeId·name·address?·language) / PUT = 업로드(ORDER_ITEM) → imagePath / DELETE
 *    → 응답으로 상세 캐시 **교체** + 목록 무효화 · **낙관 갱신 없음**(응답 전 캐시 무변) · 실패 = 캐시 원상태 + 토스트
 * ④ 토스트 분기: IMAGE-007 / ORDER-002·ORDER-004 / 그 외
 *
 * ApiError·adaptOrderDetail은 실물 — 네트워크(api.*)와 업로드만 목.
 */
/* eslint-disable import/first --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 뒤여야 목이 걸린다(팩토리 호이스팅). 레포 관례(subHeaderTitleCenter403). */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
const mockPatch = jest.fn();
const mockPut = jest.fn();
const mockDel = jest.fn();
jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual('@/lib/api/client') as Record<string, unknown>;
  return {
    ...actual,
    api: { get: jest.fn(), post: jest.fn(), patch: (...a: unknown[]) => mockPatch(...a), put: (...a: unknown[]) => mockPut(...a), del: (...a: unknown[]) => mockDel(...a) },
    apiLang: () => 'ja',
  };
});
const mockUpload = jest.fn();
jest.mock('@/lib/api/scanImage', () => ({ uploadImage: (...a: unknown[]) => mockUpload(...a) }));
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a) }));

import { ApiError } from '@/lib/api/client';
import { adaptOrderDetail, orderItemImage, type OrderDetail } from '../useOrders';
import { orderEditErrorKey, useResetOrderItemImage, useSetOrderItemImage, useUpdateOrderPlace, ORDER_ITEM_IMAGE_PURPOSE } from '../useOrderEdit';
import { sharePhotos } from '@/features/order/shareCard';

const WIRE = {
  orderId: 123, orderedAt: 1765700640000, roadAddress: null, totalQuantity: 1, totalPrice: 9000, scanImageUrl: null,
  place: { placeId: 'g1', name: 'Old Place', address: 'Seoul', language: 'en' },
  items: [{ id: 7001, menuName: '순두부찌개', quantity: 1, price: 9000, foodId: 7, imageRef: 'https://cdn/catalog.jpg', ready: true, hasPhoto: true, userImageUrl: null }],
};

/* ---- ① 어댑터 ---- */
it('① 어댑터 — id·userImageUrl 통과, 구응답(둘 다 부재) = null · 비-URL userImageUrl은 차단', () => {
  const d = adaptOrderDetail(WIRE as never);
  expect(d.items[0]).toMatchObject({ id: '7001', userImageUrl: null, imageUrl: 'https://cdn/catalog.jpg' });
  const old = adaptOrderDetail({ ...WIRE, items: [{ menuName: 'x', quantity: 1, foodId: 7, imageRef: 'https://cdn/c.jpg' }] } as never);
  expect(old.items[0]).toMatchObject({ id: null, userImageUrl: null });
  const bad = adaptOrderDetail({ ...WIRE, items: [{ ...WIRE.items[0], userImageUrl: 'orders/abc.jpg' }] } as never);
  expect(bad.items[0].userImageUrl).toBeNull(); // 절대 URL만(refToUrl 규칙)
});

/* ---- ② 표시 헬퍼 ---- */
describe('② orderItemImage — 회원 사진 > 카탈로그', () => {
  it('회원 사진 있으면 그것 · 없으면 카탈로그 · 둘 다 없으면 null', () => {
    expect(orderItemImage({ userImageUrl: 'https://cdn/me.jpg', imageUrl: 'https://cdn/c.jpg' })).toBe('https://cdn/me.jpg');
    expect(orderItemImage({ userImageUrl: null, imageUrl: 'https://cdn/c.jpg' })).toBe('https://cdn/c.jpg');
    expect(orderItemImage({ imageUrl: null })).toBeNull();
  });

  it('공유 카드 sharePhotos — 회원 사진은 ready·hasPhoto 필터를 **통과**, 카탈로그는 기존 필터 그대로', () => {
    const items = [
      { imageUrl: 'https://cdn/c1.jpg', userImageUrl: 'https://cdn/me1.jpg', ready: false, hasPhoto: false }, // 준비중·사진 없음이어도 내 사진
      { imageUrl: 'https://cdn/c2.jpg', userImageUrl: null, ready: true, hasPhoto: true }, // 카탈로그 실사진
      { imageUrl: 'https://cdn/c3.jpg', userImageUrl: null, ready: true, hasPhoto: false }, // 대체 이미지 — 제외(기존)
      { imageUrl: 'https://cdn/c4.jpg', userImageUrl: null, ready: false }, // 준비중 — 제외(기존)
    ];
    expect(sharePhotos(items)).toEqual(['https://cdn/me1.jpg', 'https://cdn/c2.jpg']);
  });

  it('소스 잠금 — 상세 썸네일·sharePhotos 둘 다 헬퍼 경유(imageUrl 직결 0)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    const detail = fs.readFileSync('src/app/profile/order/[id].tsx', 'utf8') as string;
    expect(detail).toContain('orderItemImage(it)');
    expect(detail).not.toMatch(/uri=\{it\.imageUrl\}/);
    const share = fs.readFileSync('src/features/order/shareCard.ts', 'utf8') as string;
    expect(share).toContain('.map((it) => orderItemImage(it) as string)');
  });
});

/* ---- ③ 뮤테이션 ---- */
type Hooks = { place: ReturnType<typeof useUpdateOrderPlace>; set: ReturnType<typeof useSetOrderItemImage>; reset: ReturnType<typeof useResetOrderItemImage> };
async function mount(seed?: OrderDetail): Promise<{ qc: QueryClient; hooks: () => Hooks }> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (seed) qc.setQueryData(['orders', seed.orderId], seed);
  qc.setQueryData(['orders'], { pages: [], pageParams: [] }); // 목록 캐시(무효화 대상)
  let h!: Hooks;
  function Harness() {
    h = { place: useUpdateOrderPlace(), set: useSetOrderItemImage(), reset: useResetOrderItemImage() };
    return null;
  }
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  return { qc, hooks: () => h };
}
const SEED = adaptOrderDetail(WIRE as never);
const UPDATED = { ...WIRE, place: { ...WIRE.place, placeId: 'g2', name: 'New Place' }, items: [{ ...WIRE.items[0], userImageUrl: 'https://cdn/me.jpg' }] };
const listStale = (qc: QueryClient) => qc.getQueryState(['orders'])?.isInvalidated === true;

beforeEach(() => { mockPatch.mockReset(); mockPut.mockReset(); mockDel.mockReset(); mockUpload.mockReset(); mockToast.mockReset(); });

describe('③ 장소 교체 PATCH', () => {
  it('페이로드 = placeId·name·address·language(=apiLang) · 응답으로 상세 캐시 교체 + 목록 무효화', async () => {
    mockPatch.mockResolvedValueOnce(UPDATED);
    const { qc, hooks } = await mount(SEED);
    await act(async () => { await hooks().place.mutateAsync({ orderId: '123', place: { placeId: 'g2', name: 'New Place', roadAddress: 'Busan' } }); });
    expect(mockPatch).toHaveBeenCalledWith('/api/orders/123/place', { placeId: 'g2', name: 'New Place', address: 'Busan', language: 'ja' });
    expect(qc.getQueryData<OrderDetail>(['orders', '123'])?.placeName).toBe('New Place');
    expect(listStale(qc)).toBe(true);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('주소 없는 결과 = address 키 생략(빈 문자열·null 전송 금지)', async () => {
    mockPatch.mockResolvedValueOnce(UPDATED);
    const { hooks } = await mount(SEED);
    await act(async () => { await hooks().place.mutateAsync({ orderId: '123', place: { placeId: 'g2', name: 'New Place', roadAddress: null } }); });
    expect(mockPatch.mock.calls[0][1]).toEqual({ placeId: 'g2', name: 'New Place', language: 'ja' });
  });

  it('응답 전엔 캐시 무변(낙관 갱신 0) · 실패 = 캐시 원상태 + 토스트 1회', async () => {
    let reject!: (e: unknown) => void;
    mockPatch.mockReturnValueOnce(new Promise((_r, rj) => (reject = rj)));
    const { qc, hooks } = await mount(SEED);
    let p!: Promise<unknown>;
    act(() => { p = hooks().place.mutateAsync({ orderId: '123', place: { placeId: 'g2', name: 'New Place', roadAddress: null } }).catch(() => {}); });
    expect(qc.getQueryData<OrderDetail>(['orders', '123'])?.placeName).toBe('Old Place'); // 대기 중 — 그대로
    await act(async () => { reject(new ApiError('nope', 404, 'ORDER-002')); await p; });
    expect(qc.getQueryData<OrderDetail>(['orders', '123'])?.placeName).toBe('Old Place');
    expect(listStale(qc)).toBe(false);
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith('myFoods.editNotFound', { error: true });
  });
});

describe('③ 항목 사진 PUT / DELETE', () => {
  it('업로드(purpose ORDER_ITEM) → PUT {imagePath} → 응답 반영(userImageUrl)', async () => {
    mockUpload.mockResolvedValueOnce({ path: 'orders/abc.jpg', publicUrl: 'https://cdn/abc.jpg' });
    mockPut.mockResolvedValueOnce(UPDATED);
    const { qc, hooks } = await mount(SEED);
    await act(async () => { await hooks().set.mutateAsync({ orderId: '123', itemId: '7001', uri: 'file:///tmp/p.jpg' }); });
    expect(mockUpload).toHaveBeenCalledWith({ uri: 'file:///tmp/p.jpg', width: 0, height: 0 }, ORDER_ITEM_IMAGE_PURPOSE);
    expect(ORDER_ITEM_IMAGE_PURPOSE).toBe('ORDER_ITEM');
    expect(mockPut).toHaveBeenCalledWith('/api/orders/123/items/7001/image', { imagePath: 'orders/abc.jpg' });
    expect(qc.getQueryData<OrderDetail>(['orders', '123'])?.items[0].userImageUrl).toBe('https://cdn/me.jpg');
    expect(listStale(qc)).toBe(true);
  });

  it('업로드 실패 = PUT 0 · 캐시 원상태 · 일반 실패 토스트', async () => {
    mockUpload.mockRejectedValueOnce(new Error('storage PUT 500'));
    const { qc, hooks } = await mount(SEED);
    await act(async () => { await hooks().set.mutateAsync({ orderId: '123', itemId: '7001', uri: 'file:///x' }).catch(() => {}); });
    expect(mockPut).not.toHaveBeenCalled();
    expect(qc.getQueryData<OrderDetail>(['orders', '123'])?.items[0].userImageUrl).toBeNull();
    expect(mockToast).toHaveBeenCalledWith('myFoods.editFailed', { error: true });
  });

  it('PUT 400 IMAGE-007 = 전용 토스트 · ORDER-004 = 없음 토스트', async () => {
    mockUpload.mockResolvedValue({ path: 'orders/abc.jpg', publicUrl: 'x' });
    mockPut.mockRejectedValueOnce(new ApiError('not yours', 400, 'IMAGE-007'));
    const { hooks } = await mount(SEED);
    await act(async () => { await hooks().set.mutateAsync({ orderId: '123', itemId: '7001', uri: 'file:///x' }).catch(() => {}); });
    expect(mockToast).toHaveBeenLastCalledWith('myFoods.editPhotoNotReady', { error: true });
    mockPut.mockRejectedValueOnce(new ApiError('no item', 404, 'ORDER-004'));
    await act(async () => { await hooks().set.mutateAsync({ orderId: '123', itemId: '9999', uri: 'file:///x' }).catch(() => {}); });
    expect(mockToast).toHaveBeenLastCalledWith('myFoods.editNotFound', { error: true });
  });

  it('기본 사진으로 = DELETE 같은 경로 · 응답(userImageUrl null) 반영', async () => {
    mockDel.mockResolvedValueOnce(WIRE);
    const { qc, hooks } = await mount({ ...SEED, items: [{ ...SEED.items[0], userImageUrl: 'https://cdn/me.jpg' }] });
    await act(async () => { await hooks().reset.mutateAsync({ orderId: '123', itemId: '7001' }); });
    expect(mockDel).toHaveBeenCalledWith('/api/orders/123/items/7001/image');
    expect(qc.getQueryData<OrderDetail>(['orders', '123'])?.items[0].userImageUrl).toBeNull();
    expect(listStale(qc)).toBe(true);
  });
});

/* ---- ④ 토스트 분기(순수) ---- */
it('④ orderEditErrorKey — 코드로만 분기(status 무관) · 네트워크·비ApiError = 일반 실패', () => {
  expect(orderEditErrorKey(new ApiError('x', 400, 'IMAGE-007'))).toBe('myFoods.editPhotoNotReady');
  expect(orderEditErrorKey(new ApiError('x', 404, 'ORDER-002'))).toBe('myFoods.editNotFound');
  expect(orderEditErrorKey(new ApiError('x', 404, 'ORDER-004'))).toBe('myFoods.editNotFound');
  expect(orderEditErrorKey(new ApiError('x', 400, 'COMMON-002'))).toBe('myFoods.editFailed');
  expect(orderEditErrorKey(new ApiError('x', 404))).toBe('myFoods.editFailed'); // 404여도 코드 없으면 일반
  expect(orderEditErrorKey(new Error('NETWORK: timeout'))).toBe('myFoods.editFailed');
});

it('i18n — 편집 키 5종 10로케일 · ko 대시(—) 없음', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es']) {
    const mf = JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')).myFoods as Record<string, string>;
    for (const k of ['itemPhotoTitle', 'itemPhotoDefault', 'editFailed', 'editPhotoNotReady', 'editNotFound']) expect(typeof mf[k]).toBe('string');
    if (l === 'ko') for (const k of ['itemPhotoTitle', 'itemPhotoDefault', 'editFailed', 'editPhotoNotReady', 'editNotFound']) expect(mf[k]).not.toContain('—');
  }
});

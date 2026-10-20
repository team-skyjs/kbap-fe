/**
 * KB-821 — 음식 탭·저장 이름 정렬(서버 3.1). 이름 정렬만 `X-API-Version: 3.1` + `sort`·불투명 커서 그대로,
 * 기본 정렬은 기존 요청 그대로, 400 FOOD-002 · 409 FOOD-022 = 첫 페이지부터 조용히(에러 상태 0).
 */
import * as fs from 'fs';
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('@/lib/i18n/useAppLanguage', () => ({ useAppLanguage: () => 'en' }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/components/topToastStore', () => ({ showTopToast: jest.fn() }));
jest.mock('@/lib/airbridge', () => ({ airbridge: {} }));
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => {
  class MockApiError extends Error {
    status?: number; code?: string;
    constructor(m: string, s?: number, c?: string) { super(m); this.status = s; this.code = c; }
  }
  return { api: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn(), patch: jest.fn() }, apiLang: () => 'en', ApiError: MockApiError, foodHiddenReason: () => null };
});

/* eslint-disable import/first -- jest.mock 뒤 */
import { ApiError } from '@/lib/api/client';
import { useInfiniteFoods } from '../useFoods';
import { useBookmarks } from '../bookmarks';
import type { FoodNameSort } from '../foodNameSort';
/* eslint-enable import/first */

const WIRE = (id: number) => ({ foodId: id, name: `F${id}`, koreanName: `푸${id}`, imageRef: null, spiciness: 0, overallRiskStatus: 'SAFE' });
type Q = { data?: { foodId: string }[]; isError: boolean; hasNextPage: boolean; fetchNextPage: () => Promise<unknown> };
const flush = () => act(async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); });
const trees: ReactTestRenderer[] = [];
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); mockGet.mockReset(); });

function mount(use: () => Q) {
  const ref: { q?: Q } = {};
  function Probe() { ref.q = use(); return null; }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => { trees.push(renderer.create(<QueryClientProvider client={qc}><Probe /></QueryClientProvider>)); });
  return ref;
}
const call = (i: number) => mockGet.mock.calls[i] as [string, { headers?: Record<string, string> } | undefined];

it('기본 정렬 = 기존 요청 그대로(3.1 헤더·sort 없음, 숫자 커서 그대로)', async () => {
  mockGet.mockResolvedValueOnce({ items: [WIRE(2)], hasNext: true, nextCursor: 42 }).mockResolvedValueOnce({ items: [WIRE(1)], hasNext: false, nextCursor: null });
  const ref = mount(() => useInfiniteFoods() as unknown as Q);
  await flush();
  await act(async () => { await ref.q!.fetchNextPage(); }); await flush();
  expect(call(0)[0]).toBe('/foods?lang=en');
  expect(call(1)[0]).toBe('/foods?cursor=42&lang=en');
  for (const i of [0, 1]) expect(call(i)[1]?.headers).toBeUndefined();
});

it.each<[FoodNameSort]>([['name_asc'], ['name_desc']])('음식 %s = 3.1 헤더 + sort · 불투명 커서 그대로', async (sort) => {
  const opaque = 'eyJ2IjozLCJrIjoi6rCAIn0=/x+y';
  mockGet.mockResolvedValueOnce({ items: [WIRE(1)], hasNext: true, nextCursor: opaque }).mockResolvedValueOnce({ items: [WIRE(2)], hasNext: false, nextCursor: null });
  const ref = mount(() => useInfiniteFoods(undefined, { sort }) as unknown as Q);
  await flush();
  await act(async () => { await ref.q!.fetchNextPage(); }); await flush();
  expect(call(0)[0]).toBe(`/foods?lang=en&sort=${sort}`);
  expect(call(1)[0]).toBe(`/foods?cursor=${encodeURIComponent(opaque)}&lang=en&sort=${sort}`);
  for (const i of [0, 1]) expect(call(i)[1]).toEqual({ headers: { 'X-API-Version': '3.1' } });
});

it('저장 목록 = 같은 규칙(기본 무변 · 이름 정렬만 3.1 + sort, 위험도 필터 조합)', async () => {
  mockGet.mockResolvedValue({ items: [WIRE(1)], hasNext: false, nextCursor: null });
  mount(() => useBookmarks() as unknown as Q);
  mount(() => useBookmarks('safe', { sort: 'name_desc' }) as unknown as Q);
  await flush();
  const urls = mockGet.mock.calls.map((c) => c[0] as string);
  expect(urls).toContain('/bookmarks?lang=en');
  const sorted = mockGet.mock.calls.find((c) => (c[0] as string).includes('sort='))!;
  expect(sorted[0]).toMatch(/^\/bookmarks\?lang=en&risk=[A-Z,]+&sort=name_desc$/);
  expect(sorted[1]).toEqual({ headers: { 'X-API-Version': '3.1' } });
  expect(mockGet.mock.calls.find((c) => c[0] === '/bookmarks?lang=en')![1]).toBeUndefined();
});

it.each([['FOOD-022', 409], ['FOOD-002', 400]])('다음 페이지 %s = 첫 페이지부터 조용히 재조회(에러 상태 0 · 중복 0)', async (code, status) => {
  mockGet
    .mockResolvedValueOnce({ items: [WIRE(1), WIRE(2)], hasNext: true, nextCursor: 'c1' })
    .mockRejectedValueOnce(new ApiError('changed', status as number, code as string))
    .mockResolvedValueOnce({ items: [WIRE(1), WIRE(3)], hasNext: false, nextCursor: null }); // 목록이 바뀐 새 첫 페이지
  const ref = mount(() => useInfiniteFoods(undefined, { sort: 'name_asc' }) as unknown as Q);
  await flush();
  await act(async () => { await ref.q!.fetchNextPage(); }); await flush(); await flush();
  expect(mockGet.mock.calls.map((c) => c[0])).toEqual(['/foods?lang=en&sort=name_asc', '/foods?cursor=c1&lang=en&sort=name_asc', '/foods?lang=en&sort=name_asc']);
  expect(ref.q!.isError).toBe(false);
  expect(ref.q!.data!.map((f) => f.foodId)).toEqual(['1', '3']); // 앞 페이지와 섞이지 않음
});

it('첫 페이지 409 = 한 번 바로 재요청 · 다른 오류는 그대로 에러', async () => {
  mockGet.mockRejectedValueOnce(new ApiError('changed', 409, 'FOOD-022')).mockResolvedValueOnce({ items: [WIRE(5)], hasNext: false, nextCursor: null });
  const ok = mount(() => useInfiniteFoods(undefined, { sort: 'name_desc' }) as unknown as Q);
  await flush();
  expect(mockGet).toHaveBeenCalledTimes(2);
  expect(ok.q!.data!.map((f) => f.foodId)).toEqual(['5']);
  mockGet.mockReset();
  mockGet.mockRejectedValueOnce(new ApiError('boom', 500, 'COMMON-001'));
  const bad = mount(() => useBookmarks(undefined, { sort: 'name_asc' }) as unknown as Q);
  for (let i = 0; i < 40 && (bad.q as unknown as { status: string }).status !== 'error'; i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  expect((bad.q as unknown as { status: string }).status).toBe('error');
});

it('위험도 필터의 빈 중간 페이지 = 서버가 준 다음 커서로 계속', async () => {
  mockGet
    .mockResolvedValueOnce({ items: [], hasNext: true, nextCursor: 'c-empty' })
    .mockResolvedValueOnce({ items: [WIRE(7)], hasNext: false, nextCursor: null });
  const ref = mount(() => useInfiniteFoods('safe', { sort: 'name_asc' }) as unknown as Q);
  await flush();
  expect(ref.q!.hasNextPage).toBe(true);
  await act(async () => { await ref.q!.fetchNextPage(); }); await flush();
  expect(call(1)[0]).toMatch(/cursor=c-empty&lang=en&risk=[A-Z,]+&sort=name_asc$/);
  expect(ref.q!.data!.map((f) => f.foodId)).toEqual(['7']);
});

it('정렬 시트 = 기존 항목·기본값 불변 + 이름 정순·역순 · 세션 내 유지 · 북마크 판정 소스는 기본 정렬 · 10언어 라벨', () => {
  const src = fs.readFileSync('src/features/food/FoodExplorer.tsx', 'utf8');
  expect(src).toContain("const FOOD_SORTS: FoodSort[] = ['popular', 'new', 'name_asc', 'name_desc'];");
  expect(src).toContain("let sessionSort: FoodSort = 'popular';");
  // Codex #299 P2: 기억된 정렬·이름 정렬은 음식 탭(screen)만 — 홈(embedded)은 기본 순서
  expect(src).toContain("const sortable = variant === 'screen';");
  expect(src).toContain("React.useState<FoodSort>(() => (sortable ? sessionSort : 'popular'))");
  expect(src).toContain('const nameSort = sortable ? nameSortOf(sort) : undefined;');
  expect(src).toContain('const saved = useBookmarks(undefined, { enabled: bookmarksOn });');
  for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi']) {
    const food = JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')).food as Record<string, string>;
    expect(food.sort_name_asc).toBeTruthy();
    expect(food.sort_name_desc).toBeTruthy();
    expect(food.sort_name_asc).not.toBe(food.sort_name_desc);
    expect(food.sort_name_asc + food.sort_name_desc).not.toContain('·');
  }
});

/**
 * KB-722(P-452 ③) — 검색 커서는 불투명: 숫자가 아닌 nextCursor(KB-721 관련도 정렬 뒤 형식 변경)가 와도 그대로 되돌려 보낸다.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/i18n/useAppLanguage', () => ({ useAppLanguage: () => 'en' }));
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => ({ apiLang: () => 'en', api: { get: (...a: unknown[]) => mockGet(...a) } }));

// eslint-disable-next-line import/first -- jest.mock 선언 뒤(팩토리 호이스팅) — 레포 관례
import { useSearchFoods } from '../useFoods';

type Q = ReturnType<typeof useSearchFoods>;
const seen = jest.fn<void, [Q]>();
function Probe() {
  seen(useSearchFoods('kimchi'));
  return null;
}
const latest = () => seen.mock.calls.at(-1)![0];
// TanStack notifyManager는 setTimeout(0)(매크로태스크)로 구독자에게 알린다 — 마이크로태스크만 비우면 상태를 읽는 시점이 운에 걸린다(#241 CI 재현).
// 조건이 될 때까지 실제 타이머 한 틱씩 기다린다(상한 있음).
const waitUntil = async (cond: () => boolean) => {
  for (let i = 0; i < 100 && !cond(); i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  expect(cond()).toBe(true);
};

it('문자열 nextCursor("k:9f3a|2026")를 다음 페이지 요청의 cursor=로 그대로(인코딩만) 되돌려 보낸다 · 마지막 페이지(null) = hasNextPage false', async () => {
  const OPAQUE = 'k:9f3a|2026';
  mockGet
    .mockResolvedValueOnce({ items: [], hasNext: true, nextCursor: OPAQUE })
    .mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}><Probe /></QueryClientProvider>); });
  await waitUntil(() => latest().status === 'success'); // 첫 페이지 도착·알림까지
  expect(mockGet).toHaveBeenCalledTimes(1);
  expect(String(mockGet.mock.calls[0][0])).not.toContain('cursor='); // 첫 페이지 = 커서 없음
  expect(latest().hasNextPage).toBe(true);
  const beforeNext = latest().dataUpdatedAt;
  await act(async () => { await latest().fetchNextPage(); });
  // fetchNextPage()는 fetch가 끝나면 풀리지만 렌더 알림은 setTimeout(0) 뒤 — 2페이지가 **렌더에 반영된** 시점(dataUpdatedAt 전진·idle)까지 기다린다
  await waitUntil(() => latest().dataUpdatedAt > beforeNext && latest().fetchStatus === 'idle');
  expect(mockGet).toHaveBeenCalledTimes(2);
  expect(String(mockGet.mock.calls[1][0])).toContain(`cursor=${encodeURIComponent(OPAQUE)}`); // 숫자 변환·파싱 0
  expect(latest().hasNextPage).toBe(false);
  await act(async () => { tree.unmount(); });
  qc.clear();
});

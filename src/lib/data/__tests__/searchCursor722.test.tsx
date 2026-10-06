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
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); }); };

it('문자열 nextCursor("k:9f3a|2026")를 다음 페이지 요청의 cursor=로 그대로(인코딩만) 되돌려 보낸다 · 마지막 페이지(null) = hasNextPage false', async () => {
  const OPAQUE = 'k:9f3a|2026';
  mockGet
    .mockResolvedValueOnce({ items: [], hasNext: true, nextCursor: OPAQUE })
    .mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}><Probe /></QueryClientProvider>); });
  await flush();
  expect(mockGet).toHaveBeenCalledTimes(1);
  expect(String(mockGet.mock.calls[0][0])).not.toContain('cursor='); // 첫 페이지 = 커서 없음
  expect(latest().hasNextPage).toBe(true);
  await act(async () => { await latest().fetchNextPage(); });
  await flush();
  expect(mockGet).toHaveBeenCalledTimes(2);
  expect(String(mockGet.mock.calls[1][0])).toContain(`cursor=${encodeURIComponent(OPAQUE)}`); // 숫자 변환·파싱 0
  expect(latest().hasNextPage).toBe(false);
  await act(async () => { tree.unmount(); });
  qc.clear();
});

/**
 * P-008(KB-174 후속): 401을 "성공+빈 목록"으로 위장하던 레거시 제거 회귀.
 * 죽은 토큰(로그인 유저)의 401은 isError로 서야 에러 블록(P-007)이 뜬다 —
 * 빈 목록 위장이 되살아나면 음식 탭이 다시 백지/false-empty가 된다.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/api/client', () => {
  class MockApiError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  }
  return { ApiError: MockApiError, apiLang: () => 'en', api: { get: jest.fn() } };
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { api, ApiError } = require('@/lib/api/client');
/* eslint-enable @typescript-eslint/no-require-imports */

import { useInfiniteFoods, useSearchFoods } from '../useFoods';

function Probe({ hook, onState }: { hook: () => { isError: boolean; data?: unknown }; onState: (s: { isError: boolean; data?: unknown }) => void }) {
  const q = hook();
  React.useEffect(() => {
    if (q.isError || q.data !== undefined) onState(q);
  });
  return null;
}

async function runHook(hook: () => { isError: boolean; data?: unknown }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let resolve!: (s: { isError: boolean; data?: unknown }) => void;
  const settled = new Promise<{ isError: boolean; data?: unknown }>((r) => (resolve = r));
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <Probe hook={hook} onState={resolve} />
      </QueryClientProvider>,
    );
  });
  const state = await settled;
  await act(async () => {
    tree.unmount();
  });
  qc.clear();
  return state;
}

beforeEach(() => jest.clearAllMocks());

it('browse: 401 → isError (빈 목록 위장 없음 — 에러 블록 표면화)', async () => {
  api.get.mockRejectedValue(new ApiError('Unauthorized', 401));
  const s = await runHook(() => useInfiniteFoods());
  expect(s.isError).toBe(true);
  expect(s.data).toBeUndefined();
});

it('search: 401 → isError (빈 목록 위장 없음)', async () => {
  api.get.mockRejectedValue(new ApiError('Unauthorized', 401));
  const s = await runHook(() => useSearchFoods('kimchi'));
  expect(s.isError).toBe(true);
  expect(s.data).toBeUndefined();
});

it('게스트(무토큰) 정상 응답은 무변 — 목록 그대로', async () => {
  api.get.mockResolvedValue({
    items: [{ foodId: 1, name: 'Kimchi', koreanName: '김치', imageRef: null, spiciness: 0, overallRiskStatus: 'UNKNOWN' }],
    hasNext: false,
  });
  const s = await runHook(() => useInfiniteFoods());
  expect(s.isError).toBe(false);
  expect(Array.isArray(s.data) ? (s.data as unknown[]).length : 0).toBe(1);
});

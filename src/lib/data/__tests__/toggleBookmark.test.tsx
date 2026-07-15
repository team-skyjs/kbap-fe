/**
 * KB-142 반려 회귀: 저장 토글의 POST/PATCH 분기.
 * RQ v5는 onMutate(낙관 쓰기)를 mutationFn보다 먼저 실행하므로, mutationFn이
 * 캐시를 재독해 분기하면 항상 반대 요청이 나간다(저장 시도 → PATCH 해제).
 * 낙관 반영이 켜진 실제 QueryClient 위에서 실제 발사되는 HTTP 동사를 잠근다.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
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

import { useToggleBookmark, type BookmarkSnapshot } from '../bookmarks';

const SNAP: BookmarkSnapshot = {
  foodId: '7',
  name: 'Bibimbap',
  nameKo: '비빔밥',
  risk: 'safe',
  photoUrl: null,
};

function Harness({ add, onSettled }: { add: boolean; onSettled: () => void }) {
  const toggle = useToggleBookmark();
  React.useEffect(() => {
    toggle.mutate({ snap: SNAP, add }, { onSettled });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

async function runToggle(qc: QueryClient, add: boolean) {
  let settled!: () => void;
  const done = new Promise<void>((r) => (settled = r));
  // create와 대기를 같은 act에 두면 effect flush 데드락 — 분리 (useUpdateMe.test 참조)
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <Harness add={add} onSettled={settled} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await done;
  });
}

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

beforeEach(() => jest.clearAllMocks());

it('미저장 상태에서 토글(add) → POST /bookmarks 발사 (낙관 반영 후에도 역전 없음)', async () => {
  const qc = client(); // 북마크 캐시 없음 = 미저장
  // 상세 캐시 시드 — KB-142 후속: 낙관 토글이 서버 필드(bookmarked)도 즉시 반전해야 함
  qc.setQueryData(['food', '7', 'en'], { foodId: '7', bookmarked: false });
  await runToggle(qc, true);

  expect(api.post).toHaveBeenCalledWith('/bookmarks', { foodId: 7 });
  expect(api.patch).not.toHaveBeenCalled();
  expect((qc.getQueryData(['food', '7', 'en']) as { bookmarked: boolean }).bookmarked).toBe(true); // 낙관 반전
});

it('저장 상태에서 토글(remove) → PATCH /bookmarks/{id} 발사 (DELETE·POST 아님)', async () => {
  const qc = client();
  // 저장된 상태 시드 — 낙관 쓰기(onMutate)가 이 캐시를 먼저 비운 뒤 mutationFn이 돈다
  qc.setQueryData(['bookmarks', 'en'], {
    pages: [{ items: [{ foodId: 7, name: 'Bibimbap', koreanName: '비빔밥', imageRef: null, spiciness: 0, overallRiskStatus: 'SAFE' }], hasNext: false }],
    pageParams: [undefined],
  });
  qc.setQueryData(['food', '7', 'en'], { foodId: '7', bookmarked: true });
  await runToggle(qc, false);

  expect(api.patch).toHaveBeenCalledWith('/bookmarks/7');
  expect(api.post).not.toHaveBeenCalled();
  expect((qc.getQueryData(['food', '7', 'en']) as { bookmarked: boolean }).bookmarked).toBe(false); // 낙관 반전
});

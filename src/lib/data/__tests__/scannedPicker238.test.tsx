/**
 * P-238(KB-335): 리뷰 음식 픽커 — scanned 초기 목록·scope 검색 쿼리 실측·
 * cursor 무시 규약·음식탭 무변 회귀·게스트 경로 잠금.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
const mockGet = jest.fn().mockResolvedValue({ items: [], hasNext: false, nextCursor: null });
jest.mock('@/lib/api/client', () => ({
  api: { get: (p: string) => mockGet(p) },
  apiLang: () => 'en',
}));

import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useScannedFoods, useSearchFoods } from '../useFoods';

function run(hook: () => unknown): () => Promise<void> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  function H() {
    hook();
    return null;
  }
  return async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <QueryClientProvider client={qc}>
          <H />
        </QueryClientProvider>,
      );
      await Promise.resolve();
    });
    await act(async () => { tree.unmount(); });
    qc.clear();
  };
}

beforeEach(() => jest.clearAllMocks());

it('scanned 초기 목록 = GET /api/foods/scanned (버전리스 절대 경로·lang)', async () => {
  await run(() => useScannedFoods(true))();
  expect(mockGet).toHaveBeenCalledWith('/api/foods/scanned?lang=en');
});

it('scanned 비활성(게스트) = 호출 0 — 401 방어(화면은 인기 폴백)', async () => {
  await run(() => useScannedFoods(false))();
  expect(mockGet).not.toHaveBeenCalled();
});

it('검색 scope=scanned — 쿼리 실측 + cursor 미전송(스웨거: 페이징 없음·cursor 무시)', async () => {
  await run(() => useSearchFoods('kimchi', 'scanned'))();
  expect(mockGet).toHaveBeenCalledWith('/foods/search?keyword=kimchi&scope=scanned&lang=en');
});

it('scope 미전달 = 현행 쿼리 무변(음식탭·홈 검색 회귀 잠금 — all 기본은 서버 몫)', async () => {
  await run(() => useSearchFoods('kimchi'))();
  expect(mockGet).toHaveBeenCalledWith('/foods/search?keyword=kimchi&lang=en');
});

it('배선 소스 잠금 — 픽커 리뷰 컨텍스트만 scanned, 음식탭·검색 화면은 scope 미사용', () => {
  const fs = require('fs');
  const picker = fs.readFileSync('src/app/community/compose.tsx', 'utf8') as string;
  expect(picker).toContain("context === 'review'");
  expect(picker).toContain("useScanScope && !searchAll ? 'scanned' : undefined");
  expect(picker).toContain('reviewInitial'); // 스캔 0건 = 인기 폴백 분기
  expect(picker).toContain("testID=\"picker-search-all\""); // 전체 재검색 제안 행
  // 다른 표면은 scope 인자 없이 호출(무변)
  expect(fs.readFileSync('src/app/search.tsx', 'utf8')).not.toContain("'scanned'");
  expect(fs.readFileSync('src/app/(tabs)/food.tsx', 'utf8')).not.toContain("'scanned'");
});

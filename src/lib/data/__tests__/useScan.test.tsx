/**
 * P-002(KB-72): 스캔 요청이 새 계약 { imagePath, items } 로 나가는지 잠근다.
 * presigned 발급 API 미배포 동안 imagePath 는 '' (텍스트-only 폴백) — 사진이
 * 있어도 스텁이라 '' 이고, 크래시 없이 스캔이 계속되어야 한다 (DoD: 발급 API
 * 부재 시 안전한 폴백).
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/api/client', () => ({
  api: {
    post: jest.fn().mockResolvedValue({ degraded: false, results: [] }),
  },
  apiLang: () => 'en',
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { api } = require('@/lib/api/client');
/* eslint-enable @typescript-eslint/no-require-imports */

import { useScan, type ScanInput } from '../useScan';

const box = { x: 0.1, y: 0.3, width: 0.4, height: 0.05 };

function Harness({ input, onSettled }: { input: ScanInput; onSettled: () => void }) {
  const scan = useScan();
  React.useEffect(() => {
    scan.mutate(input, { onSettled });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

async function runScan(input: ScanInput) {
  // gcTime Infinity — 뮤테이션 GC 타이머(기본 5분)가 워커를 붙잡는 것 방지
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  let settled!: () => void;
  const done = new Promise<void>((r) => (settled = r));
  // create와 대기를 같은 act에 두면 effect flush 데드락 — 분리 (toggleBookmark.test 참조)
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <Harness input={input} onSettled={settled} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await done;
  });
  await act(async () => {
    tree.unmount();
  });
  qc.clear();
}

beforeEach(() => jest.clearAllMocks());

it('요청 body 에 imagePath 포함 — 사진 없음(샘플) → "" + items 는 idx/rawMenuName 만', async () => {
  await runScan({ items: [{ itemId: 0, rawMenuName: '김치찌개', box }], photo: null });
  expect(api.post).toHaveBeenCalledWith('/scans', {
    imagePath: '',
    items: [{ idx: 0, rawMenuName: '김치찌개' }], // box 는 온디바이스 — 전송 금지
  });
});

it('사진이 있어도 발급 API 미배포(스텁) → imagePath "" 로 폴백, 스캔은 계속 (TODO(KB-72))', async () => {
  await runScan({
    items: [{ itemId: 0, rawMenuName: '된장찌개', box }],
    photo: { uri: 'file:///tmp/menu.jpg', width: 1000, height: 1400 },
  });
  const [path, body] = api.post.mock.calls[0];
  expect(path).toBe('/scans');
  expect(body.imagePath).toBe('');
});

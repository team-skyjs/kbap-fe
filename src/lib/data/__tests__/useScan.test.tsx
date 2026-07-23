/**
 * P-002(KB-72): 스캔 요청이 새 계약 { imagePath, items } 로 나가는지 잠근다.
 * P-003 갱신: presigned 실연동 — 업로드 성공 시 검증된 path, 실패 시 ''
 * (텍스트-only 폴백, BE 허용 확정)로 크래시 없이 스캔이 계속되어야 한다.
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
// 업로드 흐름은 scanImage.test 가 잠근다 — 여기서는 성공/실패 양 극단만 주입
const mockResolvePath = jest.fn();
jest.mock('@/lib/api/scanImage', () => ({
  resolveScanImagePath: (...a: unknown[]) => mockResolvePath(...a),
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

beforeEach(() => {
  jest.clearAllMocks();
  api.post.mockResolvedValue({ degraded: false, results: [] });
  mockResolvePath.mockResolvedValue(null);
});

it('요청 body 에 imagePath 포함 — 사진 없음(샘플) → "" + items 는 idx/rawMenuName 만', async () => {
  await runScan({ items: [{ itemId: 0, rawMenuName: '김치찌개', box }], photo: null });
  expect(api.post).toHaveBeenCalledWith('/scans?lang=en', {
    imagePath: '',
    items: [{ idx: 0, rawMenuName: '김치찌개' }], // box 는 온디바이스 — 전송 금지
  });
});

it('업로드 성공 → 검증된 path 가 imagePath 로 전송 (P-003 실연동)', async () => {
  mockResolvePath.mockResolvedValue('scan/1/a.jpg');
  const photo = { uri: 'file:///tmp/menu.jpg', width: 1000, height: 1400 };
  await runScan({ items: [{ itemId: 0, rawMenuName: '된장찌개', box }], photo });
  expect(mockResolvePath).toHaveBeenCalledWith(photo); // 파일 정리보다 앞 — postScan 초입
  const [path, body] = api.post.mock.calls[0];
  expect(path).toBe('/scans?lang=en'); // P-060③: 지역화 lang 필수
  expect(body.imagePath).toBe('scan/1/a.jpg');
});

it('업로드 실패(null) → imagePath "" 폴백, 스캔은 계속 (텍스트-only)', async () => {
  await runScan({
    items: [{ itemId: 0, rawMenuName: '된장찌개', box }],
    photo: { uri: 'file:///tmp/menu.jpg', width: 1000, height: 1400 },
  });
  const [path, body] = api.post.mock.calls[0];
  expect(path).toBe('/scans?lang=en'); // P-060③: 지역화 lang 필수
  expect(body.imagePath).toBe('');
});

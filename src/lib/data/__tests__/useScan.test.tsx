/**
 * P-002(KB-72): 스캔 요청이 새 계약 { imagePath, items } 로 나가는지 잠근다.
 * P-003 갱신: presigned 실연동 — 업로드 성공 시 검증된 path, 실패 시 ''
 * (텍스트-only 폴백, BE 허용 확정)로 크래시 없이 스캔이 계속되어야 한다.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
// P-153: 채널 목 — 기존 계약 잠금은 v1(prod), 신규는 v2(dev 계열)
// P-155: FLAGS.scanV2 킬스위치 — v2 유닛은 강제 on, 기본은 off(전 채널 v1)
let mockProd = true;
let mockScanV2 = false;
jest.mock('@/lib/flags', () => ({
  isProdChannel: () => mockProd,
  get FLAGS() {
    return { ...jest.requireActual('@/lib/flags').FLAGS, scanV2: mockScanV2 };
  },
}));
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

beforeEach(() => {
  mockProd = true; // 기본 = v1 (기존 계약 잠금 유지)
  mockScanV2 = false; // P-155 킬스위치 기본 off
});

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
  expect(api.post).toHaveBeenCalledWith(
    '/scans?lang=en',
    {
      imagePath: '',
      items: [{ idx: 0, rawMenuName: '김치찌개' }], // box 는 온디바이스 — 전송 금지
    },
    { timeoutMs: 120_000 }, // P-234 확정: 실측 58초 × 2 (P-232 진단 → TEMP 원복)
  );
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


/* ---- P-153: 스캔 v2 채널 분기 ---- */
it('P-153 → P-219 v2(dev 계열): items 미전송 + X-API-Version 2.0 + lang·currency 쿼리', async () => {
  mockProd = false;
  mockScanV2 = true; // P-155 킬스위치 — v2 유닛은 강제 on(코드 보존 잠금)
  mockResolvePath.mockResolvedValue('scans/1/a.jpg');
  await runScan({ items: [{ itemId: 0, rawMenuName: '김치찌개', box }], photo: { uri: 'file:a.jpg', width: 1, height: 1 }, currency: 'JPY' });
  const [path, body, opts] = api.post.mock.calls[0];
  expect(path).toBe('/scans?lang=en&currency=JPY'); // P-219: 둘 다 필수(누락 = 400)
  expect(body.items).toEqual([]); // 서버 비전 OCR — 클라 items 무시 경로
  expect(body.imagePath).toBe('scans/1/a.jpg');
  expect(opts.headers).toEqual({ 'X-API-Version': '2.0' });
});

// P-219 ②: currency 누락 = 스캔 전면 사망(400)이라 끝단에서 USD 강제 — 3케이스 실측
it.each([
  ['프로필 통화 있음', 'THB', 'THB'],
  ['해석 결과 없음(빈 문자열) → USD 강제', '', 'USD'],
  ['미전달(undefined) → USD 강제', undefined, 'USD'],
])('P-219: v2 요청 쿼리에 currency가 반드시 실린다 — %s', async (_label, input, expected) => {
  mockProd = false;
  mockScanV2 = true;
  mockResolvePath.mockResolvedValue('scans/1/a.jpg');
  await runScan({ items: [], photo: { uri: 'file:a.jpg', width: 1, height: 1 }, currency: input as string | undefined });
  const [path] = api.post.mock.calls[0];
  expect(path).toBe(`/scans?lang=en&currency=${expected}`);
});

it('P-219: prod 채널은 currency 쿼리·2.0 헤더 없이 v1 고정(구 계약 보호)', async () => {
  mockProd = true;
  mockScanV2 = true; // 플래그가 켜져 있어도 prod는 v1
  mockResolvePath.mockResolvedValue('scans/1/a.jpg');
  await runScan({ items: [{ itemId: 0, rawMenuName: '김치찌개', box }], photo: { uri: 'file:a.jpg', width: 1, height: 1 }, currency: 'USD' });
  const [path, body, opts] = api.post.mock.calls[0];
  expect(path).toBe('/scans?lang=en');
  expect(body.items).toEqual([{ idx: 0, rawMenuName: '김치찌개' }]);
  expect(opts.headers).toBeUndefined();
});

it('P-153 v1(production): 현행 무변 — items 전송 + 버전 헤더 없음 (prod 서버 v2 미지원)', async () => {
  mockProd = true;
  mockResolvePath.mockResolvedValue('scans/1/a.jpg');
  await runScan({ items: [{ itemId: 0, rawMenuName: '김치찌개', box }], photo: { uri: 'file:a.jpg', width: 1, height: 1 } });
  const [, body, opts] = api.post.mock.calls[0];
  expect(body.items).toEqual([{ idx: 0, rawMenuName: '김치찌개' }]);
  expect(opts.headers).toBeUndefined();
});


it('P-155: 킬스위치 off(기본) → dev 계열이어도 v1(items 전송·헤더 없음·온디바이스 OCR 경로)', async () => {
  mockProd = false; // dev 계열
  mockScanV2 = false; // BE v2 미완성 — 전 채널 v1
  mockResolvePath.mockResolvedValue('scans/1/a.jpg');
  await runScan({ items: [{ itemId: 0, rawMenuName: '김치찌개', box }], photo: { uri: 'file:a.jpg', width: 1, height: 1 } });
  const [, body, opts] = api.post.mock.calls[0];
  expect(body.items).toEqual([{ idx: 0, rawMenuName: '김치찌개' }]);
  expect(opts.headers).toBeUndefined();
});

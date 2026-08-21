/**
 * P-250(KB-345): 스캔 티켓·3회 정책 — 티켓 발급 선행(업로드 전)·X-Scan-Ticket·
 * SCAN-004/005/007 분기·시도 스코프(전역 잔존 0)·v1 무변.
 * 가이드(PR #181) QA 체크리스트 매핑: #1(발급 전 업로드 미시작) #2(헤더 동시)
 * #3(시도마다 신규) #5(양쪽 SCAN-004 동일 stage) #7(005 자동 재발급 금지)
 * #9(007 폐기·재발급) #12(code 기준 분기) = 이 스위트 · 나머지 = 실기/기존 유닛.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
let mockProd = false;
let mockScanV2 = true;
jest.mock('@/lib/flags', () => ({
  isProdChannel: () => mockProd,
  get FLAGS() {
    return { ...jest.requireActual('@/lib/flags').FLAGS, scanV2: mockScanV2 };
  },
}));
jest.mock('@/lib/api/client', () => {
  class MockApiError extends Error {
    status?: number;
    code?: string;
    constructor(message: string, status?: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return { ApiError: MockApiError, api: { post: jest.fn() }, apiLang: () => 'en' };
});
const mockResolvePath = jest.fn();
jest.mock('@/lib/api/scanImage', () => ({
  resolveScanImagePath: (...a: unknown[]) => mockResolvePath(...a),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { api, ApiError } = require('@/lib/api/client');
/* eslint-enable @typescript-eslint/no-require-imports */

import { useScan, type ScanInput } from '../useScan';
import { stageForCode, failReasonForStage } from '@/lib/scan/scanErrors';

const PHOTO = { uri: 'file:a.jpg', width: 1, height: 1 };
const INPUT: ScanInput = { items: [], photo: PHOTO, currency: 'USD' };
const TICKETS = '/api/scans/tickets';
const err = (code: string, status = 400) => new ApiError(`server msg for ${code}`, status, code);
const ticketCalls = () => (api.post.mock.calls as unknown[][]).filter(([p]) => p === TICKETS);
const scanCalls = () => (api.post.mock.calls as unknown[][]).filter(([p]) => p !== TICKETS);

let ticketSeq = 0;

async function runScan(input: ScanInput): Promise<Error | null> {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  let settled!: () => void;
  const done = new Promise<void>((r) => (settled = r));
  let captured: Error | null = null;
  function Harness() {
    const scan = useScan();
    React.useEffect(() => {
      scan.mutate(input, { onSettled, onError: (e) => (captured = e as Error) });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }
  const onSettled = () => settled();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <Harness />
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
  return captured;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProd = false;
  mockScanV2 = true;
  ticketSeq = 0;
  api.post.mockImplementation(async (path: string) =>
    path === TICKETS ? { ticket: `T-${++ticketSeq}`, expiresInSeconds: 300 } : { degraded: false, results: [] },
  );
  mockResolvePath.mockResolvedValue('scans/1/a.jpg');
});

it('가이드 #1·#2: 티켓 발급 → 업로드 → 스캔(X-Scan-Ticket) 순서 실측', async () => {
  await runScan(INPUT);
  // 발급이 업로드보다 먼저(SCAN-004면 업로드 비용 0 — 시나리오 B 전제)
  expect(api.post.mock.calls[0][0]).toBe(TICKETS);
  expect(api.post.mock.invocationCallOrder[0]).toBeLessThan(mockResolvePath.mock.invocationCallOrder[0]);
  const [, , opts] = scanCalls()[0] as [string, unknown, { headers: Record<string, string> }];
  expect(opts.headers['X-Scan-Ticket']).toBe('T-1');
  expect(opts.headers['X-API-Version']).toBe('2.0');
});

it('가이드 #3: 시도마다 신규 발급 — 이전 티켓 재사용 0', async () => {
  await runScan(INPUT);
  await runScan(INPUT);
  expect(ticketCalls()).toHaveLength(2);
  const heads = scanCalls().map((c) => (c[2] as { headers: Record<string, string> }).headers['X-Scan-Ticket']);
  expect(heads).toEqual(['T-1', 'T-2']);
});

it('시나리오 B: 발급 단계 SCAN-004 = 업로드·스캔 미시작(데이터 비용 0)', async () => {
  api.post.mockRejectedValueOnce(err('SCAN-004', 403));
  const e = await runScan(INPUT);
  expect((e as { code?: string })?.code).toBe('SCAN-004');
  expect(mockResolvePath).not.toHaveBeenCalled(); // 업로드 시작 금지(가이드 명시)
  expect(scanCalls()).toHaveLength(0);
});

it('가이드 #5·#12: SCAN-004 = 발급·스캔 양쪽 동일 stage(quota) — code 기준 분기', () => {
  expect(stageForCode('SCAN-004', 'x')).toBe('quota');
  expect(stageForCode('SCAN-005', 'x')).toBe('processing');
  expect(stageForCode('SCAN-007', 'x')).toBe('be'); // 007은 postScan이 흡수(재발급) — 표면 도달 = 일반 처리
  // fail_reason: CSV 5종 고정 — 정책 거절·중복은 server 흡수(신설 필요 시 보고)
  expect(failReasonForStage('quota')).toBe('server');
  expect(failReasonForStage('processing')).toBe('server');
});

it('가이드 #9(시나리오 F): 스캔 단계 SCAN-007 = 조용히 새 티켓 발급 후 1회 재시도(재업로드 없음)', async () => {
  let scanTries = 0;
  api.post.mockImplementation(async (path: string) => {
    if (path === TICKETS) return { ticket: `T-${++ticketSeq}`, expiresInSeconds: 300 };
    if (++scanTries === 1) throw err('SCAN-007', 400);
    return { degraded: false, results: [] };
  });
  const e = await runScan(INPUT);
  expect(e).toBeNull(); // 재시도 성공 — 사용자 무감
  expect(ticketCalls()).toHaveLength(2); // 폐기 후 신규 발급
  expect(mockResolvePath).toHaveBeenCalledTimes(1); // 이미지 재업로드 없음(path 재사용)
  const heads = scanCalls().map((c) => (c[2] as { headers: Record<string, string> }).headers['X-Scan-Ticket']);
  expect(heads).toEqual(['T-1', 'T-2']); // 재시도는 반드시 새 티켓
});

it('SCAN-007 반복 실패 = 1회 재시도 후 던짐(무한 루프 금지 — 안내로 전환)', async () => {
  api.post.mockImplementation(async (path: string) => {
    if (path === TICKETS) return { ticket: `T-${++ticketSeq}`, expiresInSeconds: 300 };
    throw err('SCAN-007', 400);
  });
  const e = await runScan(INPUT);
  expect((e as { code?: string })?.code).toBe('SCAN-007');
  expect(ticketCalls()).toHaveLength(2); // 재발급 1회 한정
  expect(scanCalls()).toHaveLength(2);
});

it('가이드 #7: SCAN-005(처리 중) = 새 티켓 자동 재발급·재호출 금지', async () => {
  api.post.mockImplementation(async (path: string) => {
    if (path === TICKETS) return { ticket: `T-${++ticketSeq}`, expiresInSeconds: 300 };
    throw err('SCAN-005', 409);
  });
  const e = await runScan(INPUT);
  expect((e as { code?: string })?.code).toBe('SCAN-005');
  expect(ticketCalls()).toHaveLength(1); // 자동 재발급 0
  expect(scanCalls()).toHaveLength(1); // 연속 호출 0
});

it('P-255: 선발급 티켓 전달 = postScan 자체 발급 0(재사용 — 왕복 절감)', async () => {
  await runScan({ ...INPUT, ticket: 'PRE-1' });
  expect(ticketCalls()).toHaveLength(0); // 자체 발급 생략
  const [, , opts] = scanCalls()[0] as [string, unknown, { headers: Record<string, string> }];
  expect(opts.headers['X-Scan-Ticket']).toBe('PRE-1');
});

it('P-255: 선발급 부재(null/미전달) = 현행 자체 발급 폴백(흐름 차단 금지)', async () => {
  await runScan({ ...INPUT, ticket: null });
  expect(ticketCalls()).toHaveLength(1);
  const [, , opts] = scanCalls()[0] as [string, unknown, { headers: Record<string, string> }];
  expect(opts.headers['X-Scan-Ticket']).toBe('T-1');
});

it('P-255 배선 소스 잠금 — 진입 선발급(focus)·004 즉시 잠금·계측 미발화·1회용 소모·게스트 상위', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const src = require('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
  expect(src).toContain('useFocusEffect'); // 진입·복귀 시 선발급(시나리오 C 복귀 재발급 겸)
  expect(src).toContain("if (isGuest) return; // 게스트 가드 상위(순서 유지)");
  expect(src).toContain("setError({ stage: 'quota', detail: 'preflight SCAN-004' })"); // 즉시 잠금(카메라 미표시)
  // fail() 미경유 = scan_complete 계측 오염 0(진입 잠금은 스캔 시도가 아님)
  const pre = src.split('const preflight')[1].split('useFocusEffect')[0];
  expect(pre).not.toContain('fail(');
  expect(pre).not.toContain('track(');
  expect(src).toContain('preTicket.current = null;\n    scan.mutate'); // 1회용 소모 후 전달
});

it('v1(prod) 무변 — 티켓 발급 0·헤더 없음(가이드 비대상)', async () => {
  mockProd = true;
  await runScan({ items: [{ itemId: 0, rawMenuName: '김치찌개', box: { x: 0, y: 0, width: 1, height: 1 } }], photo: PHOTO });
  expect(ticketCalls()).toHaveLength(0);
  const [, , opts] = scanCalls()[0] as [string, unknown, { headers?: unknown }];
  expect(opts.headers).toBeUndefined();
});

it('소스 잠금 — 잔여 횟수 계산·티켓 영구 저장·만료 클라 판정 잔존 0 + quota UI 배선', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  const useScanSrc = fs.readFileSync('src/lib/data/useScan.ts', 'utf8') as string;
  // 티켓은 시도 스코프 지역 변수만 — 전역/영구 저장·만료 판정 금지(가이드)
  expect(useScanSrc).not.toContain('AsyncStorage');
  expect(useScanSrc).not.toMatch(/expiresInSeconds[^:]*[<>]/); // 만료 비교 판정 금지
  const scanSrc = fs.readFileSync('src/app/scan.tsx', 'utf8') as string;
  expect(scanSrc).not.toMatch(/remaining|잔여/); // 잔여 횟수 클라 계산·표시 부재
  // quota UI: 리뷰 작성하기 = 리뷰 픽커(P-245 자격 UX) + 나중에
  expect(scanSrc).toContain("t('scan.quotaCta')");
  expect(scanSrc).toContain("t('scan.later')");
  expect(scanSrc).toContain('<TagPickerSheet');
  expect(scanSrc).toContain('context="review"');
  expect(scanSrc).toContain('/review` as Href');
});

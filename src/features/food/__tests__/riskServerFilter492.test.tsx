/**
 * P-350(KB-492) — 위험도 칩 서버 필터 배선 잠금:
 * ① useInfiniteFoods(risk) = &risk=<서버값> 전송 + 쿼리키 분리('all'과 캐시 혼입 0)
 * ② useBookmarks(risk) 동일 + 빈 페이지(items 0·hasNext true) = 종료 아님(커서 전진)
 * ③ FoodExplorer 클라 위험 필터 부재 + 얇은 페이지 연속 페치 + 빈 판정 !hasNextPage 소스 잠금
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/api/client', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  apiLang: () => 'en',
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/components/topToastStore', () => ({ showTopToast: jest.fn(), subscribeTopToast: jest.fn(() => () => {}) }));

import { api } from '@/lib/api/client';
import { FOODS_PAGE_SIZE, useInfiniteFoods } from '@/lib/data/useFoods';
import { riskWireOf } from '@/lib/api/foodAdapter';
import { useBookmarks } from '@/lib/data/bookmarks';

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const flush = () => act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 5)); });

function Probe({ risk }: { risk?: 'all' | 'safe' | 'caution' | 'danger' }) {
  useInfiniteFoods(risk);
  return null;
}
function BmProbe({ risk }: { risk?: 'all' | 'safe' | 'caution' | 'danger' }) {
  const q = useBookmarks(risk);
  return React.createElement('probe', { count: q.data?.length ?? 0, hasNext: q.hasNextPage, fetchNext: q.fetchNextPage });
}

beforeEach(() => jest.clearAllMocks());

it('① foods — risk 지정 = &risk=<서버값> 전송·쿼리키 분리, 미지정/all = 현행 URL·키', async () => {
  (api.get as jest.Mock).mockResolvedValue({ items: [], hasNext: false, nextCursor: null });
  const qc = client();
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <Probe />
        <Probe risk="all" />
        <Probe risk="danger" />
      </QueryClientProvider>,
    );
  });
  await flush();
  const urls = (api.get as jest.Mock).mock.calls.map((c) => c[0] as string).filter((u) => u.startsWith('/foods'));
  expect(urls).toContain('/foods?lang=en&risk=DANGER');
  expect(urls.filter((u) => !u.includes('risk='))).toHaveLength(1); // undefined·'all' = 같은 키 = 요청 1회
  const keys = qc.getQueryCache().getAll().map((q) => JSON.stringify(q.queryKey));
  expect(keys).toContain(JSON.stringify(['foods', 'list', 'en']));
  expect(keys).toContain(JSON.stringify(['foods', 'list', 'en', 'DANGER']));
  expect(riskWireOf('safe')).toBe('SAFE');
  expect(riskWireOf('all')).toBeUndefined();
});

it('② bookmarks — &risk= 전송 + 빈 페이지(items 0·hasNext true) = 종료 아님(커서 전진, P-332 에코 가드는 유지)', async () => {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    const cursor = /cursor=(\d+)/.exec(url)?.[1];
    if (cursor == null) return Promise.resolve({ items: [], hasNext: true, nextCursor: 7 }); // 얇은 페이지
    return Promise.resolve({ items: [], hasNext: true, nextCursor: 7 }); // 에코 — 여기서 종료돼야 함
  });
  const qc = client();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <BmProbe risk="caution" />
      </QueryClientProvider>,
    );
  });
  await flush();
  const first = (api.get as jest.Mock).mock.calls[0][0] as string;
  expect(first).toContain('/bookmarks?');
  expect(first).toContain('&risk=CAUTION');
  const probe = tree.root.findAll((n) => n.type === 'probe')[0];
  expect(probe.props.hasNext).toBe(true); // 빈 페이지여도 hasNext = 페이징 계속
  await act(async () => { await probe.props.fetchNext(); });
  await flush();
  expect((api.get as jest.Mock).mock.calls[1][0]).toContain('cursor=7'); // 커서 전진
  // 에코 페이지(next 7 재등장) 후엔 종료 — P-332 가드 잔존
  const probe2 = tree.root.findAll((n) => n.type === 'probe')[0];
  expect(probe2.props.hasNext).toBe(false);
});

it('①-b foods 커서 에코 가드(#112 P1) — 같은 커서 반복 응답이면 종료(연속 페치 무한 루프 봉쇄)', async () => {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    const cursor = /cursor=(\d+)/.exec(url)?.[1];
    if (cursor == null) return Promise.resolve({ items: [], hasNext: true, nextCursor: 3 });
    return Promise.resolve({ items: [], hasNext: true, nextCursor: 3 }); // 에코 — 전진 없음
  });
  const qc = client();
  let tree!: ReactTestRenderer;
  function FProbe() {
    const q = useInfiniteFoods('danger');
    return React.createElement('fprobe', { hasNext: q.hasNextPage, fetchNext: q.fetchNextPage });
  }
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <FProbe />
      </QueryClientProvider>,
    );
  });
  await flush();
  const probe = tree.root.findAll((n) => n.type === 'fprobe')[0];
  expect(probe.props.hasNext).toBe(true);
  await act(async () => { await probe.props.fetchNext(); });
  await flush();
  // 2페이지째가 커서 3을 에코 → 종료(hasNext 무시), 추가 fetch 없음
  expect(tree.root.findAll((n) => n.type === 'fprobe')[0].props.hasNext).toBe(false);
  await act(async () => { await tree.root.findAll((n) => n.type === 'fprobe')[0].props.fetchNext(); });
  await flush();
  expect((api.get as jest.Mock).mock.calls.filter((c) => (c[0] as string).startsWith('/foods')).length).toBe(2);
});

it('③ FoodExplorer 소스 잠금 — 클라 위험 필터 부재·riskChip 훅 전달·얇은 페이지 연속 페치·빈 판정 !hasNextPage', () => {
  const fe = require('fs').readFileSync('src/features/food/FoodExplorer.tsx', 'utf8') as string;
  expect(fe).not.toContain("gridSource.filter((f) => personalRisk(f.risk, hasR) === riskChip)");
  expect(fe).toContain('const browse = useInfiniteFoods(riskChip, { enabled: !savedTabActive });'); // 2R ②: Saved 활성 = browse 휴면
  expect(fe).toContain("const savedList = useBookmarks(savedTabActive ? riskChip : 'all');");
  expect(fe).toContain('const saved = useBookmarks();'); // 판정 소스(드레인) = 무필터 유지
  expect(fe).toContain('if (gridLen < FOODS_PAGE_SIZE && gridQ.hasNextPage && !gridQ.isFetching)');
  expect(fe).toContain("if (gridQ.isError) return; // 3R ①"); // 에러 = 자동 페치 중단
  expect(fe).toContain('fillFailedAtRef.current.at === gridQ.dataUpdatedAt // 성공 재조회(갱신 시각 변화) = 마커 무효(6R P2)'); // 5R ①→6R: 쿼리 스코프+갱신 시각 실패 마커
  expect(fe).toContain('void Promise.resolve(gridQ.fetchNextPage({ cancelRefetch: false })).then((r) => {');
  expect(fe).toContain('gridQ.isLoading || gridQ.hasNextPage ? ('); // 빈 상태 = !hasNextPage && 0건일 때만
  expect(FOODS_PAGE_SIZE).toBe(20); // 서버 FoodService/BookmarkService PAGE_SIZE 동치
});

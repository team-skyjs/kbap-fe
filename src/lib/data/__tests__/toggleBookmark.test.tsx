/**
 * KB-142 반려 회귀: 저장 토글의 POST/PATCH 분기.
 * RQ v5는 onMutate(낙관 쓰기)를 mutationFn보다 먼저 실행하므로, mutationFn이
 * 캐시를 재독해 분기하면 항상 반대 요청이 나간다(저장 시도 → PATCH 해제).
 * 낙관 반영이 켜진 실제 QueryClient 위에서 실제 발사되는 HTTP 동사를 잠근다.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } })); // P-339 ⑤: 토스트 발화가 t 사용
jest.mock('@/lib/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn().mockResolvedValue(undefined),
    patch: jest.fn().mockResolvedValue(undefined),
  },
  apiLang: () => 'en',
  foodHiddenReason: () => null, // KB-779 실패 롤백 케이스 — onError가 호출
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

/* ---- KB-779: 홈 카드 캐시 낙관 반전 — /bookmarks 드레인 없이 별이 즉시 바뀐다 ---- */
describe('KB-779 홈 캐시(["home", lang]) 낙관 반전', () => {
  const card = (foodId: string, bookmarked: boolean) => ({ foodId, name: foodId, nameKo: foodId, photoUrl: null, risk: 'safe', overall: { average: null, count: 0 }, bookmarked });
  const HOME = () => ({
    authenticated: true,
    avoided: [],
    recommended: [card('7', false), card('8', false)],
    mostReviewed: [card('7', false)],
    recent: [card('7', false), card('9', true)],
  });
  type Home = ReturnType<typeof HOME>;
  const home = (qc: QueryClient) => qc.getQueryData<Home>(['home', 'en'])!;
  const wirePages = () => ({
    pages: [{ items: [{ foodId: 7, name: 'B', koreanName: '비', imageRef: null, spiciness: 0, overallRiskStatus: 'SAFE', bookmarked: false }, { foodId: 8, name: 'C', koreanName: '씨', imageRef: null, spiciness: 0, overallRiskStatus: 'SAFE', bookmarked: false }], hasNext: false }],
    pageParams: [undefined],
  });
  type Pages = ReturnType<typeof wirePages>;

  it('add → recommended·mostReviewed·recent에서 해당 foodId의 bookmarked만 true · 다른 카드 무변', async () => {
    const qc = client();
    qc.setQueryData(['home', 'en'], HOME());
    await runToggle(qc, true);
    const h = home(qc);
    expect(h.recommended.map((c) => c.bookmarked)).toEqual([true, false]);
    expect(h.mostReviewed.map((c) => c.bookmarked)).toEqual([true]);
    expect(h.recent.map((c) => c.bookmarked)).toEqual([true, true]);
  });

  it('실패 → 홈 캐시 원복(별이 되돌아간다)', async () => {
    const qc = client();
    const before = HOME();
    qc.setQueryData(['home', 'en'], before);
    (api.post as jest.Mock).mockRejectedValueOnce(new Error('500'));
    await runToggle(qc, true);
    expect(home(qc)).toEqual(before);
  });

  it('홈 캐시 없음(홈 미방문) = 무크래시 · 캐시 생성 없음', async () => {
    const qc = client();
    await runToggle(qc, true);
    expect(qc.getQueryData(['home', 'en'])).toBeUndefined();
  });

  it('settle 시 ["home"] invalidate 없음 — popularFoods 서버 랜덤(KB-712) 재조회 = 레일 셔플·스크롤 리셋(KB-710)', async () => {
    const qc = client();
    qc.setQueryData(['home', 'en'], HOME());
    const spy = jest.spyOn(qc, 'invalidateQueries');
    await runToggle(qc, true);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['bookmarks'] })); // 스파이 실효 확인
    expect(spy.mock.calls.some(([o]) => (o?.queryKey as unknown[] | undefined)?.[0] === 'home')).toBe(false);
  });

  it('/foods 와이어 페이지 캐시(홈 Food 탭·위험 칩 레일 소스)도 같은 카드만 반전 · 실패 원복', async () => {
    const qc = client();
    qc.setQueryData(['foods', 'list', 'en'], wirePages());
    qc.setQueryData(['foods', 'list', 'en', 'SAFE'], wirePages());
    await runToggle(qc, true);
    for (const key of [['foods', 'list', 'en'], ['foods', 'list', 'en', 'SAFE']]) {
      expect(qc.getQueryData<Pages>(key)!.pages[0].items.map((i) => i.bookmarked)).toEqual([true, false]);
    }
    (api.patch as jest.Mock).mockRejectedValueOnce(new Error('500'));
    await runToggle(qc, false);
    expect(qc.getQueryData<Pages>(['foods', 'list', 'en'])!.pages[0].items.map((i) => i.bookmarked)).toEqual([true, false]);
  });
});

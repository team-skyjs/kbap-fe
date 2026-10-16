/**
 * KB-142 반려 회귀: 저장 토글의 POST/PATCH 분기.
 * RQ v5는 onMutate(낙관 쓰기)를 mutationFn보다 먼저 실행하므로, mutationFn이
 * 캐시를 재독해 분기하면 항상 반대 요청이 나간다(저장 시도 → PATCH 해제).
 * 낙관 반영이 켜진 실제 QueryClient 위에서 실제 발사되는 HTTP 동사를 잠근다.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useToggleBookmark, useRemoveBookmark, useRestoreBookmark, useSavedIds, type BookmarkSnapshot } from '../bookmarks';

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

jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false })); // Codex ④: useSavedIds 드레인 케이스

/* eslint-disable @typescript-eslint/no-require-imports */
const { api } = require('@/lib/api/client');
/* eslint-enable @typescript-eslint/no-require-imports */


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

/* ---- Codex 리뷰(#264) 반영 — 낙관 반전의 경쟁 조건 ---- */
describe('KB-779 Codex 리뷰: 카드 캐시 반전 경쟁 조건', () => {
  type H = { toggle: ReturnType<typeof useToggleBookmark>; remove: ReturnType<typeof useRemoveBookmark>; restore: ReturnType<typeof useRestoreBookmark> };
  function Hooks({ fn, done }: { fn: (h: H) => Promise<unknown>; done: () => void }) {
    const h = { toggle: useToggleBookmark(), remove: useRemoveBookmark(), restore: useRestoreBookmark() };
    React.useEffect(() => { void fn(h).finally(done); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
  }
  async function run(qc: QueryClient, fn: (h: H) => Promise<unknown>) {
    let settled!: () => void;
    const done = new Promise<void>((r) => (settled = r));
    await act(async () => {
      renderer.create(<QueryClientProvider client={qc}><Hooks fn={fn} done={settled} /></QueryClientProvider>);
    });
    await act(async () => { await done; });
  }
  const card = (foodId: string, bookmarked: boolean) => ({ foodId, name: foodId, nameKo: foodId, photoUrl: null, risk: 'safe', overall: { average: null, count: 0 }, bookmarked });
  const HOME = (b7 = false, b8 = false) => ({ authenticated: true, avoided: [], recommended: [card('7', b7), card('8', b8)], mostReviewed: [], recent: [] });
  const stars = (qc: QueryClient) => qc.getQueryData<ReturnType<typeof HOME>>(['home', 'en'])!.recommended.map((c) => c.bookmarked);
  const snap = (foodId: string): BookmarkSnapshot => ({ ...SNAP, foodId });
  beforeEach(() => { // clearAllMocks는 구현을 안 지운다 — ①의 지연 reject 구현 잔존 방지
    (api.post as jest.Mock).mockResolvedValue(undefined);
    (api.patch as jest.Mock).mockResolvedValue(undefined);
  });

  it('① 두 카드 연속 토글 — 앞(7)이 뒤(8) 성공 뒤에 실패해도 8의 별은 남고 7만 되돌아간다', async () => {
    const qc = client();
    qc.setQueryData(['home', 'en'], HOME());
    let fail7!: (e: Error) => void;
    (api.post as jest.Mock).mockImplementation((_u: string, body: { foodId: number }) =>
      body.foodId === 7 ? new Promise((_r, rej) => (fail7 = rej)) : Promise.resolve(undefined));
    await run(qc, async (h) => {
      const p7 = h.toggle.mutateAsync({ snap: snap('7'), add: true }).catch(() => {});
      await h.toggle.mutateAsync({ snap: snap('8'), add: true }); // 8 먼저 성공
      expect(stars(qc)).toEqual([true, true]);
      fail7(new Error('500'));
      await p7;
    });
    expect(stars(qc)).toEqual([false, true]);
  });

  it('② 홈·/foods 재조회가 진행 중일 때 토글 — 늦게 도착한 옛 응답이 낙관 반영을 덮지 않는다(쓰기 전 cancel)', async () => {
    const qc = client();
    qc.setQueryData(['home', 'en'], HOME());
    qc.setQueryData(['foods', 'list', 'en'], { pages: [{ items: [{ foodId: 7, bookmarked: false }], hasNext: false }], pageParams: [undefined] });
    let arriveHome!: (v: unknown) => void;
    let arriveFoods!: (v: unknown) => void;
    const homeFetch = qc.fetchQuery({ queryKey: ['home', 'en'], queryFn: () => new Promise((r) => (arriveHome = r)) }).catch(() => {});
    const foodsFetch = qc.fetchInfiniteQuery({ queryKey: ['foods', 'list', 'en'], initialPageParam: undefined, queryFn: () => new Promise((r) => (arriveFoods = r)) }).catch(() => {});
    await run(qc, (h) => h.toggle.mutateAsync({ snap: snap('7'), add: true }));
    arriveHome(HOME()); // 옛 상태(별 꺼짐) 늦게 도착
    arriveFoods({ items: [{ foodId: 7, bookmarked: false }], hasNext: false });
    await act(async () => { await Promise.all([homeFetch, foodsFetch]); });
    expect(stars(qc)).toEqual([true, false]);
    expect(qc.getQueryData<{ pages: { items: { bookmarked: boolean }[] }[] }>(['foods', 'list', 'en'])!.pages[0].items[0].bookmarked).toBe(true);
  });

  it('③ 저장 화면 스와이프 해제·Undo 복원도 홈 카드 별을 같이 바꾼다 · 해제 실패 = 원복', async () => {
    const qc = client();
    qc.setQueryData(['home', 'en'], HOME(true));
    await run(qc, (h) => h.remove.mutateAsync('7'));
    expect(stars(qc)).toEqual([false, false]);
    await run(qc, (h) => h.restore.mutateAsync(snap('7')));
    expect(stars(qc)).toEqual([true, false]);
    (api.patch as jest.Mock).mockRejectedValueOnce(new Error('500'));
    await run(qc, (h) => h.remove.mutateAsync('7').catch(() => {}));
    expect(stars(qc)).toEqual([true, false]);
  });

  it('④ useSavedIds({enabled:false}) — 다른 화면이 남긴 부분 캐시(hasNext)가 있어도 다음 페이지를 당기지 않는다', async () => {
    const partial = () => ({ pages: [{ items: [], hasNext: true, nextCursor: 'c1' }], pageParams: [undefined] });
    (api.get as jest.Mock).mockResolvedValue({ items: [], hasNext: false, nextCursor: null });
    const Probe = ({ enabled }: { enabled: boolean }) => { useSavedIds({ enabled }); return null; };
    const mount = async (enabled: boolean) => {
      const qc = client();
      qc.setQueryData(['bookmarks', 'en'], partial());
      await act(async () => { renderer.create(<QueryClientProvider client={qc}><Probe enabled={enabled} /></QueryClientProvider>); });
      await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    };
    await mount(true); // 대조군 — 활성이면 드레인이 돈다(테스트 실효 확인)
    expect(api.get).toHaveBeenCalledTimes(1);
    (api.get as jest.Mock).mockClear();
    await mount(false);
    expect(api.get).not.toHaveBeenCalled();
  });
});

// Selected cache is a summary envelope, not a paginated list or HomeResponse.
it.each([false, true])('selected cache bookmark success/rollback (reject=%s) preserves order and unavailable IDs', async (reject) => {
  const qc = client();
  const key = ['selectedHomeFoods','prod','1.1','manifest','7,8','en',true,0,0];
  qc.setQueryData(key,{items:[{...SNAP,bookmarked:false},{...SNAP,foodId:'8',bookmarked:false}],unavailableFoodIds:[]});
  if (reject) api.post.mockRejectedValueOnce(new Error('offline'));
  else api.post.mockResolvedValueOnce(undefined);
  await runToggle(qc,true);
  const data = qc.getQueryData<{items:{foodId:string;bookmarked:boolean}[];unavailableFoodIds:number[]}>(key)!;
  expect(data.items.map((x) => x.foodId)).toEqual(['7','8']);
  expect(data.items.map((x) => x.bookmarked)).toEqual([!reject,false]);
  expect(data.unavailableFoodIds).toEqual([]);
  expect(qc.getQueryState(key)?.isInvalidated).toBe(true);
  qc.clear();
});

/**
 * KB-620(Codex #184 P1) — `useFoodDetail`의 **실제 queryFn**으로 FOOD-001을 검증한다.
 *
 * 화면 테스트(foodDetailV2 · KB-620)는 `useFoodDetail`을 통째로 목 처리하고 에러를 **직접 주입**했다.
 * 그래서 통과했지만 프로덕션에선 그 분기가 한 번도 안 떴다 — 훅이 HTTP 400을 **전부** 삼켜
 * `unregisteredFoodDetail`로 바꿨기 때문이다(서버 FOOD-001 = 400). 목이 가린 층에서 동작이
 * 바뀌고 있었다. 여기선 네트워크(`api.get`)만 목 처리하고 훅의 분기는 **진짜로** 돈다.
 */
/* eslint-disable import/first --
   jest 구조상 불가피: 대상(`useFoods`)의 import는 `jest.mock('@/lib/api/client')` 선언 **뒤**에 와야
   목이 걸린다(목 팩토리는 호이스팅된다). 레포 관례와 동일(subHeaderTitleCenter403.test.tsx). */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => {
  // ApiError·isFoodHidden은 **실물** — 판별 로직까지 목으로 바꾸면 이 테스트도 빈 통이 된다
  const actual = jest.requireActual('@/lib/api/client') as Record<string, unknown>;
  return { ...actual, api: { get: (p: string) => mockGet(p) }, apiLang: () => 'en' };
});

import { ApiError, isFoodHidden } from '@/lib/api/client';
import { HIDDEN_RECHECK_MS, useFoodDetail } from '../useFoods';

type Snap = ReturnType<typeof useFoodDetail>;

/** 훅을 한 번 마운트하고 쿼리가 끝난 상태를 돌려준다. */
/** ⚠️ 테스트 격리: 마운트한 트리·클라이언트는 **테스트가 끝나면 전부 내린다**. 남겨 두면 앞 테스트의
 *  쿼리 관찰자가 뒤 테스트 중에 재조회해 `mockGet`의 1회용 응답을 가로채거나, 성공 응답으로 숨김 신호를
 *  풀어 버린다 — 순서 테스트가 실행마다 통과/실패가 갈렸던 원인(KB-626 3R에서 실측). */
const mounted: { unmount: () => void }[] = [];
const clients: QueryClient[] = [];

async function runDetail(id: string): Promise<Snap> {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false } },
  });
  clients.push(qc);
  let snap!: Snap;
  function Probe() {
    snap = useFoodDetail(id);
    return null;
  }
  await act(async () => {
    mounted.push(
      renderer.create(
        <QueryClientProvider client={qc}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
  });
  // queryFn의 reject/resolve가 상태에 반영될 때까지 한 틱 더
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return snap;
}

beforeEach(() => mockGet.mockReset());
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
  while (clients.length) clients.pop()!.clear();
});

describe('useFoodDetail — 400은 코드로만 분기(status 폴백 없음)', () => {
  it('FOOD-001(400) → **에러로 올라온다**(미등록 폴백으로 둔갑하지 않는다)', async () => {
    mockGet.mockRejectedValueOnce(new ApiError('해당 음식 정보를 찾을 수 없습니다', 400, 'FOOD-001'));
    const s = await runDetail('123');
    expect(s.data).toBeUndefined();
    expect(isFoodHidden(s.error)).toBe(true); // 화면이 이걸 보고 숨김 안내를 그린다
  });

  /* KB-626(P-405): 이 자리는 KB-620 때 "FOOD-001이 아닌 400 → 미등록 폴백 유지"로 **현재 동작을
     잠가 둔** 테스트였다. 폴백을 없애자 이 테스트가 먼저 빨개졌다 — 잠가 둔 목적 그대로다.
     폴백은 `unregisteredFoodDetail(id)`로 **숫자 id를 이름에** 넣어 사용자가 "123"을 봤다. */
  it.each(['COMMON-002', 'COMMON-001', undefined])(
    'FOOD-001이 아닌 400(%s) → **에러**로 올라온다 · 데이터 없음 = 이름에 id가 나올 자리 0',
    async (code) => {
      mockGet.mockRejectedValueOnce(new ApiError('잘못된 요청', 400, code));
      const s = await runDetail('123');
      expect(s.data).toBeUndefined(); // "123 — 판정 불가" 폴백 없음
      expect(s.error).toBeInstanceOf(ApiError);
      expect(isFoodHidden(s.error)).toBe(false); // 숨김 안내가 아니라 일반 오류 UI로
    },
  );

  it('5xx → 에러(기존 동작 무변)', async () => {
    mockGet.mockRejectedValueOnce(new ApiError('boom', 500, 'COMMON-001'));
    const s = await runDetail('123');
    expect(s.error).toBeInstanceOf(ApiError);
    expect(isFoodHidden(s.error)).toBe(false);
  });

  it('비숫자 id(스캔 미등록 음식)는 네트워크를 안 탄다 — FOOD-001 분기와 무관', async () => {
    const s = await runDetail('%EA%B9%80%EB%B0%A5'); // '김밥'
    expect(mockGet).not.toHaveBeenCalled();
    expect(s.data?.risk).toBe('unable');
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * KB-626(#185 2R) — **원천이 신호를 세우는가**. 화면은 숨김 신호(hiddenFoods) 하나로 판정하고,
 * 신호는 FOOD-001을 받은 원천이 그 자리에서 세운다. 화면 테스트는 원천을 목으로 바꾸므로 여기서
 * 원천 쪽 절반을 본다 — 네트워크만 목, 원천 코드·저장소는 **실물**. 이음매 = 같은 저장소.
 * ──────────────────────────────────────────────────────────────────────────── */
const HIDDEN = jest.requireActual('@/lib/data/hiddenFoods') as typeof import('@/lib/data/hiddenFoods');

/** 원천이 저장소에 **썼는지**를 직접 본다(React 경로는 화면 테스트 몫 — `__isFoodHiddenForTest` 주석 참고). */
const readHidden = (id: string): boolean => HIDDEN.__isFoodHiddenForTest(id);

describe('원천 ① 상세 queryFn — FOOD-001이면 세우고, 성공하면 푼다', () => {
  beforeEach(() => HIDDEN.__resetHiddenFoodsForTest());

  it('FOOD-001 → 신호 섬', async () => {
    expect(readHidden('123')).toBe(false); // 대조군: 처음엔 안 섬
    mockGet.mockRejectedValueOnce(new ApiError('x', 400, 'FOOD-001'));
    await runDetail('123');
    expect(readHidden('123')).toBe(true);
  });

  it('FOOD-001이 아닌 에러(5xx·다른 400)는 세우지 않는다', async () => {
    mockGet.mockRejectedValueOnce(new ApiError('boom', 500, 'COMMON-001'));
    await runDetail('123');
    mockGet.mockRejectedValueOnce(new ApiError('bad', 400, 'COMMON-002'));
    await runDetail('123');
    expect(readHidden('123')).toBe(false);
  });

  /* 커맨드 센터 조건 ②: 상세 쿼리는 숨김 중에도 돌아야 한다(`enabled`를 신호에 묶지 않는다). 성공이
     신호를 푸는 유일한 경로라, 쿼리를 끄면 음식이 돌아와도 영영 숨김이 된다. */
  it('숨김 상태에서 마운트 → 성공 응답 → 풀림(음식이 돌아왔다)', async () => {
    act(() => HIDDEN.markFoodHidden('123'));
    expect(readHidden('123')).toBe(true);
    mockGet.mockResolvedValueOnce({});
    await runDetail('123');
    expect(mockGet).toHaveBeenCalledTimes(1); // 숨김 중에도 쿼리가 실제로 나갔다
    expect(readHidden('123')).toBe(false);
  });

  it('숨김 중 재조회가 **네트워크 에러**면 풀리지 않는다(재조회 실패는 해제 경로가 아님)', async () => {
    act(() => HIDDEN.markFoodHidden('123'));
    mockGet.mockRejectedValueOnce(new ApiError('NETWORK: timeout'));
    await runDetail('123');
    expect(readHidden('123')).toBe(true);
  });

  /* #185 4R: 200이어도 **적응에 실패하면** 쿼리는 실패하고 캐시 상세가 남는다 — 그때 신호가 풀리면
     옛 SAFE가 드러난다. 해제는 검증(적응) 끝난 페이로드 뒤에만. */
  it.each([
    ['null 본문', null],
    ['깨진 재료 항목', { ingredients: [null] }],
  ])('숨김 중 200 + %s → 쿼리 실패 · **여전히 숨김**', async (_label, body) => {
    act(() => HIDDEN.markFoodHidden('123'));
    mockGet.mockResolvedValueOnce(body);
    const s = await runDetail('123');
    expect(s.error).toBeTruthy(); // 대조: 적응이 실제로 실패했다(아니면 이 테스트는 빈 통)
    expect(readHidden('123')).toBe(true);
  });
});

/* #185 6R(P2): 상세가 이미 성공한 뒤 **다른 원천**(리뷰·북마크)이 거부를 받으면 숨김 화면만 남는다 —
   상세 쿼리는 fresh라 스스로 다시 안 돈다. 숨김 중엔 주기 재조회로 "거부 이후 출발한 요청"을 만들어야
   음식이 돌아왔을 때 풀린다. 가짜 타이머로 시간만 흘려 본다. */
describe('숨김 중 상세 재확인 — 화면에 머물러도 음식이 돌아오면 풀린다', () => {
  beforeEach(() => {
    HIDDEN.__resetHiddenFoodsForTest();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  async function mountDetail(id: string) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(qc);
    function Probe() {
      useFoodDetail(id);
      return null;
    }
    await act(async () => {
      mounted.push(renderer.create(<QueryClientProvider client={qc}><Probe /></QueryClientProvider>));
    });
  }
  const tick = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

  it('상세 성공 → 다른 원천이 숨김 → 주기 재조회 성공 → **풀림**', async () => {
    mockGet.mockResolvedValue({});
    await mountDetail('123');
    expect(mockGet).toHaveBeenCalledTimes(1);
    act(() => HIDDEN.markFoodHidden('123')); // 리뷰·북마크가 FOOD-001을 받은 셈
    expect(readHidden('123')).toBe(true);
    await tick(HIDDEN_RECHECK_MS);
    expect(mockGet).toHaveBeenCalledTimes(2); // 숨김 뒤에 출발한 요청이 실제로 나갔다
    expect(readHidden('123')).toBe(false);
  });

  it('재확인이 계속 FOOD-001이면 숨김 유지 · 계속 재확인', async () => {
    mockGet.mockResolvedValueOnce({});
    await mountDetail('123');
    act(() => HIDDEN.markFoodHidden('123'));
    mockGet.mockRejectedValue(new ApiError('x', 400, 'FOOD-001'));
    await tick(HIDDEN_RECHECK_MS);
    await tick(HIDDEN_RECHECK_MS);
    expect(mockGet).toHaveBeenCalledTimes(3);
    expect(readHidden('123')).toBe(true);
  });

  it('대조: 숨김이 아니면 폴링하지 않는다(평소 부하 0)', async () => {
    mockGet.mockResolvedValue({});
    await mountDetail('123');
    await tick(HIDDEN_RECHECK_MS * 3);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});

describe('원천 ② 리뷰 목록 fetch — FOOD-001이면 세우고, 성공하면 푼다', () => {
  beforeEach(() => HIDDEN.__resetHiddenFoodsForTest());
  const { fetchFoodReviewsPage } = jest.requireActual('../useFoodReviews') as typeof import('../useFoodReviews');

  it('FOOD-001 → 신호 섬(상세 재조회를 기다리지 않는다) · 에러는 그대로 던진다', async () => {
    mockGet.mockRejectedValueOnce(new ApiError('x', 400, 'FOOD-001'));
    await expect(fetchFoodReviewsPage('55', null)).rejects.toBeInstanceOf(ApiError);
    expect(readHidden('55')).toBe(true);
  });

  it('성공 → 풀림', async () => {
    act(() => HIDDEN.markFoodHidden('55'));
    mockGet.mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null });
    await fetchFoodReviewsPage('55', null);
    expect(readHidden('55')).toBe(false);
  });

  it('다른 에러는 세우지 않는다', async () => {
    mockGet.mockRejectedValueOnce(new ApiError('boom', 500, 'COMMON-001'));
    await expect(fetchFoodReviewsPage('55', null)).rejects.toBeInstanceOf(ApiError);
    expect(readHidden('55')).toBe(false);
  });

  it.each([
    ['null 본문', null],
    ['깨진 리뷰 항목', { items: [null], hasNext: false, nextCursor: null }],
  ])('숨김 중 200 + %s → 실패 · **여전히 숨김**(#185 4R)', async (_label, body) => {
    act(() => HIDDEN.markFoodHidden('55'));
    mockGet.mockResolvedValueOnce(body);
    await expect(fetchFoodReviewsPage('55', null)).rejects.toThrow();
    expect(readHidden('55')).toBe(true);
  });
  /* #185 5R: 전역 피드도 foodId 필터를 주면 서버 `listReviews` → `getReadyFood` = 같은 원천. */
  it('전역 피드 + foodId 필터 FOOD-001 → 신호 섬 · 필터 없으면 부기 무관', async () => {
    const { fetchGlobalReviewsPage } = jest.requireActual('../useFoodReviews') as typeof import('../useFoodReviews');
    mockGet.mockRejectedValueOnce(new ApiError('x', 400, 'FOOD-001'));
    await expect(fetchGlobalReviewsPage(null, { foodId: '55' })).rejects.toBeInstanceOf(ApiError);
    expect(readHidden('55')).toBe(true);
    act(() => HIDDEN.__resetHiddenFoodsForTest());
    mockGet.mockRejectedValueOnce(new ApiError('x', 400, 'FOOD-001'));
    await expect(fetchGlobalReviewsPage(null)).rejects.toBeInstanceOf(ApiError);
    expect(readHidden('55')).toBe(false); // 어느 음식인지 모르는 요청은 신호를 못 세운다(세울 id 없음)
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * Codex #185 3R — **순서**. 거부보다 먼저 출발한 옛 성공이 거부 뒤에 도착해 신호를 풀면 캐시 SAFE
 * 판정이 다시 드러난다. 거부를 받은 **뒤에 출발한** 요청의 성공만 풀 수 있어야 한다.
 * ──────────────────────────────────────────────────────────────────────────── */
describe('순서 — 거부 전에 출발한 옛 성공은 신호를 풀지 못한다', () => {
  beforeEach(() => HIDDEN.__resetHiddenFoodsForTest());
  const { fetchFoodReviewsPage } = jest.requireActual('../useFoodReviews') as typeof import('../useFoodReviews');
  /** 응답을 손으로 늦추는 요청 */
  const deferred = <T,>() => {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
  };

  it('(iv) 리뷰 요청 출발(READY) → 북마크가 FOOD-001로 숨김 → 옛 리뷰 성공 도착 → **여전히 숨김**', async () => {
    const late = deferred<unknown>();
    mockGet.mockReturnValueOnce(late.promise);
    const inflight = fetchFoodReviewsPage('55', null); // 출발 — 이 시점엔 음식이 READY
    act(() => HIDDEN.markFoodHidden('55')); // 그 사이 북마크 onError가 거부를 받았다
    await act(async () => {
      late.resolve({ items: [], hasNext: false, nextCursor: null }); // 옛 성공이 이제 도착
      await inflight;
    });
    expect(readHidden('55')).toBe(true); // 풀리면 캐시 SAFE 판정이 다시 드러난다
  });

  it('(iv) 상세도 같다 — 거부 전에 나간 상세 요청의 늦은 성공은 풀지 못한다', async () => {
    const late = deferred<unknown>();
    mockGet.mockReturnValueOnce(late.promise);
    let done!: Promise<Snap>;
    await act(async () => {
      done = runDetail('123');
      await Promise.resolve();
    });
    act(() => HIDDEN.markFoodHidden('123'));
    await act(async () => {
      late.resolve({});
      await done;
    });
    expect(readHidden('123')).toBe(true);
  });

  it('(v) 거부 → **그 뒤에 출발한** 성공 → 풀림(음식이 돌아왔다)', async () => {
    act(() => HIDDEN.markFoodHidden('55')); // 먼저 거부
    mockGet.mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null });
    await fetchFoodReviewsPage('55', null); // 거부 뒤에 출발
    expect(readHidden('55')).toBe(false);
  });

  it('거부가 두 번이면 **마지막 거부 뒤에** 출발한 성공만 푼다', async () => {
    act(() => HIDDEN.markFoodHidden('55'));
    const late = deferred<unknown>();
    mockGet.mockReturnValueOnce(late.promise);
    const between = fetchFoodReviewsPage('55', null); // 첫 거부와 둘째 거부 사이에 출발
    act(() => HIDDEN.markFoodHidden('55')); // 둘째 거부
    await act(async () => {
      late.resolve({ items: [], hasNext: false, nextCursor: null });
      await between;
    });
    expect(readHidden('55')).toBe(true);
  });
});

/* eslint-disable import/first --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-650(서버 #292, KB-625) — 서버가 "존재하나 READY 아님"을 `FOOD-001`→`FOOD-018`로 분리한다.
 * 출시된 1.0.3은 001만 숨김으로 보므로 서버가 먼저 나가면 숨겨진 음식이 **일반 에러**(빨간 토스트·
 * 재시도 함정)로 보인다. 여기서 잠그는 것:
 *   ① 원천 4곳(상세 · 리뷰 목록(foodId) · 북마크 추가/복원 · 리뷰 작성)이 018을 받으면 **숨김 신호 +
 *      사유 `updating`**, 001은 `gone`. 부기는 `trackReadyFood` 한 곳이라 원천 코드는 무변 — 그래도
 *      원천별로 돌리는 이유: 어느 원천이 `trackReadyFood`를 우회하면 그 하나만 018을 못 본다(#185 5R).
 *   ② 토스트: 상세 안 = 0 · 목록 = 회복 문구 `saved.foodUpdating`(중립 아이콘) · 복원·작성 = 0
 *   ③ 사유 전환(018→001)은 구독자에 알린다 — 문구가 바뀌어야 한다
 * `ApiError`·`foodHiddenReason`·`hiddenFoods`는 **실물** — 판별까지 목이면 빈 통.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('@/lib/flags', () => ({ FLAGS: { reviewsLiveEnabled: true } }));
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual('@/lib/api/client') as Record<string, unknown>;
  return { ...actual, api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), patch: jest.fn() }, apiLang: () => 'en' };
});
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a) }));

import { ApiError } from '@/lib/api/client';
import { __foodHiddenReasonForTest, __resetHiddenFoodsForTest, markFoodHidden, trackReadyFood, useFoodHiddenReason } from '../hiddenFoods';
import { useFoodDetail } from '../useFoods';
import { fetchFoodReviewsPage } from '../useFoodReviews';
import { useRestoreBookmark, useToggleBookmark, type BookmarkSnapshot } from '../bookmarks';
import { useCreateReview } from '../useReviewMutations';

const updating = () => new ApiError('음식 정보를 갱신 중입니다', 400, 'FOOD-018');
const gone = () => new ApiError('해당 음식 정보를 찾을 수 없습니다', 400, 'FOOD-001');
const SNAP: BookmarkSnapshot = { foodId: '7', name: 'Bibimbap', nameKo: '비빔밥', risk: 'safe', photoUrl: null };
const reason = () => __foodHiddenReasonForTest('7');

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } } });
const mounted: { unmount: () => void }[] = [];

async function mount(el: React.ReactElement) {
  await act(async () => {
    mounted.push(renderer.create(<QueryClientProvider client={client()}>{el}</QueryClientProvider>));
  });
}
async function runMutation(useHook: () => { mutate: (v: never, o: { onSettled: () => void }) => void }, vars: unknown) {
  let settled!: () => void;
  const done = new Promise<void>((r) => (settled = r));
  function Harness() {
    const m = useHook();
    React.useEffect(() => {
      m.mutate(vars as never, { onSettled: () => settled() });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }
  await mount(<Harness />);
  await act(async () => { await done; });
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockToast.mockReset();
  __resetHiddenFoodsForTest();
});
afterEach(() => {
  act(() => { while (mounted.length) mounted.pop()!.unmount(); });
});

describe('trackReadyFood — 사유를 싣는다(판별은 client.ts 한 곳)', () => {
  it('018 → updating · 001 → gone · 다른 에러 → 신호 없음(전부 다시 던진다)', async () => {
    await expect(trackReadyFood('7', () => Promise.reject(updating()))).rejects.toBeInstanceOf(ApiError);
    expect(reason()).toBe('updating');
    __resetHiddenFoodsForTest();
    await expect(trackReadyFood('7', () => Promise.reject(gone()))).rejects.toBeInstanceOf(ApiError);
    expect(reason()).toBe('gone');
    __resetHiddenFoodsForTest();
    await expect(trackReadyFood('7', () => Promise.reject(new ApiError('boom', 500, 'COMMON-001')))).rejects.toBeInstanceOf(ApiError);
    expect(reason()).toBeNull();
  });

  it('거부 뒤에 출발한 성공은 018 숨김도 푼다(001과 같은 순서 규칙)', async () => {
    await trackReadyFood('7', () => Promise.reject(updating())).catch(() => undefined);
    expect(reason()).toBe('updating');
    await trackReadyFood('7', () => Promise.resolve('ok'));
    expect(reason()).toBeNull();
  });

  /* Codex #207 P2: 요청이 겹치면 **먼저 출발한** 요청의 거부가 뒤늦게 온다. 그 018이 더 나중 요청의 001을 덮으면
     삭제된 음식에 "새로 고치는 중"을 약속한다. 사유는 가장 늦게 출발한 요청의 것 — 도착 순서가 아니라 출발 순서. */
  it('먼저 출발한 옛 요청의 늦은 018은 나중 요청의 001을 덮지 못한다(도착 순서 ≠ 출발 순서)', async () => {
    let rejectOld!: (e: unknown) => void;
    const old = trackReadyFood('7', () => new Promise((_r, rej) => (rejectOld = rej))).catch(() => undefined); // 출발 1
    await trackReadyFood('7', () => Promise.reject(gone())).catch(() => undefined); // 출발 2 → 먼저 도착: gone
    expect(reason()).toBe('gone');
    rejectOld(updating()); // 출발 1의 늦은 도착
    await old;
    expect(reason()).toBe('gone'); // 여전히 gone — 숨김은 유지
    expect(__foodHiddenReasonForTest('7')).not.toBeNull();
  });

  it('양성 대조군: 나중에 출발한 요청의 001은 먼저 도착한 018을 덮는다(출발 순서대로 최신)', async () => {
    let rejectNew!: (e: unknown) => void;
    await trackReadyFood('7', () => Promise.reject(updating())).catch(() => undefined); // 출발 1 → updating
    const newer = trackReadyFood('7', () => new Promise((_r, rej) => (rejectNew = rej))).catch(() => undefined); // 출발 2
    expect(reason()).toBe('updating');
    rejectNew(gone());
    await newer;
    expect(reason()).toBe('gone');
  });

  it('사유 전환(018→001)은 구독자에 알린다 — 화면 문구가 바뀌어야 한다', async () => {
    const seen: (string | null)[] = [];
    function Probe() {
      seen.push(useFoodHiddenReason('7'));
      return null;
    }
    await mount(<Probe />);
    act(() => markFoodHidden('7', 'updating'));
    act(() => markFoodHidden('7', 'gone'));
    expect(seen.at(-1)).toBe('gone');
    expect(seen).toContain('updating');
  });
});

describe('원천 4곳 — 018 = 숨김 신호(updating) · 에러 표면 0', () => {
  it('① 상세(useFoodDetail) 018 → updating · data 없음', async () => {
    mockGet.mockRejectedValueOnce(updating());
    let snap!: ReturnType<typeof useFoodDetail>;
    function Probe() {
      snap = useFoodDetail('7');
      return null;
    }
    await mount(<Probe />);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(snap.data).toBeUndefined();
    expect(reason()).toBe('updating');
  });

  it('② 리뷰 목록(foodId) 018 → updating · 다시 던진다', async () => {
    mockGet.mockRejectedValueOnce(updating());
    await expect(fetchFoodReviewsPage('7', null)).rejects.toBeInstanceOf(ApiError);
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('foodId=7')); // 대조: 실제 경로
    expect(reason()).toBe('updating');
  });

  it('③ 북마크 추가 — 목록에서 018 → updating · 회복 문구 토스트 1(중립 아이콘·에러 아님)', async () => {
    mockPost.mockRejectedValueOnce(updating());
    await runMutation(useToggleBookmark, { snap: SNAP, add: true });
    expect(reason()).toBe('updating');
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith('saved.foodUpdating', { icon: 'info' });
  });

  it('③ 북마크 추가 — 상세에서 018 → 토스트 0(상세 안내가 설명) · 001은 여전히 중립 문구', async () => {
    mockPost.mockRejectedValueOnce(updating());
    await runMutation(useToggleBookmark, { snap: SNAP, add: true, fromDetail: true });
    expect(reason()).toBe('updating');
    expect(mockToast).not.toHaveBeenCalled();

    mockPost.mockRejectedValueOnce(gone());
    await runMutation(useToggleBookmark, { snap: SNAP, add: true });
    expect(reason()).toBe('gone');
    expect(mockToast).toHaveBeenCalledWith('saved.foodHidden', { icon: 'info' });
    expect(mockToast).not.toHaveBeenCalledWith('saved.error', expect.anything());
  });

  it('③ 북마크 복원(Undo) 018 → updating · 토스트 0', async () => {
    mockPost.mockRejectedValueOnce(updating());
    await runMutation(useRestoreBookmark, SNAP);
    expect(mockPost).toHaveBeenCalledWith('/bookmarks', { foodId: 7 });
    expect(reason()).toBe('updating');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('④ 리뷰 작성 018 → updating · 토스트 0', async () => {
    mockPost.mockRejectedValueOnce(updating());
    await runMutation(useCreateReview, { foodId: '7', rating: 5 });
    expect(mockPost).toHaveBeenCalledWith('/api/reviews', expect.objectContaining({ foodId: 7 }));
    expect(reason()).toBe('updating');
    expect(mockToast).not.toHaveBeenCalled();
  });
});

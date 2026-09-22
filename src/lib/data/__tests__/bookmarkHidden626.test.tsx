/* eslint-disable import/first --
   jest 구조상 불가피: 대상(`bookmarks`)의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅).
   레포 관례와 동일(subHeaderTitleCenter403.test.tsx). */
/**
 * KB-626(P-405 ②) — 북마크 **추가**가 FOOD-001을 받으면(서버 `bookmark` → `getReadyFood`) 에러가 아니다.
 *
 * ① 목록 카드(검색·탐색)에서 → 빨간 에러 토스트 대신 **중립 안내 토스트**
 *    ⚠️ 기본 토스트는 ✓ 체크라 "저장 성공"처럼 읽히고, `icon:'alert'`는 안전 판정 글리프(caution)라
 *    음식에 판정이 붙은 것처럼 읽힌다 — 둘 다 금지. 중립 `icon:'info'`(IconInfo — 예진 확인 대상).
 * ② 상세 안에서 → **토스트 없음**. 거부를 삼키지 않고 **숨김 신호(hiddenFoods)를 즉시 세워** 상세가 그
 *    자리에서 숨김 안내로 바뀐다 — 재조회를 기다리지 않는다(#185 2R). 토스트까지 띄우면 같은 말을 두 번 한다.
 * ③ 다른 에러는 기존 빨간 에러 토스트 그대로.
 *
 * `ApiError`·`isFoodHidden`은 **실물** — 판별까지 목으로 바꾸면 이 테스트는 빈 통이 된다.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
const mockPost = jest.fn();
const mockPatch = jest.fn();
jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual('@/lib/api/client') as Record<string, unknown>;
  return { ...actual, api: { get: jest.fn(), post: (...a: unknown[]) => mockPost(...a), patch: (...a: unknown[]) => mockPatch(...a) }, apiLang: () => 'en' };
});
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a) }));

import { ApiError } from '@/lib/api/client';
import { useRestoreBookmark, useToggleBookmark, type BookmarkSnapshot } from '../bookmarks';
import { useCreateReview } from '../useReviewMutations';

const SNAP: BookmarkSnapshot = { foodId: '7', name: 'Bibimbap', nameKo: '비빔밥', risk: 'safe', photoUrl: null };

async function runAdd(qc: QueryClient, fromDetail?: boolean, add = true) {
  let settled!: () => void;
  const done = new Promise<void>((r) => (settled = r));
  function Harness() {
    const toggle = useToggleBookmark();
    React.useEffect(() => {
      toggle.mutate({ snap: SNAP, add, fromDetail }, { onSettled: () => settled() });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await done;
  });
}

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const hidden = () => new ApiError('해당 음식 정보를 찾을 수 없습니다', 400, 'FOOD-001');

const HIDDEN = jest.requireActual('@/lib/data/hiddenFoods') as typeof import('@/lib/data/hiddenFoods');
/** 원천이 저장소에 **썼는지**를 직접 본다(React 경로는 화면 테스트 몫 — `__isFoodHiddenForTest` 주석 참고). */
const readHidden = (id: string): boolean => HIDDEN.__isFoodHiddenForTest(id);

beforeEach(() => {
  mockPost.mockReset();
  mockPatch.mockReset();
  mockToast.mockReset();
  HIDDEN.__resetHiddenFoodsForTest();
});

describe('KB-626 북마크 추가 — FOOD-001은 에러가 아니다', () => {
  it('다른 에러 → 기존 빨간 에러 토스트 (양성 대조군 — 토스트 포착이 살아 있음)', async () => {
    mockPost.mockRejectedValueOnce(new ApiError('boom', 500, 'COMMON-001'));
    await runAdd(client());
    expect(mockToast).toHaveBeenCalledWith('saved.error', { error: true });
  });

  it('목록에서 FOOD-001 → 중립 안내 1회 · 에러 변형 아님 · 성공 체크·판정 글리프 아님', async () => {
    mockPost.mockRejectedValueOnce(hidden());
    await runAdd(client());
    expect(mockToast).toHaveBeenCalledTimes(1);
    const [text, opts] = mockToast.mock.calls[0] as [string, { error?: boolean; icon?: string } | undefined];
    expect(text).toBe('saved.foodHidden');
    expect(opts?.error).toBeFalsy(); // 빨간 에러 아님
    expect(opts?.icon).toBe('info'); // 기본(✓ 성공)도 'alert'(caution 판정 글리프)도 아님
  });

  /* Codex #185 2R: 거부를 **삼키지 않고 전파**한다 — 숨김 신호를 세우면 상세가 그 즉시 판정·액션 바를
     가린다. 이전엔 onSettled 재조회에 맡겨서, 재조회가 늦거나 네트워크로 실패하면 캐시 SAFE가 남았다. */
  it('상세에서 FOOD-001 → 토스트 없음 · **숨김 신호를 즉시 세운다**(재조회를 기다리지 않음)', async () => {
    expect(readHidden('7')).toBe(false); // 대조군
    mockPost.mockRejectedValueOnce(hidden());
    await runAdd(client(), true);
    expect(mockToast).not.toHaveBeenCalled();
    expect(readHidden('7')).toBe(true);
  });

  it('목록에서 FOOD-001도 신호를 세운다 — 그 음식 상세에 들어가면 첫 프레임부터 가려진다', async () => {
    mockPost.mockRejectedValueOnce(hidden());
    await runAdd(client());
    expect(readHidden('7')).toBe(true);
  });

  it('다른 에러는 신호를 세우지 않는다', async () => {
    mockPost.mockRejectedValueOnce(new ApiError('boom', 500, 'COMMON-001'));
    await runAdd(client(), true);
    expect(readHidden('7')).toBe(false);
  });

  it('상세에서도 FOOD-001이 **아닌** 에러는 에러 토스트를 띄운다(과잉 침묵 금지)', async () => {
    mockPost.mockRejectedValueOnce(new ApiError('boom', 500, 'COMMON-001'));
    await runAdd(client(), true);
    expect(mockToast).toHaveBeenCalledWith('saved.error', { error: true });
  });

  /* #185 4R P2: 추가 성공 = 서버 `getReadyFood` 통과 → 신호를 푼다(상세·리뷰와 같은 순서 규칙).
     취소(PATCH)는 서버에서 READY 검사를 안 타므로 풀지 않는다. */
  it('숨김 중 추가 **성공** → 풀림(음식이 돌아왔다)', async () => {
    act(() => HIDDEN.markFoodHidden('7'));
    mockPost.mockResolvedValueOnce(undefined);
    await runAdd(client());
    expect(readHidden('7')).toBe(false);
  });

  it('숨김 중 **취소** 성공 → 풀지 않는다(취소는 READY 검사를 안 탄다)', async () => {
    act(() => HIDDEN.markFoodHidden('7'));
    await runAdd(client(), false, false);
    expect(mockPatch).toHaveBeenCalledTimes(1); // 대조: 취소 경로가 실제로 돌았다
    expect(readHidden('7')).toBe(true);
  });

  it('거부 **전에** 출발한 추가의 늦은 성공은 풀지 못한다', async () => {
    let resolve!: () => void;
    mockPost.mockReturnValueOnce(new Promise<void>((r) => (resolve = r)));
    let settled!: () => void;
    const done = new Promise<void>((r) => (settled = r));
    function Harness() {
      const toggle = useToggleBookmark();
      React.useEffect(() => {
        toggle.mutate({ snap: SNAP, add: true }, { onSettled: () => settled() });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }
    await act(async () => {
      renderer.create(
        <QueryClientProvider client={client()}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    act(() => HIDDEN.markFoodHidden('7')); // 요청이 떠 있는 사이 다른 원천이 거부를 받음
    await act(async () => {
      resolve();
      await done;
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(readHidden('7')).toBe(true);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * #185 5R — `POST` 원천의 나머지: Undo 복원(같은 `POST /bookmarks`)·리뷰 작성(서버 `createReview` →
 * `getReadyFood`). 부기는 엔드포인트 단위라 **모든** 호출자가 `trackReadyFood`를 타야 한다 — 복원이
 * 빠져 있던 게 이 라운드의 지적. 화면 정책(복원 = 조용한 롤백, 토스트 0)은 호출자에 그대로.
 * ──────────────────────────────────────────────────────────────────────────── */
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
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={client()}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await done;
  });
}

describe('#185 5R — Undo 복원도 같은 부기(POST /bookmarks 공용 경로)', () => {
  it('복원 FOOD-001 → 숨김 신호 섬 · 토스트 0(조용한 롤백 유지)', async () => {
    mockPost.mockRejectedValueOnce(hidden());
    await runMutation(useRestoreBookmark, SNAP);
    expect(mockPost).toHaveBeenCalledWith('/bookmarks', { foodId: 7 }); // 대조: 복원 경로가 실제로 돌았다
    expect(readHidden('7')).toBe(true);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('거부 **뒤에** 출발한 복원 성공 → 풀림', async () => {
    act(() => HIDDEN.markFoodHidden('7'));
    mockPost.mockResolvedValueOnce(undefined);
    await runMutation(useRestoreBookmark, SNAP);
    expect(readHidden('7')).toBe(false);
  });
});

describe('#185 5R — 리뷰 작성도 FOOD-001 원천(서버 createReview → getReadyFood)', () => {
  const INPUT = { foodId: '7', rating: 5 };

  it('작성 FOOD-001 → 숨김 신호 섬(상세 판정이 즉시 가려진다)', async () => {
    mockPost.mockRejectedValueOnce(hidden());
    await runMutation(useCreateReview, INPUT);
    expect(mockPost).toHaveBeenCalledWith('/api/reviews', expect.objectContaining({ foodId: 7 })); // 대조
    expect(readHidden('7')).toBe(true);
  });

  it('숨김 중 작성 성공 → 풀림', async () => {
    act(() => HIDDEN.markFoodHidden('7'));
    mockPost.mockResolvedValueOnce(undefined);
    await runMutation(useCreateReview, INPUT);
    expect(readHidden('7')).toBe(false);
  });

  it('작성의 다른 에러는 신호 무관', async () => {
    mockPost.mockRejectedValueOnce(new ApiError('boom', 500, 'COMMON-001'));
    await runMutation(useCreateReview, INPUT);
    expect(readHidden('7')).toBe(false);
  });
});

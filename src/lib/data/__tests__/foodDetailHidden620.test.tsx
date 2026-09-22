/**
 * KB-620(Codex #184 P1) — `useFoodDetail`의 **실제 queryFn**으로 FOOD-001을 검증한다.
 *
 * 화면 테스트(foodDetailV2 · KB-620)는 `useFoodDetail`을 통째로 목 처리하고 에러를 **직접 주입**했다.
 * 그래서 통과했지만 프로덕션에선 그 분기가 한 번도 안 떴다 — 훅이 HTTP 400을 **전부** 삼켜
 * `unregisteredFoodDetail`로 바꿨기 때문이다(서버 FOOD-001 = 400). 목이 가린 층에서 동작이
 * 바뀌고 있었다. 여기선 네트워크(`api.get`)만 목 처리하고 훅의 분기는 **진짜로** 돈다.
 */
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
import { useFoodDetail } from '../useFoods';

type Snap = ReturnType<typeof useFoodDetail>;

/** 훅을 한 번 마운트하고 쿼리가 끝난 상태를 돌려준다. */
async function runDetail(id: string): Promise<Snap> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let snap!: Snap;
  function Probe() {
    snap = useFoodDetail(id);
    return null;
  }
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  // queryFn의 reject/resolve가 상태에 반영될 때까지 한 틱 더
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return snap;
}

beforeEach(() => mockGet.mockReset());

describe('useFoodDetail — FOOD-001은 400 폴백보다 먼저', () => {
  it('FOOD-001(400) → **에러로 올라온다**(미등록 폴백으로 둔갑하지 않는다)', async () => {
    mockGet.mockRejectedValueOnce(new ApiError('해당 음식 정보를 찾을 수 없습니다', 400, 'FOOD-001'));
    const s = await runDetail('123');
    expect(s.data).toBeUndefined();
    expect(isFoodHidden(s.error)).toBe(true); // 화면이 이걸 보고 숨김 안내를 그린다
  });

  it('FOOD-001이 아닌 400 → 기존 미등록 폴백 그대로(판정 불가 — FR-033 무변)', async () => {
    mockGet.mockRejectedValueOnce(new ApiError('잘못된 요청', 400, 'COMMON-002'));
    const s = await runDetail('123');
    expect(s.error).toBeNull();
    expect(s.data?.risk).toBe('unable'); // 보수적 판정 유지(헌법 III)
  });

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

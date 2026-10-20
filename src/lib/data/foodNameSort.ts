/**
 * KB-821 — 음식 탭·저장 목록 이름 정렬(서버 3.1 계약, #407 KB-803). dev Swagger `/api/foods`·`/api/bookmarks`:
 * `X-API-Version: 3.1` + `sort=name_asc|name_desc`, nextCursor = 불투명 문자열(그대로 전달).
 * 이름 정렬을 고를 때만 이 경로를 탄다 — 기본 정렬은 기존 요청·숫자 커서 바이트 그대로(sort=undefined).
 *
 * 400 FOOD-002(커서·범위 불일치) · 409 FOOD-022(목록 변경) = "첫 페이지부터 다시". 다음 페이지에서 오면 재시작 표식 페이지를
 * 돌려주고(에러 상태·토스트 0), 훅이 그 쿼리를 첫 페이지부터 리셋한다. 첫 페이지 409는 한 번 바로 재요청.
 */
import * as React from 'react';
import { useQueryClient, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import type { PageMenuSummaryWire } from '../api/foodListTypes';

export type FoodNameSort = 'name_asc' | 'name_desc';
export const NAME_SORT_API_VERSION = '3.1';
const RESTART_CODES = new Set(['FOOD-002', 'FOOD-022']);

/** 재시작 표식 페이지 — items 0·hasNext false(더 당기지 않음). */
export type SortedPage = PageMenuSummaryWire & { restart?: true };

export function nameSortQuery(sort: FoodNameSort | undefined): string {
  return sort ? `&sort=${sort}` : '';
}
export function nameSortOptions(sort: FoodNameSort | undefined) {
  return sort ? { headers: { 'X-API-Version': NAME_SORT_API_VERSION } } : undefined;
}

/** 이름 정렬 페이지 요청 — 재시작 코드는 표식 페이지로 바꾼다(에러 상태·토스트 0). 첫 페이지 409는 커서가 없으니 한 번 바로 재요청.
 *  기본 정렬(sort 없음)은 손대지 않는다. */
export async function fetchSortedPage(sort: FoodNameSort | undefined, firstPage: boolean, run: () => Promise<PageMenuSummaryWire>): Promise<SortedPage> {
  if (!sort) return run();
  try {
    return await run();
  } catch (e) {
    if (!(e instanceof ApiError) || !e.code || !RESTART_CODES.has(e.code)) throw e;
    if (firstPage) return run();
    return { items: [], hasNext: false, restart: true };
  }
}

/** 마지막 페이지가 재시작 표식이면 그 쿼리를 첫 페이지부터 다시(조용히). 표식 페이지가 **캐시에 반영된 뒤**(effect) 리셋한다 —
 *  queryFn 안에서 리셋하면 진행 중이던 그 페치가 취소되며 옛 페이지로 되돌아간다(실측). */
export function useRestartOnStaleCursor(queryKey: QueryKey, dataUpdatedAt: number) {
  const qc = useQueryClient();
  const keyJson = JSON.stringify(queryKey);
  React.useEffect(() => {
    const key = JSON.parse(keyJson) as QueryKey;
    const pages = qc.getQueryData<InfiniteData<SortedPage>>(key)?.pages;
    if (pages?.[pages.length - 1]?.restart) void qc.resetQueries({ queryKey: key, exact: true });
  }, [dataUpdatedAt, keyJson, qc]);
}

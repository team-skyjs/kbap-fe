/**
 * ads/feedSlots (KB-739 ④-③④) — 목록에 "N개마다 광고 1개"를 끼운 행 배열. 광고 행 key는 순번 고정(`ad-1`, `ad-2`…)이라
 * 페이지가 늘어도 앞 광고 행의 identity가 안 바뀐다(리스트 key 안정). N개 미만이면 광고 0.
 */
export type FeedRow<T> = { kind: 'item'; key: string; item: T } | { kind: 'ad'; key: string; slot: number };

export const FEED_AD_EVERY = 3;
/** KB-816(예진 10/20): 리뷰 탭 피드만 5개마다. 음식 상세 미리보기는 최대 3장이라 기본 3 유지(5면 광고 0). */
export const REVIEW_FEED_AD_EVERY = 5;

export function withFeedAds<T>(items: readonly T[], keyOf: (item: T) => string, every: number = FEED_AD_EVERY): FeedRow<T>[] {
  const rows: FeedRow<T>[] = [];
  let slot = 0;
  items.forEach((item, i) => {
    rows.push({ kind: 'item', key: keyOf(item), item });
    if ((i + 1) % every === 0) { slot += 1; rows.push({ kind: 'ad', key: `ad-${slot}`, slot }); }
  });
  return rows;
}

import type { FoodCard } from './types';
import type { MenuSummaryWire } from './foodListTypes';
import { adaptMenuSummary } from './foodAdapter';

export type SelectedFoods = { items: FoodCard[]; unavailableFoodIds: number[] };
const fail = (): never => { throw new Error('Invalid selected foods response'); };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail();
export function adaptSelectedFoods(value: unknown, requested: readonly number[]): SelectedFoods {
  const raw = record(value);
  if (!Array.isArray(raw.items) || !Array.isArray(raw.unavailableFoodIds)) return fail();
  const rows = raw.items.map((item) => {
    const r = record(item);
    if (!Number.isSafeInteger(r.foodId) || !requested.includes(r.foodId as number) || typeof r.name !== 'string' || !r.name.trim() ||
        typeof r.spiciness !== 'number' || !Number.isFinite(r.spiciness) || r.spiciness < 0 || r.spiciness > 10 ||
        !['SAFE', 'CAUTION', 'DANGER', 'UNKNOWN'].includes(r.overallRiskStatus as string) || typeof r.bookmarked !== 'boolean') return fail();
    for (const field of ['koreanName', 'imageRef', 'publishedAt']) if (r[field] != null && typeof r[field] !== 'string') return fail();
    const review = record(r.review);
    if (!Number.isSafeInteger(review.count) || (review.count as number) < 0 || typeof review.averageRating !== 'number' ||
        !Number.isFinite(review.averageRating) || review.averageRating < 0 || review.averageRating > 5) return fail();
    return r as unknown as MenuSummaryWire;
  });
  const unavailable = raw.unavailableFoodIds;
  const available = rows.map((r) => r.foodId);
  const all = [...available, ...unavailable];
  if (all.length !== requested.length || new Set(all).size !== requested.length ||
      all.some((id) => !Number.isSafeInteger(id) || !requested.includes(id))) return fail();
  for (const ids of [available, unavailable]) {
    if (ids.some((id, index) => index > 0 && requested.indexOf(id) <= requested.indexOf(ids[index - 1]))) return fail();
  }
  return { items: rows.map(adaptMenuSummary), unavailableFoodIds: unavailable };
}

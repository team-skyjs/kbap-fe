/**
 * P-143: 검색 유도 큐레이션 잠금 — placeholder 로테이션·인기 사진 정렬.
 */
import { placeholderKeyword, popularPhotoFoods, SEED_POOL_N } from '../discovery';
import type { FoodCard } from '@/lib/api/types';

const F = (id: string, rank: number | undefined, photo: string | null): FoodCard => ({
  foodId: id,
  name: `Name${id}`,
  nameKo: `한식${id}`,
  photoUrl: photo,
  risk: 'safe',
  overall: { average: null, count: 0 },
  sameNationality: { average: null, count: 0 },
  popularityRank: rank,
});

const CATALOG = [F('3', 3, null), F('1', 1, 'p1'), F('99', undefined, 'p99'), F('2', 2, 'p2')];

it('placeholder — 랭크 상위 풀에서 선택(rand 주입 결정적), 미로드 시 null', () => {
  expect(placeholderKeyword(undefined)).toBe(null);
  expect(placeholderKeyword([])).toBe(null);
  // rand=0 → 풀 첫 항목 = rank 1
  expect(placeholderKeyword(CATALOG, () => 0)).toBe('Name1');
  // rand 상한 근처 → 풀 마지막(랭크 무보유는 뒤) — 풀 크기 내 로테이션
  expect(placeholderKeyword(CATALOG, () => 0.999)).toBe('Name99');
  expect(SEED_POOL_N).toBeGreaterThanOrEqual(8);
  expect(SEED_POOL_N).toBeLessThanOrEqual(12);
});

it('인기 사진 — 랭크 정렬 + 사진 보유 우선(무사진은 뒤)', () => {
  const out = popularPhotoFoods(CATALOG, 4);
  expect(out.map((f) => f.foodId)).toEqual(['1', '2', '99', '3']); // 사진(1,2,99) 먼저, 무사진(3) 마지막
  expect(popularPhotoFoods(undefined)).toEqual([]);
});

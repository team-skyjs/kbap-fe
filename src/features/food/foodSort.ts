/** 음식 탭 정렬 시트 값 → 서버 sort 파라미터(KB-821 이름 정렬 · KB-956 Popular = 리뷰 많은 순). 화면 컴포넌트와 분리 — 유닛 잠금용 */
import { FLAGS } from '@/lib/flags';
import type { FoodNameSort } from '@/lib/data/foodNameSort';

export type FoodSort = 'popular' | 'new' | Exclude<FoodNameSort, 'reviews'>;

// KB-956: Popular = 리뷰 많은 순(sort=reviews) — 플래그 off(운영 서버 릴리스 전) = 기존 기본 정렬(파라미터 없음)
export const nameSortOf = (s: FoodSort): FoodNameSort | undefined =>
  s === 'name_asc' || s === 'name_desc' ? s : s === 'popular' && FLAGS.popularByReviews ? 'reviews' : undefined;

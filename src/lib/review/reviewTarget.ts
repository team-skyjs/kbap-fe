/**
 * KB-812 2차 — 리뷰 대상(음식 · 가공식품) 분기 한 곳. 카드·상세·내 리뷰가 대상 링크·수정 경로를 여기서만 얻는다
 * (화면마다 `/food/${foodId}`를 직접 쓰면 가공식품 리뷰가 `/food/`(빈 id)로 간다).
 */
import type { Href } from 'expo-router';
import type { Review } from '@/lib/api/types';

export const isPackagedReview = (r: Pick<Review, 'target'>): boolean => r.target === 'packaged';

/** 계측 target_type 값 */
export const reviewTargetType = (r: Pick<Review, 'target'>): 'food' | 'packaged' => (isPackagedReview(r) ? 'packaged' : 'food');

/** 대상 상세 — 음식은 src(food_detail_view 출처), 가공식품은 제품 상세. 대상 미상 = null(탭 무동작) */
export function reviewTargetHref(r: Pick<Review, 'target' | 'foodId' | 'processedFoodId'>, src: string): Href | null {
  if (isPackagedReview(r)) return r.processedFoodId ? (`/processed-foods/${r.processedFoodId}` as Href) : null;
  return r.foodId ? (`/food/${r.foodId}?src=${src}` as Href) : null;
}

/** 내 리뷰 수정 화면 — 대상별 작성 화면의 편집 모드 */
export function reviewEditHref(r: Pick<Review, 'id' | 'target' | 'foodId' | 'processedFoodId'>): Href | null {
  if (isPackagedReview(r)) return r.processedFoodId ? (`/processed-foods/${r.processedFoodId}/review?reviewId=${r.id}` as Href) : null;
  return r.foodId ? (`/food/${r.foodId}/review?reviewId=${r.id}` as Href) : null;
}

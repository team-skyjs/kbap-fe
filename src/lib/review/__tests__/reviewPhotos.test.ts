/** P-077(KB-16): 리뷰 폼 유효성·사진 상한 잠금. */
import { addReviewPhotos, canPostReview, removeReviewPhoto, REVIEW_MAX_PHOTOS } from '../reviewPhotos';

it('사진 상한 3 — 초과 선택은 잘린다', () => {
  expect(REVIEW_MAX_PHOTOS).toBe(3);
  expect(addReviewPhotos([], ['a', 'b'])).toEqual(['a', 'b']);
  expect(addReviewPhotos(['a', 'b'], ['c', 'd'])).toEqual(['a', 'b', 'c']);
  expect(addReviewPhotos(['a', 'b', 'c'], ['d'])).toEqual(['a', 'b', 'c']);
});

it('개별 삭제 — 지정 URI만 제거', () => {
  expect(removeReviewPhoto(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  expect(removeReviewPhoto(['a'], 'x')).toEqual(['a']);
});

it('폼 유효성 — 별점 1~5 정수 필수, 텍스트·사진 무관', () => {
  expect(canPostReview(0)).toBe(false);
  expect(canPostReview(1)).toBe(true);
  expect(canPostReview(5)).toBe(true);
  expect(canPostReview(6)).toBe(false);
  expect(canPostReview(3.5)).toBe(false);
});

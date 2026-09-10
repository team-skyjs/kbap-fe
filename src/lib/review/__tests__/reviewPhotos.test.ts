/** P-077(KB-16): 리뷰 폼 유효성·사진 상한 잠금. */
import { addReviewPhotos, canPostReview, removeReviewPhoto, reviewPhotoKey, REVIEW_MAX_PHOTOS, type ReviewPhoto } from '../reviewPhotos';

// P-358(KB-521): 슬롯 = remote|local 유니온 — 로컬 픽 헬퍼
const L = (uri: string): ReviewPhoto => ({ kind: 'local', uri });
const R = (url: string): ReviewPhoto => ({ kind: 'remote', url });

it('사진 상한 3 — 초과 선택은 잘린다(remote 기존분 포함 총합 기준)', () => {
  expect(REVIEW_MAX_PHOTOS).toBe(3);
  expect(addReviewPhotos([], ['a', 'b'])).toEqual([L('a'), L('b')]);
  expect(addReviewPhotos([L('a'), L('b')], ['c', 'd'])).toEqual([L('a'), L('b'), L('c')]);
  expect(addReviewPhotos([R('https://cdn/x.jpg'), L('b'), L('c')], ['d'])).toEqual([R('https://cdn/x.jpg'), L('b'), L('c')]);
});

it('개별 삭제 — 키(remote=URL·local=URI)로 제거', () => {
  expect(removeReviewPhoto([L('a'), R('https://cdn/b.jpg'), L('c')], 'https://cdn/b.jpg')).toEqual([L('a'), L('c')]);
  expect(removeReviewPhoto([L('a')], 'x')).toEqual([L('a')]);
  expect(reviewPhotoKey(R('u'))).toBe('u');
  expect(reviewPhotoKey(L('v'))).toBe('v');
});

it('폼 유효성 — 별점 1~5 정수 필수, 텍스트·사진 무관', () => {
  expect(canPostReview(0)).toBe(false);
  expect(canPostReview(1)).toBe(true);
  expect(canPostReview(5)).toBe(true);
  expect(canPostReview(6)).toBe(false);
  expect(canPostReview(3.5)).toBe(false);
});

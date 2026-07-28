/**
 * reviewPhotos.ts — 리뷰 사진 첨부(P-077/KB-16, 최대 3장) 순수 헬퍼 + 업로드 어댑터.
 *
 * 업로드 어댑터: 리뷰 저장 자체가 목이므로 로컬 URI 패스스루. 실연결(KB-73) 때
 * 기존 presigned 플로우(scanImage.ts의 /images/upload-url 규약)로 이 함수만 스왑.
 */
export const REVIEW_MAX_PHOTOS = 3;

/** 첨부 추가 — 상한 3장 초과분은 자름(뒤에 고른 것 버림). */
export function addReviewPhotos(current: string[], picked: string[]): string[] {
  return [...current, ...picked].slice(0, REVIEW_MAX_PHOTOS);
}

export function removeReviewPhoto(current: string[], uri: string): string[] {
  return current.filter((u) => u !== uri);
}

/** 별점 필수 — 1~5 정수(계약). 텍스트·사진은 선택. */
export function canPostReview(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

/** 목: 로컬 URI 그대로 반환. 실연결: presigned 업로드 후 서버 경로 배열. */
export async function uploadReviewImages(uris: string[]): Promise<string[]> {
  return uris;
}

/**
 * reviewPhotos.ts — 리뷰 사진 첨부(P-077/KB-16, 최대 3장) 순수 헬퍼 + 업로드 어댑터.
 *
 * P-085(KB-73): 업로드 실연결 — 기존 presigned 플로우(scanImage.uploadImage:
 * 발급→PUT→complete) 재사용, purpose="REVIEW"(스웨거 enum 실측). 전송값 = path
 * (objectKey), 조회는 서버 조합 완전 URL — 프로필 사진과 동일 규약. 세션 없는
 * 개발 경로만 URI 패스스루 유지.
 */
import { uploadImage } from '@/lib/api/scanImage';
import { hasBeSession } from '@/lib/auth/beAuth';
import { FLAGS } from '@/lib/flags';

/** BE 스웨거 UploadUrlRequest.purpose enum 실측: MENU_SCAN | REVIEW | PROFILE_IMAGE. */
export const REVIEW_IMAGE_PURPOSE = 'REVIEW';

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

/** presigned 업로드 → 전송용 path 배열. 실패는 throw(호출측 표면화 — 부분 업로드 잔존 없음). */
export async function uploadReviewImages(uris: string[]): Promise<string[]> {
  // P-086 봉인: 실연결 off·무세션 → 로컬 URI 패스스루 (P-077 목 경로 — 업로드 호출 0)
  if (!FLAGS.reviewsLiveEnabled || !(await hasBeSession())) return uris;
  const paths: string[] = [];
  for (const uri of uris) {
    const { path } = await uploadImage({ uri, width: 0, height: 0 }, REVIEW_IMAGE_PURPOSE);
    paths.push(path);
  }
  return paths;
}

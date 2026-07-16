/**
 * scanImage.ts — 스캔 사진 업로드 흐름의 어댑터 경계 (KB-72, 2026-07-16 계약).
 *
 * 완성 흐름(계약): presigned 발급 → PUT 업로드 → POST /images/complete(검증
 * 신고, 멱등) → 반환 path 를 ScanRequest.imagePath 로.
 *
 * 현재: presigned **발급 API 가 BE 에 미배포** (2026-07-16 실측 — complete 만
 * 있음). 발급 파트만 스텁이고 complete 연동은 실코드다. 발급 API 가 배포되면
 * resolveScanImagePath 의 TODO 만 채우면 된다.
 *
 * 실패 경로(헌법 III — 가짜 결과 금지): 업로드가 불가하면 null 을 반환하고
 * 스캔은 imagePath '' 로 진행(텍스트-only, 계약상 required 지만 minLength 0).
 * 서버가 '' 를 거부하면 그 에러가 그대로 표면화된다 — 가짜 safe 없음.
 */
import { api } from './client';
import type { ImageCompletePayload, ImageCompleteRequest } from './scanTypes';

type PhotoFile = { uri: string; width: number; height: number };

/**
 * 업로드 완료 신고 — 서버가 실제 이미지인지 검증 후 경로를 확정한다.
 * 400: IMAGE-001(이미지 아님) / 002(신고값 불일치) / 003(오브젝트 없음).
 */
export async function completeImageUpload(req: ImageCompleteRequest): Promise<string> {
  const payload = await api.post<ImageCompletePayload>('/images/complete', req);
  return payload.path;
}

/**
 * 촬영 사진 → 검증된 imagePath. 업로드 불가/실패 시 null (텍스트-only 폴백).
 * ⑦(KB-137) 순서 주의: 이 함수는 촬영 파일 삭제(교체/언마운트 시)보다 먼저,
 * 스캔 요청 직전에 호출된다 — 업로드 전에 파일이 지워지는 경로 없음.
 */
export async function resolveScanImagePath(photo: PhotoFile | null): Promise<string | null> {
  if (!photo) return null; // 샘플 스캔 — 사진 자체가 없음
  // TODO(KB-72): presigned 발급 API 대기 (2026-07-16 실측 미배포). 배포되면:
  //   1. 발급 API → { uploadUrl, path }
  //   2. FileSystem.uploadAsync(uploadUrl, photo.uri, { httpMethod: 'PUT', headers: { 'Content-Type': contentType } })
  //   3. return completeImageUpload({ path, contentType, size })
  // 실패 시 throw 하지 말고 null 반환 유지(텍스트-only 폴백) — 단, BE 가 '' 를
  // 거부하는 것으로 확정되면 정직한 에러로 전환할 것.
  console.log('[scan] imagePath 생략 — presigned 발급 API 대기 (TODO(KB-72))');
  return null;
}

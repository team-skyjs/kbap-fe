/**
 * scanImage.ts — 이미지 업로드 흐름의 어댑터 경계 (KB-72, presigned 실연동
 * 2026-07-16 — P-003).
 *
 * 흐름: POST /images/upload-url (발급 — 용도·형식·크기 검증) → uploadUrl 로
 * PUT (⚠️ requiredHeaders 그대로 — Content-Type/Length 불일치 시 스토리지 거절)
 * → POST /images/complete (검증 신고, 멱등) → 반환 path 를 imagePath 로.
 *
 * purpose 는 파라미터 — 프로필 이미지(KB-149, P-004)와 공용 (중복 구현 금지).
 *
 * 실패 경로(헌법 III — 가짜 결과 금지): 발급/업로드/신고 어디서 실패하든
 * null 반환 → 스캔은 imagePath '' 로 진행(텍스트-only, BE 허용 확정 7/16).
 * 업로드 실패가 스캔 자체를 죽이지 않는다 — 가짜 safe 없음.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { api } from './client';
import type { ImageCompletePayload, ImageCompleteRequest, UploadUrlPayload, UploadUrlRequest } from './scanTypes';

type PhotoFile = { uri: string; width: number; height: number };

/** uri 확장자 → Content-Type (기본 jpeg — 카메라/피커 산출물). */
export function imageContentType(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  return { png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif' }[ext] ?? 'image/jpeg';
}

/**
 * 업로드 완료 신고 — 서버가 실제 이미지인지 검증 후 경로를 확정한다.
 * 400: IMAGE-001(이미지 아님) / 002(신고값 불일치) / 003(오브젝트 없음).
 */
export async function completeImageUpload(req: ImageCompleteRequest): Promise<string> {
  const payload = await api.post<ImageCompletePayload>('/images/complete', req);
  return payload.path;
}

/**
 * 발급 → PUT 업로드 → 완료 신고. 성공 시 검증된 오브젝트 경로, 실패 시 throw.
 * (호출측이 폴백 정책을 정한다 — 스캔은 null→'', 프로필은 정직한 에러+사진 없이 진행)
 */
export async function uploadImage(file: PhotoFile, purpose: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(file.uri); // size 는 존재 시 기본 포함 (legacy API)
  if (!info.exists || typeof info.size !== 'number') throw new Error(`file missing: ${file.uri}`);
  const contentType = imageContentType(file.uri);

  const issueReq: UploadUrlRequest = { purpose, contentType, contentLength: info.size };
  const issued = await api.post<UploadUrlPayload>('/images/upload-url', issueReq);
  console.log(`[scan] upload-url issued | key = ${issued.objectKey}`);

  const put = await FileSystem.uploadAsync(issued.uploadUrl, file.uri, {
    httpMethod: (issued.method || 'PUT') as FileSystem.FileSystemAcceptedUploadHttpMethod,
    headers: issued.requiredHeaders, // 발급값 그대로 — 임의 추가/변경 금지
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });
  if (put.status < 200 || put.status >= 300) throw new Error(`storage PUT ${put.status}`);

  const path = await completeImageUpload({ path: issued.objectKey, contentType, size: info.size });
  console.log(`[scan] image upload complete | path = ${path}`);
  return path;
}

/**
 * 촬영 사진 → 검증된 imagePath. 실패 시 null (텍스트-only 폴백 — '' 허용 BE 확정).
 * ⑦(KB-137) 순서: 이 함수는 촬영 파일 삭제(교체/언마운트 시)보다 먼저,
 * 스캔 요청 직전에 호출된다 — 업로드 전에 파일이 지워지는 경로 없음.
 */
export async function resolveScanImagePath(photo: PhotoFile | null): Promise<string | null> {
  if (!photo) return null; // 샘플 스캔 — 사진 자체가 없음
  try {
    return await uploadImage(photo, 'MENU_SCAN');
  } catch (e) {
    console.log('[scan] image upload failed — 텍스트-only 폴백:', (e as Error)?.message ?? e);
    return null;
  }
}

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
 * null 반환 → 스캔은 imagePath '' 로 요청하지만 **서버가 빈 imagePath를 400으로 거절**한다(v1·v2 모두 @NotBlank —
 * 7/16의 "'' 허용"은 그 뒤 바뀌었다). 즉 업로드 실패 = 스캔 실패(기존 스캔 실패 화면). 폴백 코드는 KB-711에서 그대로 둔다.
 * 가짜 safe는 없다(실패는 실패로 보인다).
 */
import { track } from '@/lib/net/inflight';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from './client';
import { UploadAbortedError } from './uploadAbort';
import type { ImageCompletePayload, ImageCompleteRequest, UploadUrlPayload, UploadUrlRequest } from './scanTypes';

type PhotoFile = { uri: string; width: number; height: number };

/** uri 확장자 → Content-Type (기본 jpeg — 카메라/피커 산출물). */
export function imageContentType(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  return { png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif' }[ext] ?? 'image/jpeg';
}

/** P-189: 업로드 = **JPEG만**(쿠팡 관례 — PNG 스크린샷 렌더 느림). png 포함 그 외
 *  전부 JPEG(q0.8) 재인코딩. 향후 신규 표면도 uploadImage() 경유가 규칙 —
 *  upload-url 직접 호출 금지(이 관문 한 곳이 형식 정책 전체를 소유). */
const UPLOAD_OK = new Set(['image/jpeg']);

/**
 * P-127(8/4 실측): 아이폰 카메라 원본(HEIC)이 픽커에서 무변환 통과 →
 * POST /images/upload-url 400 UPLOAD-001. **공용 길목 한 곳 방어** — jpeg/png가
 * 아니면 expo-image-manipulator로 JPEG(q0.8) 재인코딩(기설치 — 지문 무변).
 * 재인코딩 실패는 그대로 throw — 호출측 기존 에러 경로 표면화(무한 대기 금지).
 */
async function ensureUploadable(file: PhotoFile): Promise<{ file: PhotoFile; contentType: string }> {
  const contentType = imageContentType(file.uri);
  if (UPLOAD_OK.has(contentType)) return { file, contentType };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { manipulateAsync, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  const out = await manipulateAsync(file.uri, [], { compress: 0.8, format: SaveFormat.JPEG });
  console.log(`[upload] ${contentType} → image/jpeg 재인코딩 (P-127) | ${out.width}x${out.height}`);
  return { file: { uri: out.uri, width: out.width, height: out.height }, contentType: 'image/jpeg' };
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
 * KB-711: 스토리지 PUT 상한 — 전엔 JS 쪽 타임아웃·취소가 없어 끝나는 시점이 OS 네트워크에 달렸다(약한 망에서 제출이 끝나지 않음).
 * 값 근거: 리뷰·문의·커뮤니티·프로필·주문 사진 1장 — 대개 1~3MB. 약한 3G(≈50KB/s)에서 3MB ≈ 60초 → 60초.
 * 메뉴 스캔은 제외(상한 없음 — resolveScanImagePath): 카메라 원본 2~4MB라 이 값이 그대로 경계고, 스캔은 사용자가 갇히는 화면이 아니다.
 * **PUT만** 제한한다(발급·완료는 client.ts 15초 상한, 스캔의 서버 처리 대기 120초는 별개 흐름 — 손대지 않음).
 * ponytail: 장당 고정 상한 — 사진 크기별 가변 상한이 필요하면 contentLength로 계산.
 */
export const UPLOAD_PUT_TIMEOUT_MS = 60_000;


/** PUT 한 번 — 상한 초과 = 일반 실패(재시도 가능), signal 중단 = UploadAbortedError. 어느 쪽이든 네이티브 업로드는 취소한다 */
function putWithLimit(
  url: string,
  uri: string,
  options: FileSystem.FileSystemUploadOptions,
  signal?: AbortSignal,
  timeoutMs: number | null = UPLOAD_PUT_TIMEOUT_MS,
): Promise<FileSystem.FileSystemUploadResult> {
  const task = FileSystem.createUploadTask(url, uri, options);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      fn();
    };
    const cancel = () => void task.cancelAsync().catch(() => {});
    const onAbort = () => {
      cancel();
      finish(() => reject(new UploadAbortedError()));
    };
    const timer =
      timeoutMs == null
        ? undefined
        : setTimeout(() => {
            cancel();
            finish(() => reject(new Error(`storage PUT timeout ${timeoutMs}ms`)));
          }, timeoutMs);
    signal?.addEventListener('abort', onAbort);
    task.uploadAsync().then(
      (res) => finish(() => (res ? resolve(res) : reject(new Error('storage PUT cancelled')))),
      (e) => finish(() => reject(e)),
    );
  });
}

export interface UploadedImage {
  path: string; // complete 가 검증·확정한 오브젝트 경로 — 스캔 imagePath 용
  publicUrl: string; // 만료 없는 표시용 URL — 프로필 profileImageUrl 용 (P-004)
}

/**
 * 발급 → PUT 업로드 → 완료 신고. 성공 시 검증된 경로·표시 URL, 실패 시 throw.
 * (호출측이 폴백 정책을 정한다 — 스캔은 null→'', 프로필은 정직한 에러+사진 없이 진행)
 */
export async function uploadImage(
  rawFile: PhotoFile,
  purpose: string,
  opts: { signal?: AbortSignal; timeoutMs?: number | null } = {},
): Promise<UploadedImage> {
  // KB-711: 화면을 떠나 signal이 중단되면 다음 단계로 가지 않는다(다음 사진·본 요청도 나가지 않게 — 호출측 루프가 여기서 멈춤)
  // timeoutMs: PUT 상한(기본 UPLOAD_PUT_TIMEOUT_MS) · null = 상한 없음(메뉴 스캔 — resolveScanImagePath)
  const { signal, timeoutMs = UPLOAD_PUT_TIMEOUT_MS } = opts;
  const bail = () => {
    if (signal?.aborted) throw new UploadAbortedError();
  };
  bail();
  // P-127: HEIC 등 비허용 형식은 여기서 JPEG 재인코딩 — 호출처(리뷰·스캔·프로필) 수정 0
  const { file, contentType } = await ensureUploadable(rawFile);
  bail();
  const info = await FileSystem.getInfoAsync(file.uri); // size 는 존재 시 기본 포함 (legacy API)
  if (!info.exists || typeof info.size !== 'number') throw new Error(`file missing: ${file.uri}`);

  const issueReq: UploadUrlRequest = { purpose, contentType, contentLength: info.size };
  const issued = await api.post<UploadUrlPayload>('/images/upload-url', issueReq);
  console.log(`[scan] upload-url issued | key = ${issued.objectKey}`);
  bail();

  // #109 3R: 네이티브 업로드는 client.ts 밖 — inflight.track으로 OTA 정적 창에 포함(상한·취소로 끝나도 track이 정산된다)
  const put = await track(putWithLimit(issued.uploadUrl, file.uri, {
    httpMethod: (issued.method || 'PUT') as FileSystem.FileSystemAcceptedUploadHttpMethod,
    headers: issued.requiredHeaders, // 발급값 그대로 — 임의 추가/변경 금지
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  }, signal, timeoutMs));
  if (put.status < 200 || put.status >= 300) throw new Error(`storage PUT ${put.status}`);
  bail();

  const path = await completeImageUpload({ path: issued.objectKey, contentType, size: info.size });
  console.log(`[scan] image upload complete | path = ${path}`);
  return { path, publicUrl: issued.publicUrl };
}

/**
 * 촬영 사진 → 검증된 imagePath. 실패 시 null → 스캔 요청은 서버에서 400(빈 imagePath 거절) = 스캔 실패.
 * KB-711: 스캔 PUT은 **상한 없음**(timeoutMs null) — 카메라 원본(대개 2~4MB)이 약한 망에서 60초를 넘기 쉽고, 끊으면 "느림"이 "불가"가 된다.
 * ⑦(KB-137) 순서: 이 함수는 촬영 파일 삭제(교체/언마운트 시)보다 먼저,
 * 스캔 요청 직전에 호출된다 — 업로드 전에 파일이 지워지는 경로 없음.
 */
export async function resolveScanImagePath(photo: PhotoFile | null): Promise<string | null> {
  if (!photo) return null; // 샘플 스캔 — 사진 자체가 없음
  try {
    return (await uploadImage(photo, 'MENU_SCAN', { timeoutMs: null })).path; // KB-711: 스캔 PUT은 상한 없음(위 주석)
  } catch (e) {
    console.log('[scan] image upload failed — 빈 imagePath로 진행(서버 400 = 스캔 실패):', (e as Error)?.message ?? e);
    return null;
  }
}

/**
 * P-003(KB-72 마무리): presigned 업로드 흐름을 잠근다.
 * 발급 body(purpose/contentType/contentLength 정확값) · PUT에 requiredHeaders
 * 그대로 · complete body(objectKey/size) · 실패 시 스캔은 null 폴백(텍스트-only).
 */
const mockGetInfoAsync = jest.fn();
const mockUploadAsync = jest.fn();
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: (...a: unknown[]) => mockGetInfoAsync(...a),
  uploadAsync: (...a: unknown[]) => mockUploadAsync(...a),
  FileSystemUploadType: { BINARY_CONTENT: 'binary' },
}));
jest.mock('@/lib/api/client', () => ({ api: { post: jest.fn() } }));

/* eslint-disable @typescript-eslint/no-require-imports */
const { api } = require('@/lib/api/client');
/* eslint-enable @typescript-eslint/no-require-imports */

import { imageContentType, resolveScanImagePath, uploadImage } from '../scanImage';

const PHOTO = { uri: 'file:///cache/menu.jpg', width: 1000, height: 1400 };
const ISSUED = {
  uploadUrl: 'https://storage.example/put?sig=abc',
  method: 'PUT',
  requiredHeaders: { 'Content-Type': 'image/jpeg', 'x-amz-meta-purpose': 'MENU_SCAN' },
  publicUrl: 'https://cdn.example/scan/1/a.jpg',
  objectKey: 'scan/1/a.jpg',
  expiresAt: '2026-07-16T09:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetInfoAsync.mockResolvedValue({ exists: true, size: 384512 });
  mockUploadAsync.mockResolvedValue({ status: 200 });
  (api.post as jest.Mock).mockImplementation(async (path: string) => {
    if (path === '/images/upload-url') return ISSUED;
    if (path === '/images/complete') return { path: 'scan/1/a.jpg' };
    throw new Error(`unexpected post ${path}`);
  });
});

it('성공 경로: 발급 body 정확값 → PUT(requiredHeaders 그대로) → complete(objectKey) → path 반환', async () => {
  await expect(uploadImage(PHOTO, 'MENU_SCAN')).resolves.toBe('scan/1/a.jpg');
  expect(api.post).toHaveBeenCalledWith('/images/upload-url', {
    purpose: 'MENU_SCAN',
    contentType: 'image/jpeg',
    contentLength: 384512, // getInfoAsync 정확값 — 불일치 시 스토리지 거절
  });
  expect(mockUploadAsync).toHaveBeenCalledWith(ISSUED.uploadUrl, PHOTO.uri, expect.objectContaining({
    httpMethod: 'PUT',
    headers: ISSUED.requiredHeaders,
  }));
  expect(api.post).toHaveBeenCalledWith('/images/complete', {
    path: 'scan/1/a.jpg',
    contentType: 'image/jpeg',
    size: 384512,
  });
});

it('발급 실패(400 등) → 스캔 폴백 null (텍스트-only)', async () => {
  (api.post as jest.Mock).mockRejectedValue(new Error('400 IMAGE-XXX'));
  await expect(resolveScanImagePath(PHOTO)).resolves.toBe(null);
  expect(mockUploadAsync).not.toHaveBeenCalled();
});

it('스토리지 PUT 비2xx → 폴백 null, complete 미호출 (신고값 불일치 방지)', async () => {
  mockUploadAsync.mockResolvedValue({ status: 403 });
  await expect(resolveScanImagePath(PHOTO)).resolves.toBe(null);
  expect((api.post as jest.Mock).mock.calls.map((c: unknown[]) => c[0])).not.toContain('/images/complete');
});

it('파일 소실(getInfoAsync exists:false) → 폴백 null, 발급 미호출', async () => {
  mockGetInfoAsync.mockResolvedValue({ exists: false });
  await expect(resolveScanImagePath(PHOTO)).resolves.toBe(null);
  expect(api.post).not.toHaveBeenCalled();
});

it('사진 없음(샘플 스캔) → null, 아무것도 호출하지 않음', async () => {
  await expect(resolveScanImagePath(null)).resolves.toBe(null);
  expect(api.post).not.toHaveBeenCalled();
  expect(mockGetInfoAsync).not.toHaveBeenCalled();
});

it('imageContentType — 확장자 매핑, 기본 jpeg', () => {
  expect(imageContentType('a.PNG')).toBe('image/png');
  expect(imageContentType('a.heic')).toBe('image/heic');
  expect(imageContentType('a.jpg')).toBe('image/jpeg');
  expect(imageContentType('noext')).toBe('image/jpeg');
});

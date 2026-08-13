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
const mockManipulate = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...a: unknown[]) => mockManipulate(...a),
  SaveFormat: { JPEG: 'jpeg' },
}));

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

it('성공 경로: 발급 body 정확값 → PUT(requiredHeaders 그대로) → complete(objectKey) → path+publicUrl 반환', async () => {
  await expect(uploadImage(PHOTO, 'MENU_SCAN')).resolves.toEqual({
    path: 'scan/1/a.jpg',
    publicUrl: ISSUED.publicUrl, // 프로필 표시용 (P-004 공용)
  });
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


/* ---- P-127: HEIC 등 비허용 형식 = 공용 길목 JPEG 재인코딩 ---- */
describe('P-127: 업로드 전 JPEG 재인코딩 (UPLOAD-001 방어)', () => {
  it('heic → manipulator(JPEG q0.8) 경유 + 발급 contentType=image/jpeg + 재인코딩 uri 업로드', async () => {
    mockManipulate.mockResolvedValue({ uri: 'file:///cache/menu-reenc.jpg', width: 900, height: 1200 });
    await uploadImage({ uri: 'file:///cache/IMG_0001.heic', width: 1000, height: 1400 }, 'REVIEW');
    expect(mockManipulate).toHaveBeenCalledWith('file:///cache/IMG_0001.heic', [], { compress: 0.8, format: 'jpeg' });
    expect((api.post as jest.Mock).mock.calls.find((c: unknown[]) => c[0] === '/images/upload-url')![1]).toMatchObject({
      contentType: 'image/jpeg',
    });
    expect(mockUploadAsync.mock.calls[0][1]).toBe('file:///cache/menu-reenc.jpg'); // 재인코딩 산출물로 PUT
    expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///cache/menu-reenc.jpg'); // size도 산출물 기준
  });

  it('jpeg만 무변환 패스 — manipulator 미호출 (P-189: png는 허용 목록 제외)', async () => {
    await uploadImage(PHOTO, 'MENU_SCAN');
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('P-189: png(스크린샷) → JPEG 재인코딩 경유 + contentType=image/jpeg 발급', async () => {
    await uploadImage({ uri: 'file:///cache/a.png', width: 10, height: 10 }, 'REVIEW');
    expect(mockManipulate).toHaveBeenCalledWith('file:///cache/a.png', [], { compress: 0.8, format: 'jpeg' });
    const issued = (api.post as jest.Mock).mock.calls.find((c) => String(c[0]).includes('upload-url'))!;
    expect(issued[1]).toMatchObject({ contentType: 'image/jpeg' });
  });

  it('재인코딩 실패 → throw 표면화 (발급 미호출 — 무한 대기 금지)', async () => {
    mockManipulate.mockRejectedValue(new Error('decode fail'));
    await expect(uploadImage({ uri: 'file:///cache/x.heif', width: 1, height: 1 }, 'REVIEW')).rejects.toThrow('decode fail');
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('P-189: 원격 사진 렌더 = expo-image(디스크 캐시) 소스 잠금', () => {
  it('원격 렌더 파일 7곳 — RN Image import 잔존 0 (로컬 촬영 표면은 제외)', () => {
    const fs = require('fs');
    const files = [
      'src/app/(tabs)/profile.tsx', 'src/app/community/compose.tsx', 'src/app/onboarding/index.tsx',
      'src/app/profile/edit.tsx', 'src/features/community/parts.tsx',
      'src/features/review/ReviewCellParts.tsx', 'src/features/scan/ScanRichList.tsx',
    ];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8') as string;
      expect(src).toContain("from 'expo-image'");
      expect(src).not.toMatch(/import \{[^}]*\bImage\b[^}]*\} from 'react-native'/);
    }
  });
});

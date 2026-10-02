/**
 * P-003(KB-72 마무리): presigned 업로드 흐름을 잠근다.
 * 발급 body(purpose/contentType/contentLength 정확값) · PUT에 requiredHeaders
 * 그대로 · complete body(objectKey/size) · 실패 시 스캔은 null 폴백(텍스트-only).
 */
const mockGetInfoAsync = jest.fn();
const mockUploadAsync = jest.fn();
const mockCancelAsync = jest.fn().mockResolvedValue(undefined);
// KB-711: PUT = createUploadTask(상한·취소 가능) — 기존 단언은 같은 (url, uri, options)로 mockUploadAsync에 그대로 모인다
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: (...a: unknown[]) => mockGetInfoAsync(...a),
  createUploadTask: (...a: unknown[]) => ({ uploadAsync: () => mockUploadAsync(...a), cancelAsync: () => mockCancelAsync() }),
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

// eslint-disable-next-line import/first -- jest.mock 선언 뒤(팩토리 호이스팅) — 레포 관례
import { imageContentType, resolveScanImagePath, uploadImage, UPLOAD_PUT_TIMEOUT_MS } from '../scanImage';
// eslint-disable-next-line import/first -- 위와 같음
import { isUploadAborted } from '../uploadAbort';

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
  it('원격 렌더 파일 7곳 — RN Image import 잔존 0 (P-207: 직접 expo-image 또는 공용 경유)', () => {
    const fs = require('fs');
    const files = [
      'src/app/(tabs)/profile.tsx', 'src/app/community/compose.tsx', 'src/app/onboarding/index.tsx',
      'src/app/profile/edit.tsx', 'src/features/community/parts.tsx',
      'src/features/review/ReviewCellParts.tsx', 'src/features/scan/ScanRichList.tsx',
    ];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8') as string;
      // P-207: 원격 렌더 = expo-image 직접 또는 공용 래퍼(RemoteImage/CardPhoto — 내부 expo-image+스켈레톤)
      expect(/from 'expo-image'|RemoteImage|CardPhoto/.test(src)).toBe(true);
      expect(src).not.toMatch(/import \{[^}]*\bImage\b[^}]*\} from 'react-native'/);
    }
  });
});

// ── KB-711: PUT 상한·이탈 취소
describe('KB-711 업로드 상한·취소', () => {
  afterEach(() => jest.useRealTimers());
  it('PUT이 끝나지 않으면 UPLOAD_PUT_TIMEOUT_MS 뒤 일반 실패(취소 아님) + 네이티브 업로드 취소 · complete 0', async () => {
    jest.useFakeTimers();
    mockUploadAsync.mockImplementation(() => new Promise(() => {}));
    const p = uploadImage(PHOTO, 'REVIEW');
    const caught = p.catch((e: unknown) => e);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(UPLOAD_PUT_TIMEOUT_MS + 1);
    const e = await caught;
    expect(e).toBeInstanceOf(Error);
    expect(isUploadAborted(e)).toBe(false); // 각 화면의 기존 실패 경로(재시도 가능)로
    expect(String((e as Error).message)).toContain('timeout');
    expect(mockCancelAsync).toHaveBeenCalledTimes(1);
    expect(api.post).not.toHaveBeenCalledWith('/images/complete', expect.anything());
  });
  it('PUT 중 signal 중단 = UploadAbortedError + 네이티브 업로드 취소 · complete 0', async () => {
    mockUploadAsync.mockImplementation(() => new Promise(() => {}));
    const ctl = new AbortController();
    const p = uploadImage(PHOTO, 'REVIEW', { signal: ctl.signal });
    const caught = p.catch((e: unknown) => e);
    for (let i = 0; i < 5; i++) await Promise.resolve(); // 발급까지 진행
    expect(mockUploadAsync).toHaveBeenCalledTimes(1);
    ctl.abort();
    expect(isUploadAborted(await caught)).toBe(true);
    expect(mockCancelAsync).toHaveBeenCalledTimes(1);
    expect(api.post).not.toHaveBeenCalledWith('/images/complete', expect.anything());
  });
  it('이미 중단된 signal = 발급 요청조차 안 나감(다음 사진·본 요청 차단)', async () => {
    const ctl = new AbortController();
    ctl.abort();
    const e = await uploadImage(PHOTO, 'REVIEW', { signal: ctl.signal }).catch((x: unknown) => x);
    expect(isUploadAborted(e)).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
    expect(mockUploadAsync).not.toHaveBeenCalled();
  });
  it('스캔 회귀 0 — 업로드 상한 초과도 텍스트-only 폴백(null), 서버 처리 대기와 무관', async () => {
    jest.useFakeTimers();
    mockUploadAsync.mockImplementation(() => new Promise(() => {}));
    const p = resolveScanImagePath(PHOTO);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(UPLOAD_PUT_TIMEOUT_MS + 1);
    await expect(p).resolves.toBe(null);
  });
});

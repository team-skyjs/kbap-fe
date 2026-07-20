/**
 * P-006(KB-149 후속): 프로필 업로드 전송값 = path(objectKey) 를 잠근다.
 * BE 확정(7/16 저녁): 도메인 조합은 서버 몫 — publicUrl 을 보내면 CDN
 * distribution 교체 때 깨진다. purpose 도 확정값 PROFILE_IMAGE 를 잠근다.
 */
jest.mock('expo-image-picker', () => ({}));
const mockUploadImage = jest.fn();
jest.mock('@/lib/api/scanImage', () => ({ uploadImage: (...a: unknown[]) => mockUploadImage(...a) }));

import { uploadProfileImage, PROFILE_IMAGE_PURPOSE } from '../profileImage';

it('업로드 결과의 path(objectKey)를 반환 — publicUrl 아님 (P-006)', async () => {
  mockUploadImage.mockResolvedValue({ path: 'profile/1/a.jpg', publicUrl: 'https://cdn/profile/1/a.jpg' });
  const file = { uri: 'file:///cache/p.jpg', width: 500, height: 500 };
  await expect(uploadProfileImage(file)).resolves.toBe('profile/1/a.jpg');
  expect(mockUploadImage).toHaveBeenCalledWith(file, PROFILE_IMAGE_PURPOSE);
  expect(PROFILE_IMAGE_PURPOSE).toBe('PROFILE_IMAGE'); // BE 확정값
});

it('업로드 실패는 그대로 표면화 (호출 화면이 에러 표시, 사진 없이 진행)', async () => {
  mockUploadImage.mockRejectedValue(new Error('400 IMAGE-001'));
  await expect(uploadProfileImage({ uri: 'file:///x.jpg', width: 1, height: 1 })).rejects.toThrow('400 IMAGE-001');
});

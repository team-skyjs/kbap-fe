/**
 * profileImage.ts — 프로필 사진 선택→업로드 (KB-149, P-004).
 *
 * 업로드 파이프라인은 스캔과 공용(scanImage.uploadImage — 발급→PUT→complete,
 * purpose 만 다름). 전송값은 **path(objectKey)** — BE 확정(종한, 7/16 저녁):
 * CDN distribution 교체 대응으로 도메인 조합은 백엔드 담당, FE 는 전체 URL 을
 * 보내지 않는다. 조회(MyProfileResponse)는 서버가 조합한 절대 URL 로 온다
 * (adaptProfile 의 비-http 방어 참조).
 *
 * 실패 정책(할 일 5): throw 로 정직하게 표면화 — 호출 화면이 에러 표시 후
 * 사진 없이 진행 가능해야 한다 (가입/수정 자체를 막지 않음).
 */
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/api/scanImage';

/** BE 확정(7/16 저녁) — 백엔드가 이 값으로 개발. */
export const PROFILE_IMAGE_PURPOSE = 'PROFILE_IMAGE';

/**
 * 프로필 사진 삭제 전송값 (P-013/KB-149 후속) — ⚠️ null vs '' 종한 확정 대기.
 * 잠정 '' 채택: 스키마가 type: string(비-nullable)이라 null은 검증 위반 소지,
 * imagePath '' 선례(required string에 '' 허용 확정)와 동일 계열. 확정되면 이
 * 상수(및 필요시 타입)만 교체. "생략=유지"는 그대로 보존된다.
 */
export const PROFILE_IMAGE_CLEAR = '';

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

/** 갤러리에서 1장 선택 (1:1 크롭). null = 사용자가 취소. */
export async function pickProfileImage(): Promise<PickedImage | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true, // 1:1 크롭 시트 — 아바타는 원형 렌더
    aspect: [1, 1],
    quality: 0.8,
    selectionLimit: 1,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 };
}

/** 업로드 → 전송용 path(objectKey). 실패는 throw (호출측이 에러 표시, 사진 없이 진행). */
export async function uploadProfileImage(file: PickedImage): Promise<string> {
  const { path } = await uploadImage(file, PROFILE_IMAGE_PURPOSE);
  console.log('[profile] image uploaded | path =', path);
  return path;
}

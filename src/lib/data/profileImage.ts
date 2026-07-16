/**
 * profileImage.ts — 프로필 사진 선택→업로드 (KB-149, P-004).
 *
 * 업로드 파이프라인은 스캔과 공용(scanImage.uploadImage — 발급→PUT→complete,
 * purpose 만 다름). 반환은 publicUrl — profileImageUrl 필드에 어느 쪽(publicUrl
 * vs objectKey)을 넣는지 계약 명시가 없어 **필드명이 Url 인 publicUrl 우선**
 * (진행로그 기록, 반증되면 path 로 전환).
 *
 * 실패 정책(할 일 5): throw 로 정직하게 표면화 — 호출 화면이 에러 표시 후
 * 사진 없이 진행 가능해야 한다 (가입/수정 자체를 막지 않음).
 */
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/api/scanImage';

/** ⚠️ 스펙에 purpose 값 미명시(예시는 MENU_SCAN 뿐) — 추정값, BE 질의 중 (P-004 진행로그). */
export const PROFILE_IMAGE_PURPOSE = 'PROFILE_IMAGE';

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

/** 업로드 → 표시용 publicUrl. 실패는 throw (호출측이 에러 표시, 사진 없이 진행). */
export async function uploadProfileImage(file: PickedImage): Promise<string> {
  const { publicUrl } = await uploadImage(file, PROFILE_IMAGE_PURPOSE);
  console.log('[profile] image uploaded | publicUrl =', publicUrl);
  return publicUrl;
}

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
 * 프로필 사진 삭제 전송값 — **null 확정** (종한×예진 7/20, P-014: P-013의 잠정
 * '' 교체). 미설정/삭제 시 서버가 기본 프로필 사진 URL을 응답하는 일원화 방향.
 * "생략=유지"는 그대로 보존된다(undefined만 미전송). 스펙 스키마는 아직
 * 비-nullable 표기 — 서버 배포와 동시 적용 (진행로그 기록).
 */
export const PROFILE_IMAGE_CLEAR = null;

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

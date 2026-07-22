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
import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/api/scanImage';
import { PROFILE_IMAGE_DEFAULT_PATH } from '@/lib/api/memberAdapter';

/** BE 확정(7/16 저녁) — 백엔드가 이 값으로 개발. */
export const PROFILE_IMAGE_PURPOSE = 'PROFILE_IMAGE';

/**
 * 프로필 사진 삭제 전송값 — 3차 최종 확정(P-016, 종한 7/20 Q-02 답변):
 * '' (P-013 잠정) → null (P-014) → **기본 path 전송** (null 폐기 — 필드는 항상
 * 값이 있는 설계, "미설정" 상태 소멸). "생략=유지"는 그대로 보존.
 */
export const PROFILE_IMAGE_CLEAR = PROFILE_IMAGE_DEFAULT_PATH;

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

/* ---- P-049(KB-218): 촬영 추가 — 시스템 카메라 + 네이티브 선택 시트 ---- */

export type PhotoSource = 'camera' | 'gallery' | 'remove';

export interface PhotoSheetLabels {
  title: string;
  camera: string;
  gallery: string;
  /** 있으면 iOS 시트에 destructive 삭제 옵션 노출 (안드는 화면의 기존 삭제 링크가 담당) */
  remove?: string;
  cancel: string;
}

/**
 * 사진 소스 선택 — **시스템 UI만** (직접 제작 금지 지시): iOS ActionSheetIOS,
 * Android는 시스템 Alert 3버튼(촬영/갤러리/취소 — 지시 그대로. 삭제는 4버튼이
 * 불가한 Alert 제약상 화면의 기존 삭제 링크 존치로 커버).
 */
export function choosePhotoSource(labels: PhotoSheetLabels): Promise<PhotoSource | null> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      const options = [labels.camera, labels.gallery, ...(labels.remove ? [labels.remove] : []), labels.cancel];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: labels.title,
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: labels.remove ? 2 : undefined,
        },
        (i) => resolve(i === 0 ? 'camera' : i === 1 ? 'gallery' : labels.remove && i === 2 ? 'remove' : null),
      );
      return;
    }
    Alert.alert(
      labels.title,
      undefined,
      [
        { text: labels.cancel, style: 'cancel', onPress: () => resolve(null) },
        { text: labels.gallery, onPress: () => resolve('gallery') },
        { text: labels.camera, onPress: () => resolve('camera') },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

/** 시스템 카메라 촬영 (1:1 크롭 — 갤러리 경로와 동일 옵션). 권한 거부 = CAMERA_PERMISSION throw. */
export async function captureProfileImage(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('CAMERA_PERMISSION');
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 };
}

export interface PermLabels {
  permTitle: string;
  permBody: string;
  openSettings: string;
  cancel: string;
}

/**
 * 소스별 픽업 공용 경로 (프로필 수정 + 온보딩 공유). 카메라 권한 거부는
 * 정직한 안내 + 설정 유도(Alert) 후 null — 흐름은 막지 않는다.
 */
export async function pickBySource(source: 'camera' | 'gallery', labels: PermLabels): Promise<PickedImage | null> {
  if (source === 'gallery') return pickProfileImage();
  try {
    return await captureProfileImage();
  } catch (e) {
    if ((e as Error)?.message === 'CAMERA_PERMISSION') {
      Alert.alert(labels.permTitle, labels.permBody, [
        { text: labels.cancel, style: 'cancel' },
        { text: labels.openSettings, onPress: () => void Linking.openSettings() },
      ]);
      return null;
    }
    throw e;
  }
}

/**
 * KB-814 F3 — 가공식품 리뷰 사진 '직접 촬영한 사진만' 동의(갤러리 경로 1회).
 * 기기 저장(계정 무관 — 탈퇴·계정 전환 정리 대상 아님). 읽기 실패 = 미동의로 본다(다시 묻는 쪽이 안전),
 * 쓰기 실패 = 이번 실행 동안만 기억(세션 메모리 폴백).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PACKAGED_PHOTO_CONSENT_KEY = 'ugc.packagedPhotoConsent.v1';
let granted = false;

export async function hasPackagedPhotoConsent(): Promise<boolean> {
  if (granted) return true;
  try {
    granted = (await AsyncStorage.getItem(PACKAGED_PHOTO_CONSENT_KEY)) === '1';
  } catch {
    // 읽기 실패 = 미동의
  }
  return granted;
}

export async function grantPackagedPhotoConsent(): Promise<void> {
  granted = true;
  try {
    await AsyncStorage.setItem(PACKAGED_PHOTO_CONSENT_KEY, '1');
  } catch {
    // 저장 실패 = 세션 메모리만
  }
}

/** 테스트 전용 */
export const resetPackagedPhotoConsentForTest = () => {
  granted = false;
};

/**
 * useAppFonts — P-135(멘토 #1·25): 로고 워드마크 전용 Baloo 2 800 **1종만** 로딩.
 * 그 외 전 표면 = 시스템 폰트(Txt/resolveFont가 가상 패밀리 → weight 치환).
 * Nunito Sans·Baloo 600/700 번들 제거 — 폰트 에셋 1,673KB → ~410KB.
 */
import { useFonts } from 'expo-font';
import { Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2/800ExtraBold';

export function useAppFonts() {
  return useFonts({ Baloo2_800ExtraBold });
}

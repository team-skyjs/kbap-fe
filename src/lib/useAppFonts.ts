/**
 * useAppFonts — loads the K-Bap Latin brand fonts (Baloo 2 / Nunito Sans) at
 * the weights referenced by theme.font. Returns [loaded, error].
 *
 * ⑦(KB-137): 루트 import 금지 — @expo-google-fonts 루트 index는 9웨이트 전부를
 * require해 Metro가 안 쓰는 ttf까지 번들한다(asset require는 tree-shake 불가).
 * 웨이트별 서브패스 import로 필요한 7개만 싣는다. Noto Sans KR 3웨이트는
 * 시스템 폰트 전환으로 제거(place=ko는 Txt가 system+fontWeight로 렌더).
 */
import { useFonts } from 'expo-font';
import { Baloo2_600SemiBold } from '@expo-google-fonts/baloo-2/600SemiBold';
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2/800ExtraBold';
import { NunitoSans_400Regular } from '@expo-google-fonts/nunito-sans/400Regular';
import { NunitoSans_600SemiBold } from '@expo-google-fonts/nunito-sans/600SemiBold';
import { NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans/700Bold';
import { NunitoSans_800ExtraBold } from '@expo-google-fonts/nunito-sans/800ExtraBold';

export function useAppFonts() {
  return useFonts({
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    NunitoSans_800ExtraBold,
  });
}

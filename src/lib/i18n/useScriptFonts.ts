/**
 * useScriptFonts — loads the Noto family for the ACTIVE non-Latin script on
 * demand (T071). Latin (en/vi/id/es) and Cyrillic (ru → Nunito Sans) need no
 * extra load and resolve ready immediately. Only the four weights actually used
 * by theme roles (400/600/700/800) are registered per script.
 */
import { useFonts } from 'expo-font';
import {
  NotoSansSC_400Regular,
  NotoSansSC_600SemiBold,
  NotoSansSC_700Bold,
  NotoSansSC_800ExtraBold,
} from '@expo-google-fonts/noto-sans-sc';
import {
  NotoSansTC_400Regular,
  NotoSansTC_600SemiBold,
  NotoSansTC_700Bold,
  NotoSansTC_800ExtraBold,
} from '@expo-google-fonts/noto-sans-tc';
import {
  NotoSansJP_400Regular,
  NotoSansJP_600SemiBold,
  NotoSansJP_700Bold,
  NotoSansJP_800ExtraBold,
} from '@expo-google-fonts/noto-sans-jp';
import {
  NotoSansThai_400Regular,
  NotoSansThai_600SemiBold,
  NotoSansThai_700Bold,
  NotoSansThai_800ExtraBold,
} from '@expo-google-fonts/noto-sans-thai';
import type { ScriptKey } from './fonts';

const SCRIPT_MODULES: Partial<Record<ScriptKey, Record<string, number>>> = {
  sc: { NotoSansSC_400Regular, NotoSansSC_600SemiBold, NotoSansSC_700Bold, NotoSansSC_800ExtraBold },
  tc: { NotoSansTC_400Regular, NotoSansTC_600SemiBold, NotoSansTC_700Bold, NotoSansTC_800ExtraBold },
  jp: { NotoSansJP_400Regular, NotoSansJP_600SemiBold, NotoSansJP_700Bold, NotoSansJP_800ExtraBold },
  thai: { NotoSansThai_400Regular, NotoSansThai_600SemiBold, NotoSansThai_700Bold, NotoSansThai_800ExtraBold },
};

/** Returns true once the active script's fonts are registered (or none needed). */
export function useScriptFonts(script: ScriptKey): boolean {
  const [loaded] = useFonts(SCRIPT_MODULES[script] ?? {});
  return loaded;
}

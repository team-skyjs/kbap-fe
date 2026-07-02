/**
 * Txt — drop-in Text that makes fontFamily script-aware (T071). Screens/components
 * import it aliased as `Text`, so their static StyleSheet font values (frozen at
 * module load) still end up correct for the active reader language: at render we
 * remap a Latin theme.font family to the active script's equivalent.
 *
 * Latin languages are an identity no-op (zero overhead). Korean families
 * (place=ko data) always pass through unchanged. Non-text-family styles (layout)
 * are untouched.
 */
import * as React from 'react';
import { Text as RNText, StyleSheet, type TextProps } from 'react-native';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { remapFamily } from '@/lib/i18n/fonts';

export function Txt({ style, ...rest }: TextProps) {
  const { script } = useLocale();
  if (script === 'latin') return <RNText style={style} {...rest} />;
  const flat = StyleSheet.flatten(style) as { fontFamily?: string } | undefined;
  const mapped = remapFamily(flat?.fontFamily, script);
  if (!mapped || mapped === flat?.fontFamily) return <RNText style={style} {...rest} />;
  return <RNText style={[style, { fontFamily: mapped }]} {...rest} />;
}

export default Txt;

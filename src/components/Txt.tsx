/**
 * Txt — drop-in Text that makes fontFamily script-aware (T071 → ⑦ KB-137).
 * Screens/components import it aliased as `Text`, so their static StyleSheet
 * font values (frozen at module load) still end up correct: at render we
 * resolve the declared family to either (a) untouched — Latin brand fonts,
 * (b) a Cyrillic-capable bundled family, or (c) the SYSTEM font + fontWeight —
 * CJK/Thai/KR, whose Noto bundles were removed for app size (257MB → ~5MB).
 *
 * place=ko strings (theme.font.ko*) now also resolve to system font + weight
 * regardless of reader language — 'NotoSansKR_*' is a virtual family name.
 */
import * as React from 'react';
import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { resolveFont } from '@/lib/i18n/fonts';

export function Txt({ style, ...rest }: TextProps) {
  const { script } = useLocale();
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const override = resolveFont(flat?.fontFamily, script);
  if (!override) return <RNText style={style} {...rest} />;
  // fontFamily를 undefined로 덮어쓸 수 없으므로(flatten이 뒤 값을 채택) 키를 제거한다
  const { fontFamily: _drop, ...restStyle } = flat ?? {};
  return <RNText style={[restStyle, override]} {...rest} />;
}

export default Txt;

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

// P-031(KB-206): 시스템 큰글씨 상한 ×1.3 — 고정높이 레이아웃(칩·행·버튼) 잘림
// 방지. 전 화면이 Txt를 쓰므로 여기 한 곳이 전역 관통. 정식 Dynamic Type
// 대응(레이아웃 스케일링)은 출시 후 범위.
const MAX_FONT_SCALE = 1.3;

export function Txt({ style, maxFontSizeMultiplier = MAX_FONT_SCALE, ...rest }: TextProps) {
  const { script } = useLocale();
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  // KB-429(디자인 4차): 전역 자간 -1%(fontSize×-0.01) — 명시 letterSpacing이
  // 있으면 존중. 전 화면이 Txt 경유라 여기 한 곳이 관통(시안 Pretendard -1%).
  const ls =
    flat?.letterSpacing !== undefined ? undefined : flat?.fontSize ? { letterSpacing: flat.fontSize * -0.01 } : undefined;
  const override = resolveFont(flat?.fontFamily, script);
  if (!override && !ls) return <RNText style={style} maxFontSizeMultiplier={maxFontSizeMultiplier} {...rest} />;
  // fontFamily를 undefined로 덮어쓸 수 없으므로(flatten이 뒤 값을 채택) 키를 제거한다
  const { fontFamily: _drop, ...restStyle } = flat ?? {};
  return (
    <RNText
      style={[override ? restStyle : flat, ls, override ?? undefined]}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
    />
  );
}

export default Txt;

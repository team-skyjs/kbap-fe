/**
 * Flag — compact nationality indicator. We don't ship real flag artwork (SVG
 * only, no emoji, and hand-drawing ~250 flags isn't practical), so every country
 * renders as a uniform ISO-code monogram chip (text). Used where a small
 * standalone nationality badge helps (same-nationality rating / review author).
 * Nationality pickers/fields show the full country name as plain text instead.
 */
import * as React from 'react';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { color as C, font } from '@/lib/theme';

export function Flag({ code = 'US', size = 22 }: { code?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="11.4" fill={C.surface2} stroke={C.line} strokeWidth="1.5" />
      <SvgText x="12" y="15.6" textAnchor="middle" fontFamily={font.bodyBold} fontSize="9.5" fill={C.ink2}>
        {code.slice(0, 2).toUpperCase()}
      </SvgText>
    </Svg>
  );
}

export default Flag;

/**
 * icons.tsx — designed SVG icon set, ported 1:1 from the mockup icons.jsx +
 * hifi-icons.jsx to react-native-svg. NO unicode/system emoji anywhere
 * (Constitution: frontend MUST NOT use default emoji).
 *
 * Web `stroke="currentColor"` has no RN equivalent, so color is an explicit prop
 * applied on a wrapping <G>; children inherit it.
 */
import * as React from 'react';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  type SvgProps,
} from 'react-native-svg';
import { color as C } from '@/lib/theme';

export type IconProps = {
  size?: number;
  color?: string;
  /** stroke width */
  sw?: number;
  /** fill (default none = outline icon) */
  fill?: string;
  style?: SvgProps['style'];
};

/** Stroke-icon primitive: <G> applies stroke/fill so children inherit. */
function Glyph({
  size = 24,
  color = C.ink,
  sw = 2,
  fill = 'none',
  vb = 24,
  style,
  children,
}: IconProps & { vb?: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} style={style}>
      <G
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={fill}
      >
        {children}
      </G>
    </Svg>
  );
}

/* ============ TAB BAR ICONS ============ */
export const IconHome = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M3.5 11 L12 4 l8.5 7" />
    <Path d="M5.5 9.6 V20 h13 V9.6" />
    <Path d="M10 20 v-5 h4 v5" />
  </Glyph>
);
export const IconFood = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M3.5 11 h17 a8.5 8.5 0 0 1 -17 0 Z" />
    <Path d="M2.5 20.5 h19" />
    <Path d="M9 4 c-1 1.4 -1 2.6 0 4" />
    <Path d="M13 3.4 c-1 1.4 -1 2.6 0 4" />
  </Glyph>
);
export const IconCamera = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M4 8.5 h3.4 l1.4 -2 h6.4 l1.4 2 H20 a1.5 1.5 0 0 1 1.5 1.5 v8 a1.5 1.5 0 0 1 -1.5 1.5 H4 a1.5 1.5 0 0 1 -1.5 -1.5 v-8 A1.5 1.5 0 0 1 4 8.5 Z" />
    <Circle cx="12" cy="14" r="3.3" />
  </Glyph>
);
export const IconCommunity = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M4 5 h12 a1.5 1.5 0 0 1 1.5 1.5 v6 A1.5 1.5 0 0 1 16 14 H9 l-3.5 3 v-3 H4 A1.5 1.5 0 0 1 2.5 12.5 v-6 A1.5 1.5 0 0 1 4 5 Z" />
  </Glyph>
);
export const IconProfile = (p: IconProps) => (
  <Glyph {...p}>
    <Circle cx="12" cy="8.5" r="3.6" />
    <Path d="M5 20 c0 -4 3.2 -6 7 -6 s7 2 7 6" />
  </Glyph>
);

/* ============ HEADER / UI GLYPHS ============ */
export const IconBell = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M6 16 V11 a6 6 0 0 1 12 0 v5 l1.6 2.4 H4.4 Z" />
    <Path d="M9.8 18.6 a2.2 2.2 0 0 0 4.4 0" />
  </Glyph>
);
export const IconSearch = (p: IconProps) => (
  <Glyph {...p}>
    <Circle cx="11" cy="11" r="6.2" />
    <Line x1="15.6" y1="15.6" x2="20.5" y2="20.5" />
  </Glyph>
);
export const IconChevron = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M9 5 l7 7 -7 7" />
  </Glyph>
);
export const IconArrowLeft = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M14.5 5 l-7 7 7 7" />
  </Glyph>
);
export const IconClose = (p: IconProps) => (
  <Glyph {...p}>
    <Line x1="6" y1="6" x2="18" y2="18" />
    <Line x1="18" y1="6" x2="6" y2="18" />
  </Glyph>
);
export const IconPlus = (p: IconProps) => (
  <Glyph {...p}>
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Glyph>
);
export const IconLock = (p: IconProps) => (
  <Glyph {...p}>
    <Rect x="5" y="10.5" width="14" height="9" rx="1.6" />
    <Path d="M8 10.5 V8 a4 4 0 0 1 8 0 v2.5" />
  </Glyph>
);
export const IconRetry = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M20 7 v5 h-5" />
    <Path d="M19 12 a7.4 7.4 0 1 0 -1.9 6" />
  </Glyph>
);
export const IconWifiOff = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M5 11 a10 10 0 0 1 4.6 -2.6" />
    <Path d="M2.5 8 a14 14 0 0 1 4.4 -3" />
    <Path d="M8.2 14 a5 5 0 0 1 6 -.8" />
    <Circle cx="12" cy="18" r="0.2" strokeWidth={2.6} />
    <Line x1="3" y1="3" x2="21" y2="21" />
  </Glyph>
);
export const IconAlertTri = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M12 4 L21 19 H3 Z" />
    <Line x1="12" y1="10" x2="12" y2="14.5" />
    <Circle cx="12" cy="17" r="0.6" fill={p.color ?? C.ink} stroke="none" />
  </Glyph>
);
export const IconBubbleEmpty = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M4 5 h16 a1.5 1.5 0 0 1 1.5 1.5 v9 A1.5 1.5 0 0 1 20 17 H10 l-4.5 3.5 V17 H4 A1.5 1.5 0 0 1 2.5 15.5 v-9 A1.5 1.5 0 0 1 4 5 Z" />
  </Glyph>
);
export const IconGallery = (p: IconProps) => (
  <Glyph {...p}>
    <Rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <Circle cx="8.5" cy="9.5" r="1.6" />
    <Path d="M4 18 l5 -5 4 3.4 3 -2.4 4 4" />
  </Glyph>
);
export const IconScanLines = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M4 7 V4.5 h2.5" />
    <Path d="M20 7 V4.5 h-2.5" />
    <Path d="M4 17 v2.5 h2.5" />
    <Path d="M20 17 v2.5 h-2.5" />
    <Line x1="6" y1="12" x2="18" y2="12" strokeWidth={2.4} />
  </Glyph>
);

/* ============ auxiliary glyphs (hifi-icons.jsx) ============ */
export const IconEnvelope = (p: IconProps) => (
  <Glyph {...p}>
    <Rect x="3" y="5.5" width="18" height="13" rx="2.2" />
    <Path d="M4 7.2 l8 6 8 -6" />
  </Glyph>
);
export const IconCheck = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M5 12.5 l4 4 L19 6.5" strokeWidth={2.4} />
  </Glyph>
);
export const IconSpeech = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M4 5 h16 a1.5 1.5 0 0 1 1.5 1.5 v8 A1.5 1.5 0 0 1 20 16 H11 l-4 3.5 V16 H4 A1.5 1.5 0 0 1 2.5 14.5 v-8 A1.5 1.5 0 0 1 4 5 Z" />
  </Glyph>
);
export const IconFlip = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M4 8 a8 8 0 0 1 13 -2.5 l2 2" />
    <Path d="M20 16 a8 8 0 0 1 -13 2.5 l-2 -2" />
    <Path d="M19 3.5 V7.5 H15" />
    <Path d="M5 20.5 V16.5 H9" />
  </Glyph>
);
export const IconGear = (p: IconProps) => (
  <Glyph {...p}>
    <Circle cx="12" cy="12" r="3.2" />
    <Path d="M12 3 v2.5 M12 18.5 V21 M21 12 h-2.5 M5.5 12 H3 M18.4 5.6 l-1.8 1.8 M7.4 16.6 l-1.8 1.8 M18.4 18.4 l-1.8 -1.8 M7.4 7.4 L5.6 5.6" />
  </Glyph>
);
export const IconTrash = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M5 7 h14" />
    <Path d="M9 7 V5 h6 v2" />
    <Path d="M6.5 7 l1 12.5 h9 l1 -12.5" />
    <Line x1="10" y1="10.5" x2="10" y2="16" />
    <Line x1="14" y1="10.5" x2="14" y2="16" />
  </Glyph>
);
export const IconEdit = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M5 19 h4 L19 9 l-4 -4 L5 15 Z" />
    <Line x1="13.5" y1="6.5" x2="17.5" y2="10.5" />
  </Glyph>
);
export const IconGlobe = (p: IconProps) => (
  <Glyph {...p}>
    <Circle cx="12" cy="12" r="8.4" />
    <Line x1="3.7" y1="12" x2="20.3" y2="12" />
    <Path d="M12 3.6 c2.5 2.4 2.5 14.4 0 16.8 M12 3.6 c-2.5 2.4 -2.5 14.4 0 16.8" />
  </Glyph>
);
export const IconApple = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M12.2 7.6 c.6 -1.5 2 -2.1 3.1 -2.1 c.1 1.2 -.4 2.2 -1.1 2.9" />
    <Path d="M16.4 11.1 c-.9 -.9 -2.1 -1 -2.9 -.6 c-.8 .4 -1.2 .4 -2 0 c-1.5 -.7 -3.5 -.2 -4.4 1.5 c-1 2 -.2 5.1 1.2 6.9 c.7 .9 1.3 1.2 2 .9 c.7 -.3 1 -.3 1.8 0 c.8 .3 1.3 -.1 2 -.9 c.5 -.7 .9 -1.5 1.2 -2.4 c-1.9 -.9 -2.1 -3.6 -.1 -5.9 Z" />
  </Glyph>
);
export const IconGoogleG = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M19.8 12.2 a8 8 0 1 1 -2.5 -5.8" />
    <Line x1="20" y1="12.2" x2="13" y2="12.2" />
  </Glyph>
);
export const IconFlame = (p: IconProps) => (
  <Glyph {...p} fill={p.color ?? C.ink} sw={0}>
    <Path d="M12 3.4 c2.4 2.9 4.3 4.9 4.3 8.3 a4.3 4.3 0 0 1 -8.6 0 c0 -1.2 .4 -2.2 1.1 -3 c.2 .9 .8 1.5 1.6 1.7 c-.3 -2.4 .6 -4.6 1.6 -7 Z" />
  </Glyph>
);

/* ============ CATEGORY GLYPHS (home / browse) ============ */
export const CatStew = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M4 10 h16 a8 8 0 0 1 -16 0 Z" />
    <Path d="M3 20 h18" />
    <Path d="M9 4 c-1 1.2 -1 2.4 0 3.6" />
    <Path d="M13 3.6 c-1 1.2 -1 2.4 0 3.6" />
  </Glyph>
);
export const CatBowl = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M3.5 11 h17 a8.5 8.5 0 0 1 -17 0 Z" />
    <Path d="M9 7.5 c0 -1.5 6 -1.5 6 0" />
  </Glyph>
);
export const CatNoodle = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M4 8 c3 2 5 -2 8 0 s5 2 8 0" />
    <Path d="M4 13 c3 2 5 -2 8 0 s5 2 8 0" />
    <Path d="M4 18 c3 2 5 -2 8 0 s5 2 8 0" />
  </Glyph>
);
export const CatBBQ = (p: IconProps) => (
  <Glyph {...p}>
    <Rect x="4" y="9" width="16" height="3" rx="1.4" />
    <Path d="M7 12 v6 M17 12 v6" />
    <Path d="M8 6 c1 -1 1 -2 0 -3 M12 6 c1 -1 1 -2 0 -3 M16 6 c1 -1 1 -2 0 -3" />
  </Glyph>
);
export const CatStreet = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M6 8 h12 l-1.4 11 a1.5 1.5 0 0 1 -1.5 1.4 H8.9 a1.5 1.5 0 0 1 -1.5 -1.4 Z" />
    <Path d="M9 5 c1 -1 1 -2 0 -3 M15 5 c1 -1 1 -2 0 -3" />
  </Glyph>
);
export const CatSides = (p: IconProps) => (
  <Glyph {...p}>
    <Circle cx="8" cy="9" r="4" />
    <Circle cx="16" cy="15" r="4" />
  </Glyph>
);

/**
 * theme.ts — K-Bap design tokens (Direction G "Bright & Appetizing").
 * Ported 1:1 from the hi-fi mockup `hifi-g.css` :root.
 *
 * Risk 4-state colors are FIXED semantic (Constitution III) — DO NOT change.
 * No emoji anywhere; all glyphs are SVG (react-native-svg). See components/icons.
 */

export const color = {
  primary: '#E2580C',
  primaryPress: '#c44a08',
  primary2: '#E8893F', // gradient 2nd stop (≈ color-mix primary 82% + #ffd9a0)
  accent: '#0E9AA7',

  surface: '#FCF5EF',
  surface2: '#F7ECE1',
  surfaceGlow: '#F4DFCB', // app radial glow (≈ color-mix primary 16% + surface)
  panel: '#FFFFFF', // RiskMark solid glyphs cut to this
  card: '#FFFFFF',

  ink: '#2A211B',
  ink2: '#7C6B5E',
  ink3: '#B0A395',
  hair: '#EFE5D9',
  line: '#E7DACB',

  // Risk 4-states — FIXED semantic (Constitution III). safe/caution/danger/unable.
  riskSafe: '#2f8f5b',
  riskCaution: '#d28a12',
  riskDanger: '#cf3a2c',
  riskUnable: '#5b6470',
} as const;

/**
 * Soft tonal backgrounds/borders for risk chips & banners (from hifi-g.css).
 * bg = pale fill, line = hairline border, fg = text/icon color.
 */
export const riskTone = {
  safe: { fg: color.riskSafe, bg: '#e8f4ec', line: '#c9e4d3' },
  caution: { fg: color.riskCaution, bg: '#fdf3e0', line: '#f0ddb8' },
  danger: { fg: color.riskDanger, bg: '#fdecea', line: '#f3cdc8' },
  unable: { fg: color.riskUnable, bg: '#eef0f2', line: '#d8dde2' },
} as const;

export const primaryTint = 'rgba(226,88,12,0.08)';
export const primaryTint2 = 'rgba(226,88,12,0.045)';
export const accentTint = 'rgba(14,154,167,0.08)';

export const radius = { lg: 20, sm: 15, xs: 11, pill: 999 } as const;

/**
 * Font families. Each (family, weight) is a distinct registered fontFamily key
 * (RN can't synthesize weights for custom fonts) — load via useAppFonts().
 */
export const font = {
  // Display (Baloo 2) — titles / wordmark / big numbers
  displaySemi: 'Baloo2_600SemiBold',
  display: 'Baloo2_700Bold',
  displayBlack: 'Baloo2_800ExtraBold',
  // Body (Nunito Sans) — reader text (English-first)
  body: 'NunitoSans_400Regular',
  bodySemi: 'NunitoSans_600SemiBold',
  bodyBold: 'NunitoSans_700Bold',
  bodyBlack: 'NunitoSans_800ExtraBold',
  // Korean (Noto Sans KR) — place=ko strings (owner confirmation, menu names)
  ko: 'NotoSansKR_400Regular',
  koMed: 'NotoSansKR_500Medium',
  koBold: 'NotoSansKR_700Bold',
} as const;

/** Shadow presets (hifi-g.css --sh-*). RN uses elevation on Android; iOS shadow* props. */
export const shadow = {
  // --sh-1: subtle hairline lift
  sh1: {
    shadowColor: '#14181f',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  // --sh-2: card lift
  sh2: {
    shadowColor: '#14181f',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  // --sh-pop: popovers / sheets
  shPop: {
    shadowColor: '#2a211b',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export type RiskState = 'safe' | 'caution' | 'danger' | 'unable';

export const theme = { color, riskTone, radius, font, shadow, space } as const;
export default theme;

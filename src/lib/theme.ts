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
  // P-031(KB-206) 대비: primary(3.73:1)는 소형 텍스트 기준 미달 — fontSize ≤14
  // 텍스트(링크·라벨)는 이 토큰. white 4.85:1 / surface 4.49:1. 15px+ 디스플레이
  // 숫자·대형(owner/order 카드 34px)은 brand primary 유지(3:1 대형 기준 충족).
  primaryText: '#c44a08',
  primary2: '#E8893F', // gradient 2nd stop (≈ color-mix primary 82% + #ffd9a0)
  accent: '#0E9AA7',

  surface: '#FCF5EF',
  surface2: '#F7ECE1',
  surfaceGlow: '#F4DFCB', // app radial glow (≈ color-mix primary 16% + surface)
  panel: '#FFFFFF', // RiskMark solid glyphs cut to this
  card: '#FFFFFF',

  ink: '#2A211B',
  ink2: '#7C6B5E',
  // P-031(KB-206) 대비: #B0A395(2.28:1) → 어둡게. white(카드 — 소형 텍스트 대부분)
  // 4.57:1 ✓ / surface 4.23:1(목표 근접). 더 어두우면 ink2와 시각 구분이 소멸해
  // 3단 위계가 죽는다 — 여기서 절충, 위계는 크기·굵기가 담당 (apple-design §15).
  ink3: '#837363',
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
/** P-135(멘토 #1·25): 값은 **가상 패밀리 토큰** — 실제 렌더는 Txt/resolveFont가
 *  시스템 폰트 + fontWeight로 치환(iOS SF/Apple SD Gothic Neo · 안드 Roboto/Noto).
 *  예외: 로고 워드마크만 Baloo2_800ExtraBold 실로딩(Brand.tsx — raw Text로 우회).
 *  키 구조·호출처(`fontFamily: font.x`)는 무수정 유지가 요건. */
export const font = {
  displaySemi: 'Baloo2_600SemiBold',
  display: 'Baloo2_700Bold',
  displayBlack: 'Baloo2_800ExtraBold', // 로고 전용으로만 실존 — 그 외 표면은 시스템 800 치환
  body: 'NunitoSans_400Regular',
  bodySemi: 'NunitoSans_600SemiBold',
  bodyBold: 'NunitoSans_700Bold',
  bodyBlack: 'NunitoSans_800ExtraBold',
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

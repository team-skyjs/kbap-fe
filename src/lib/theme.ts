/**
 * theme.ts — K-Bap design tokens (Direction G "Bright & Appetizing").
 * Ported 1:1 from the hi-fi mockup `hifi-g.css` :root.
 *
 * Risk 4-state colors are FIXED semantic (Constitution III) — DO NOT change.
 * No emoji anywhere; all glyphs are SVG (react-native-svg). See components/icons.
 */

/** KB-429(P-274) 디자인 4차: 값 = 커맨드 센터 Figma 실측(노드 ID는 발주문) —
 *  키는 전부 유지, 값만 교체. 신규 키 = inkMute·inkDisabled·line2(+아래
 *  riskText·shadowGlow·shBadge·type). */
export const color = {
  primary: '#FF7134', // Button/Primary 4123:3985 · FAB 4095:1858
  primaryPress: '#E8602A', // 시안 Pressed(보라)는 잔재 — primary 10% 어둡게
  // P-031 대비 규칙 유지: primary(#FF7134)는 흰 배경 2.9:1 — fontSize ≤14 텍스트는
  // 이 토큰(FE 산출 #C9491A = white 4.70:1 ✓). 15px+ 대형은 primary 그대로.
  primaryText: '#C9491A',
  primary2: '#FF9A6E', // gradient 2nd stop(현 규칙 유지)
  accent: '#0E9AA7',

  surface: '#FFFFFF', // 전 프레임 fill
  surface2: '#F7F8FA', // Input/Search bg 4026:667
  surfaceGlow: '#FFFFFF', // 글로우 폐지(시안 없음) — 소비처 시각 무해 값
  panel: '#FFFFFF', // RiskMark solid glyphs cut to this
  card: '#FFFFFF',

  ink: '#1C1E21', // gray-1000
  ink2: '#6A6F7C', // gray-700
  ink3: '#9196A1', // gray-600 — 섹션 라벨·플레이스 칩
  inkMute: '#B1B5BD', // 탭 비활성 라벨·날짜·secondary 버튼
  inkDisabled: '#D1D3D8', // placeholder·disabled 라벨·비활성 아이콘
  hair: '#F2F3F6',
  line: '#EAEBEE', // gray-200
  line2: '#DCDEE3', // gray-300 — 아웃라인 버튼·체크박스·탭 디바이더

  // Risk 4-states — FIXED semantic (Constitution III). safe/caution/danger/unable.
  riskSafe: '#00BE65', // 4064:790
  riskCaution: '#FFA526', // 4064:796
  riskDanger: '#F76661', // 4064:793
  riskUnable: '#B1B5BD', // 4064:798
} as const;

/**
 * Soft tonal backgrounds/borders for risk chips & banners — 4차 시안
 * (ScreenFoodDetail 재료 행 4129:11366 · 4150:16969~72). line = 공통 헤어라인.
 */
export const riskTone = {
  safe: { fg: color.riskSafe, bg: '#EFFFF7', line: '#D5DFE7' },
  caution: { fg: color.riskCaution, bg: '#FFFDEF', line: '#D5DFE7' },
  danger: { fg: color.riskDanger, bg: '#FFF3EF', line: '#D5DFE7' },
  unable: { fg: color.riskUnable, bg: '#ECECEC', line: '#D5DFE7' },
} as const;

/** 12~14px 위험 텍스트("Safe" 12/700 등) 대비용 어두운 변형 — 시안 원색은 흰 배경
 *  4.5:1 미달(safe 2.1·caution 1.9·danger 2.9). FE 산출(white 기준): safe 4.97 ·
 *  caution 4.84 · danger 4.77 · unable 6.9. 예진이 원색 고집 시 이 한 곳만 되돌림. */
export const riskText = {
  safe: '#008147',
  caution: '#9A6700',
  danger: '#D93025',
  unable: '#5B6470',
} as const;

export const primaryTint = 'rgba(255,113,52,0.05)'; // 시안 "primary 5%"
export const primaryTint2 = 'rgba(255,113,52,0.03)';
export const accentTint = 'rgba(14,154,167,0.08)';

export const radius = { lg: 10, sm: 8, xs: 4, pill: 999 } as const; // Alert 4123:4019 · tag/input · 버튼/카드

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

/** Shadow presets — 4차 시안. RN uses elevation on Android; iOS shadow* props. */
export const shadow = {
  // 시안 카드 그림자(btn/review·add 버튼 4129:10715): 0/1 blur 7.3 op 0.07 #000
  sh1: {
    shadowColor: '#000000',
    shadowOpacity: 0.07,
    shadowRadius: 7.3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  // 구 카드 lift — 시안 대응물 없음(메달 글로우는 shadowGlow 헬퍼): 소비처가
  // D-2~6에서 sh1/무그림자로 이관될 때까지 유지(여기서 바꾸면 전 카드가 흔들림).
  sh2: {
    shadowColor: '#14181f',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  // --sh-pop: popovers / sheets (유지)
  shPop: {
    shadowColor: '#2a211b',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  // risk 썸네일 배지(4095:1430): 1/1 blur 3.7 op 0.6
  shBadge: {
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 3.7,
    shadowOffset: { width: 1, height: 1 },
    elevation: 3,
  },
} as const;

/** rank-medal 글로우(4150:16186) — 색상 = 요소 색(메달 전용): 0/3 blur 8 op 0.4. */
export function shadowGlow(colorHex: string) {
  return {
    shadowColor: colorHex,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  } as const;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

/** KB-429 타입 스케일(시안 4차) — D-2~6 화면 적용 기준값. size/weight/lineHeight.
 *  lineHeight 기본 1.35(캡션 1.5) — 전역 강제 아님(레이아웃은 화면 단계에서). */
export const type = {
  largeTitle: { fontSize: 26, fontWeight: '700' },
  sectionTitle: { fontSize: 20, fontWeight: '400' }, // 4064:787
  appBar: { fontSize: 18, fontWeight: '600' },
  button: { fontSize: 15, fontWeight: '600' },
  emphasis: { fontSize: 15, fontWeight: '500' }, // 닉네임·입력
  body: { fontSize: 14, fontWeight: '400' },
  chip: { fontSize: 14, fontWeight: '500' }, // 칩·ko 부제
  subtitle: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 13, fontWeight: '500' },
  rating: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
  captionMed: { fontSize: 12, fontWeight: '500' },
  riskLabel: { fontSize: 12, fontWeight: '700' }, // "Safe"
  tabLabel: { fontSize: 11, fontWeight: '500' },
  newBadge: { fontSize: 10, fontWeight: '600' },
} as const;

export type RiskState = 'safe' | 'caution' | 'danger' | 'unable';

export const theme = { color, riskTone, radius, font, shadow, space, type } as const;
export default theme;

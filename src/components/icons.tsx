/**
 * icons.tsx — 공용 아이콘 카탈로그 (P-082/KB-258 규격 통일).
 *
 * ── 통일 규격 (확정) ─────────────────────────────────────────────
 * - 도형 = **Lucide** (ISC, © 2022 Lucide Contributors — 라이선스 고지) 세트를
 *   **벤더링**: 사용하는 글리프의 경로 데이터만 내장. 패키지 직접 의존은
 *   폐기 — Metro가 barrel 1,757종 전량을 번들해 +1.81MB(실측)라서, 동일
 *   도형을 ~7KB로 내장하는 쪽을 채택 (규격·형태는 Lucide 그대로).
 * - 규격: 24×24 그리드 · 스트로크 2px · round cap/join · 아웃라인 우선.
 * - API: size(기본 24) · color(기본 C.ink) · sw(strokeWidth, 기본 2) ·
 *   fill(기본 없음 — 채움형은 fill+sw=0) · style.
 * - **신규 아이콘 추가 = lucide.dev에서 도형 복사** (Glyph로 감싸 아래에 추가,
 *   kebab 이름을 주석으로 병기). 수제 제작은 Lucide에 없는 형태뿐.
 * - **교체 금지(브랜드 시맨틱)**: RiskMark(위험도 4상태 — RiskMark.tsx),
 *   IconApple·IconGoogleG(공식 로고 — 경로/색 수정 금지), Cat*(카테고리
 *   일러스트, categoryUI 플래그), Flag(국기 — Flag.tsx), SuccessCheck 등.
 * - NO unicode/system emoji (헌법 — 유일 예외는 맵기 🌶️).
 * ────────────────────────────────────────────────────────────────
 */
import * as React from 'react';
import Svg, { Circle, G, Path, Rect, type SvgProps } from 'react-native-svg';
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
      <G stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill={fill}>
        {children}
      </G>
    </Svg>
  );
}

/* ============ Lucide 벤더 글리프 (ISC) ============ */
export const IconHome = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <Path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Glyph>
);
export const IconFood = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z" />
    <Path d="M7 21h10" />
    <Path d="M19.5 12 22 6" />
    <Path d="M16.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62" />
    <Path d="M11.25 3c.27.1.8.53.74 1.36-.05.83-.93 1.2-.98 2.02-.06.78.33 1.24.72 1.62" />
    <Path d="M6.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.74 1.62" />
  </Glyph>
);
export const IconCamera = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" />
    <Circle cx="12" cy="13" r="3" />
  </Glyph>
);
export const IconCommunity = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <Path d="M16 3.128a4 4 0 0 1 0 7.744" />
    <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <Circle cx="9" cy="7" r="4" />
  </Glyph>
);
export const IconProfile = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
  </Glyph>
);
export const IconSearch = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="m21 21-4.34-4.34" />
    <Circle cx="11" cy="11" r="8" />
  </Glyph>
);
export const IconChevron = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="m9 18 6-6-6-6" />
  </Glyph>
);
export const IconArrowLeft = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="m12 19-7-7 7-7" />
    <Path d="M19 12H5" />
  </Glyph>
);
export const IconLogout = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="m16 17 5-5-5-5" />
    <Path d="M21 12H9" />
    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
  </Glyph>
);
export const IconClose = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M18 6 6 18" />
    <Path d="m6 6 12 12" />
  </Glyph>
);
export const IconPlus = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M5 12h14" />
    <Path d="M12 5v14" />
  </Glyph>
);
export const IconMinus = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M5 12h14" />
  </Glyph>
);
export const IconLock = (p: IconProps) => (
  <Glyph {...p}>
    <Rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Glyph>
);
export const IconRetry = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <Path d="M21 3v5h-5" />
  </Glyph>
);
export const IconWifiOff = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M12 20h.01" />
    <Path d="M8.5 16.429a5 5 0 0 1 7 0" />
    <Path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
    <Path d="M19 12.859a10 10 0 0 0-2.007-1.523" />
    <Path d="M2 8.82a15 15 0 0 1 4.177-2.643" />
    <Path d="M22 8.82a15 15 0 0 0-11.288-3.764" />
    <Path d="m2 2 20 20" />
  </Glyph>
);
export const IconAlertTri = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <Path d="M12 9v4" />
    <Path d="M12 17h.01" />
  </Glyph>
);
export const IconBubbleEmpty = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
  </Glyph>
);
export const IconGallery = (p: IconProps) => (
  <Glyph {...p}>
    <Rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <Circle cx="9" cy="9" r="2" />
    <Path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </Glyph>
);
export const IconBookmark = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" />
  </Glyph>
);
export const IconScanLines = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <Path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <Path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <Path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <Path d="M7 8h8" />
    <Path d="M7 12h10" />
    <Path d="M7 16h6" />
  </Glyph>
);
export const IconCheck = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M20 6 9 17l-5-5" />
  </Glyph>
);
export const IconSpeech = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Glyph>
);
export const IconFlip = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
    <Path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
    <Circle cx="12" cy="12" r="3" />
    <Path d="m18 22-3-3 3-3" />
    <Path d="m6 2 3 3-3 3" />
  </Glyph>
);
export const IconGear = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
    <Circle cx="12" cy="12" r="3" />
  </Glyph>
);
export const IconTrash = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M10 11v6" />
    <Path d="M14 11v6" />
    <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <Path d="M3 6h18" />
    <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Glyph>
);
export const IconEdit = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    <Path d="m15 5 4 4" />
  </Glyph>
);
export const IconList = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M3 5h.01" />
    <Path d="M3 12h.01" />
    <Path d="M3 19h.01" />
    <Path d="M8 5h13" />
    <Path d="M8 12h13" />
    <Path d="M8 19h13" />
  </Glyph>
);
export const IconBulb = (p: IconProps) => (
  <Glyph {...p}>
    <Path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <Path d="M9 18h6" />
    <Path d="M10 22h4" />
  </Glyph>
);
export const IconGlobe = (p: IconProps) => (
  <Glyph {...p}>
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <Path d="M2 12h20" />
  </Glyph>
);

/* ============ 브랜드 로고 (교체 금지) ============ */

/** 공식 애플 마크 — 필드(채움) 모노크롬 (P-034/KB-203 Q-16: 스트로크 근사치 폐기).
 *  연동 행 전용 — 로그인 화면은 OS 네이티브 애플 버튼이라 무관. */
export const IconApple = ({ size = 20, color, style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <Path
      fill={color ?? C.ink}
      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.031 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.702"
    />
  </Svg>
);
/** 공식 구글 'G' 4색 마크 — 브랜드 고정색이라 color prop 무시 (P-034: 로그인
 *  버튼과 동일 SSOT — SocialAuthButtons도 이걸 쓴다. 경로/색 수정 금지). */
export const IconGoogleG = ({ size = 20, style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </Svg>
);

/* ============ 카테고리 일러스트 (categoryUI 플래그, 교체 금지) ============ */
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

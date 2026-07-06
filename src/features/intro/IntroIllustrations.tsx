/**
 * IntroIllustrations — flat, text-free brand illustrations for the onboarding
 * intro slides (KB-76). RN port of Claude Design hifi-intro-illus.jsx, drawn in
 * the K-Bap asset style (same geometry as the K-Bowl mark + icon set).
 *
 * Country-neutral, no text → language-agnostic (9-language / 0-rework). Brand +
 * risk colors come from theme tokens; the remaining values are illustration-only
 * art colors kept in ART. SVG drop-shadow filters from the web source are omitted
 * (react-native-svg support is unreliable) — the flat art reads without them.
 *
 * Each fills its slot via a 320×360 viewBox, xMidYMid slice.
 */
import * as React from 'react';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { color as C, primaryTint } from '@/lib/theme';

/** Illustration-only art colors (not brand tokens — intrinsic to the artwork). */
const ART = {
  bgTop: '#FCEBDD',
  bgBot: '#FDF5EF',
  menuLine: '#D8C7B5',
  phoneBezel: '#4A403A',
  phoneScreen: '#211A15',
  teal: '#38C6D3',
  tealLite: '#8CEDF6',
  peanutA: '#D8A15E',
  peanutB: '#C98C46',
};

/* small filled/empty star row (drawn from a 24-unit glyph) */
function StarRow({ x, y, n = 5, filled = 5, size = 11, gap = 2.5, color = C.primary }: {
  x: number; y: number; n?: number; filled?: number; size?: number; gap?: number; color?: string;
}) {
  const d = 'M12 2.4 l2.9 6.2 6.8.6 -5.2 4.5 1.6 6.7 L12 17.4 l-6.1 3.6 1.6 -6.7 -5.2 -4.5 6.8 -.6 Z';
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <Path
          key={i}
          transform={`translate(${x + i * (size + gap)} ${y}) scale(${size / 24})`}
          d={d}
          fill={i < filled ? color : '#E7DACB'}
        />
      ))}
    </>
  );
}

/* one review card body drawn in local coords (0,0 → w,h) */
function ReviewCardG({ x, y, rot, w = 182, h = 82, faded, flagColor = C.accent }: {
  x: number; y: number; rot: number; w?: number; h?: number; faded?: boolean; flagColor?: string;
}) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rot})`} opacity={faded ? 0.55 : 1}>
      <Rect x={0} y={0} width={w} height={h} rx={16} fill="#fff" stroke={C.hair} strokeWidth={1} />
      {/* avatar */}
      <Circle cx={26} cy={27} r={15} fill={primaryTint} />
      <Circle cx={26} cy={23} r={5.4} fill={C.primary} opacity={0.85} />
      <Path d="M16 37 a10 8 0 0 1 20 0 Z" fill={C.primary} opacity={0.85} />
      {/* flag pennant (country-neutral) */}
      <G transform={`translate(${w - 34} 12)`}>
        <Line x1={0} y1={0} x2={0} y2={22} stroke={C.ink3} strokeWidth={2.4} strokeLinecap="round" />
        <Path d="M0 2 L20 6.5 L0 12 Z" fill={flagColor} />
      </G>
      {/* stars */}
      <StarRow x={50} y={15} filled={faded ? 4 : 5} size={10} />
      {/* text lines */}
      <Rect x={50} y={34} width={104} height={7} rx={3.5} fill="#E7DACB" />
      <Rect x={50} y={48} width={118} height={7} rx={3.5} fill={C.hair} />
      <Rect x={50} y={62} width={70} height={7} rx={3.5} fill={C.hair} />
    </G>
  );
}

/* ============ S1 · SCAN ============ */
export function IllusScan() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 360" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="bgScan" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={ART.bgTop} />
          <Stop offset="1" stopColor={ART.bgBot} />
        </LinearGradient>
      </Defs>
      <Rect width={320} height={360} fill="url(#bgScan)" />
      <Circle cx={252} cy={70} r={96} fill={C.primary} opacity={0.06} />

      {/* menu card, tilted, behind */}
      <G transform="rotate(-8 126 196)">
        <Rect x={52} y={104} width={148} height={188} rx={13} fill="#fff" stroke={C.hair} strokeWidth={1} />
        <Rect x={68} y={122} width={66} height={13} rx={6.5} fill={C.primary} />
        {[0, 1, 2, 3, 4].map((r) => (
          <G key={r}>
            <Rect x={68} y={150 + r * 26} width={72} height={8} rx={4} fill={ART.menuLine} />
            <Rect x={158} y={150 + r * 26} width={26} height={8} rx={4} fill="#E7DACB" />
          </G>
        ))}
      </G>

      {/* phone, foreground right */}
      <G transform="rotate(6 214 224)">
        <Rect x={152} y={116} width={126} height={214} rx={26} fill={C.ink} />
        <Rect x={200} y={126} width={30} height={5} rx={2.5} fill={ART.phoneBezel} />
        <Rect x={163} y={150} width={104} height={158} rx={13} fill={ART.phoneScreen} />
        {/* teal scan brackets */}
        <G stroke={ART.teal} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M176 176 v-10 a5 5 0 0 1 5 -5 h10" />
          <Path d="M249 161 h10 a5 5 0 0 1 5 5 v10" />
          <Path d="M176 282 v10 a5 5 0 0 1 5 5 h10" />
          <Path d="M264 282 v10 a5 5 0 0 1 -5 5 h-10" />
        </G>
        {/* scan line */}
        <Rect x={176} y={220} width={88} height={12} rx={6} fill={ART.teal} opacity={0.22} />
        <Rect x={178} y={224.5} width={84} height={3.4} rx={1.7} fill={ART.tealLite} />
        <Rect x={205} y={316} width={20} height={4} rx={2} fill={ART.phoneBezel} />
      </G>

      {/* floating safety badges (fixed semantic risk colors) */}
      <G>
        <Circle cx={150} cy={54} r={16} fill="#fff" />
        <Circle cx={150} cy={54} r={16} fill={C.riskCaution} />
        <Line x1={150} y1={47} x2={150} y2={56} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
        <Circle cx={150} cy={61.5} r={1.8} fill="#fff" />

        <Circle cx={198} cy={74} r={20} fill="#fff" />
        <Circle cx={198} cy={74} r={20} fill={C.riskSafe} />
        <Path d="M189 74 l6 6 l12 -13" stroke="#fff" strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        <Circle cx={238} cy={110} r={15} fill="#fff" />
        <Circle cx={238} cy={110} r={15} fill={C.riskDanger} />
        <Path d="M233 105 l10 10 M243 105 l-10 10" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
      </G>
    </Svg>
  );
}

/* ============ S2 · YOUR SAFETY ============ */
export function IllusSafety() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 360" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="bgSafe" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={ART.bgTop} />
          <Stop offset="1" stopColor={ART.bgBot} />
        </LinearGradient>
      </Defs>
      <Rect width={320} height={360} fill="url(#bgSafe)" />
      <Circle cx={70} cy={70} r={86} fill={C.accent} opacity={0.06} />

      {/* shield forming */}
      <Path
        d="M160 52 L236 78 V172 C236 232 199 270 160 292 C121 270 84 232 84 172 V78 Z"
        fill="rgba(14,154,167,0.07)"
        stroke={C.accent}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <Path
        d="M160 52 L236 78 V172 C236 232 199 270 160 292"
        fill="none"
        stroke={C.accent}
        strokeWidth={5}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="6 12"
        opacity={0.5}
      />

      {/* sealing check emblem at shield crown */}
      <G>
        <Circle cx={160} cy={78} r={19} fill="#fff" />
        <Circle cx={160} cy={78} r={19} fill={C.accent} />
        <Path d="M151 78 l6 6 l12 -13" stroke="#fff" strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>

      {/* ingredient cards being chosen — peanut */}
      <G transform="rotate(-7 128 200)">
        <Rect x={98} y={180} width={60} height={44} rx={12} fill="#fff" stroke={C.hair} strokeWidth={1} />
        <Ellipse cx={122} cy={202} rx={8} ry={10} fill={ART.peanutA} />
        <Ellipse cx={134} cy={202} rx={8} ry={10} fill={ART.peanutB} />
      </G>
      {/* chili card */}
      <G transform="rotate(8 196 208)">
        <Rect x={170} y={186} width={56} height={42} rx={11} fill="#fff" stroke={C.hair} strokeWidth={1} />
        <Path d="M190 197 c8 -3 16 2 18 12 c-10 3 -18 -1 -20 -9 Z" fill={C.riskDanger} />
        <Path d="M190 197 c-1 -4 2 -6 5 -5" fill="none" stroke={C.riskSafe} strokeWidth={2.6} strokeLinecap="round" />
      </G>
      {/* selected shrimp card (orange) with check */}
      <G transform="rotate(-2 160 156)">
        <Rect x={120} y={128} width={80} height={52} rx={13} fill="#fff" stroke={C.primary} strokeWidth={2.5} />
        <Path d="M150 145 c-9 -2 -15 6 -10 13 c3 5 11 5 15 0 c2 -3 1 -6 -2 -7" fill="none" stroke={C.primary} strokeWidth={3.2} strokeLinecap="round" />
        <Path d="M150 145 c3 -2 7 -2 10 0" fill="none" stroke={C.primary} strokeWidth={3.2} strokeLinecap="round" />
        <Circle cx={196} cy={132} r={12} fill={C.primary} />
        <Path d="M190.5 132 l4 4 l7 -8" stroke="#fff" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>

      {/* sparkles */}
      <G fill={ART.teal}>
        <Path d="M110 118 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" opacity={0.9} />
        <Path d="M214 152 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" opacity={0.8} />
      </G>
    </Svg>
  );
}

/* ============ S3 · REVIEWS ============ */
export function IllusReviews() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 360" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="bgRev" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={ART.bgTop} />
          <Stop offset="1" stopColor={ART.bgBot} />
        </LinearGradient>
      </Defs>
      <Rect width={320} height={360} fill="url(#bgRev)" />
      <Circle cx={248} cy={80} r={90} fill={C.accent} opacity={0.06} />

      {/* stacked review cards with country-neutral flag pennants */}
      <ReviewCardG x={66} y={60} rot={-6} faded flagColor={C.accent} />
      <ReviewCardG x={60} y={228} rot={-3} faded flagColor={C.primary} />
      <ReviewCardG x={78} y={146} rot={4} flagColor={C.accent} />
    </Svg>
  );
}

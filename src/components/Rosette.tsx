/**
 * Rosette — ranking badge (ported from mockup icons.jsx). A scalloped medal
 * whose level is shown by filled pips (colorblind-safe, grayscale). Used in
 * review-submitted + review lists.
 *
 * MedalEmblem — 랭킹 디테일의 컬러 메달(스타버스트+리본). KB-125에서
 * ranking.tsx 로컬 → 공용 이동 (프로필 탭 랭킹 행에서도 사용).
 */
import * as React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Stop, Text as SvgText } from 'react-native-svg';
import { color as C, font } from '@/lib/theme';

export function Rosette({ level = 1, size = 40 }: { level?: number; size?: number }) {
  const pts: string[] = [];
  const n = 12;
  const R = 11;
  const r = 8.4;
  for (let i = 0; i < n * 2; i++) {
    const ang = (Math.PI / n) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(12 + rad * Math.cos(ang)).toFixed(2)},${(12 + rad * Math.sin(ang)).toFixed(2)}`);
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon points={pts.join(' ')} fill={C.panel} stroke={C.line} strokeWidth={1.4} strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="6.4" fill="none" stroke={C.line} strokeWidth={1.2} />
      {Array.from({ length: 5 }).map((_, i) => {
        const a = ((Math.PI * 2) / 5) * i - Math.PI / 2;
        const filled = i < level;
        return (
          <Circle
            key={i}
            cx={(12 + 3.5 * Math.cos(a)).toFixed(2)}
            cy={(12 + 3.5 * Math.sin(a)).toFixed(2)}
            r="1.15"
            fill={filled ? C.ink : 'none'}
            stroke={C.ink}
            strokeWidth={1}
          />
        );
      })}
    </Svg>
  );
}

/* starburst medal (my-ranking.jsx MedalEmblem) — level number on a gradient disc */
const RAY_PTS = (() => {
  const cx = 50, cy = 43, n = 12, R = 35, r = 28;
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI / n) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
})();

export function MedalEmblem({ level, size }: { level: number; size: number }) {
  const gid = React.useId();
  const c1 = C.primary, c2 = C.primary2;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c1} />
          <Stop offset="1" stopColor={c2} />
        </LinearGradient>
      </Defs>
      <Path d="M40 66 L32 96 L41 88 L48 95 L48 70 Z" fill={c2} opacity={0.92} />
      <Path d="M60 66 L68 96 L59 88 L52 95 L52 70 Z" fill={c1} opacity={0.92} />
      <Polygon points={RAY_PTS} fill={c1} opacity={0.55} />
      <Circle cx={50} cy={43} r={27} fill={`url(#${gid})`} />
      <Circle cx={50} cy={43} r={27} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={2} />
      <Circle cx={50} cy={43} r={22} fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={1} />
      <Path d="M34 34 a20 20 0 0 1 24 -8" fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={2.4} strokeLinecap="round" />
      <SvgText x={50} y={53.5} textAnchor="middle" fill="#fff" fontFamily={font.displayBlack} fontSize={30}>
        {String(level)}
      </SvgText>
    </Svg>
  );
}

export default Rosette;

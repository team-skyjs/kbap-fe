/**
 * Rosette — ranking badge (ported from mockup icons.jsx). A scalloped medal
 * whose level is shown by filled pips (colorblind-safe, grayscale). Used in
 * review-submitted + profile + review lists.
 */
import * as React from 'react';
import Svg, { Circle, Polygon } from 'react-native-svg';
import { color as C } from '@/lib/theme';

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

export default Rosette;

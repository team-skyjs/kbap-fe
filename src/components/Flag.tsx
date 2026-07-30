/**
 * Flag — nationality indicator (P-082/KB-258: 실국기 도입).
 *
 * 내장국(circle-flags, MIT — flagAssets.ts 16개국: 추천국 12 + FR·DE·HK·SG)은
 * 실국기 원형 SVG, 그 외는 종전 ISO-코드 모노그램 칩 폴백 — 전량(250+국,
 * ~170KB) 대신 상위국 내장(~11.5KB)이 번들 전략 (미보유국도 항상 렌더 가능).
 * NO emoji (헌법 — 국기도 SVG only).
 */
import * as React from 'react';
import Svg, { Circle, SvgXml, Text as SvgText } from 'react-native-svg';
import { color as C, font } from '@/lib/theme';
import { FLAG_XML } from './flagAssets';

export function Flag({ code = 'US', size = 22 }: { code?: string; size?: number }) {
  const cc = code.slice(0, 2).toUpperCase();
  const xml = FLAG_XML[cc];
  if (xml) return <SvgXml xml={xml} width={size} height={size} />;
  // 미내장국 — 모노그램 칩 폴백 (종전 렌더 유지)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="11.4" fill={C.surface2} stroke={C.line} strokeWidth="1.5" />
      <SvgText x="12" y="15.6" textAnchor="middle" fontFamily={font.bodyBold} fontSize="9.5" fill={C.ink2}>
        {cc}
      </SvgText>
    </Svg>
  );
}

export default Flag;

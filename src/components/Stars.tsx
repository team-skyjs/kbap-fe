/**
 * Stars — rating display. Single Star supports partial fill via a clip rect
 * (ported from mockup icons.jsx, Math.random id → stable React.useId).
 */
import * as React from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';
import { color as C, font } from '@/lib/theme';
import { Txt } from './Txt';

/** P-168 ④: 빈 별 아웃라인 = 채움 주황의 옅은 톤(쿠팡 문법) — 갈/검정 아웃라인 과함. */
export const STAR_EMPTY = 'rgba(226,88,12,0.4)';

const STAR_D =
  'M12 2.6 l2.7 5.95 6.5.62 -4.9 4.32 1.45 6.36 L12 16.9 l-5.75 3.55 1.45 -6.36 -4.9 -4.32 6.5 -.62 Z';

export function Star({
  size = 20,
  fillPct = 100,
  fillColor = C.ink,
  emptyColor = STAR_EMPTY,
}: {
  size?: number;
  fillPct?: number;
  fillColor?: string;
  emptyColor?: string;
}) {
  const rawId = React.useId();
  const id = `st${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <ClipPath id={id}>
          <Rect x="0" y="0" width={(24 * fillPct) / 100} height="24" />
        </ClipPath>
      </Defs>
      <Path d={STAR_D} fill="none" stroke={emptyColor} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d={STAR_D} fill={fillColor} clipPath={`url(#${id})`} />
    </Svg>
  );
}

/** A row of 5 stars rendering a 0–5 rating with fractional fill. */
export function Stars({
  value,
  size = 16,
  color = C.primary,
}: {
  value: number;
  size?: number;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const pct = Math.max(0, Math.min(1, value - i)) * 100;
        return <Star key={i} size={size} fillPct={pct} fillColor={color} emptyColor={STAR_EMPTY} />;
      })}
    </View>
  );
}

/**
 * RatingLine (P-195) — 목록 카드 평점 줄 공용("없는 정보는 0으로 전시하지 않는다").
 * 1건+: "★들 (n)" — 하이픈·가운뎃점·평점 숫자 병기 전부 폐지(쿠팡 정합).
 * 0건: 미노출 — 세로 목록은 줄 제거(null), 가로 캐러셀은 fixedSlot으로 카드 높이
 * 균일 유지(빈 고정 슬롯). 상세 리뷰 브리프(큰 별+수치 — P-169)는 대상 아님.
 */
export function RatingLine({
  overall,
  size = 13,
  fixedSlot = false,
}: {
  overall: { average: number | null; count: number };
  size?: number;
  fixedSlot?: boolean;
}) {
  const empty = overall.count === 0;
  if (empty && !fixedSlot) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1, height: size + 4 }} testID="rating-line">
      {!empty && (
        <>
          <Stars value={overall.average ?? 0} size={size} />
          <Txt style={{ fontFamily: font.bodyBold, fontSize: 12, color: C.ink2 }} testID="rating-count">
            ({overall.count})
          </Txt>
        </>
      )}
    </View>
  );
}

export default Stars;

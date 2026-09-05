/**
 * Stars — rating display. Single Star supports partial fill via a clip rect
 * (ported from mockup icons.jsx, Math.random id → stable React.useId).
 */
import * as React from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';
import { color as C, font } from '@/lib/theme';
import { Txt } from './Txt';

/** KB-429(4095:1561/1582): 빈 별 = #EAEBEE + stroke #DCDEE3 1px. */
export const STAR_EMPTY = '#DCDEE3';
/** KB-429: 채움 별 = #FFED47 + stroke #F4D27D 1px. */
export const STAR_FILL = '#FFED47';
const STAR_FILL_STROKE = '#F4D27D';
const STAR_EMPTY_FILL = '#EAEBEE';

// 9/5 시안 원본 경로(스펙 bridge/design/4th/icons/star-*.svg — 16 그리드, 형태 무수정)
const STAR_D =
  'M7.287 1.396C7.584 0.814 8.416 0.814 8.713 1.396L10.213 4.337C10.329 4.564 10.548 4.723 10.8 4.763L14.06 5.282C14.705 5.384 14.962 6.175 14.501 6.637L12.168 8.973C11.987 9.154 11.904 9.41 11.944 9.663L12.458 12.924C12.56 13.569 11.887 14.058 11.305 13.761L8.363 12.265C8.135 12.149 7.865 12.149 7.637 12.265L4.695 13.761C4.113 14.058 3.44 13.569 3.542 12.924L4.056 9.663C4.096 9.41 4.013 9.154 3.832 8.973L1.499 6.637C1.038 6.175 1.295 5.384 1.94 5.282L5.2 4.763C5.452 4.723 5.671 4.564 5.787 4.337L7.287 1.396Z';

/** 9/5 판정(4129:10698/10701): 북마크 버튼 별 — 미저장 = 아웃라인(stroke #6A6F7C 1.5),
 *  저장됨 = fill #FFE812 + stroke #E5D64D 1. 별 geometry = 시안 star 경로(16 그리드). */
export function BookmarkStar({ saved = false, size = 16 }: { saved?: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {saved ? (
        <Path d={STAR_D} fill="#FFE812" stroke="#E5D64D" strokeWidth={1} strokeLinejoin="round" />
      ) : (
        <Path d={STAR_D} fill="none" stroke="#6A6F7C" strokeWidth={1.5} strokeLinejoin="round" />
      )}
    </Svg>
  );
}

export function Star({
  size = 20,
  fillPct = 100,
  fillColor = STAR_FILL, // KB-429
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
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Defs>
        <ClipPath id={id}>
          <Rect x="0" y="0" width={(16 * fillPct) / 100} height="16" />
        </ClipPath>
      </Defs>
      <Path d={STAR_D} fill={STAR_EMPTY_FILL} stroke={emptyColor} strokeWidth={1} strokeLinejoin="round" />
      <Path d={STAR_D} fill={fillColor} stroke={STAR_FILL_STROKE} strokeWidth={1} strokeLinejoin="round" clipPath={`url(#${id})`} />
    </Svg>
  );
}

/** A row of 5 stars rendering a 0–5 rating with fractional fill. */
export function Stars({
  value,
  size = 16,
  color = STAR_FILL, // KB-429
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

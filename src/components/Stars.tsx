/**
 * Stars — rating display. 부분 채움은 **View 오버레이 + overflow hidden**으로 자른다
 * (SVG clipPath 폐기 — P-375/KB-539: Android react-native-svg가 `url(#id)` 참조를
 * 못 풀어 채움 Path가 통째로 클립됐다. P-349 vectorEffect 충돌에 이은 두 번째
 * 플랫폼 사고라 클립 의존 자체를 없애 양 플랫폼 동일 경로로 만든다).
 */
import * as React from 'react';
import { View, type TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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

/** P-348 ①(KB-511) → P-349 ①(KB-512): viewBox 16 기준 strokeWidth가 크기에 비례
 *  확대(48px 별 = 9px 보더) — 1px 절대값은 vectorEffect가 아니라 **strokeWidth={16/size}**
 *  (vectorEffect non-scaling-stroke는 clipPath와 충돌 — 부분 채움이 조각만 렌더, 실기 회귀). */
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
  const pct = Math.max(0, Math.min(100, fillPct));
  const sw = 16 / size; // 화면상 1px 고정(P-349)
  const empty = (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d={STAR_D} fill={STAR_EMPTY_FILL} stroke={emptyColor} strokeWidth={sw} strokeLinejoin="round" />
    </Svg>
  );
  const filled = (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d={STAR_D} fill={fillColor} stroke={STAR_FILL_STROKE} strokeWidth={sw} strokeLinejoin="round" />
    </Svg>
  );
  if (pct <= 0) return empty;
  if (pct >= 100) return filled;
  // 부분 채움 = 채운 별을 폭 pct%의 overflow hidden 상자로 가린다(SVG 클립 미사용).
  return (
    <View style={{ width: size, height: size }}>
      {empty}
      <View style={{ position: 'absolute', left: 0, top: 0, width: (size * pct) / 100, height: size, overflow: 'hidden' }}>
        {filled}
      </View>
    </View>
  );
}

/** 음식 목록 카드(Top rated)의 종합 평점 줄 — 채운 별 14 + 평균(14/700) + (개수)(12/700). KB-865: 가공식품 카드도 같은 표시(예진 10/22 "기존 별 그대로").
 *  평균 null = 빈 별 + 대시. */
export function OverallRating({ average, count, numTestID, style, textStyle, starSize = 14 }: {
  average: number | null; count: number; numTestID?: string; style?: object;
  /** KB-948 후속(P-568) 카드 변형: 평균·개수 = 이 글자 스타일 하나(같은 굵기 — 카드 한국어 이름 줄 토큰). 넘기면 행 높이 = 그 글자 lineHeight(minHeight 0) */
  textStyle?: TextStyle;
  starSize?: number;
}) {
  const card = textStyle != null;
  return (
    // KB-948 QA: 높이 고정 18 = 큰 글자에서 평균 숫자 하단 잘림 → minHeight + 글자 lineHeight 18(기본 크기 18 그대로, 큰 글자면 lineHeight가 같이 커져 줄이 늘어남)
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4 }, !card && { minHeight: 18 }, style]} testID="overall-rating-row">
      <Star size={starSize} fillPct={average == null ? 0 : 100} />
      <Txt style={card ? [textStyle, average == null && { color: C.inkMute }] : { fontSize: 16, lineHeight: 18, fontWeight: '700', color: average == null ? C.inkMute : C.ink }} testID={numTestID}>
        {average == null ? '\u2014' : average.toFixed(1)}
      </Txt>
      <Txt style={card ? textStyle : { fontSize: 13, lineHeight: 18, fontWeight: '700', color: C.ink2 }}>({count})</Txt>
    </View>
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
    <View style={{ flexDirection: 'row', gap: 4 }}>
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
          <Txt style={{ fontFamily: font.bodyBold, fontSize: 13, color: C.ink2 }} testID="rating-count">
            ({overall.count})
          </Txt>
        </>
      )}
    </View>
  );
}

export default Stars;

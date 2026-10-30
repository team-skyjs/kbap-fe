/**
 * 하단 가로 전체 알약 CTA — 음식 상세(KB-871)·리뷰 작성(KB-891) 공용 정의.
 * 좌우 화면 여백 20 · 높이 48 이상 · radius full · 글자 16/22 semi. 큰 글씨면 줄바꿈으로 높이가 는다(1줄 자르기 금지).
 */
import * as React from 'react';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { color as C, font, radius } from '@/lib/theme';

// 색 없는 틀·글자 — Btn 변형 색(off 등)을 그대로 받는 곳은 이것만 쓴다
const shape: ViewStyle = { alignSelf: 'stretch', minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.pill };
const label: TextStyle = { flexShrink: 1, fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22, textAlign: 'center' };

/** KB-903: 하단 바 띠 위 여백 — 알약 위로 콘텐츠가 바로 붙지 않게 */
export const BAND_PAD_TOP = 12;
/** KB-903(T-032): 알약 글자 확대 상한 — 큰 글자에서 바가 화면 1/4을 덮었다(AX5 두 줄 알약 = 약 110pt). 앱 상한 1.3보다 낮게 */
export const PILL_MAX_SCALE = 1.15;

const band: ViewStyle = { paddingHorizontal: 20, paddingTop: BAND_PAD_TOP, gap: 8, backgroundColor: C.surface }; // 흰 띠 · 상단 선 없음(KB-891 시안 문법)

export const pillCta = StyleSheet.create({
  pillRow: { position: 'absolute', left: 20, right: 20, gap: 8 },
  /** KB-903(T-060·T-019): 떠 있는 바 = 화면 폭 불투명 띠 — 알약 사이·아래로 콘텐츠가 비치고, 비친 별점 행을 누르면 알약이 눌렸다. 아래 여백(안전 영역)은 호출부가 */
  band: { ...band, position: 'absolute', left: 0, right: 0, bottom: 0 },
  /** KB-903(T-071): 흐름 안 바(리뷰 작성·수정) — 스크롤이 바 위에서 끝나 마지막 줄이 바 뒤로 들어갈 수 없다 */
  bandStatic: band,
  pillShape: shape,
  pillLabel: label,
  pillPrimary: { ...shape, backgroundColor: C.primary },
  pillPrimaryText: { ...label, color: '#FFFFFF' },
});

/** 화면 바닥에서 알약까지 — 안전 영역, 최소 12 */
export const pillBottomOf = (inset: number) => Math.max(inset, 12);

/**
 * KB-903: 떠 있는 하단 바(띠)가 있는 화면의 공통 규칙 — 띠 실높이(큰 글자·긴 번역이면 커짐)를 재서 스크롤 아래 여백 = 띠 + 16.
 * 측정 전 폴백 = 위 여백 + 알약 48 + 안전 영역. `bottom` = 띠 안 알약 아래 여백(안전 영역, 최소 12).
 */
export function useBottomBand(inset: number) {
  const bottom = pillBottomOf(inset);
  const [measured, setMeasured] = React.useState(0);
  const bandH = measured || BAND_PAD_TOP + 48 + bottom;
  return { bottom, bandH, scrollPad: bandH + 16, onHeight: setMeasured };
}

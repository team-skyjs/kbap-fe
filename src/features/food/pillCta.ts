/**
 * 하단 가로 전체 알약 CTA — 음식 상세(KB-871)·리뷰 작성(KB-891) 공용 정의.
 * 좌우 화면 여백 20 · 높이 48 이상 · radius full · 글자 16/22 semi. 큰 글씨면 줄바꿈으로 높이가 는다(1줄 자르기 금지).
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { color as C, font } from '@/lib/theme';

// 색 없는 틀·글자 — Btn 변형 색(off 등)을 그대로 받는 곳은 이것만 쓴다
const shape: ViewStyle = { alignSelf: 'stretch', minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 };
const label: TextStyle = { flexShrink: 1, fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22, textAlign: 'center' };

export const pillCta = StyleSheet.create({
  pillRow: { position: 'absolute', left: 20, right: 20, gap: 8 },
  pillShape: shape,
  pillLabel: label,
  pillPrimary: { ...shape, backgroundColor: C.primary },
  pillPrimaryText: { ...label, color: '#FFFFFF' },
});

/** 화면 바닥에서 알약까지 — 안전 영역, 최소 12 */
export const pillBottomOf = (inset: number) => Math.max(inset, 12);

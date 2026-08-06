/**
 * FlagEmoji (P-130, 헌법 v2.3.0) — 국기 = 이모지 (circle-flags SVG 벤더 대체).
 * size = 구 Flag의 원 지름 감각 — fontSize 환산으로 시각 크기 근사.
 * 코드 불량(비2글자)·null이면 null 렌더 — 호출측 기존 폴백(익명 아이콘) 유지.
 */
import * as React from 'react';
import { Txt as Text } from '@/components/Txt';
import { flagEmoji } from '@/lib/flagEmoji';

export function FlagEmoji({ code, size = 20 }: { code: string | null | undefined; size?: number }) {
  const glyph = flagEmoji(code);
  if (!glyph) return null;
  return <Text style={{ fontSize: size * 0.82, lineHeight: size }}>{glyph}</Text>;
}

export default FlagEmoji;

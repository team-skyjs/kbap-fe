/**
 * capsuleMarker (P-125/KB-240) — 스캔 결과 마커 "E — 글래스 캡슐" (예진 8/4 확정,
 * 비주얼 정본 = specs mockups/dot-styles-mockup.html의 .dotE).
 *
 * 다크 글래스 캡슐(반투명 다크 + 그림자 — backdrop blur는 네이티브 의존이라 제외,
 * rgba 근사) 안에 [위험도 글리프 도트 + 흰 굵은 숫자]. 이름은 미니시트로 이동 —
 * 조밀 메뉴판의 이름 필 사다리 붕괴(KB-240)를 구조적으로 해소.
 *
 * 글리프 = 색+형태 병행(헌법 — 색맹 구분): 안전 원 #5fd695 · 주의 사각 #f2b94a ·
 * 회피 45° 마름모 #ff7a66 · 정보없음 회색 사각+물음표 (다크 배경 대비 밝은 변형).
 *
 * 번호 = 미니시트 순번과 1:1 — assignScanNumbers가 **스캔 항목 idx(itemId) 오름차순**
 * 으로 안정 부여(배열 순서·크롭 여부 무관). photoOnly(음수 id)는 마커 없음 → 번호 없음.
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import type { RiskState } from '@/lib/theme';
import { font } from '@/lib/theme';
import type { ResultDish } from '@/lib/scan/segmentMenu';

export const CAPSULE_H = 24;

/** 목업 .dotE 팔레트 — 다크 배경 대비용 밝은 변형(위험도 4색 예약과 별개 표기색). */
export const CAPSULE_GLYPH = {
  safe: '#5fd695',
  caution: '#f2b94a',
  danger: '#ff7a66',
  unable: '#a8a099',
} as const;

export type NumberedDish = ResultDish & { no: number };

/** 번호 부여 — 오버레이 마커 대상(box 보유)만, itemId 오름차순 안정. */
export function assignScanNumbers(dishes: ResultDish[]): NumberedDish[] {
  return [...dishes]
    .sort((a, b) => a.itemId - b.itemId)
    .map((d, i) => ({ ...d, no: i + 1 }));
}

/** 캡슐 폭 추정 — 패딩(7×2) + 글리프(9) + gap(4) + 숫자(자릿수×7.5). */
export function capsuleWidth(no: number): number {
  return 14 + 9 + 4 + String(no).length * 7.5;
}

/**
 * 겹침 처리 — 사다리 알고리즘(pillLayout) 폐기: 캡슐이 작아 대부분 자연 해소,
 * 잔여 겹침만 **미세 오프셋**(아래로 한 단). 입력은 y,x 정렬 가정 없음 — 내부 정렬.
 */
export function layoutCapsules<T extends { lx: number; ty: number; width: number }>(items: T[]): T[] {
  const placed: { lx: number; ty: number; width: number }[] = [];
  return [...items]
    .sort((a, b) => a.ty - b.ty || a.lx - b.lx)
    .map((it) => {
      let ty = it.ty;
      const hits = (y: number) =>
        placed.some((p) => Math.abs(p.ty - y) < CAPSULE_H && it.lx < p.lx + p.width + 4 && p.lx < it.lx + it.width + 4);
      if (hits(ty)) ty += CAPSULE_H - 6; // 한 단만 — 연쇄 사다리 금지
      placed.push({ lx: it.lx, ty, width: it.width });
      return { ...it, ty };
    });
}

/** 위험도 글리프 도트 — 형태(원/사각/마름모/물음표)가 색과 병행. */
export function CapsuleGlyph({ risk }: { risk: RiskState }) {
  if (risk === 'unable') {
    return (
      <View style={[styles.glyph, styles.glyphSquare, { backgroundColor: CAPSULE_GLYPH.unable }]} testID="glyph-unable">
        <Text style={styles.glyphQ}>?</Text>
      </View>
    );
  }
  if (risk === 'danger') {
    return <View style={[styles.glyph, styles.glyphSquare, styles.glyphDiamond, { backgroundColor: CAPSULE_GLYPH.danger }]} testID="glyph-danger" />;
  }
  if (risk === 'caution') {
    return <View style={[styles.glyph, styles.glyphSquare, { backgroundColor: CAPSULE_GLYPH.caution }]} testID="glyph-caution" />;
  }
  return <View style={[styles.glyph, styles.glyphCircle, { backgroundColor: CAPSULE_GLYPH.safe }]} testID="glyph-safe" />;
}

export function CapsuleMarker({
  dish,
  left,
  top,
  onPress,
}: {
  dish: NumberedDish;
  left: number;
  top: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={[styles.capsule, { left, top }]} testID={`capsule-${dish.no}`}>
      <CapsuleGlyph risk={dish.risk} />
      <Text style={styles.no}>{dish.no}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  capsule: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: CAPSULE_H,
    paddingHorizontal: 7,
    borderRadius: CAPSULE_H / 2,
    backgroundColor: 'rgba(28,24,20,0.62)', // 목업 .dotE — blur 없이 rgba 근사
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  no: { fontFamily: font.bodyBlack, fontSize: 12.5, color: '#fff', fontVariant: ['tabular-nums'] },
  glyph: { width: 9, height: 9, alignItems: 'center', justifyContent: 'center' },
  glyphCircle: { borderRadius: 5 },
  glyphSquare: { borderRadius: 2 },
  glyphDiamond: { transform: [{ rotate: '45deg' }] },
  glyphQ: { fontFamily: font.bodyBlack, fontSize: 7, lineHeight: 8, color: '#1c1917' },
});

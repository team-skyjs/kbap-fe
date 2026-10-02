/**
 * KB-706(P-445) — 홈 불꽃 뱃지 끌어 놓기 위치(순수 계산 + 저장 키).
 * 놓으면 가까운 좌/우 가장자리(여백 20)로 붙고 높이는 놓은 그대로. 위치는 **기기 단위**로 기억(회원 아님 — 탈퇴 정리 대상 아님).
 * 범위 = 상단 헤더(상태 표시줄 가림막 포함) 아래 ~ 하단 탭바 FAB 돌출부 위. 화면 크기가 달라져 저장값이 범위 밖이면 안으로 당긴다.
 */
import { BADGE_H, BADGE_W } from '@/components/CountdownBadge';
import { FAB_OVERHANG } from '@/components/TabBar';

export const BADGE_POS_KEY = 'kb706.quotaBadgePos.v1';
export const BADGE_EDGE = 20;
/** 헤더 아래 여유 */
const TOP_CLEAR = 4;
/** 탭바 FAB 돌출 위 여유 */
const BOTTOM_CLEAR = FAB_OVERHANG + 8;
/** 이 거리(pt) 미만 이동은 끌기가 아니라 탭 — 안내 시트 */
export const DRAG_SLOP = 8;

export type BadgeSide = 'left' | 'right';
export interface BadgePos {
  side: BadgeSide;
  top: number;
}

/** 저장 문자열 → 위치(형식이 어긋나면 null = 기본 자리) */
export function parseBadgePos(raw: string | null | undefined): BadgePos | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<BadgePos>;
    if ((v.side === 'left' || v.side === 'right') && typeof v.top === 'number' && Number.isFinite(v.top)) return { side: v.side, top: v.top };
  } catch {
    /* 깨진 값 = 기본 자리 */
  }
  return null;
}

/** 끌 수 있는 세로 범위(홈 영역 높이 · 헤더 높이) */
export function badgeBounds(areaH: number, headerH: number): { min: number; max: number } {
  const min = headerH + TOP_CLEAR;
  return { min, max: Math.max(min, areaH - BADGE_H - BOTTOM_CLEAR) };
}

export function clampTop(top: number, b: { min: number; max: number }): number {
  return Math.min(b.max, Math.max(b.min, top));
}

export function edgeX(side: BadgeSide, areaW: number): number {
  return side === 'left' ? BADGE_EDGE : areaW - BADGE_EDGE - BADGE_W;
}

/** 뱃지 가운데가 화면 왼쪽 절반이면 왼쪽 */
export function nearestSide(x: number, areaW: number): BadgeSide {
  return x + BADGE_W / 2 < areaW / 2 ? 'left' : 'right';
}

/**
 * KB-706(P-445) — 홈 불꽃 뱃지 끌어 놓기 위치(순수 계산 + 저장 키).
 * 놓으면 가까운 좌/우 가장자리(여백 20)로 붙고 높이는 놓은 그대로. 위치는 **기기 단위**로 기억(회원 아님 — 탈퇴 정리 대상 아님).
 * 범위 = 위: **홈 검색 줄(검색창 + 스캔 버튼) 아래 끝 + 여백 — 불꽃이 가장 커진 프레임·불티까지 그려지는 영역 기준**(#234 QA: 위 한계를 헤더로 두면
 *  뱃지가 스캔 버튼(주 CTA)·검색창을 덮어 버튼을 누르려다 시트가 열렸다), 검색 줄 측정 전엔 헤더 아래 · 아래: 탭바 FAB 돌출부 위.
 *  화면 크기가 달라지거나 한계 위에 저장된 값은 복원 때 범위 안으로 당긴다.
 */
import { BADGE_DRAWN_ABOVE, BADGE_H, BADGE_W } from '@/components/CountdownBadge';
import { FAB_OVERHANG } from '@/components/TabBar';

export const BADGE_POS_KEY = 'kb706.quotaBadgePos.v1';
export const BADGE_EDGE = 20;
/** 헤더 아래 여유(검색 줄 측정 전) · 검색 줄 아래 여백 */
const TOP_CLEAR = 4;
export const ROW_CLEAR = 4;
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

/** 뱃지 상자 top의 최솟값 — 검색 줄 아래 끝(측정 앵커)이 있으면 그 아래 여백 + 불꽃이 상자 위로 그려지는 높이, 없으면 헤더 아래 */
export function badgeMinTop(rowBottom: number | null, headerH: number): number {
  return rowBottom != null ? rowBottom + ROW_CLEAR + BADGE_DRAWN_ABOVE : headerH + TOP_CLEAR;
}

/** 끌 수 있는 세로 범위(홈 영역 높이 · 위 한계 badgeMinTop) */
export function badgeBounds(areaH: number, minTop: number): { min: number; max: number } {
  const min = minTop;
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

/** 세션 캐시 — 첫 읽기(또는 놓기) 뒤 홈 재마운트는 저장소를 기다리지 않고 바로 그 자리(undefined = 아직 안 읽음) */
let posCache: BadgePos | null | undefined;
export function cachedBadgePos(): BadgePos | null | undefined {
  return posCache;
}
export function rememberBadgePos(v: BadgePos | null): void {
  posCache = v;
}
/** 유닛용 — undefined = 읽기 전, null = 저장값 없음 */
export function _setBadgePosCacheForTest(v: BadgePos | null | undefined): void {
  posCache = v;
}

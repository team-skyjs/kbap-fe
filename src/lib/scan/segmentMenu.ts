/**
 * segmentMenu.ts — T072 step2 (handoff §14-2.3): classify OCR lines, then attach
 * best-effort side info (price, romanized name) to each dish name via radial
 * nearest-neighbor. Works for both layouts (grid: price below; list: price to the
 * right) because nearest-by-center is correct in both.
 *
 * SAFETY: this geometry is decoupled from risk (§14-3). Risk binds to the dish
 * NAME directly downstream, so a mis-attached price/latin causes zero safety harm.
 * Filtering keeps every plausible Korean dish name (structural junk only).
 */
import type { BoundingBox } from '@/lib/api/scanTypes';
import type { RiskState } from '@/lib/theme';
import { classifyLine, type LineType } from './classifyLine';

export interface OcrLine {
  text: string;
  box: BoundingBox; // normalized 0..1
}

export interface MenuDish {
  itemId: number; // client-assigned 0..n (BE match key, §13-2)
  rawMenuName: string;
  box: BoundingBox;
  /** 메뉴판 가격, KRW 정수 (멘토링 ④ — 환율 변환은 후일 이 값 기준). 매칭 실패=null=미표시 */
  priceKrw: number | null;
  latin: string | null; // best-effort nearest romanized name
}

/** A dish enriched with the BE verdict — what the result view renders (KB-72 신계약). */
export interface ResultDish extends MenuDish {
  risk: RiskState;
  matched: boolean; // false = 조사 대기 → detail navigation disabled
  foodId: string | null; // detail route param when matched
  displayName: string; // BE name (rawMenuName fallback) — pill/list label
  koreanName: string | null;
  /** P-153 v2: 미등록 항목 유사 제안(링크 전용 — 행 판정 unable 불변). */
  similar?: import('@/lib/api/scanAdapter').SimilarFood | null;
}

export interface SegmentedMenu {
  dishes: MenuDish[];
  origins: string[]; // display-only (never sent to BE)
  /** per-line classification, for tests/debug */
  classified: { text: string; box: BoundingBox; type: LineType }[];
}

const center = (b: BoundingBox) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

function dist(a: BoundingBox, b: BoundingBox): number {
  const ca = center(a);
  const cb = center(b);
  const dx = ca.x - cb.x;
  const dy = ca.y - cb.y;
  return Math.hypot(dx, dy);
}

/** nearest line of a given type to `from`, or null. maxD 밖이면 무매칭(null). */
function nearest(from: BoundingBox, pool: { text: string; box: BoundingBox }[], maxD = Infinity): string | null {
  let best: string | null = null;
  let bestD = maxD;
  for (const c of pool) {
    const d = dist(from, c.box);
    if (d < bestD) {
      bestD = d;
      best = c.text.trim();
    }
  }
  return best;
}

// 멘토링 ④: 가격은 같은 행(리스트) 또는 바로 아래(그리드)에서만 — 가격 없는 메뉴에
// 화면 반대편 가격이 붙는 것 방지(잘못된 가격 > 미표시). 정규화 좌표 기준.
// ponytail: 고정 반경 휴리스틱 — 기울어진 사진/가격 열 분리형 메뉴판은 놓친다(진행 메모 한계 참고)
const PRICE_MAX_DIST = 0.35;

/** "12,000" / "12000원" / "₩12,000" / "W8,000" → KRW 정수. 숫자 없으면 null. */
export function parsePriceKrw(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return n > 0 ? n : null;
}

/** KRW 정수 → "₩12,000" (표시 통일 포맷, Intl 미의존). */
export function formatKrw(n: number): string {
  return '₩' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* ---- P-012(KB-179): 스캔 결과 → 상세 가격 route param ----
 * 가격은 음식이 아니라 그 메뉴판의 속성(BE 확정 7/20) — 스캔 진입에만 param으로
 * 전달·표시하고 저장하지 않는다. 신뢰 경계 낮음(표시 전용): 양의 정수만 통과. */

/** ResultDish.priceKrw → 상세 href 접미사 ('?price=9000' | ''). null/0/비정수 = 미첨부. */
export function scanPriceParam(priceKrw: number | null | undefined): string {
  return typeof priceKrw === 'number' && Number.isInteger(priceKrw) && priceKrw > 0
    ? `?price=${priceKrw}`
    : '';
}

/** 상세의 price param 파싱 — 정수 파싱 실패·음수·조작값은 null(미표시). */
export function parseScanPrice(raw: string | string[] | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

export function segmentMenu(lines: OcrLine[]): SegmentedMenu {
  const classified = lines.map((l) => ({ text: l.text, box: l.box, type: classifyLine(l.text, l.box) }));

  const dishLines = classified.filter((c) => c.type === 'dishName');
  const priceLines = classified.filter((c) => c.type === 'price');
  const latinLines = classified.filter((c) => c.type === 'latin');
  const origins = classified.filter((c) => c.type === 'origin').map((c) => c.text.trim());

  const dishes: MenuDish[] = dishLines.map((d, i) => {
    const priceText = nearest(d.box, priceLines, PRICE_MAX_DIST);
    return {
      itemId: i,
      rawMenuName: d.text.trim(),
      box: d.box,
      priceKrw: priceText != null ? parsePriceKrw(priceText) : null,
      latin: nearest(d.box, latinLines),
    };
  });

  return { dishes, origins, classified };
}

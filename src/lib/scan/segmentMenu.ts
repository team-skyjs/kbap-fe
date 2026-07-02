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
import { classifyLine, type LineType } from './classifyLine';

export interface OcrLine {
  text: string;
  box: BoundingBox; // normalized 0..1
}

export interface MenuDish {
  itemId: number; // client-assigned 0..n (BE match key, §13-2)
  rawMenuName: string;
  box: BoundingBox;
  price: string | null; // best-effort nearest price line
  latin: string | null; // best-effort nearest romanized name
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

/** nearest line of a given type to `from`, or null. */
function nearest(from: BoundingBox, pool: { text: string; box: BoundingBox }[]): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of pool) {
    const d = dist(from, c.box);
    if (d < bestD) {
      bestD = d;
      best = c.text.trim();
    }
  }
  return best;
}

export function segmentMenu(lines: OcrLine[]): SegmentedMenu {
  const classified = lines.map((l) => ({ text: l.text, box: l.box, type: classifyLine(l.text, l.box) }));

  const dishLines = classified.filter((c) => c.type === 'dishName');
  const priceLines = classified.filter((c) => c.type === 'price');
  const latinLines = classified.filter((c) => c.type === 'latin');
  const origins = classified.filter((c) => c.type === 'origin').map((c) => c.text.trim());

  const dishes: MenuDish[] = dishLines.map((d, i) => ({
    itemId: i,
    rawMenuName: d.text.trim(),
    box: d.box,
    price: nearest(d.box, priceLines),
    latin: nearest(d.box, latinLines),
  }));

  return { dishes, origins, classified };
}

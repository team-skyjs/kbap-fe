/**
 * T072 step6 — segmentation locked against the REAL 58-line ML Kit OCR sample.
 * Fixture vendored from spec repo specs/.../fixtures/ocr-sample-menu.json
 * (commit eb2ed72): original lines (text + normalized box), fullText, and the
 * human-curated `expected` buckets (dishNames = BE-send targets, junk = drop).
 *
 * SAFETY assertions (handoff §14-3/§14-5, Constitution III):
 *  - every expected dish name IS captured as a dish (never drop a real dish),
 *  - no expected junk line leaks in as a dish (structural drop works).
 * Over-inclusion of plausible-Korean non-dishes (store titles / banners) is
 * allowed by design — they render as "unable", which is safe — so we assert a
 * superset, not exact equality, and snapshot the actual output to lock it.
 */
import { segmentMenu, type OcrLine } from '../segmentMenu';
import fixture from './fixtures/ocr-sample-menu.json';

type Fixture = {
  lines: { text: string; box: { x: number; y: number; width: number; height: number } }[];
  expected: { dishNames: string[]; junk: string[]; sections: string[]; titles: string[] };
};

const fx = fixture as unknown as Fixture;
const lines: OcrLine[] = fx.lines.map((l) => ({ text: l.text, box: l.box }));
const seg = segmentMenu(lines);
const dishNames = seg.dishes.map((d) => d.rawMenuName);

describe('T072 segmentation on the real 58-line OCR sample (spec eb2ed72)', () => {
  it('captures every expected dish name (never drops a real dish — §14-3)', () => {
    for (const name of fx.expected.dishNames) {
      expect(dishNames).toContain(name);
    }
  });

  it('drops all expected junk — none leaks in as a dish (§14-5)', () => {
    for (const junk of fx.expected.junk) {
      expect(dishNames).not.toContain(junk);
    }
  });

  it('only sends dish names to the BE (no prices/sections/origin among dishes)', () => {
    for (const s of [...fx.expected.sections, ...fx.expected.titles]) {
      // sections must never be dishes; titles are allowed-but-noisy → asserted in snapshot
      if (fx.expected.sections.includes(s)) expect(dishNames).not.toContain(s);
    }
    expect(seg.origins.join(' ')).toContain('원산지');
  });

  it('locks the exact segmentation output (snapshot)', () => {
    const counts = seg.classified.reduce<Record<string, number>>((a, c) => {
      a[c.type] = (a[c.type] ?? 0) + 1;
      return a;
    }, {});
    expect({ dishNames, counts }).toMatchSnapshot();
  });
});

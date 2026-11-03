/** KB-934 — 홈 Popular dishes 가로 레일: 리본 윗변(사진 위 4pt 걸침)이 ScrollView 경계에 잘렸다 → 레일 위 여백 = 걸침 높이, 같은 만큼 위로(카드 자리 무변) */
import * as fs from 'fs';

const ex = fs.readFileSync('src/features/food/FoodExplorer.tsx', 'utf8');
const cards = fs.readFileSync('src/features/food/FoodCards.tsx', 'utf8');

it('레일 위 여백 = 리본 걸침(gbadge top −4) · 레일은 그만큼 위로(세로 자리 무변)', () => {
  const overhang = -Number(/gbadge: \{ position: 'absolute', top: (-?\d+)/.exec(cards)![1]);
  expect(overhang).toBe(4);
  expect(ex).toContain(`export const RAIL_RIBBON_OVERHANG = ${overhang};`);
  expect(ex).toContain('rail: { flexGrow: 0, marginTop: -RAIL_RIBBON_OVERHANG },');
  expect(ex).toMatch(/railContent: \{[^}]*paddingTop: RAIL_RIBBON_OVERHANG/);
});

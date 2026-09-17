/**
 * P-396(KB-590) — 홈 가로 레일 끝 "전체 보기" 카드에 주황 포인트.
 * ① 색은 DS 토큰만(새 hex 0) ② 프레임·탭 동작 무변 ③ 틴트 위 대비 AA
 *
 * ③이 이 PR의 핵심 판단: 발주는 텍스트·chevron을 `C.primary`로 지정했지만 그 값은
 * 이 배경에서 2.61밖에 안 나온다(AA 4.5 미달, 비텍스트 3:1도 미달). P-284가
 * "12~14px primary 텍스트 = primaryText"로 이미 정해둔 이유가 이것이라, 실측으로 잠근다.
 */
import * as fs from 'fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const FX = read('src/features/food/FoodExplorer.tsx');
const THEME = read('src/lib/theme.ts');

/* WCAG 2.1 상대 휘도 → 대비비 */
const lum = (hex: string) => {
  const ch = [0, 2, 4]
    .map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** primaryTint(주황 5%)를 흰 배경 위에 합성한 실제 표시색 */
const overWhite = (rgb: [number, number, number], alpha: number) =>
  '#' + rgb.map((c) => Math.round(c * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0')).join('');

it('① 색은 DS 토큰만 — seeAll 스타일에 새 hex 리터럴 0', () => {
  const block = FX.match(/seeAllCard: \{[\s\S]*?\n  \},/)![0] + FX.match(/seeAllText: \{[^}]*\},/)![0];
  expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/); // 인라인 hex 금지
  expect(block).toContain('backgroundColor: primaryTint');
  expect(block).toContain('borderColor: C.primary');
  expect(block).toContain('color: C.primaryText');
  // chevron도 같은 토큰(텍스트만 바꾸고 아이콘이 회색으로 남는 반쪽 적용 방지)
  expect(FX).toMatch(/\{t\('home\.seeAll'\)\}<\/Text>\s*<IconChevron size=\{16\} color=\{C\.primaryText\}/);
});

it('② 프레임·탭 동작 무변 — 비율·gap·패딩 그대로, foodTabHref 승계, testID 유지', () => {
  expect(FX).toContain('aspectRatio: 174 / 203');
  expect(FX).toContain('gap: 2,');
  expect(FX).toContain('paddingHorizontal: 12,');
  expect(FX).toContain('testID="home-rail-see-all"');
  expect(FX).toMatch(/testID="home-rail-see-all"|foodTabHref\(gridTab as GridSegment, riskChip as RiskChipParam/);
  // 폭은 렌더 시 cardW 주입 — 고정 width가 새로 박히면 레일 폭 계산이 깨진다
  expect(FX).toMatch(/style=\{\[styles\.seeAllCard, \{ width: cardW \}\]\}/);
});

it('③ 대비 — primaryTint 배경 위 primaryText는 AA(4.5) 통과, 발주가 지정한 primary는 미달', () => {
  const primary = THEME.match(/primary: '(#[0-9A-Fa-f]{6})'/)![1];
  const primaryText = THEME.match(/primaryText: '(#[0-9A-Fa-f]{6})'/)![1];
  const tintRaw = THEME.match(/primaryTint = 'rgba\((\d+),(\d+),(\d+),([\d.]+)\)'/)!;
  const bg = overWhite([+tintRaw[1], +tintRaw[2], +tintRaw[3]], +tintRaw[4]);

  expect(ratio(primaryText, bg)).toBeGreaterThanOrEqual(4.5); // 실측 4.91
  // 발주 지정값을 그대로 썼다면 비텍스트 최소치 3:1조차 못 넘었다 — 이 단언이 회귀를 막는다
  expect(ratio(primary, bg)).toBeLessThan(3);
});

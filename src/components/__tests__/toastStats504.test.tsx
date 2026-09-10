/** P-343(KB-504) — ① DS 토스트 최상단 오버레이 ② 리뷰 통계 우측 중앙 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('① 토스트(P-346으로 대체) — 최상단 오버레이·box-none 유지(형태 잠금은 toastMobbin507)', () => {
  const tt = read('src/components/TopToast.tsx');
  expect(tt).toContain('top: insets.top + 8');
  expect(tt).toContain('zIndex: 1000');
  expect(tt).toContain('pointerEvents="box-none"');
});

it('② summaryRight = 우측 영역 중앙(justifyContent center, gap 13 유지) — 있는 축만 렌더', () => {
  const rl = read('src/app/food/[id]/reviews.tsx');
  expect(rl).toMatch(/summaryRight: \{ flexGrow: 1, flexShrink: 1, minWidth: 0, flexDirection: 'row', gap: 13, alignItems: 'flex-start', justifyContent: 'center'/); // 4R: 기준선 상단 공유
});

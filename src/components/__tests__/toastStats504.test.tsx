/** P-343(KB-504) — ① DS 토스트 최상단 오버레이 ② 리뷰 통계 우측 중앙 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('① 토스트 = DS 9:4239(335×36·#000 50%·r9·pad 8/50·14/600 lh20) + 최상단 insets.top+8·zIndex 1000·터치 투과', () => {
  const tt = read('src/components/TopToast.tsx');
  expect(tt).toContain('top: insets.top + 8');
  expect(tt).toContain('zIndex: 1000');
  // #105 P2(i18n): minHeight 36 + pad 16 — 성공 1줄 = 36 유지, 긴 에러만 2줄 확장
  expect(tt).toContain("width: 335, maxWidth: '100%', minHeight: 36, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 16");
  expect(tt).toContain("fontSize: 14, fontWeight: '600', color: '#FFFFFF', textAlign: 'center', lineHeight: 20");
  expect(tt).toContain('numberOfLines={2}'); // 축소 폐기 — i18n 절단 방지
  expect(tt).toContain('pointerEvents="none"');
  expect(tt).not.toContain('insets.top + 56'); // 헤더 아래 배치 폐기
});

it('② summaryRight = 우측 영역 중앙(justifyContent center, gap 13 유지) — 있는 축만 렌더', () => {
  const rl = read('src/app/food/[id]/reviews.tsx');
  expect(rl).toMatch(/summaryRight: \{ flexGrow: 1, flexShrink: 1, minWidth: 0, flexDirection: 'row', gap: 13[^}]*justifyContent: 'center'/);
});

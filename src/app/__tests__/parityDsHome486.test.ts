/**
 * P-325 ①(KB-486) — DS·홈 픽셀 정합 값 잠금(핵심 수치, 스냅샷 아님).
 * 정본: bridge/design/parity-audit-2026-09-08.md §3.
 */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('A-DS — SectionHead 11/700·22/700, 세그먼트 탭 14/700 #9196A1, 북마크 기본 보더 투명(저장만 #EAEBEE)', () => {
  const head = read('src/components/SectionHead.tsx');
  expect(head).toContain("fontSize: 11, fontWeight: '700', letterSpacing: 1.6");
  expect(head).toContain("fontSize: 22, fontWeight: '700', lineHeight: 30, letterSpacing: -0.6");
  const fx = read('src/features/food/FoodExplorer.tsx');
  expect(fx).toContain("tabLabel: { fontSize: 14, fontWeight: '700', color: '#9196A1' }");
  const cards = read('src/features/food/FoodCards.tsx');
  expect(cards).toContain("borderColor: 'transparent'");
  expect(cards).toContain("gbmSaved: { borderColor: '#EAEBEE' }");
});

it('A-FC — card gap 8·who gap 4·아바타 0.5 스트로크·케밥 20 #262C31·음식 칩 gap 4', () => {
  const fc = read('src/features/review/FeedCard.tsx');
  expect(fc).toMatch(/card: \{ paddingVertical: 22, paddingHorizontal: 20, gap: 8/);
  expect(fc).toMatch(/who: \{[^}]*gap: 4/);
  expect(fc).toMatch(/avatar: \{[^}]*borderWidth: 0\.5, borderColor: 'rgba\(0,0,0,0\.10\)'/);
  expect(fc).toContain("<IconMore size={20} color={'#262C31'} />");
  expect(fc).toMatch(/foodChip: \{[^}]*gap: 4/);
});

it('A-HM — 검색 pt0·padH16·placeholder #D1D3D8(스캔 버튼 bg는 C 이관 = primary 유지)·탭 mt14·칩 18/14·gmeta 10/5·rname 15/700', () => {
  const fx = read('src/features/food/FoodExplorer.tsx');
  expect(fx).toMatch(/searchRow: \{[^}]*paddingTop: 0/);
  expect(fx).toContain("color: '#D1D3D8'");
  expect(fx).toMatch(/scanBtn: \{[^}]*backgroundColor: C\.primary/); // A-HM-02 제외분(C 이관)
  expect(fx).toMatch(/tabsRow: \{[^}]*marginTop: 14/);
  expect(fx).toMatch(/chipRow: \{[^}]*paddingTop: 18, paddingBottom: 14/);
  const cards = read('src/features/food/FoodCards.tsx');
  expect(cards).toMatch(/gmeta: \{[^}]*gap: 5, marginTop: 10/);
  expect(cards).toContain("rname: { fontSize: 15, fontWeight: '700'");
  const home = read('src/app/(tabs)/index.tsx');
  expect(home).toMatch(/moreWrap: \{[^}]*paddingTop: 16, paddingBottom: 16/);
  expect(home).toMatch(/chipRow: \{[^}]*paddingVertical: 0/);
});

it('A-SV·A-RT·A-NF·A-ER — 저장 그리드 17·리뷰탭 토글 7·FAB 14/18·알림 제목 700·에러 gap 6', () => {
  const saved = read('src/app/profile/saved.tsx');
  expect(saved).toContain('gridRow: { gap: 17 }');
  const rf = read('src/features/community/ReviewFeed.tsx');
  expect(rf).toMatch(/toggleRow: \{[^}]*gap: 7/);
  expect(rf).toMatch(/right: 14,\s*\n\s*bottom: 18/);
  expect(read('src/app/notifications.tsx')).toMatch(/title: \{ fontSize: 15, fontWeight: '700'/);
  expect(read('src/components/StateBlock.tsx')).toMatch(/errWrap: \{[^}]*gap: 6/);
});

it('A-SK — 리뷰 블록 pv14·내 리뷰 카드 스트로크·마이푸드 보더 #EAEBEE·그리드 프레임 소멸', () => {
  const sk = read('src/components/Skeleton.tsx');
  expect(sk).toContain('reviewBlock: { gap: 12, paddingVertical: 14 }');
  expect(sk).toContain("myRevCard: { borderRadius: 8, borderWidth: 1, borderColor: '#EAEBEE', padding: 16, gap: 12 }");
  expect(sk).toMatch(/myFoodsRow: \{[^}]*borderBottomColor: '#EAEBEE'/);
  expect(sk).toContain("gridCard: { width: '48.5%' }");
});

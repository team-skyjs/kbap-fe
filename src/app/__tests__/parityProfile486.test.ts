/** P-325 ③(KB-486) — 프로필 탭·편집·내 리뷰·마이 푸드·주문 상세 픽셀 정합 값 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('A-PF — 아바타 48 스트로크·행 gap8·정보수정 #2F3137·랭킹 카드 pad 20/16·타일 r0 pt8 rowGap16', () => {
  const pf = read('src/app/(tabs)/profile.tsx');
  expect(pf).toMatch(/avatar: \{ width: 48[^}]*borderWidth: 1, borderColor: 'rgba\(0,0,0,0\.10\)'/);
  expect(pf).toMatch(/id: \{ flexDirection: 'row', alignItems: 'center', gap: 8/);
  expect(pf).toContain("editBtnText: { fontSize: 13, fontWeight: '500', color: '#2F3137' }");
  expect(pf).toMatch(/rankCard: \{[^}]*paddingLeft: 20, paddingRight: 16/);
  expect(pf).toMatch(/rankBarRow: \{[^}]*gap: 12[^}]*marginTop: 8/);
  // P-368 ②: 그리드 = 행 chunk(컨테이너 rowGap·행 columnGap 분리)
  expect(pf).toMatch(/dietGrid: \{ rowGap: 16 \}/);
  expect(pf).toMatch(/dietRow: \{ flexDirection: 'row', columnGap: 8 \}/);
  expect(pf).toMatch(/dietTile: \{[^}]*paddingTop: 8, gap: 0/);
  expect(pf).toContain('dietImg: { width: 48, height: 48, borderRadius: 0');
  expect(pf).toContain('radius={0}'); // AvoidTile r0(프로필 변형 — 온보딩 기본 14 무변)
  const av = read('src/components/AvoidTile.tsx');
  expect(av).toContain('radius = 14');
});

it('A-ED — 아바타 pv12+스트로크·캠 배지 @0·필드 흰 48 #DCDEE3·라벨 14/500 #6A6F7C·linkedIc 24/아이콘 20·savebar 16', () => {
  const ed = read('src/app/profile/edit.tsx');
  expect(ed).toMatch(/avatarWrap: \{[^}]*paddingVertical: 12/);
  expect(ed).toMatch(/av: \{ width: 100[^}]*borderWidth: 1, borderColor: 'rgba\(0,0,0,0\.10\)'/);
  expect(ed).toMatch(/cam: \{ position: 'absolute', right: 0, bottom: 0/);
  expect(ed).toContain('fieldset: { gap: 4, marginTop: -4 }');
  expect(ed).toContain("fieldLbl: { fontSize: 14, fontWeight: '500', color: '#6A6F7C' }");
  expect(ed).toMatch(/field: \{[^}]*backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCDEE3'[^}]*minHeight: 48/);
  expect(ed).toMatch(/linkedIc: \{ width: 24, height: 24, borderRadius: 12/);
  expect(ed).toContain('<IconApple size={20}');
  expect(ed).toMatch(/savebar: \{[^}]*paddingHorizontal: 16/);
});

it('A-MR·A-MF — 위험 칩 소멸(P-336 — A-MR-01 대체) · 탭 전폭 mt0 · 카드 gap10 #EAEBEE · 메타 gap6 · 필 텍스트 #1C1E21', () => {
  expect(read('src/app/profile/reviews.tsx')).not.toContain('myrev-chip');
  const mf = read('src/app/profile/my-foods.tsx');
  expect(mf).toContain("tabsRow: { flexDirection: 'row', paddingHorizontal: 0, marginTop: 0 }");
  expect(mf).toMatch(/card: \{[^}]*gap: 10[^}]*borderBottomColor: '#EAEBEE'/);
  expect(mf).toMatch(/metaRow: \{[^}]*gap: 6/);
  expect(mf).toContain("qtyPillText: { fontSize: 12, fontWeight: '500', color: '#1C1E21' }");
});

it('A-OD — 영수증 보더 0·pad 16/0 gap16 · 디바이더 #F5F5F5 · dish 카드 흰 r8 #EAEBEE pad12 · 수량+가격 가로 gap3', () => {
  const od = read('src/app/profile/order/[id].tsx');
  expect(od).toContain("receipt: { marginHorizontal: 20, paddingVertical: 16, paddingHorizontal: 0, gap: 16 }");
  expect(od).toContain("divider8: { height: 8, backgroundColor: '#F5F5F5' }");
  expect(od).toMatch(/dishesHead: \{[^}]*gap: 6/);
  expect(od).toMatch(/itemRow: \{[^}]*padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAEBEE', borderRadius: 8/);
  expect(od).toContain("itemRight: { flexDirection: 'row', alignItems: 'baseline', gap: 3 }");
});

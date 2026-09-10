/** P-325 ④(KB-486) — 음식 상세·리뷰 목록·리뷰 작성·스캔 픽셀 정합 값 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('A-FD — 헤드 24/18/27·타일 31% pt26(푸터 변형 pt8)·별점 행 gap2 13/600·natToggle gap7', () => {
  const fd = read('src/app/food/[id]/index.tsx');
  expect(fd).toContain("headBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 27 }");
  expect(fd).toMatch(/ingTile: \{[^}]*paddingTop: 26/);
  expect(fd).toContain('ingTileWithFoot: { paddingTop: 8 }');
  expect(fd).toContain("ratingRowText: { fontSize: 13, fontWeight: '600', color: '#2F3137' }");
  expect(fd).toMatch(/rvHead: \{[^}]*gap: 2, paddingHorizontal: 20, paddingTop: 20/);
  expect(fd).toMatch(/natToggleRow: \{[^}]*gap: 7/);
});

it('A-RL — body 20/8 gap9·summaryBox pv16 ph0 gap29·좌 149·축 gap6·트랙 8×46 #DCDEE3·토글 gap7', () => {
  const rl = read('src/app/food/[id]/reviews.tsx');
  expect(rl).toContain("body: { paddingHorizontal: 20, paddingTop: 8, gap: 9 }");
  expect(rl).toMatch(/summaryBox: \{[^}]*paddingVertical: 16, paddingHorizontal: 0, gap: 29/);
  expect(rl).toContain('summaryLeft: { flex: 1, minWidth: 96, maxWidth: 149, gap: 4'); // #105 P2
  expect(rl).toContain("axisCol: { alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }"); // #105 3R
  expect(rl).toMatch(/axisTrack: \{ width: 8, height: 46, borderRadius: 4, backgroundColor: '#DCDEE3'/);
  expect(rl).toMatch(/filterToggle: \{[^}]*gap: 7/);
});

it('A-RW — body pad20 gap20·캡션 슬롯 안 14/600 #778088·라벨 13/600·textarea 132 #DCDEE3 mt-8·photoDel #D9D9D9·시트 r16 pad16 gap20 제목 중앙', () => {
  const rw = read('src/app/food/[id]/review.tsx');
  expect(rw).toContain("body: { padding: 20, gap: 20 }");
  expect(rw).not.toContain('photoCap:'); // A-RW-05 → P-348 ③ 대체(캡션 소멸 — 아이콘만)
  expect(rw).toContain("label: { fontSize: 13, fontWeight: '600', color: '#778088' }");
  expect(rw).toMatch(/textarea: \{ minHeight: 132[^}]*borderColor: '#DCDEE3'[^}]*marginTop: -8/);
  expect(rw).toMatch(/photoDel: \{[^}]*top: 6, right: 6[^}]*backgroundColor: '#D9D9D9'/);
  const rc = read('src/features/review/ReviewCellParts.tsx');
  expect(rc).toMatch(/pickerSheet: \{[^}]*borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 20/);
  expect(rc).toContain("pickerHeader: { alignItems: 'center' }");
  expect(rc).toMatch(/searchBox: \{[^}]*borderRadius: 4, paddingLeft: 16/);
  expect(rc).toMatch(/extrasLabelWrap: \{[^}]*gap: 4/);
});

it('A-SC — 결과 헤더 56/16·배너 gap6·행 보더 0·warnChip pad 3/6·moreChip=warnChip 12/700·miss 비이탤릭 lh13·thumbUnable 흰', () => {
  const sc = read('src/app/scan.tsx');
  expect(sc).toMatch(/quietHeader: \{[^}]*paddingHorizontal: 16, minHeight: 56/);
  expect(sc).toMatch(/recogBanner: \{[^}]*gap: 6, minHeight: 48/);
  expect(sc).toMatch(/controlRow: \{[^}]*paddingTop: 18, paddingBottom: 10/);
  const rich = read('src/features/scan/ScanRichList.tsx');
  expect(rich).toContain("body: { paddingHorizontal: 20, paddingBottom: 120 }");
  expect(rich).not.toMatch(/row: \{[^}]*borderBottomWidth/);
  expect(rich).toMatch(/warnChip: \{[^}]*paddingLeft: 3, paddingRight: 6/);
  expect(rich).toMatch(/moreChip: \{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C\.line, borderRadius: 37/);
  expect(rich).toContain("moreChipText: { fontSize: 12, fontWeight: '700', color: '#2F3137' }");
  expect(rich).toContain("missText: { fontSize: 13, fontWeight: '400', color: C.ink3, lineHeight: 13 }");
  // P-353 ③(KB-515): 미등록 = 기본 음식 이미지 + unable 마크 오버레이(구 흰 박스 소멸)
  expect(rich).toContain('<ExpoImage source={DEFAULT_FOOD_IMAGE}'); // KB-515 후속: 로컬 에셋
  expect(rich).toContain('thumbUnableOverlay');
});

it('A-SN-04 — 권한 알럿 gap5·본문 lh22.3·스크림 0.8 / Stars 행 gap4(공용)', () => {
  const sc = read('src/app/scan.tsx');
  expect(sc).toMatch(/permAlert: \{[^}]*gap: 5 \}/);
  expect(sc).toMatch(/permAlertBody: \{[^}]*lineHeight: 22\.3/);
  expect(sc).toContain("permScrim: { backgroundColor: 'rgba(0,0,0,0.8)'");
  expect(read('src/components/Stars.tsx')).toMatch(/flexDirection: 'row', gap: 4/);
});

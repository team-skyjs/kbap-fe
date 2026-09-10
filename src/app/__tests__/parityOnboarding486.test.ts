/** P-325 ②(KB-486) — 온보딩(로그인·국가·맵기·식이) 픽셀 정합 값 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('A-LG — hero gap 6/pad 24·sub lh22 mw326·Google h48 r4 15·버튼 gap 8·둘러보기 14', () => {
  const lg = read('src/app/login.tsx');
  expect(lg).toMatch(/hero: \{[^}]*gap: 6, paddingHorizontal: 24/);
  expect(lg).toMatch(/sub: \{[^}]*lineHeight: 22, maxWidth: 326/);
  expect(lg).toMatch(/browse: \{ fontSize: 14/);
  const sb = read('src/components/SocialAuthButtons.tsx');
  expect(sb).toContain("wrap: { alignSelf: 'stretch', gap: 8 }");
  expect(sb).toContain('const BTN_H = 48');
  expect(sb).toMatch(/google: \{[\s\S]{0,300}borderRadius: 4/);
  expect(sb).toContain("googleLabel: { fontFamily: font.bodyBold, fontSize: 15, color: '#1F1F1F' }");
});

it('A-NT — 미니헤더 56/chevron 24·body 20·라디오 1.5·검색 r4 h48 15/500·타일 16/12·footer pt10', () => {
  const ob = read('src/app/onboarding/index.tsx');
  expect(ob).toMatch(/miniHeader: \{[^}]*minHeight: 56/);
  expect(ob).toMatch(/body: \{ paddingHorizontal: 20/);
  expect(ob).toMatch(/natRadio: \{[^}]*borderWidth: 1\.5/);
  expect(ob).toMatch(/natSearch: \{[^}]*borderRadius: 4, paddingHorizontal: 16, marginBottom: 12/);
  expect(ob).toMatch(/natSearchInput: \{[^}]*paddingVertical: 14[^}]*fontSize: 15/);
  expect(ob).toMatch(/natTile: \{[^}]*gap: 12, padding: 16/);
  expect(ob).toMatch(/footer: \{ paddingTop: 10/);
});

it('A-SP — 히어로 60(mb18+42)·chili gap4·레일 18/7·타일 세로중앙 gap2·슬라이더 박스 81·그라 2-stop', () => {
  const ob = read('src/app/onboarding/index.tsx');
  expect(ob).toContain("gap: 4, marginTop: 42 }");
  expect(ob).toMatch(/chiliRow: \{[^}]*gap: 4/);
  expect(ob).toMatch(/railRow: \{[^}]*gap: 7, marginTop: 18/);
  expect(ob).toMatch(/railTile: \{[^}]*justifyContent: 'center', gap: 2/);
  expect(ob).toMatch(/sliderBox: \{[^}]*paddingTop: 5, paddingBottom: 14/);
  expect(read('src/components/SpiceLevelSlider.tsx')).toContain("colors={['#FFCD43', '#FF7134']}");
  expect(read('src/app/profile/edit.tsx')).toMatch(/spiceBox: \{[^}]*paddingTop: 5, paddingBottom: 14/);
});

it('A-DT — 칩 r8 12/16 14/400 #1E2124(온보딩·diet 공통)·그룹 24·diet 그룹 라벨 14/500', () => {
  const ob = read('src/app/onboarding/index.tsx');
  expect(ob).toMatch(/presetChip: \{[^}]*borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12/);
  expect(ob).toContain("presetChipText: { fontSize: 14, fontWeight: '400', color: '#1E2124' }");
  expect(ob).toContain("style={{ marginBottom: 24 }}");
  const dt = read('src/app/profile/diet.tsx');
  expect(dt).toMatch(/chip: \{[^}]*borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12/);
  expect(dt).toContain("groupTitle: { fontSize: 14, fontWeight: '500', color: '#6A6F7C' }");
  expect(dt).toMatch(/body: \{ padding: 18, gap: 24/);
});

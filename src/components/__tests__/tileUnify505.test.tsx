/** P-344(KB-505) — 재료 타일 통일(A안) + 누끼 74% 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('AvoidTile 기본 = 흰+보더1 #EAEBEE r14 · 선택 = 1.5 #FF7134 + primary 6%(외곽 치수 불변)', () => {
  const av = read('src/components/AvoidTile.tsx');
  expect(av).toMatch(/tile: \{ width: '100%', aspectRatio: 1, borderRadius: 14[^}]*borderWidth: 1, borderColor: '#EAEBEE'/);
  expect(av).toContain("tileOn: { borderWidth: 1.5, borderColor: C.primary, backgroundColor: 'rgba(255,113,52,0.06)' }");
  expect(av).not.toContain("borderColor: 'transparent'"); // 구 "보더 없음"(투명) 기본 소멸
});

it('누끼 인셋 13%(≈74%) 전 표면 공통 — AvoidTile·상세 IngChainImage, 폴백 cover 유지', () => {
  const av = read('src/components/AvoidTile.tsx');
  expect(av).toContain("photoCut: { position: 'absolute', top: '13%', right: '13%', bottom: '13%', left: '13%' }");
  expect(av).toContain("contentFit={isCutout ? 'contain' : 'cover'}"); // 폴백 = cover
  expect(read('src/app/food/[id]/index.tsx')).toContain('size * 0.74');
});

it('선택 라벨 #FF7134 700 / 비선택 #4B4F58 500 · 체크 배지 20 · 프로필 Dietary(radius 0) 형태 유지', () => {
  const it_ = read('src/components/IngredientTileSections.tsx');
  expect(it_).toContain("label: { fontSize: 10.5, fontWeight: '500', color: '#4B4F58', maxWidth: '100%' }");
  expect(it_).toContain("labelOn: { color: C.primaryText, fontWeight: '700' }"); // #106 P2: 접근성 대비 토큰
  expect(it_).toMatch(/check: \{[^}]*width: 20, height: 20, borderRadius: 10/);
  // 프로필 타일 = radius 0 프롭 경로(보더 0) 유지 — 이미지 확대만 공통 photoCut으로
  expect(read('src/components/AvoidTile.tsx')).toContain("radius === 0 && { borderWidth: 0 }");
  expect(read('src/app/(tabs)/profile.tsx')).toContain('radius={0}');
});

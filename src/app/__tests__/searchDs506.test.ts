/** P-345(KB-506) — 검색 화면 DS 정합 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('① 검색창 = 홈 searchBox 동일(h48 r4 surface2 pad16 보더 0) · 아이콘 20 우측/입력 중 Clear 원 · 커서만 브랜드색', () => {
  const s = read('src/app/search.tsx');
  expect(s).toContain('box: { flex: 1, height: 48, flexDirection: \'row\', alignItems: \'center\', gap: 10, backgroundColor: C.surface2, borderRadius: 4, paddingHorizontal: 16 }');
  expect(s).not.toContain('borderColor: C.primary'); // 구 포커스 보더 소멸
  expect(s).toContain('selectionColor={C.primary}');
  expect(s).toContain('placeholderTextColor="#D1D3D8"');
  expect(s).toContain("clearDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#D9D9D9'");
  expect(s).toMatch(/query\.length > 0 \? \([^]*?search-clear[^]*?\) : \(\s*<IconSearch size=\{20\} color=\{C\.ink3\} \/>/);
});

it('② 결과 0건 = ScreenCenterFill + EmptyBlock(noResultsTitle) · 고아 키 10로케일 제거', () => {
  const s = read('src/app/search.tsx');
  expect(s).toMatch(/<ScreenCenterFill>\s*<EmptyBlock label=\{t\('search\.noResultsTitle'\)\} testID="search-empty" \/>/);
  expect(s).not.toContain('noResultsBody');
  expect(s).not.toContain('backToPopular');
  for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
    const j = read(`src/lib/i18n/${loc}.json`);
    expect(j).not.toContain('noResultsBody');
    expect(j).not.toContain('backToPopular');
  }
});

it('③ 결과 행 = dish-item(pad12 r8 #EAEBEE·썸 58 r4 + RiskBadge 오프셋·상태 12/700) — RiskPill·blurb 소멸 · ④ popThumb r4', () => {
  const s = read('src/app/search.tsx');
  expect(s).toContain("card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAEBEE', borderRadius: 8, padding: 12 }");
  expect(s).toContain('thumb: { width: 58, height: 58, borderRadius: 4 }');
  expect(s).toContain("thumbBadge: { position: 'absolute', top: -4, left: 3 }");
  expect(s).toContain("cardStatus: { fontSize: 12, fontWeight: '700' }");
  expect(s).toContain('riskTextStrong[risk]');
  expect(s).not.toContain('<RiskPill'); // 렌더 소멸(파일 헤더 주석의 언급만 잔존)
  expect(s).not.toContain('food.blurb');
  expect(s).toMatch(/popThumb: \{ width: 108, height: 84, borderRadius: 4/);
  expect(s).toContain('<View style={{ height: 12 }} />'); // 행 간 12
});

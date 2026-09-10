/** P-371(KB-534) — Android 텍스트 세로 정렬(includeFontPadding) + 탭바 FAB top 통일 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('Txt — includeFontPadding:false 기본이 두 렌더 분기 모두에 선두로 적용된다', () => {
  const txt = read('src/components/Txt.tsx');
  expect(txt).toContain('const base = { includeFontPadding: false } as const');
  expect(txt).toContain('style={[base, style]}'); // fast path
  expect(txt).toContain('style={[base, override ? restStyle : flat, ls, override ?? undefined]}');
});

it('Chip — 라벨 lineHeight 20(8+20+8=36 칩 높이 유지)', () => {
  const chip = read('src/components/Chip.tsx');
  expect(chip).toContain("label: { fontSize: 14, fontWeight: '500', lineHeight: 20 }");
  expect(chip).toMatch(/chip: \{ paddingVertical: 8, paddingHorizontal: 14/);
});

it('TabBar — FAB_OVERHANG 16(바 상단 기준) + top 식 = iOS -22 / Android -16', () => {
  const tb = read('src/components/TabBar.tsx');
  expect(tb).toContain('export const FAB_OVERHANG = 16');
  expect(tb).toContain('top: -(FAB_OVERHANG + TABBAR_V_SHIFT)');
});

it('reviews.allReviews — 10로케일 전부 존재·비어있지 않음(en/ko 값 고정)', () => {
  const langs = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'ru', 'vi', 'th', 'id'];
  const val = (l: string) => JSON.parse(read(`src/lib/i18n/${l}.json`)).reviews.allReviews as string;
  langs.forEach((l) => expect(typeof val(l) === 'string' && val(l).length > 0).toBe(true));
  expect(val('en')).toBe('All reviews');
  expect(val('ko')).toBe('전체 리뷰');
});

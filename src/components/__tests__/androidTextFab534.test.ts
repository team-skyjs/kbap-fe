/** P-371(KB-534) — Android 텍스트 세로 정렬(includeFontPadding) + 탭바 FAB top 통일 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('Txt — includeFontPadding:false 기본이 두 렌더 분기 모두에 선두로 적용된다', () => {
  const txt = read('src/components/Txt.tsx');
  expect(txt).toContain('const base = { includeFontPadding: false } as const');
  expect(txt).toContain('style={[base, style]}'); // fast path
  expect(txt).toContain('style={[base, override ? restStyle : flat, ls, override ?? undefined]}');
});

it('Chip — 칩 높이 36 유지(세로 여백 × 2 + 라벨 줄 높이) · KB-708: 줄 높이 24(vi 위아래 성조 부호·g 꼬리가 안 잘리게)', () => {
  const chip = read('src/components/Chip.tsx');
  expect(chip).toContain("label: { fontSize: 14, fontWeight: '500', lineHeight: CHIP_LABEL_LH }");
  const lh = Number(/export const CHIP_LABEL_LH = (\d+);/.exec(chip)![1]);
  const pv = Number(/chip: \{ paddingVertical: (\d+), paddingHorizontal: 14/.exec(chip)![1]);
  expect(pv * 2 + lh).toBe(36); // 칩 높이(시안 고정) 무변
  expect(lh).toBeGreaterThanOrEqual(24); // 옛 20 = vi "Thận trọng" 아래 잘림(KB-708 QA)
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

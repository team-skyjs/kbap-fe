/** P-342(KB-503) 실기 피드백 4건 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('① Helpful = 아이콘+숫자 61×30 고정 — "Helpful (n)" 텍스트 폐기·눌림 = #FF7134 스트로크(색만)·99+ 유지·a11y 기존 키', () => {
  const rc = read('src/features/review/ReviewCellParts.tsx');
  expect(rc).toMatch(/helpfulBtn: \{ minWidth: 61, height: 30, [^}]*paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1/); // 2R: 61 = 보더 포함, 99+ 자연 확장
  expect(rc).toContain('helpfulBtnOn: { borderColor: C.primary }');
  expect(rc).toContain("helpfulCount: { fontSize: 12, fontWeight: '700', color: '#2F3137'");
  expect(rc).toContain("(review.likes ?? 0) > 99 ? '99+' : String(review.likes ?? 0)");
  expect(rc).not.toContain('helpfulGhost'); // 구 고스트 예약 문법 소멸(고정 61이 폭 소유)
  expect(rc).toContain("accessibilityLabel={t('reviews.helpful', { count: review.likes ?? 0 })}");
});

it('② 정렬 시트 NEW = "준비 중" 칩(DS pill·trailing) + 키 10로케일', () => {
  const fx = read('src/features/food/FoodExplorer.tsx');
  expect(fx).toContain("t('food.sortNewSoon')");
  expect(fx).toContain("soonChip: { backgroundColor: '#F2F3F6', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }");
  expect(read('src/components/ActionSheet.tsx')).toContain('{it.trailing}');
  for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
    expect(JSON.parse(read(`src/lib/i18n/${loc}.json`)).food.sortNewSoon.length).toBeGreaterThan(0);
  }
  expect(JSON.parse(read('src/lib/i18n/ko.json')).food.sortNewSoon).toBe('준비 중');
});

it('③ 카카오 심볼 광학 확대(1.6 매트릭스 — N·G 20 박스와 동일) · ④ 국기 배지 링 제거(이모지만)', () => {
  expect(read('src/components/design4Assets.tsx')).toContain('transform="matrix(1.6,0,0,1.6,4,4.8)"');
  const fc = read('src/features/review/FeedCard.tsx');
  expect(fc).not.toMatch(/flagBadge: \{[^}]*backgroundColor: '#FFFFFF'/);
  expect(fc).not.toMatch(/flagBadge: \{[^}]*borderWidth/);
  expect(fc).toMatch(/flagBadge: \{ position: 'absolute', right: -2, bottom: -2, width: 14, height: 14/);
});

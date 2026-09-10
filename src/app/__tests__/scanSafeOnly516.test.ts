/** P-354(KB-516) — 스캔 목록 Safe only 토글 + 가격 정렬 잠금.
 *  (정렬 행동·sortSafety 소멸·안전 어휘 금지는 orderRevamp226 신계약 블록.) */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;
const scan = () => read('src/app/scan.tsx');

it('① Safe only — risk===safe만(불확실 포함 전부 숨김), 토글 배선·라벨', () => {
  const s = scan();
  expect(s).toContain("const safeDishes = listDishes.filter((d) => d.risk === 'safe');");
  expect(s).toContain('const visibleDishes = safeOnly ? safeDishes : listDishes;');
  expect(s).toContain('dishes={visibleDishes}');
  expect(s).toContain('testID="scan-safe-toggle"');
  expect(s).toContain("{t('scan.safeOnly')}");
  expect(s).not.toContain('profileFilter'); // 구 무동작 토글 소멸
});

it('① 새 스캔(다시찍기) = safeOnly OFF·정렬 menu 리셋', () => {
  expect(scan()).toContain("setSafeOnly(false); setSortMode('menu'); setPhase('camera');");
});

it('③ 배너 — ON = resultsSubSafe(safe·total), OFF = 현행 resultsSub', () => {
  const s = scan();
  expect(s).toContain("t('scan.resultsSubSafe', { safe: safeDishes.length, total: allDishes.length })");
  expect(s).toContain("t('scan.resultsSub', { count: allDishes.length })");
});

it('④ 안전 0건 — 목록 자리 EmptyBlock + 토글 OFF ghost(컨트롤·배너 유지), 스캔 0건 분기와 구분', () => {
  const s = scan();
  expect(s).toContain('{safeOnly && visibleDishes.length === 0 ? (');
  expect(s).toContain('testID="scan-safe-empty"');
  expect(s).toContain("<EmptyBlock label={t('scan.safeEmpty')} />");
  expect(s).toContain('testID="scan-show-all"');
  expect(s).toContain('onPress={() => setSafeOnly(false)}');
  expect(s).toContain('testID="scan-results-empty"'); // 스캔 자체 0건은 현행 유지
});

it('⑤ 수량 보존 — 주문 합계는 필터 무관(listDishes 전체 기준), 장바구니 itemId 키 유지', () => {
  const s = scan();
  expect(s).toContain('const items = listDishes'); // visibleDishes 아님 — 숨긴 담김분 포함
  expect(s).toMatch(/const cartCount = /); // 합계 상태는 cart 맵(뷰 필터와 무관)
});

it('신규 키 10로케일 + sortSafety 부재', () => {
  for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
    const j = JSON.parse(read(`src/lib/i18n/${loc}.json`)) as { scan: Record<string, string> };
    for (const k of ['safeOnly', 'sortPriceDesc', 'sortPriceAsc', 'resultsSubSafe', 'safeEmpty', 'showAllDishes']) {
      expect(j.scan[k]).toBeTruthy();
    }
    expect(j.scan.sortSafety).toBeUndefined();
  }
});

/**
 * KB-722(P-452 ①) — 검색창 안내 문구: 재료 검색은 앱·서버 어디에도 없는데 "음식, 재료 검색…"으로 약속했다 → "음식 검색" 뜻(10로케일).
 * placeholderSeed("{{name}} 검색해 보세요")는 그대로.
 */
const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'] as const;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- 로케일 JSON을 이름으로 순회
const load = (l: string) => require(`@/lib/i18n/${l}.json`) as { search: Record<string, string>; food: Record<string, string> };
// 로케일별 '재료' 낱말 — placeholder에 남아 있으면 안 됨
const INGREDIENT: Record<string, string> = { en: 'ingredient', ko: '재료', ja: '食材', 'zh-Hans': '食材', 'zh-Hant': '食材', vi: 'nguyên liệu', id: 'bahan', th: 'ส่วนผสม', ru: 'ингредиент', es: 'ingrediente' };

it('search.placeholder 10로케일 = "음식 검색" 뜻 — 재료 낱말 0 · 비어 있지 않음 · 이모지 0 · en/ko 값', () => {
  for (const l of LOCALES) {
    const v = load(l).search.placeholder;
    expect({ l, has: typeof v === 'string' && v.trim().length > 0 }).toEqual({ l, has: true });
    expect({ l, ingredient: v.toLowerCase().includes(INGREDIENT[l]) }).toEqual({ l, ingredient: false });
    expect({ l, emoji: /\p{Extended_Pictographic}/u.test(v) }).toEqual({ l, emoji: false });
  }
  expect(load('en').search.placeholder).toBe('Search food…');
  expect(load('ko').search.placeholder).toBe('음식 검색…');
});

it('placeholderSeed는 무변 — 10로케일 모두 {{name}} 포함', () => {
  for (const l of LOCALES) expect({ l, seed: load(l).search.placeholderSeed.includes('{{name}}') }).toEqual({ l, seed: true });
});

// QA(#241): 사용자가 실제로 보는 검색창은 홈·음식 탭의 `food.searchPlaceholder`(FoodExplorer) — 검색 화면의 `search.placeholder`는 추천 문구가 없을 때만 쓰는 대체
it('food.searchPlaceholder(홈·음식 탭 검색창) 10로케일 = search.placeholder와 같은 문구 · 재료 낱말 0', () => {
  for (const l of LOCALES) {
    const { food, search } = load(l);
    expect({ l, same: food.searchPlaceholder === search.placeholder }).toEqual({ l, same: true });
    expect({ l, ingredient: food.searchPlaceholder.toLowerCase().includes(INGREDIENT[l]) }).toEqual({ l, ingredient: false });
  }
});

// "재료 검색"을 약속하는 문구가 어디에도 없게 — 재료 낱말 + 검색 낱말이 한 값에 같이 오는 키 전수. 허용 = 회피 재료 편집기(restrictionsEdit.*: 거기선 재료를 진짜 검색한다)
const SEARCH: Record<string, RegExp> = { en: /search|find/i, ko: /검색|찾/, ja: /検索|探/, 'zh-Hans': /搜索|查找/, 'zh-Hant': /搜尋|查找/, vi: /tìm/i, id: /cari/i, th: /ค้นหา/, ru: /найти|поиск|искать/i, es: /buscar|búsqueda/i };
const ALLOW = [/^restrictionsEdit\./, /^onboarding\.demo\./]; // demo.safe(vi) = "회피 재료를 찾지 못했다" — 판정 결과 문장, 검색 아님
it('10로케일 전수: 재료+검색 낱말이 같이 오는 값은 회피 재료 편집기(restrictionsEdit)·온보딩 데모 결과뿐', () => {
  const flat = (o: Record<string, unknown>, pre = ''): [string, string][] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${pre}${k}.`) : [[`${pre}${k}`, String(v)] as [string, string]]));
  for (const l of LOCALES) {
    const hits = flat(load(l) as unknown as Record<string, unknown>)
      .filter(([, v]) => v.toLowerCase().includes(INGREDIENT[l]) && SEARCH[l].test(v))
      .map(([k]) => k)
      .filter((k) => !ALLOW.some((re) => re.test(k)));
    expect({ l, hits }).toEqual({ l, hits: [] });
  }
});

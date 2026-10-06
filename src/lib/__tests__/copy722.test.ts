/**
 * KB-722(P-452 ①) — 검색창 안내 문구: 재료 검색은 앱·서버 어디에도 없는데 "음식, 재료 검색…"으로 약속했다 → "음식 검색" 뜻(10로케일).
 * placeholderSeed("{{name}} 검색해 보세요")는 그대로.
 */
const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'] as const;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- 로케일 JSON을 이름으로 순회
const load = (l: string) => require(`@/lib/i18n/${l}.json`) as { search: Record<string, string> };
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

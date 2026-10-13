/**
 * P-124: 개발용 카피 유출 잠금 — i18n **전체**(스캔 에러 키 한정 아님)에서
 * "Metro"/"metro" 언급 0. 스토어 유저에게 개발 안내가 노출되던 버그 재발 방지.
 */
const LANGS = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];

it.each(LANGS)('%s — 로케일 전체에 Metro 언급 0', (lang) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const json = require(`../${lang}.json`) as Record<string, unknown>;
  const all: string[] = [];
  const walk = (o: unknown) => {
    if (typeof o === 'string') all.push(o);
    else if (o && typeof o === 'object') Object.values(o).forEach(walk);
  };
  walk(json);
  const hits = all.filter((s) => /metro/i.test(s));
  expect(hits).toEqual([]);
});

// KB-766(QA A1-1): 개발용 자리표시자가 스토어 1.0.4 온보딩에 노출 — "(remove; not user copy)". 값 전체에 자리표시자·작업 메모 0.
// TODO·FIXME는 대문자만(스페인어 "todo" = 모두 — 정상 단어).
it.each(LANGS)('%s — 자리표시자·작업 메모 0(not user copy · (remove · TODO · FIXME)', (lang) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const json = require(`../${lang}.json`) as Record<string, unknown>;
  const hits: string[] = [];
  const walk = (o: unknown, path: string) => {
    if (typeof o === 'string') { if (/not user copy|\(remove|TODO|FIXME/.test(o)) hits.push(`${path} = ${o}`); }
    else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => walk(v, path ? `${path}.${k}` : k));
  };
  walk(json, '');
  expect(hits).toEqual([]);
});

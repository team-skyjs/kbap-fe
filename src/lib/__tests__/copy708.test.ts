/**
 * KB-708(P-447) 문구 — (2) 검색 결과 수 복수형 · (3) 국가명(엔도님은 그 언어로 쓰인 것일 때만).
 */
import { createInstance } from 'i18next';
import { COUNTRIES, countryDisplayName } from '@/lib/onboarding/countries';
import { SUPPORTED_LANGS } from '@/lib/i18n/languages';

const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'] as const;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- 로케일 JSON을 이름으로 순회
const load = (l: string) => require(`@/lib/i18n/${l}.json`) as { search: Record<string, string> };

// (2) + #236 /review A: Hermes엔 Intl.PluralRules가 없어 i18next는 `count === 1 ? one : other` 더미 규칙으로 떨어진다(폴리필 0).
// `_other`만 둔 로케일은 1건에서 `_one`을 못 찾아 en으로 폴백("1 result"), ru는 few/many가 영영 안 골라진다. jest(Node Intl)에선 안 보임.
// #236 /review 2R: 호출 0이던 죽은 키 4개(home·restrictionsEdit.avoidCount · scan.badgeUnit · feedback.replyCount)는 삭제
const PLURAL_BASES = ['search.resultCount', 'scan.freeLeft', 'saved.count', 'myFoods.itemCount'];
const get = (l: string, path: string): string | undefined => {
  const [sec, key] = path.split('.');
  return (load(l) as unknown as Record<string, Record<string, string>>)[sec]?.[key];
};

describe('(2) 복수형 — Intl.PluralRules 없는 실기(Hermes)에서도 그 로케일 문구', () => {
  it('구조 잠금: `_one`/`_other` 접미사를 쓰는 키 전수 = 위 8개 · 전 로케일에 `_one`·`_other` 둘 다 · 맨 키(접미사 없음) 0 · ru는 네 형태 같은 문구(수 일치 불필요)', () => {
    const flat = (o: Record<string, unknown>, pre = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${pre}${k}.`) : [`${pre}${k}`]));
    const bases = new Set<string>();
    for (const l of LOCALES) for (const k of flat(load(l) as unknown as Record<string, unknown>)) {
      const m = /^(.*)_(zero|one|two|few|many|other)$/.exec(k);
      if (m) bases.add(m[1]);
    }
    expect([...bases].sort()).toEqual([...PLURAL_BASES].sort()); // 새 복수형 키가 생기면 여기 목록에 넣고 같은 규칙을 지킬 것
    for (const l of LOCALES) for (const base of PLURAL_BASES) {
      expect({ l, base, one: typeof get(l, `${base}_one`), other: typeof get(l, `${base}_other`), bare: get(l, base) }).toEqual({ l, base, one: 'string', other: 'string', bare: undefined });
    }
    for (const base of PLURAL_BASES) {
      const forms = ['one', 'few', 'many', 'other'].map((f) => get('ru', `${base}_${f}`));
      expect({ base, same: new Set(forms).size === 1 }).toEqual({ base, same: true });
    }
    // 수 구분 없는 7로케일 = `_one === _other` — 한쪽만 고치면 실기(더미 규칙)에서 1건일 때만 옛 문구가 나온다
    for (const l of ['ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th']) for (const base of PLURAL_BASES) {
      expect({ l, base, same: get(l, `${base}_one`) === get(l, `${base}_other`) }).toEqual({ l, base, same: true });
    }
    // 죽은 키는 어느 로케일에도 없다
    for (const l of LOCALES) for (const dead of ['home.avoidCount', 'restrictionsEdit.avoidCount', 'scan.badgeUnit', 'feedback.replyCount']) {
      expect({ l, dead, left: Object.keys((load(l) as unknown as Record<string, Record<string, string>>)[dead.split('.')[0]] ?? {}).filter((k) => k.startsWith(dead.split('.')[1])) }).toEqual({ l, dead, left: [] });
    }
  });

  const resolveAll = async () => {
    const i = createInstance();
    await i.init({ lng: 'en', fallbackLng: 'en', resources: Object.fromEntries(LOCALES.map((l) => [l, { translation: load(l) }])), interpolation: { escapeValue: false } });
    const out: Record<string, string> = {};
    for (const l of LOCALES) for (const base of PLURAL_BASES) for (const n of [1, 2, 5, 21]) out[`${l}|${base}|${n}`] = i.getFixedT(l)(base, { count: n });
    return out;
  };
  const expected = (l: string, base: string, n: number) => get(l, `${base}_${n === 1 ? 'one' : 'other'}`)!.replace('{{count}}', String(n));

  it('Intl.PluralRules 없음(실기): 10개 로케일 × 1·2·5·21 → 그 로케일 문구(en 폴백 0)', async () => {
    const saved = Intl.PluralRules;
    // @ts-expect-error — Hermes 재현: PluralRules 부재
    delete Intl.PluralRules;
    try {
      const out = await resolveAll();
      for (const l of LOCALES) for (const base of PLURAL_BASES) for (const n of [1, 2, 5, 21]) {
        const got = out[`${l}|${base}|${n}`];
        // 기대값 = 그 로케일 JSON의 _one/_other → en 폴백이면 여기서 깨진다(id "1 item"처럼 en과 문구가 같은 경우도 정당)
        expect({ l, base, n, got }).toEqual({ l, base, n, got: expected(l, base, n) });
      }
    } finally {
      Intl.PluralRules = saved;
    }
  });

  it('Intl.PluralRules 있음(jest·향후 폴리필): 같은 결과 — ru few/many도 중립 문구라 일치', async () => {
    const out = await resolveAll();
    for (const l of LOCALES) for (const base of PLURAL_BASES) for (const n of [1, 2, 5, 21]) {
      expect({ l, base, n, got: out[`${l}|${base}|${n}`] }).toEqual({ l, base, n, got: expected(l, base, n) });
    }
    expect(out['en|search.resultCount|1']).toBe('1 result');
    expect(out['ko|search.resultCount|1']).toBe('1개 결과');
    expect(out['ru|search.resultCount|5']).toBe('Результатов: 5');
  });
});

describe('(3) 국가명 — 엔도님이 지금 앱 언어로 쓰인 것일 때만, 그 밖 영어', () => {
  it('ko + KR = "한국" · ko + US = "United States" · ja + KR = "South Korea" · ja + JP = "日本" · 엔도님 없는 나라 = 영어', () => {
    expect(countryDisplayName('KR', 'ko')).toBe('한국');
    expect(countryDisplayName('US', 'ko')).toBe('United States');
    expect(countryDisplayName('KR', 'ja')).toBe('South Korea');
    expect(countryDisplayName('JP', 'ja')).toBe('日本');
    expect(countryDisplayName('KR', 'en')).toBe('South Korea');
  });
  it('en은 엔도님 트리거 아님(en 앱 + 엔도님 있는 비지원 언어 나라 = 영어) · KZ 엔도님(카자흐어)은 ru 사용자에게 안 보임 · zh 계열은 각자', () => {
    expect(countryDisplayName('DE', 'en')).toBe('Germany'); // 엔도님 'Deutschland'이 있어도 en은 트리거 아님
    expect(countryDisplayName('KZ', 'ru')).toBe('Kazakhstan');
    expect(countryDisplayName('RU', 'ru')).toBe('Россия');
    expect(countryDisplayName('CN', 'zh-Hans')).toBe('中国');
    expect(countryDisplayName('CN', 'zh-Hant')).toBe('China');
    expect(countryDisplayName('TW', 'zh-Hant')).toBe('台灣');
    expect(countryDisplayName('ZZ', 'ko')).toBe('ZZ'); // 모르는 코드 = 코드 그대로(옛 동작)
  });
});

describe('(4) 이탈 확인 문구 — 네 화면(리뷰 작성·수정·문의·커뮤니티) 공용 중립 키', () => {
  const LEAVE = ['leaveTitle', 'leaveBody', 'keepWriting', 'discard'] as const;
  // 로케일별 '글/게시물' 낱말 — 리뷰·문의 화면에서 어색했던 원인(제목에 남으면 안 됨)
  const POST_WORDS: Record<string, string[]> = {
    en: ['post'], es: ['publicación'], ru: ['пост'], ja: ['投稿'], 'zh-Hans': ['帖子'], 'zh-Hant': ['貼文'],
    vi: ['bài viết'], id: ['postingan'], th: ['โพสต์'], ko: ['게시물', '글을'],
  };
  it('10개 로케일 모두 common에 네 키 · community에 옛 키 0(키 두 벌 금지) · 제목에 post 낱말 없음 · en = "Leave without saving?"', () => {
    for (const l of LOCALES) {
      const j = load(l) as unknown as { common: Record<string, string>; community: Record<string, string> };
      for (const k of LEAVE) {
        expect({ l, k, has: typeof j.common[k] === 'string' && j.common[k].length > 0 }).toEqual({ l, k, has: true });
        expect({ l, k, legacy: k in j.community }).toEqual({ l, k, legacy: false });
      }
      for (const w of POST_WORDS[l]) expect({ l, title: j.common.leaveTitle.toLowerCase().includes(w) }).toEqual({ l, title: false });
    }
    expect((load('en') as unknown as { common: Record<string, string> }).common.leaveTitle).toBe('Leave without saving?');
    expect((load('ko') as unknown as { common: Record<string, string> }).common.leaveTitle).toBe('작성을 그만둘까요?');
    // ru: "Выйти без сохранения?" 아래 "Продолжить"(계속)/"Отменить"(취소)는 "나가기를 계속/취소"로 읽혀 동작과 반대 → 남기/나가기
    const ru = (load('ru') as unknown as { common: Record<string, string> }).common;
    expect([ru.keepWriting, ru.discard]).toEqual(['Остаться', 'Выйти']);
    // ja·zh: "やめる"(그만두다)·"放弃"(포기)는 "돌아가기를 그만둔다"로 읽혀 ru와 같은 결함 → 나가기/파기를 직접 말한다(#236 /review 2R)
    const c = (l: string) => (load(l) as unknown as { common: Record<string, string> }).common.discard;
    expect([c('ja'), c('zh-Hans'), c('zh-Hant')]).toEqual(['破棄する', '离开', '離開']);
  });
  it('LeaveConfirmModal은 common 키만 쓴다(community.* 참조 0)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 소스 잠금
    const src = (require('fs') as typeof import('fs')).readFileSync('src/components/LeaveConfirmModal.tsx', 'utf8');
    for (const k of LEAVE) expect(src).toContain(`t('common.${k}')`);
    expect(src).not.toMatch(/t\('community\./);
  });
});

// #236 /review H: 엔도님 언어를 `c.lang` + 예외 맵으로 유추하는 구조 — LANG_BY_COUNTRY에 나라를 더하면(예: ru 사용 국가) 조용히
// 남의 언어 이름이 보일 수 있다. 구조는 그대로 두고, 보이는 (국가, 앱 언어) 쌍 전체를 잠가 표가 바뀌면 여기서 깨지게.
it('(3) 가드: 엔도님이 보이는 (국가, 앱 언어) 쌍 전체 — 바뀌면 그 이름이 정말 그 언어로 쓰였는지 확인 후 이 목록을 고칠 것', () => {
  const pairs: string[] = [];
  for (const c of COUNTRIES) for (const l of SUPPORTED_LANGS) {
    const n = countryDisplayName(c.code, l);
    if (n !== c.name) pairs.push(`${c.code}|${l}|${n}`);
  }
  expect(pairs.sort()).toEqual([
    'BY|ru|Беларусь',
    'CN|zh-Hans|中国',
    'DO|es|República Dominicana',
    'ES|es|España',
    'GQ|es|Guinea Ecuatorial',
    'HK|zh-Hant|香港',
    'JP|ja|日本',
    'KG|ru|Кыргызстан',
    'KR|ko|한국',
    'MO|zh-Hant|澳門',
    'MX|es|México',
    'PA|es|Panamá',
    'PE|es|Perú',
    'RU|ru|Россия',
    'TH|th|ไทย',
    'TW|zh-Hant|台灣',
    'VN|vi|Việt Nam',
  ]);
});

/**
 * KB-708(P-447) 문구 — (2) 검색 결과 수 복수형 · (3) 국가명(엔도님은 그 언어로 쓰인 것일 때만).
 */
import { createInstance } from 'i18next';
import { countryDisplayName } from '@/lib/onboarding/countries';

const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'] as const;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- 로케일 JSON을 이름으로 순회
const load = (l: string) => require(`@/lib/i18n/${l}.json`) as { search: Record<string, string> };

describe('(2) "1 results" — i18next 복수형', () => {
  it('모든 로케일: 옛 단일 키 없음 · 그 언어의 복수 형태만(en·es one/other · ru one/few/many/other · 나머지 other)', () => {
    for (const l of LOCALES) {
      const s = load(l).search;
      expect(s.resultCount).toBeUndefined();
      const forms = Object.keys(s).filter((k) => k.startsWith('resultCount_')).sort();
      const want = l === 'en' || l === 'es' ? ['resultCount_one', 'resultCount_other'] : l === 'ru' ? ['resultCount_few', 'resultCount_many', 'resultCount_one', 'resultCount_other'] : ['resultCount_other'];
      expect({ l, forms }).toEqual({ l, forms: want });
      for (const f of forms) expect(s[f]).toContain('{{count}}');
    }
  });

  it('실제 해석: en 1 = "1 result" · 2 = "2 results" · ru 1/2/5/21 = 각 형태 · ko 1 = 그대로', async () => {
    const i = createInstance();
    await i.init({ lng: 'en', fallbackLng: 'en', resources: Object.fromEntries(LOCALES.map((l) => [l, { translation: load(l) }])), interpolation: { escapeValue: false } });
    expect(i.t('search.resultCount', { count: 1 })).toBe('1 result');
    expect(i.t('search.resultCount', { count: 2 })).toBe('2 results');
    const ru = i.getFixedT('ru');
    expect([1, 2, 5, 21].map((n) => ru('search.resultCount', { count: n }))).toEqual(['1 результат', '2 результата', '5 результатов', '21 результат']);
    expect(i.getFixedT('ko')('search.resultCount', { count: 1 })).toBe('1개 결과');
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

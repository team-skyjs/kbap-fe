/**
 * countries.ts — full nationality catalog for the picker (KB-8). Every country
 * is selectable; the `Flag` component draws a real flag for a few and a monogram
 * for the rest. `lang` maps a country to the app's reader language it should
 * default to (one of the 9 supported, else 'en') — used to auto-pick the reader
 * language after a nationality is chosen. `native` (endonym) is curated where
 * meaningful. Country identity is domain data; the BE may serve this later.
 */
import type { SupportedLang } from '@/lib/i18n/languages';
import { getLocales } from 'expo-localization';

export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string; // English name
  native?: string; // endonym (shown as a decorative sub)
  lang: SupportedLang; // reader language this nationality defaults to
  suggested?: boolean; // shown in the "Suggested" section
}

/** Country → supported reader language. Anything not listed defaults to 'en'. */
const LANG_BY_COUNTRY: Record<string, SupportedLang> = {
  JP: 'ja',
  TH: 'th',
  VN: 'vi',
  ID: 'id',
  CN: 'zh-Hans',
  SG: 'zh-Hans',
  TW: 'zh-Hant',
  HK: 'zh-Hant',
  MO: 'zh-Hant',
  RU: 'ru',
  BY: 'ru',
  KZ: 'ru',
  KG: 'ru',
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CO: 'es',
  PE: 'es',
  VE: 'es',
  CL: 'es',
  EC: 'es',
  GT: 'es',
  CU: 'es',
  BO: 'es',
  DO: 'es',
  HN: 'es',
  PY: 'es',
  SV: 'es',
  NI: 'es',
  CR: 'es',
  PA: 'es',
  UY: 'es',
  GQ: 'es',
};

/** Endonyms — P-130(온보딩 v3): 전 국가 보강(모국어 국가명 메인 표기).
 *  영어명과 동일한 곳은 동일 값 — 표시 로직이 보조(영어명)를 생략한다. */
const NATIVE: Record<string, string> = {
  AF: 'افغانستان', AL: 'Shqipëria', DZ: 'الجزائر', AD: 'Andorra', AO: 'Angola', AG: 'Antigua and Barbuda',
  AR: 'Argentina', AM: 'Հայաստան', AU: 'Australia', AT: 'Österreich', AZ: 'Azərbaycan', BS: 'Bahamas',
  BH: 'البحرين', BD: 'বাংলাদেশ', BB: 'Barbados', BY: 'Беларусь', BE: 'België', BZ: 'Belize',
  BJ: 'Bénin', BT: 'འབྲུག་ཡུལ', BO: 'Bolivia', BA: 'Bosna i Hercegovina', BW: 'Botswana', BR: 'Brasil',
  BN: 'Brunei', BG: 'България', BF: 'Burkina Faso', BI: 'Burundi', KH: 'កម្ពុជា', CM: 'Cameroun',
  CA: 'Canada', CV: 'Cabo Verde', CF: 'Centrafrique', TD: 'Tchad', CL: 'Chile', CN: '中国',
  CO: 'Colombia', KM: 'Komori', CG: 'Congo', CD: 'RD Congo', CR: 'Costa Rica', HR: 'Hrvatska',
  CU: 'Cuba', CY: 'Κύπρος', CZ: 'Česko', DK: 'Danmark', DJ: 'Djibouti', DM: 'Dominica',
  DO: 'República Dominicana', EC: 'Ecuador', EG: 'مصر', SV: 'El Salvador', GQ: 'Guinea Ecuatorial', ER: 'ኤርትራ',
  EE: 'Eesti', SZ: 'Eswatini', ET: 'ኢትዮጵያ', FJ: 'Fiji', FI: 'Suomi', FR: 'France',
  GA: 'Gabon', GM: 'Gambia', GE: 'საქართველო', DE: 'Deutschland', GH: 'Ghana', GR: 'Ελλάδα',
  GD: 'Grenada', GT: 'Guatemala', GN: 'Guinée', GW: 'Guiné-Bissau', GY: 'Guyana', HT: 'Haïti',
  HN: 'Honduras', HK: '香港', HU: 'Magyarország', IS: 'Ísland', IN: 'भारत', ID: 'Indonesia',
  IR: 'ایران', IQ: 'العراق', IE: 'Éire', IL: 'ישראל', IT: 'Italia', JM: 'Jamaica',
  JP: '日本', JO: 'الأردن', KZ: 'Қазақстан', KE: 'Kenya', KI: 'Kiribati', KW: 'الكويت',
  KG: 'Кыргызстан', LA: 'ລາວ', LV: 'Latvija', LB: 'لبنان', LS: 'Lesotho', LR: 'Liberia',
  LY: 'ليبيا', LI: 'Liechtenstein', LT: 'Lietuva', LU: 'Luxembourg', MO: '澳門', MG: 'Madagasikara',
  MW: 'Malawi', MY: 'Malaysia', MV: 'ދިވެހިރާއްޖެ', ML: 'Mali', MT: 'Malta', MH: 'Marshall Islands',
  MR: 'موريتانيا', MU: 'Mauritius', MX: 'México', FM: 'Micronesia', MD: 'Moldova', MC: 'Monaco',
  MN: 'Монгол', ME: 'Crna Gora', MA: 'المغرب', MZ: 'Moçambique', MM: 'မြန်မာ', NA: 'Namibia',
  NR: 'Nauru', NP: 'नेपाल', NL: 'Nederland', NZ: 'New Zealand', NI: 'Nicaragua', NE: 'Niger',
  NG: 'Nigeria', KP: '조선', MK: 'Северна Македонија', NO: 'Norge', OM: 'عُمان', PK: 'پاکستان',
  PW: 'Palau', PS: 'فلسطين', PA: 'Panamá', PG: 'Papua New Guinea', PY: 'Paraguay', PE: 'Perú',
  PH: 'Pilipinas', PL: 'Polska', PT: 'Portugal', QA: 'قطر', RO: 'România', RU: 'Россия',
  RW: 'Rwanda', KN: 'Saint Kitts and Nevis', LC: 'Saint Lucia', VC: 'Saint Vincent', WS: 'Sāmoa', SM: 'San Marino',
  ST: 'São Tomé e Príncipe', SA: 'السعودية', SN: 'Sénégal', RS: 'Србија', SC: 'Seychelles', SL: 'Sierra Leone',
  SG: 'Singapore', SK: 'Slovensko', SI: 'Slovenija', SB: 'Solomon Islands', SO: 'Soomaaliya', ZA: 'South Africa',
  KR: '한국', SS: 'South Sudan', ES: 'España', LK: 'ශ්‍රී ලංකා', SD: 'السودان', SR: 'Suriname',
  SE: 'Sverige', CH: 'Schweiz', SY: 'سوريا', TW: '台灣', TJ: 'Тоҷикистон', TZ: 'Tanzania',
  TH: 'ไทย', TL: 'Timor-Leste', TG: 'Togo', TO: 'Tonga', TT: 'Trinidad and Tobago', TN: 'تونس',
  TR: 'Türkiye', TM: 'Türkmenistan', TV: 'Tuvalu', UG: 'Uganda', UA: 'Україна', AE: 'الإمارات',
  GB: 'UK', US: 'USA', UY: 'Uruguay', UZ: "O'zbekiston", VU: 'Vanuatu', VE: 'Venezuela',
  VN: 'Việt Nam', YE: 'اليمن', ZM: 'Zambia', ZW: 'Zimbabwe',
};

/** Countries shown first in the "Suggested" section. */
const SUGGESTED = new Set(['JP', 'US', 'TH', 'VN', 'CN', 'TW', 'ID', 'RU', 'ES', 'MX', 'GB', 'KR']);

// [ISO alpha-2, English name] — UN members + common territories.
const RAW: [string, string][] = [
  ['AF', 'Afghanistan'], ['AL', 'Albania'], ['DZ', 'Algeria'], ['AD', 'Andorra'], ['AO', 'Angola'],
  ['AG', 'Antigua and Barbuda'], ['AR', 'Argentina'], ['AM', 'Armenia'], ['AU', 'Australia'], ['AT', 'Austria'],
  ['AZ', 'Azerbaijan'], ['BS', 'Bahamas'], ['BH', 'Bahrain'], ['BD', 'Bangladesh'], ['BB', 'Barbados'],
  ['BY', 'Belarus'], ['BE', 'Belgium'], ['BZ', 'Belize'], ['BJ', 'Benin'], ['BT', 'Bhutan'],
  ['BO', 'Bolivia'], ['BA', 'Bosnia and Herzegovina'], ['BW', 'Botswana'], ['BR', 'Brazil'], ['BN', 'Brunei'],
  ['BG', 'Bulgaria'], ['BF', 'Burkina Faso'], ['BI', 'Burundi'], ['KH', 'Cambodia'], ['CM', 'Cameroon'],
  ['CA', 'Canada'], ['CV', 'Cape Verde'], ['CF', 'Central African Republic'], ['TD', 'Chad'], ['CL', 'Chile'],
  ['CN', 'China'], ['CO', 'Colombia'], ['KM', 'Comoros'], ['CG', 'Congo'], ['CD', 'Congo (DRC)'],
  ['CR', 'Costa Rica'], ['CI', "Côte d'Ivoire"], ['HR', 'Croatia'], ['CU', 'Cuba'], ['CY', 'Cyprus'],
  ['CZ', 'Czechia'], ['DK', 'Denmark'], ['DJ', 'Djibouti'], ['DM', 'Dominica'], ['DO', 'Dominican Republic'],
  ['EC', 'Ecuador'], ['EG', 'Egypt'], ['SV', 'El Salvador'], ['GQ', 'Equatorial Guinea'], ['ER', 'Eritrea'],
  ['EE', 'Estonia'], ['SZ', 'Eswatini'], ['ET', 'Ethiopia'], ['FJ', 'Fiji'], ['FI', 'Finland'],
  ['FR', 'France'], ['GA', 'Gabon'], ['GM', 'Gambia'], ['GE', 'Georgia'], ['DE', 'Germany'],
  ['GH', 'Ghana'], ['GR', 'Greece'], ['GD', 'Grenada'], ['GT', 'Guatemala'], ['GN', 'Guinea'],
  ['GW', 'Guinea-Bissau'], ['GY', 'Guyana'], ['HT', 'Haiti'], ['HN', 'Honduras'], ['HK', 'Hong Kong'],
  ['HU', 'Hungary'], ['IS', 'Iceland'], ['IN', 'India'], ['ID', 'Indonesia'], ['IR', 'Iran'],
  ['IQ', 'Iraq'], ['IE', 'Ireland'], ['IL', 'Israel'], ['IT', 'Italy'], ['JM', 'Jamaica'],
  ['JP', 'Japan'], ['JO', 'Jordan'], ['KZ', 'Kazakhstan'], ['KE', 'Kenya'], ['KI', 'Kiribati'],
  ['KW', 'Kuwait'], ['KG', 'Kyrgyzstan'], ['LA', 'Laos'], ['LV', 'Latvia'], ['LB', 'Lebanon'],
  ['LS', 'Lesotho'], ['LR', 'Liberia'], ['LY', 'Libya'], ['LI', 'Liechtenstein'], ['LT', 'Lithuania'],
  ['LU', 'Luxembourg'], ['MO', 'Macau'], ['MG', 'Madagascar'], ['MW', 'Malawi'], ['MY', 'Malaysia'],
  ['MV', 'Maldives'], ['ML', 'Mali'], ['MT', 'Malta'], ['MH', 'Marshall Islands'], ['MR', 'Mauritania'],
  ['MU', 'Mauritius'], ['MX', 'Mexico'], ['FM', 'Micronesia'], ['MD', 'Moldova'], ['MC', 'Monaco'],
  ['MN', 'Mongolia'], ['ME', 'Montenegro'], ['MA', 'Morocco'], ['MZ', 'Mozambique'], ['MM', 'Myanmar'],
  ['NA', 'Namibia'], ['NR', 'Nauru'], ['NP', 'Nepal'], ['NL', 'Netherlands'], ['NZ', 'New Zealand'],
  ['NI', 'Nicaragua'], ['NE', 'Niger'], ['NG', 'Nigeria'], ['KP', 'North Korea'], ['MK', 'North Macedonia'],
  ['NO', 'Norway'], ['OM', 'Oman'], ['PK', 'Pakistan'], ['PW', 'Palau'], ['PS', 'Palestine'],
  ['PA', 'Panama'], ['PG', 'Papua New Guinea'], ['PY', 'Paraguay'], ['PE', 'Peru'], ['PH', 'Philippines'],
  ['PL', 'Poland'], ['PT', 'Portugal'], ['QA', 'Qatar'], ['RO', 'Romania'], ['RU', 'Russia'],
  ['RW', 'Rwanda'], ['KN', 'Saint Kitts and Nevis'], ['LC', 'Saint Lucia'], ['VC', 'Saint Vincent'], ['WS', 'Samoa'],
  ['SM', 'San Marino'], ['ST', 'São Tomé and Príncipe'], ['SA', 'Saudi Arabia'], ['SN', 'Senegal'], ['RS', 'Serbia'],
  ['SC', 'Seychelles'], ['SL', 'Sierra Leone'], ['SG', 'Singapore'], ['SK', 'Slovakia'], ['SI', 'Slovenia'],
  ['SB', 'Solomon Islands'], ['SO', 'Somalia'], ['ZA', 'South Africa'], ['KR', 'South Korea'], ['SS', 'South Sudan'],
  ['ES', 'Spain'], ['LK', 'Sri Lanka'], ['SD', 'Sudan'], ['SR', 'Suriname'], ['SE', 'Sweden'],
  ['CH', 'Switzerland'], ['SY', 'Syria'], ['TW', 'Taiwan'], ['TJ', 'Tajikistan'], ['TZ', 'Tanzania'],
  ['TH', 'Thailand'], ['TL', 'Timor-Leste'], ['TG', 'Togo'], ['TO', 'Tonga'], ['TT', 'Trinidad and Tobago'],
  ['TN', 'Tunisia'], ['TR', 'Türkiye'], ['TM', 'Turkmenistan'], ['TV', 'Tuvalu'], ['UG', 'Uganda'],
  ['UA', 'Ukraine'], ['AE', 'United Arab Emirates'], ['GB', 'United Kingdom'], ['US', 'United States'], ['UY', 'Uruguay'],
  ['UZ', 'Uzbekistan'], ['VU', 'Vanuatu'], ['VE', 'Venezuela'], ['VN', 'Vietnam'], ['YE', 'Yemen'],
  ['ZM', 'Zambia'], ['ZW', 'Zimbabwe'],
];

/** Full catalog, name-sorted. */
export const COUNTRIES: Country[] = RAW.map(([code, name]) => ({
  code,
  name,
  native: NATIVE[code],
  lang: LANG_BY_COUNTRY[code] ?? 'en',
  suggested: SUGGESTED.has(code),
})).sort((a, b) => a.name.localeCompare(b.name));

const BY_CODE: Record<string, Country> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

export function countryByCode(code: string): Country | undefined {
  return BY_CODE[code];
}

/** Reader language a nationality should default to (supported, else 'en'). */
export function countryLang(code: string): SupportedLang {
  return BY_CODE[code]?.lang ?? 'en';
}

/** Device region → a country code we know, else undefined. */
export function deviceCountry(): string | undefined {
  const region = getLocales()[0]?.regionCode?.toUpperCase();
  return region && BY_CODE[region] ? region : undefined;
}

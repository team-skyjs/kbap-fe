/**
 * exchange (P-136/B-3 → P-242 실환율 전환) — 이중 통화 표시.
 * P-242(KB-349, BE #182): 스캔 v2 응답의 `currency.krwPerUnit`(frankfurter/ECB
 * 실환율)이 정본 — convertKrw에 fx로 전달하면 `price ÷ krwPerUnit`.
 * 아래 고정 테이블(RATE_FROM_KRW)은 **v1(prod 구계약) 폴백 전용** 근사값.
 * 통화 기본값 = 국적 기반, 게스트 = 기기 로케일. 지원 30종(서버 enum) 밖의
 * 저장 통화는 표시·요청 모두 USD 강등(KB-349 정책 — VND·RUB·TWD 제거).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

const STORE_KEY = 'kbap.currency.v1';

/** KRW 1 기준 환산율 — **v1(prod) 폴백 전용** 2026-08 근사 고정값(P-242 이후
 *  v2 경로는 서버 krwPerUnit 사용, 이 테이블 미참조). 30종 전 커버. */
const RATE_FROM_KRW: Record<string, number> = {
  USD: 0.00072, EUR: 0.00066, JPY: 0.113, CNY: 0.0052, HKD: 0.0056,
  THB: 0.026, IDR: 11.8, PHP: 0.042, MYR: 0.0034, SGD: 0.00097,
  GBP: 0.00056, AUD: 0.0011, CAD: 0.00099, MXN: 0.0134, BRL: 0.004,
  INR: 0.062, KRW: 1,
  CHF: 0.00058, CZK: 0.0177, DKK: 0.0049, HUF: 0.264, ILS: 0.0027, ISK: 0.099,
  NOK: 0.0076, NZD: 0.0012, PLN: 0.0028, RON: 0.0033, SEK: 0.0074, TRY: 0.0295,
  ZAR: 0.0127,
};

/** 통화 기호 (표시 접두) — 30종(P-242). 라틴 약칭 통화(CHF 등)는 코드+공백. */
const SYMBOL: Record<string, string> = {
  USD: '$', EUR: '€', JPY: '¥', CNY: '¥', HKD: 'HK$', THB: '฿',
  IDR: 'Rp', PHP: '₱', MYR: 'RM', SGD: 'S$', GBP: '£',
  AUD: 'A$', CAD: 'C$', MXN: 'MX$', BRL: 'R$', INR: '₹', KRW: '₩',
  CHF: 'CHF ', CZK: 'Kč ', DKK: 'kr ', HUF: 'Ft ', ILS: '₪', ISK: 'kr ',
  NOK: 'kr ', NZD: 'NZ$', PLN: 'zł ', RON: 'lei ', SEK: 'kr ', TRY: '₺',
  ZAR: 'R ',
};

/** 국적(ISO alpha-2) → 통화. 미지 국가는 USD.
 *  P-242: VN·RU·TW 매핑 제거(frankfurter 미지원 통화) — USD 폴백(KB-349 정책). */
const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', JP: 'JPY', CN: 'CNY', HK: 'HKD', TH: 'THB',
  ID: 'IDR', PH: 'PHP', MY: 'MYR', SG: 'SGD', GB: 'GBP', AU: 'AUD',
  CA: 'CAD', MX: 'MXN', BR: 'BRL', IN: 'INR', KR: 'KRW',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', PT: 'EUR', IE: 'EUR',
  AT: 'EUR', BE: 'EUR', FI: 'EUR', GR: 'EUR',
  CH: 'CHF', CZ: 'CZK', DK: 'DKK', HU: 'HUF', IL: 'ILS', IS: 'ISK',
  NO: 'NOK', NZ: 'NZD', PL: 'PLN', RO: 'RON', SE: 'SEK', TR: 'TRY', ZA: 'ZAR',
};

export function currencyForCountry(code: string | null | undefined): string {
  if (code && COUNTRY_CURRENCY[code.toUpperCase()]) return COUNTRY_CURRENCY[code.toUpperCase()];
  return 'USD';
}

/** P-165(#145) → P-242: 피커 카탈로그 = **서버 CurrencyCode enum 30종**(KB-349
 *  실측 정합 — frankfurter 지원 통화). VND·RUB·TWD 제거. */
export const SUPPORTED_CURRENCIES: { code: string; symbol: string; name: string }[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel' },
  { code: 'ISK', symbol: 'kr', name: 'Icelandic Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
];

/** 30종 검증용 셋 — 저장/서버 통화가 밖이면 USD 강등(P-242 ③, 조용한 강등). */
const SUPPORTED_SET = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));

/**
 * 유저 통화 결정 — P-165(#145) 서버 정본 체인:
 * **서버 프로필 currency(정본)** > AsyncStorage(캐시 강등 — 오프라인/게스트용)
 * > 국적 > 기기 로케일 region > USD. 서버값 도착 시 캐시 동기화(서버 우선 원칙).
 */
export async function resolveCurrency(
  nationality: string | null | undefined,
  serverCurrency?: string | null,
): Promise<string> {
  // P-242: 30종 밖(구 VND 저장 유저 등) = 무시하고 폴백 체인 — 최종 USD 강등
  if (serverCurrency && SUPPORTED_SET.has(serverCurrency)) {
    saveCurrency(serverCurrency); // 캐시 동기화 — 다음 오프라인 폴백 대비
    return serverCurrency;
  }
  try {
    const saved = await AsyncStorage.getItem(STORE_KEY);
    if (saved && SUPPORTED_SET.has(saved)) return saved;
  } catch {
    /* 저장소 오류 — 폴백 경로로 */
  }
  if (nationality) return currencyForCountry(nationality);
  const region = getLocales()[0]?.regionCode;
  return currencyForCountry(region);
}

export function saveCurrency(code: string): void {
  void AsyncStorage.setItem(STORE_KEY, code).catch(() => {});
}

/** P-165: 통화 해제(null 저장) 시 캐시도 비움 — 낡은 캐시가 국적 폴백을 가리는 것 방지. */
export function clearCurrencyCache(): void {
  void AsyncStorage.removeItem(STORE_KEY).catch(() => {});
}

/** 스캔 v2 응답의 서버 환율(P-242) — null = 조회 실패(배지 생략)·undefined = v1. */
export type ServerFx = { code: string; krwPerUnit: number } | null;

/** KRW → 유저 통화 환산 문자열 (예: "=$6.32"). 미지 통화·KRW = null(환산 배지 생략).
 *  **환산 문자열의 유일한 생산 지점** — 표면(스캔 행·주문 카드 등 5곳)에서 접두를
 *  따로 붙이지 않는다. P-218(예진 확정 8/17): 접두 `≈` → `=`.
 *  P-242(BE #182): fx 인자 = 스캔 v2 서버 실환율(frankfurter/ECB) —
 *  **price ÷ krwPerUnit**(서버 명시 산식·반올림 클라 몫). fx === null은
 *  "환율 조회 실패·스캔 정상" 규약 — 배지 생략(₩만, 에러 아님).
 *  fx 생략(undefined) = v1(prod 구계약) — 근사 고정 테이블 폴백. */
export function convertKrw(krw: number, currency: string, fx?: ServerFx): string | null {
  if (fx === null) return null; // v2 환율 실패 — 배지 생략(에러 아님)
  const code = fx ? fx.code : currency;
  if (code === 'KRW') return null;
  let v: number;
  if (fx) {
    if (!(fx.krwPerUnit > 0)) return null; // 0/음수/NaN 방어 — 나눗셈 오염 금지
    v = krw / fx.krwPerUnit;
  } else {
    const rate = RATE_FROM_KRW[code];
    if (!rate) return null;
    v = krw * rate;
  }
  const digits = v >= 100 ? 0 : 2; // 큰 액면 통화(JPY 등)는 정수 표기
  return `=${SYMBOL[code] ?? code + ' '}${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

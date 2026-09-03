/**
 * exchange (P-136/B-3 → P-242 실환율 전환) — 이중 통화 표시.
 * P-242(KB-349, BE #182): 스캔 v2 응답의 `currency.krwPerUnit`(frankfurter/ECB
 * 실환율)이 정본 — convertKrw에 fx로 전달하면 `price ÷ krwPerUnit`.
 * KB-418: v1(prod 구계약) 폴백 근사 환율 테이블 소멸 — 환산은 서버 실환율만,
 * fx 부재 = 배지 생략(에러 아님).
 * 통화 기본값 = 국적 기반, 게스트 = 기기 로케일. 지원 30종(서버 enum) 밖의
 * 저장 통화는 표시·요청 모두 USD 강등(KB-349 정책 — VND·RUB·TWD 제거).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

const STORE_KEY = 'kbap.currency.v1';

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
 *  P-242: VN·RU·TW 매핑 제거(frankfurter 미지원 통화) — USD 폴백(KB-349 정책).
 *  KB-418: 서버 온보딩 파생(kbap-server CountryCode.kt, Member.kt 온보딩)과
 *  **동일 테이블**로 정합 — 유로존 잔여 13국·AUD 3국·LI(CHF)·PS(ILS) 보강.
 *  나머지 미기재 국가 = 서버도 전부 USD(리터럴 일치 — exchangeCurrency 유닛 전수 대조). */
const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', JP: 'JPY', CN: 'CNY', HK: 'HKD', TH: 'THB',
  ID: 'IDR', PH: 'PHP', MY: 'MYR', SG: 'SGD', GB: 'GBP',
  CA: 'CAD', MX: 'MXN', BR: 'BRL', IN: 'INR', KR: 'KRW',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', PT: 'EUR', IE: 'EUR',
  AT: 'EUR', BE: 'EUR', FI: 'EUR', GR: 'EUR',
  AD: 'EUR', HR: 'EUR', CY: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', LU: 'EUR',
  MT: 'EUR', MC: 'EUR', ME: 'EUR', SM: 'EUR', SK: 'EUR', SI: 'EUR',
  AU: 'AUD', KI: 'AUD', NR: 'AUD', TV: 'AUD',
  CH: 'CHF', LI: 'CHF', IL: 'ILS', PS: 'ILS',
  CZ: 'CZK', DK: 'DKK', HU: 'HUF', IS: 'ISK',
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

/**
 * KB-418(P-201): 프로필 통화 저장값 결정 — "자동" 선택(null) = **국가 파생 코드를
 * 명시 송신**. 서버 PATCH는 null = "유지"(MemberProfile 계약)라 null 송신으로는
 * 해제가 반영되지 않던 무동작 버그의 해소 지점. 반환 undefined = 무변(미전송).
 * 파생 규칙은 서버 온보딩(Member.kt — CountryCode.currency)과 동일 테이블.
 */
export function currencyUpdateFor(
  selected: string | null,
  nationality: string | null | undefined,
  server: string | null | undefined,
): string | undefined {
  // Codex #15 P2: 프로필 미로드(국가 부재) 상태의 "자동"은 파생 불가 — USD 오폭
  // 송신 대신 필드 생략(서버 null=유지라 안전). 명시 선택은 국가 무관 그대로.
  if (selected == null && nationality == null) return undefined;
  const wire = selected ?? currencyForCountry(nationality);
  return wire !== (server ?? null) ? wire : undefined;
}

/** 스캔 v2 응답의 서버 환율(P-242) — null = 조회 실패·undefined = 부재(둘 다 배지 생략). */
export type ServerFx = { code: string; krwPerUnit: number } | null;

/** KRW → 유저 통화 환산 문자열 (예: "=$6.32"). 미지 통화·KRW = null(환산 배지 생략).
 *  **환산 문자열의 유일한 생산 지점** — 표면(스캔 행·주문 카드 등 5곳)에서 접두를
 *  따로 붙이지 않는다. P-218(예진 확정 8/17): 접두 `≈` → `=`.
 *  P-242(BE #182): fx 인자 = 스캔 v2 서버 실환율(frankfurter/ECB) —
 *  **price ÷ krwPerUnit**(서버 명시 산식·반올림 클라 몫). fx === null은
 *  "환율 조회 실패·스캔 정상" 규약 — 배지 생략(₩만, 에러 아님).
 *  KB-418: fx 생략(undefined)도 배지 생략 — v1 근사 테이블 소멸(실환율 없는
 *  환산 표시는 하지 않는다. 유일 무-fx 소비처였던 상세 주문 카드는 priceKrw
 *  자체가 없어 환산 미도달 — 실표시 변화 0). */
export function convertKrw(krw: number, currency: string, fx?: ServerFx): string | null {
  if (fx == null) return null; // 환율 실패(null)·부재(undefined) — 배지 생략(에러 아님)
  const code = fx.code;
  if (code === 'KRW') return null;
  if (!(fx.krwPerUnit > 0)) return null; // 0/음수/NaN 방어 — 나눗셈 오염 금지
  const v = krw / fx.krwPerUnit;
  const digits = v >= 100 ? 0 : 2; // 큰 액면 통화(JPY 등)는 정수 표기
  // P-249: `= ` 공백 1 — "₩7,000 = $5.80" 대칭(예진 실기 확정 8/21)
  return `= ${SYMBOL[code] ?? code + ' '}${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

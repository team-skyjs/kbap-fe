/**
 * exchange (P-136/B-3) — 이중 통화 표시용 **임시 클라 고정 환율 테이블**.
 * ⚠️ 실환율 아님(표시 참고용 근사) — BE 환율 프록시(⑨ 종한 논의) 확정 시 이
 * 파일만 스왑(스파이스 어댑터 관례). 통화 기본값 = 국적 기반(⑪ DB 필드 전
 * 로컬 저장), 게스트 = 기기 로케일.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

const STORE_KEY = 'kbap.currency.v1';

/** KRW 1 기준 환산율 (2026-08 근사 고정값 — 표시용). */
const RATE_FROM_KRW: Record<string, number> = {
  USD: 0.00072, EUR: 0.00066, JPY: 0.113, CNY: 0.0052, TWD: 0.0233, HKD: 0.0056,
  THB: 0.026, VND: 18.9, IDR: 11.8, PHP: 0.042, MYR: 0.0034, SGD: 0.00097,
  RUB: 0.065, GBP: 0.00056, AUD: 0.0011, CAD: 0.00099, MXN: 0.0134, BRL: 0.004,
  INR: 0.062, KRW: 1,
};

/** 통화 기호 (표시 접두). */
const SYMBOL: Record<string, string> = {
  USD: '$', EUR: '€', JPY: '¥', CNY: '¥', TWD: 'NT$', HKD: 'HK$', THB: '฿',
  VND: '₫', IDR: 'Rp', PHP: '₱', MYR: 'RM', SGD: 'S$', RUB: '₽', GBP: '£',
  AUD: 'A$', CAD: 'C$', MXN: 'MX$', BRL: 'R$', INR: '₹', KRW: '₩',
};

/** 국적(ISO alpha-2) → 통화. 미지 국가는 USD. */
const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', JP: 'JPY', CN: 'CNY', TW: 'TWD', HK: 'HKD', TH: 'THB', VN: 'VND',
  ID: 'IDR', PH: 'PHP', MY: 'MYR', SG: 'SGD', RU: 'RUB', GB: 'GBP', AU: 'AUD',
  CA: 'CAD', MX: 'MXN', BR: 'BRL', IN: 'INR', KR: 'KRW',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', PT: 'EUR', IE: 'EUR',
  AT: 'EUR', BE: 'EUR', FI: 'EUR', GR: 'EUR',
};

export function currencyForCountry(code: string | null | undefined): string {
  if (code && COUNTRY_CURRENCY[code.toUpperCase()]) return COUNTRY_CURRENCY[code.toUpperCase()];
  return 'USD';
}

/** P-165(#145): 피커 카탈로그 — 환산 테이블 보유 통화만(선택 = 실제 병기 동작 보장). */
export const SUPPORTED_CURRENCIES: { code: string; symbol: string; name: string }[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
];

/**
 * 유저 통화 결정 — P-165(#145) 서버 정본 체인:
 * **서버 프로필 currency(정본)** > AsyncStorage(캐시 강등 — 오프라인/게스트용)
 * > 국적 > 기기 로케일 region > USD. 서버값 도착 시 캐시 동기화(서버 우선 원칙).
 */
export async function resolveCurrency(
  nationality: string | null | undefined,
  serverCurrency?: string | null,
): Promise<string> {
  if (serverCurrency && RATE_FROM_KRW[serverCurrency]) {
    saveCurrency(serverCurrency); // 캐시 동기화 — 다음 오프라인 폴백 대비
    return serverCurrency;
  }
  try {
    const saved = await AsyncStorage.getItem(STORE_KEY);
    if (saved && RATE_FROM_KRW[saved]) return saved;
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

/** KRW → 유저 통화 환산 문자열 (예: "$6.32"). 미지 통화·KRW = null(환산 배지 생략). */
export function convertKrw(krw: number, currency: string): string | null {
  const rate = RATE_FROM_KRW[currency];
  if (!rate || currency === 'KRW') return null;
  const v = krw * rate;
  const digits = v >= 100 ? 0 : 2; // 큰 액면 통화(JPY·VND 등)는 정수 표기
  return `${SYMBOL[currency] ?? currency + ' '}${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

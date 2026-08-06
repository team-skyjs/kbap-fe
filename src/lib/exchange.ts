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

/** 유저 통화 결정 — 저장값 > 국적 > 기기 로케일 region > USD. */
export async function resolveCurrency(nationality: string | null | undefined): Promise<string> {
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

/** KRW → 유저 통화 환산 문자열 (예: "$6.32"). 미지 통화·KRW = null(환산 배지 생략). */
export function convertKrw(krw: number, currency: string): string | null {
  const rate = RATE_FROM_KRW[currency];
  if (!rate || currency === 'KRW') return null;
  const v = krw * rate;
  const digits = v >= 100 ? 0 : 2; // 큰 액면 통화(JPY·VND 등)는 정수 표기
  return `${SYMBOL[currency] ?? currency + ' '}${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/**
 * P-165(#145) → P-242(KB-349): 통화 결정 체인(서버 정본 > 캐시 > 국적 > 로케일)
 * + 실환율 채택 — v2 krwPerUnit 환산·null 배지 생략·30종 정합·미지원 USD 강등.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'JP' }] }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { convertKrw, currencyForCountry, currencyUpdateFor, resolveCurrency, SUPPORTED_CURRENCIES } from '../exchange';
import { COUNTRIES } from '../onboarding/countries';

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('서버 currency가 1순위 정본 — 캐시·국적보다 우선 + 캐시 동기화', async () => {
  await AsyncStorage.setItem('kbap.currency.v1', 'USD');
  await expect(resolveCurrency('VN', 'THB')).resolves.toBe('THB');
  expect(await AsyncStorage.getItem('kbap.currency.v1')).toBe('THB'); // 캐시 동기화
});

it('서버값이 미지 통화(30종 밖) → 무시하고 폴백 체인', async () => {
  await expect(resolveCurrency('TH', 'XXX')).resolves.toBe('THB'); // 국적 폴백
});

it('P-242 ③: 미지원 통화(VND·RUB·TWD) = 전 체인 USD 강등 — 저장·국적 모두', async () => {
  // 구 VND 저장 유저: 서버·캐시·국적 전부 30종 밖 → USD (조용한 강등)
  await AsyncStorage.setItem('kbap.currency.v1', 'VND');
  await expect(resolveCurrency('VN', 'VND')).resolves.toBe('USD');
  await AsyncStorage.clear();
  await expect(resolveCurrency('RU', null)).resolves.toBe('USD');
  await expect(resolveCurrency('TW', null)).resolves.toBe('USD');
});

it('서버 미설정(null) → 캐시 > 국적 > 로케일 기존 체인 유지', async () => {
  await AsyncStorage.setItem('kbap.currency.v1', 'GBP');
  await expect(resolveCurrency('TH', null)).resolves.toBe('GBP');
  await AsyncStorage.clear();
  await expect(resolveCurrency('TH', null)).resolves.toBe('THB');
  await expect(resolveCurrency(null, null)).resolves.toBe('JPY'); // 로케일 region
});

it('P-242 ③: 피커 카탈로그 = 서버 CurrencyCode enum 30종 스냅샷 대조(실측 정합)', () => {
  // KB-349 실측 enum — frankfurter(ECB) 지원 통화. VND·RUB·TWD 없음.
  const SERVER_ENUM = ['AUD','BRL','CAD','CHF','CNY','CZK','DKK','EUR','GBP','HKD','HUF','IDR','ILS','INR','ISK','JPY','KRW','MXN','MYR','NOK','NZD','PHP','PLN','RON','SEK','SGD','THB','TRY','USD','ZAR'];
  const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
  expect([...codes].sort()).toEqual(SERVER_ENUM);
  for (const gone of ['VND', 'RUB', 'TWD']) expect(codes).not.toContain(gone);
});

describe('P-242 ①②: v2 서버 실환율(krwPerUnit) 채택', () => {
  it('fx 제공 = price ÷ krwPerUnit(서버 명시 산식) — 테이블 미참조', () => {
    // 1390 KRW/USD 실환율: 13900원 → $10.00 (테이블 근사 0.00072였다면 $10.01)
    expect(convertKrw(13900, 'USD', { code: 'USD', krwPerUnit: 1390 })).toBe('= $10.00');
    // 큰 액면(JPY) 정수 표기 유지: 9.2 KRW/JPY, 13900원 → ¥1,511
    expect(convertKrw(13900, 'JPY', { code: 'JPY', krwPerUnit: 9.2 })).toBe('= ¥1,511');
  });

  it('fx.code가 정본(요청 통화와 달라도 서버 응답 기준 심볼)', () => {
    expect(convertKrw(13900, 'THB', { code: 'USD', krwPerUnit: 1390 })).toBe('= $10.00');
  });

  it('fx=null(환율 조회 실패 규약) = 배지 생략 — 에러 아님·₩만 표시', () => {
    expect(convertKrw(13900, 'USD', null)).toBeNull();
  });

  it('krwPerUnit 0/음수/NaN 방어 = 배지 생략(나눗셈 오염 금지)', () => {
    expect(convertKrw(13900, 'USD', { code: 'USD', krwPerUnit: 0 })).toBeNull();
    expect(convertKrw(13900, 'USD', { code: 'USD', krwPerUnit: -1 })).toBeNull();
    expect(convertKrw(13900, 'USD', { code: 'USD', krwPerUnit: NaN })).toBeNull();
  });

  it('KB-418: fx 생략 = 배지 생략(null) — v1 고정 테이블 소멸 + KRW = null', () => {
    expect(convertKrw(8000, 'USD')).toBeNull(); // 구 테이블 폴백 경로 제거
    expect(convertKrw(8000, 'KRW', { code: 'KRW', krwPerUnit: 1 })).toBeNull();
  });

  it('배선 소스 잠금 — 스캔 행·주문 카드 fx 관통 + outcome 관통', () => {
    const fs = require('fs');
    expect(fs.readFileSync('src/features/scan/ScanRichList.tsx', 'utf8')).toContain('convertKrw(dish.priceKrw, currency, fx)');
    expect(fs.readFileSync('src/features/order/FlippedOrderCard.tsx', 'utf8')).toContain('convertKrw(totalKrw, currency, fx)');
    expect(fs.readFileSync('src/lib/data/useScan.ts', 'utf8')).toContain('fx: payload.currency ?? null');
  });
});

describe('KB-418(P-201): 통화 "자동" = 국가 파생 명시 송신 (서버 null=유지라 null 송신은 무동작)', () => {
  // 서버 파생 SSOT: kbap-server CountryCode.kt(enum, Member.kt:147 온보딩 파생) —
  // 2026-09-04 추출 스냅샷. 아래는 non-USD 전량, 나머지 국가 = 전부 USD(서버 리터럴).
  const SERVER_NON_USD: Record<string, string> = {
    JP: 'JPY', CN: 'CNY', HK: 'HKD', TH: 'THB', ID: 'IDR', PH: 'PHP', MY: 'MYR',
    SG: 'SGD', GB: 'GBP', CA: 'CAD', MX: 'MXN', BR: 'BRL', IN: 'INR', KR: 'KRW',
    CH: 'CHF', LI: 'CHF', CZ: 'CZK', DK: 'DKK', HU: 'HUF', IL: 'ILS', PS: 'ILS',
    IS: 'ISK', NO: 'NOK', NZ: 'NZD', PL: 'PLN', RO: 'RON', SE: 'SEK', TR: 'TRY', ZA: 'ZAR',
    AU: 'AUD', KI: 'AUD', NR: 'AUD', TV: 'AUD',
    AD: 'EUR', AT: 'EUR', BE: 'EUR', HR: 'EUR', CY: 'EUR', EE: 'EUR', FI: 'EUR',
    FR: 'EUR', DE: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR', LV: 'EUR', LT: 'EUR',
    LU: 'EUR', MT: 'EUR', MC: 'EUR', ME: 'EUR', NL: 'EUR', PT: 'EUR', SM: 'EUR',
    SK: 'EUR', SI: 'EUR', ES: 'EUR',
  };

  it('앱 국가 카탈로그 전수 — currencyForCountry가 서버 온보딩 파생과 일치', () => {
    for (const { code } of COUNTRIES) {
      expect(`${code}:${currencyForCountry(code)}`).toBe(`${code}:${SERVER_NON_USD[code] ?? 'USD'}`);
    }
  });

  it('자동 선택(null) = 국가 파생 코드 송신 — 명시 해제가 서버에 실반영되는 유일 경로', () => {
    expect(currencyUpdateFor(null, 'DE', 'USD')).toBe('EUR'); // 명시 USD → 자동 = EUR 전송
    expect(currencyUpdateFor(null, 'DE', 'EUR')).toBeUndefined(); // 이미 파생값 = 미전송(유지)
    expect(currencyUpdateFor(null, 'DE', null)).toBe('EUR'); // 구 미설정 유저 = 파생값으로 치유
  });

  it('명시 선택 = 그 코드 송신 · 무변 = 미전송', () => {
    expect(currencyUpdateFor('JPY', 'DE', 'EUR')).toBe('JPY');
    expect(currencyUpdateFor('JPY', 'DE', 'JPY')).toBeUndefined();
  });

  it('Codex #15 P2: 프로필 미로드(국가 부재) + 자동 = 필드 생략 — USD 오폭 송신 금지', () => {
    expect(currencyUpdateFor(null, undefined, undefined)).toBeUndefined(); // me 미로드 저장
    expect(currencyUpdateFor(null, null, 'EUR')).toBeUndefined(); // 파생 불가 = 유지
    expect(currencyUpdateFor('JPY', undefined, null)).toBe('JPY'); // 명시 선택은 국가 무관
  });

  it('배선 소스 잠금 — edit 저장 경로 = currencyUpdateFor 경유·null 송신·캐시 클리어 소멸', () => {
    const fs = require('fs');
    const edit = fs.readFileSync('src/app/profile/edit.tsx', 'utf8') as string;
    expect(edit).toContain('currencyUpdateFor(');
    expect(edit).not.toContain('clearCurrencyCache'); // null 미송신 — 캐시는 항상 실값 동기화
  });
});

describe('P-185 → P-218: 환산가 접두 = "="(예진 확정 8/17)', () => {
  it('환산 문자열 = "=" 접두 · KRW/미지 심볼 폴백(무변)', () => {
    expect(convertKrw(11120, 'USD', { code: 'USD', krwPerUnit: 1390 })).toMatch(/^= \$/); // P-249: `= ` 공백 1 잠금
    expect(convertKrw(8000, 'KRW', { code: 'KRW', krwPerUnit: 1 })).toBeNull();
    expect(convertKrw(8000, 'USD', { code: 'XXX', krwPerUnit: 1000 })).toBe('= XXX 8.00'); // 미지 심볼 = 코드+공백
  });

  it('P-218: 환산 경로에 ≈ 잔존 0 — 생산 지점 1곳 + 소비처 5곳 소스 잠금', () => {
    const fs = require('fs');
    const FILES = [
      'src/lib/exchange.ts',
      'src/features/scan/ScanRichList.tsx',
      'src/features/order/FlippedOrderCard.tsx',
      'src/app/scan.tsx',
      'src/app/scan-order.tsx',
      'src/app/food/[id]/order.tsx',
    ];
    for (const f of FILES) {
      const src = fs.readFileSync(f, 'utf8') as string;
      // 문자폭 근사 휴리스틱 주석(ScanRichList)은 환산과 무관 — 환산 문자열 조립 라인만 검사
      const lines = src.split('\n').filter((l: string) => l.includes('convertKrw') || l.includes('SYMBOL['));
      expect(lines.join('\n')).not.toContain('≈');
    }
    // KB-418: v1 근사 고정 테이블 소멸 — 환산은 서버 실환율(krwPerUnit)만
    expect(fs.readFileSync('src/lib/exchange.ts', 'utf8')).not.toContain('RATE_FROM_KRW');
  });

  it('사장님 확인 화면 = 환산 노출 0(place=ko 원화만) — 소스 잠금', () => {
    const fs = require('fs');
    const owner = fs.readFileSync('src/app/food/[id]/owner.tsx', 'utf8') as string;
    expect(owner).not.toContain('convertKrw');
    // 주문 카드 뒤집힌 ko 면(koCard)도 환산 미노출 — 환산은 리더 면(미러·합계)만
    const card = fs.readFileSync('src/features/order/FlippedOrderCard.tsx', 'utf8') as string;
    expect(card.split('koCard = ')[1].split('return (')[0]).not.toContain('converted');
  });
});

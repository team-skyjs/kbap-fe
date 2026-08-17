/**
 * P-165(#145): 통화 결정 체인 — 서버 프로필 currency(정본) > AsyncStorage(캐시)
 * > 국적 > 기기 로케일. 서버값 도착 시 캐시 동기화(서버 우선 원칙, P-147 계열).
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'JP' }] }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { convertKrw, resolveCurrency, SUPPORTED_CURRENCIES } from '../exchange';

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('서버 currency가 1순위 정본 — 캐시·국적보다 우선 + 캐시 동기화', async () => {
  await AsyncStorage.setItem('kbap.currency.v1', 'USD');
  await expect(resolveCurrency('VN', 'THB')).resolves.toBe('THB');
  expect(await AsyncStorage.getItem('kbap.currency.v1')).toBe('THB'); // 캐시 동기화
});

it('서버값이 미지 통화(환산 테이블 밖) → 무시하고 폴백 체인', async () => {
  await expect(resolveCurrency('VN', 'XXX')).resolves.toBe('VND'); // 국적 폴백
});

it('서버 미설정(null) → 캐시 > 국적 > 로케일 기존 체인 유지', async () => {
  await AsyncStorage.setItem('kbap.currency.v1', 'GBP');
  await expect(resolveCurrency('VN', null)).resolves.toBe('GBP');
  await AsyncStorage.clear();
  await expect(resolveCurrency('VN', null)).resolves.toBe('VND');
  await expect(resolveCurrency(null, null)).resolves.toBe('JPY'); // 로케일 region
});

it('피커 카탈로그 = 환산 테이블 보유 통화만(선택 즉시 병기 동작 보장)', () => {
  expect(SUPPORTED_CURRENCIES.length).toBe(20);
  expect(SUPPORTED_CURRENCIES.map((c) => c.code)).toContain('KRW');
});

describe('P-185 → P-218: 환산가 접두 = "="(예진 확정 8/17)', () => {
  it('환산 문자열 = "=" 접두 · KRW/미지 통화 = null(무변)', () => {
    expect(convertKrw(8000, 'USD')).toMatch(/^=\$/);
    expect(convertKrw(8000, 'KRW')).toBeNull();
    expect(convertKrw(8000, 'XXX')).toBeNull();
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
    // 고정 테이블 사실은 주석에 존치(실환율 연동 시 교체 지점 표식)
    expect(fs.readFileSync('src/lib/exchange.ts', 'utf8')).toContain('고정 테이블');
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

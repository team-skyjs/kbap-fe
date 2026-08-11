/**
 * P-165(#145): 통화 결정 체인 — 서버 프로필 currency(정본) > AsyncStorage(캐시)
 * > 국적 > 기기 로케일. 서버값 도착 시 캐시 동기화(서버 우선 원칙, P-147 계열).
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'JP' }] }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveCurrency, SUPPORTED_CURRENCIES } from '../exchange';

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

/**
 * P-084(KB-261 후속): 맵기 어댑터 스왑 잠금 — 유저 송수신 = enum 문자열(신계약),
 * 수신 정수 폴백(prod 구계약 하위호환), strict 파싱(비레벨 문자열→SKIP),
 * 음식 정수 유지, 로컬 보관 마이그레이션.
 */
import { parseStoredSpice, spiceChoiceToWire, wireToFoodSpice, wireToSpiceChoice, wireToSpiceLevel } from '../spiceAdapter';
import { SPICE_LEVELS } from '@/lib/spice';

it('송신 = enum 문자열 통과 (P-084 스왑 — 구 앵커 정수 폐기)', () => {
  expect(SPICE_LEVELS.map(spiceChoiceToWire)).toEqual(['NONE', 'MILD', 'MEDIUM', 'HOT', 'EXTREME']);
  expect(spiceChoiceToWire('SKIP')).toBe('SKIP');
});

it('문자열 왕복 6종 — 각 값은 송신→수신 후 자기 자신', () => {
  for (const c of [...SPICE_LEVELS, 'SKIP'] as const) {
    expect(wireToSpiceChoice(spiceChoiceToWire(c))).toBe(c);
  }
});

it('수신 strict — 비레벨 문자열(소문자·오타 포함)은 전부 SKIP', () => {
  expect(wireToSpiceChoice('SKIP')).toBe('SKIP');
  expect(wireToSpiceChoice('hot')).toBe('SKIP');
  expect(wireToSpiceChoice('SPICY')).toBe('SKIP');
  expect(wireToSpiceChoice('')).toBe('SKIP');
});

it('수신 정수 폴백(prod 구계약) — 구간 스냅 경계값 유지', () => {
  expect(wireToSpiceChoice(0)).toBe('NONE');
  expect(wireToSpiceChoice(3)).toBe('MILD');
  expect(wireToSpiceChoice(4)).toBe('MEDIUM');
  expect(wireToSpiceChoice(6)).toBe('MEDIUM');
  expect(wireToSpiceChoice(7)).toBe('HOT');
  expect(wireToSpiceChoice(8)).toBe('HOT');
  expect(wireToSpiceChoice(9)).toBe('EXTREME');
  expect(wireToSpiceChoice(10)).toBe('EXTREME');
  // -1·비정수·범위 밖·비숫자 = SKIP
  expect(wireToSpiceChoice(-1)).toBe('SKIP');
  expect(wireToSpiceChoice(3.5)).toBe('SKIP');
  expect(wireToSpiceChoice(11)).toBe('SKIP');
  expect(wireToSpiceChoice(null)).toBe('SKIP');
  expect(wireToSpiceChoice(undefined)).toBe('SKIP');
});

it('음식 수신 — 정수 계약 유지(BE 미전환): 숫자면 구간 스냅, 아니면 null', () => {
  expect(wireToFoodSpice(0)).toBe('NONE');
  expect(wireToFoodSpice(6)).toBe('MEDIUM');
  expect(wireToFoodSpice(10)).toBe('EXTREME');
  expect(wireToFoodSpice(null)).toBe(null);
  expect(wireToFoodSpice('MEDIUM')).toBe(null); // 음식 enum 전환은 BE 후속 — 그때 어댑터 갱신
});

it('구간 스냅 함수 — 경계값 전수(0/1/3/4/6/7/8/9/10)', () => {
  expect([0, 1, 3, 4, 6, 7, 8, 9, 10].map(wireToSpiceLevel)).toEqual([
    'NONE',
    'MILD',
    'MILD',
    'MEDIUM',
    'MEDIUM',
    'HOT',
    'HOT',
    'EXTREME',
    'EXTREME',
  ]);
});

it('로컬 보관 파서 — enum 문자열 통과 + 구 숫자 문자열 마이그레이션 + 쓰레기 null', () => {
  expect(parseStoredSpice('HOT')).toBe('HOT');
  expect(parseStoredSpice('SKIP')).toBe('SKIP');
  expect(parseStoredSpice('6')).toBe('MEDIUM'); // 구버전 저장분(0~10 문자열)
  expect(parseStoredSpice('-1')).toBe('SKIP');
  expect(parseStoredSpice('garbage')).toBe(null);
  expect(parseStoredSpice(null)).toBe(null);
});

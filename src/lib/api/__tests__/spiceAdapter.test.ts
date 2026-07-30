/**
 * P-081(KB-261 후속): 맵기 와이어 어댑터 잠금 — 앵커 왕복·수신 경계값 전수·
 * SKIP 경로·로컬 보관 마이그레이션. 스웨거가 enum 문자열로 재배포되면 이
 * 어댑터만 스왑된다 — 그때 이 테스트도 문자열 통과로 함께 교체.
 */
import { parseStoredSpice, spiceChoiceToWire, wireToFoodSpice, wireToSpiceChoice, wireToSpiceLevel } from '../spiceAdapter';
import { SPICE_LEVELS } from '@/lib/spice';

it('송신 앵커 — NONE→0 / MILD→2 / MEDIUM→5 / HOT→7 / EXTREME→10 · SKIP→-1', () => {
  expect(SPICE_LEVELS.map(spiceChoiceToWire)).toEqual([0, 2, 5, 7, 10]);
  expect(spiceChoiceToWire('SKIP')).toBe(-1);
});

it('왕복 — 각 단계는 송신→수신 후 자기 자신으로 돌아온다', () => {
  for (const l of SPICE_LEVELS) expect(wireToSpiceChoice(spiceChoiceToWire(l))).toBe(l);
  expect(wireToSpiceChoice(spiceChoiceToWire('SKIP'))).toBe('SKIP');
});

it('수신 경계값 전수 — 0/1/3/4/6/7/8/9/10 구간 스냅 (중간값 근사)', () => {
  expect(wireToSpiceLevel(0)).toBe('NONE');
  expect(wireToSpiceLevel(1)).toBe('MILD');
  expect(wireToSpiceLevel(3)).toBe('MILD');
  expect(wireToSpiceLevel(4)).toBe('MEDIUM');
  expect(wireToSpiceLevel(6)).toBe('MEDIUM');
  expect(wireToSpiceLevel(7)).toBe('HOT');
  expect(wireToSpiceLevel(8)).toBe('HOT');
  expect(wireToSpiceLevel(9)).toBe('EXTREME');
  expect(wireToSpiceLevel(10)).toBe('EXTREME');
});

it('유저 수신 SKIP 경로 — -1·비정수·범위 밖·비숫자 전부 SKIP', () => {
  expect(wireToSpiceChoice(-1)).toBe('SKIP');
  expect(wireToSpiceChoice(3.5)).toBe('SKIP');
  expect(wireToSpiceChoice(11)).toBe('SKIP');
  expect(wireToSpiceChoice(null)).toBe('SKIP');
  expect(wireToSpiceChoice(undefined)).toBe('SKIP');
});

it('음식 수신 — 숫자면 단계, 아니면 null(데이터 없음 — SKIP 아님)', () => {
  expect(wireToFoodSpice(6)).toBe('MEDIUM');
  expect(wireToFoodSpice(null)).toBe(null);
  expect(wireToFoodSpice(undefined)).toBe(null);
});

it('로컬 보관 파서 — enum 문자열 통과 + 구 숫자 문자열 마이그레이션 + 쓰레기 null', () => {
  expect(parseStoredSpice('HOT')).toBe('HOT');
  expect(parseStoredSpice('SKIP')).toBe('SKIP');
  expect(parseStoredSpice('6')).toBe('MEDIUM'); // 구버전 저장분(0~10 문자열)
  expect(parseStoredSpice('-1')).toBe('SKIP');
  expect(parseStoredSpice('garbage')).toBe(null);
  expect(parseStoredSpice(null)).toBe(null);
});

/**
 * KB-389 2차(9/4 심사관 경로 실측): prod 신규 가입 400(MEMBER-009) — 서버는 전
 * 채널 enum 문자열(신계약)인데 P-114 송신 채널 분기가 prod에서 구정수를 보냄.
 * 회수 조건("prod BE enum 전환 후 분기 제거", 서버 PR #114 7/30)이 충족되어
 * **분기 제거** — 이 스위트는 P-114 잠금을 뒤집어 "prod 채널이어도 enum 문자열"
 * 로 재잠금한다. (수신 폴백 — 구정수·구 숫자 문자열 — 은 하위호환으로 유지.)
 */
jest.mock('@/lib/flags', () => ({ isProdChannel: () => true })); // prod여도 분기 없음을 실측

import { parseStoredSpice, spiceChoiceToWire, wireToSpiceChoice } from '../spiceAdapter';
import { SPICE_LEVELS } from '@/lib/spice';

it('전 채널 송신 = enum 문자열 (prod 목에서도 — KB-389 2차 잠금)', () => {
  expect(SPICE_LEVELS.map(spiceChoiceToWire)).toEqual(['NONE', 'MILD', 'MEDIUM', 'HOT', 'EXTREME']);
  expect(spiceChoiceToWire('SKIP')).toBe('SKIP');
});

it('enum 왕복 — 송신 문자열을 수신 파서가 자기 자신 복원 (SKIP 포함)', () => {
  for (const c of [...SPICE_LEVELS, 'SKIP'] as const) {
    expect(wireToSpiceChoice(spiceChoiceToWire(c))).toBe(c);
  }
});

it('수신 폴백 회귀 — 구정수·구 숫자 문자열 보관값은 계속 스냅된다', () => {
  expect(wireToSpiceChoice(5)).toBe('MEDIUM'); // 구계약(prod 구서버) 응답 폴백
  expect(wireToSpiceChoice(0)).toBe('NONE');
  expect(wireToSpiceChoice(-1)).toBe('SKIP');
  expect(parseStoredSpice('5')).toBe('MEDIUM'); // 구버전 로컬 보관 마이그레이션
  expect(parseStoredSpice('HOT')).toBe('HOT');
});

it('소스 잠금 — spiceChoiceToWire에 채널 분기 부재(isProdChannel·구정수 맵 소멸)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const src = require('fs').readFileSync('src/lib/api/spiceAdapter.ts', 'utf8') as string;
  expect(src).not.toContain('isProdChannel'); // 채널 판별 import 자체가 없어야 한다
  expect(src).not.toContain('CHOICE_TO_WIRE_INT'); // P-081 앵커 정수 맵 소멸
});

/**
 * P-114(KB-280, Q-27 vc6 회원가입 400): 맵기 **송신** 채널 겸용 잠금 —
 * production 채널 = 구정수 앵커(prod 스웨거 integer, enum 보내면 본문 400) /
 * 비프로덕션(dev·teamtest·Metro) = enum 문자열(dev strict 통과).
 * (비프로덕션 경로는 spiceAdapter.test가 기본으로 잠근다 — 여기는 prod 분기.)
 */
jest.mock('@/lib/flags', () => ({ isProdChannel: () => true }));

import { spiceChoiceToWire, wireToSpiceChoice } from '../spiceAdapter';
import { SPICE_LEVELS } from '@/lib/spice';

it('production 채널 송신 = P-081 원규약 정수 5종 + SKIP -1', () => {
  expect(SPICE_LEVELS.map(spiceChoiceToWire)).toEqual([0, 2, 5, 7, 10]);
  expect(spiceChoiceToWire('SKIP')).toBe(-1);
});

it('prod 정수 왕복 — 구계약 근사 스냅 수신으로 자기 자신 복원 (SKIP=-1 포함)', () => {
  for (const c of [...SPICE_LEVELS, 'SKIP'] as const) {
    expect(wireToSpiceChoice(spiceChoiceToWire(c))).toBe(c);
  }
});

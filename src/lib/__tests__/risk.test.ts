/**
 * personalRisk — 헌법 v2.1.0(2026-07-23) 잠금: 미설정 사용자도 BE 판정 그대로.
 * (종전 safe→caution 강등은 폐지 — 안전장치는 스캔 배너+안전 고지 페이지.)
 */
import { personalRisk } from '../risk';

it('v2.1.0: 미설정(hasRestrictions=false)도 BE 판정 그대로 — safe 유지', () => {
  expect(personalRisk('safe', false)).toBe('safe');
  expect(personalRisk('caution', false)).toBe('caution');
  expect(personalRisk('danger', false)).toBe('danger');
  expect(personalRisk('unable', false)).toBe('unable');
});

it('설정 사용자: 개인화 판정 그대로 (무변)', () => {
  expect(personalRisk('safe', true)).toBe('safe');
  expect(personalRisk('danger', true)).toBe('danger');
});

/**
 * P-003(KB-150): 맵기 -1 센티널 경계를 잠근다.
 * BE 확정(7/16): 미설정 = -1 (required int). -1이 "맵기 -1"이라는 값으로
 * 새면 칩에 "-1/10"이 노출되는 오작동 — 0(맵지 않음, 유효값)과의 경계가 핵심.
 */
import { adaptSpice } from '../memberAdapter';

describe('adaptSpice — -1 센티널 / 0 유효값 경계', () => {
  it('-1(미설정 센티널) → null — 로컬 fallback도 타지 않는다 (서버가 진실)', () => {
    expect(adaptSpice(-1, 7)).toBe(null);
  });

  it('0은 유효값("맵지 않음") — 미설정으로 오인 금지', () => {
    expect(adaptSpice(0, 7)).toBe(0);
  });

  it('경계 유효값 10 유지, 범위 밖(11)·비정수(3.5)는 미설정 취급', () => {
    expect(adaptSpice(10, null)).toBe(10);
    expect(adaptSpice(11, 7)).toBe(null);
    expect(adaptSpice(3.5, 7)).toBe(null);
  });

  it('필드 누락/비숫자(구서버)만 로컬 fallback', () => {
    expect(adaptSpice(undefined, 7)).toBe(7);
    expect(adaptSpice(null, 7)).toBe(7);
    expect(adaptSpice(undefined, null)).toBe(null);
  });
});

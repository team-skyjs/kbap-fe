/**
 * P-003(KB-150): 맵기 -1 센티널 경계를 잠근다.
 * BE 확정(7/16): 미설정 = -1 (required int). -1이 "맵기 -1"이라는 값으로
 * 새면 칩에 "-1/10"이 노출되는 오작동 — 0(맵지 않음, 유효값)과의 경계가 핵심.
 * P-004(KB-149): profileImageUrl 왕복 매핑도 잠근다.
 */
import { adaptProfile, adaptSpice, type MyProfileWire } from '../memberAdapter';

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

describe('adaptProfile.profileImageUrl (P-004 KB-149)', () => {
  const wire: MyProfileWire = {
    memberId: 1,
    nickname: 'Yejin',
    avoidanceSubstanceCodes: [],
    countryCode: 'KR',
    appLanguage: 'en',
    spicinessPreference: -1,
    onboardingCompleted: true,
    ranking: { tier: 'bronze', level: 1, score: 0 },
  };

  it('서버 URL 그대로, 누락/빈 문자열은 null(플레이스홀더)', () => {
    expect(adaptProfile({ ...wire, profileImageUrl: 'https://cdn/p.jpg' }, null).profileImageUrl).toBe('https://cdn/p.jpg');
    expect(adaptProfile(wire, null).profileImageUrl).toBe(null);
    expect(adaptProfile({ ...wire, profileImageUrl: '' }, null).profileImageUrl).toBe(null);
  });

  it('비-http 값(path로 오는 등)은 렌더 불가 → null 방어 (P-006 — FE는 CDN 도메인을 모름)', () => {
    expect(adaptProfile({ ...wire, profileImageUrl: 'profile/1/a.jpg' }, null).profileImageUrl).toBe(null);
  });

  it('함께: -1 센티널도 미설정으로 (통합 경로 확인)', () => {
    expect(adaptProfile(wire, null).spiceTolerance).toBe(null);
  });
});

/**
 * P-003(KB-150): 맵기 -1 센티널 경계를 잠근다.
 * BE 확정(7/16): 미설정 = -1 (required int). -1이 "맵기 -1"이라는 값으로
 * 새면 칩에 "-1/10"이 노출되는 오작동 — 0(맵지 않음, 유효값)과의 경계가 핵심.
 * P-004(KB-149): profileImageUrl 왕복 매핑도 잠근다.
 */
import { adaptProfile, adaptSpice, isDefaultProfileImage, providerLabelKey, type MyProfileWire } from '../memberAdapter';

describe('providerLabelKey (P-029/KB-203 — 연동 계정 라벨)', () => {
  it('APPLE→애플 / GOOGLE→구글 / 미지원·누락→중립 폴백(빈 값 금지)', () => {
    expect(providerLabelKey('APPLE')).toBe('editProfile.linkedApple');
    expect(providerLabelKey('GOOGLE')).toBe('editProfile.linkedGoogle');
    expect(providerLabelKey('KAKAO')).toBe('editProfile.linkedSocial');
    expect(providerLabelKey(undefined)).toBe('editProfile.linkedSocial');
  });
});

describe('isDefaultProfileImage (P-016 — 기본 사진 = 사진 없음 취급)', () => {
  it('기본 path 포함 URL → true, 커스텀·부재 → false', () => {
    expect(isDefaultProfileImage('https://cdn/images/default/profile/profile-default-512.png')).toBe(true);
    expect(isDefaultProfileImage('images/default/profile/profile-default-512.png')).toBe(true);
    expect(isDefaultProfileImage('https://cdn/profile/1/a.jpg')).toBe(false);
    expect(isDefaultProfileImage(null)).toBe(false);
    expect(isDefaultProfileImage(undefined)).toBe(false);
  });

  it('P-140: 색상 아바타 6종(webp/default_profile) 경로도 기본 취급 — CDN URL·path 모두', () => {
    // KB-418: autoProfile 삭제(서버 지정 전환) — 기존 유저 응답에 잔존하는 6종
    // 경로는 수신 판정 대상으로 여전히 유효, 리터럴로 잠근다.
    const DEFAULT_AVATAR_PATHS = ['orange', 'teal', 'amber', 'olive', 'plum', 'navy'].map(
      (c) => `images/webp/default_profile/avatar-${c}.png`,
    );
    for (const p of DEFAULT_AVATAR_PATHS) {
      expect(isDefaultProfileImage(p)).toBe(true);
      expect(isDefaultProfileImage(`https://d29c1cr2ng7w0.cloudfront.net/${p}`)).toBe(true);
    }
  });
});

describe('adaptSpice — P-084 문자열 신계약 수신 (strict) + 정수 구계약 폴백', () => {
  it('enum 문자열 그대로, 비레벨 문자열은 SKIP — 로컬 fallback 미개입', () => {
    expect(adaptSpice('HOT', null)).toBe('HOT');
    expect(adaptSpice('SKIP', 'MEDIUM')).toBe('SKIP'); // 서버 SKIP이 진실 — fallback 무시
    expect(adaptSpice('hot', 'MEDIUM')).toBe('SKIP'); // strict: 소문자·오타는 SKIP
  });
});

describe('adaptSpice — 정수 폴백(구계약 prod): -1 센티널/경계는 SKIP, 유효 정수는 단계 스냅', () => {
  it('-1(미설정 센티널) → SKIP — 로컬 fallback도 타지 않는다 (서버가 진실)', () => {
    expect(adaptSpice(-1, 'HOT')).toBe('SKIP');
  });

  it('0은 유효값(NONE, "맵지 않음") — 미설정(SKIP)으로 오인 금지', () => {
    expect(adaptSpice(0, 'HOT')).toBe('NONE');
  });

  it('경계 유효값 10=EXTREME, 범위 밖(11)·비정수(3.5)는 SKIP 취급', () => {
    expect(adaptSpice(10, null)).toBe('EXTREME');
    expect(adaptSpice(11, 'HOT')).toBe('SKIP');
    expect(adaptSpice(3.5, 'HOT')).toBe('SKIP');
  });

  it('필드 누락/비숫자(구서버)만 로컬 fallback — fallback 없으면 SKIP', () => {
    expect(adaptSpice(undefined, 'HOT')).toBe('HOT');
    expect(adaptSpice(null, 'HOT')).toBe('HOT');
    expect(adaptSpice(undefined, null)).toBe('SKIP');
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

  it('함께: -1 센티널도 미설정(SKIP)으로 (통합 경로 확인)', () => {
    expect(adaptProfile(wire, null).spiceTolerance).toBe('SKIP');
  });

  it('P-243: dietCategories — 서버 배열 그대로 · 부재(구응답) = 빈 배열(섹션 숨김 안전)', () => {
    expect(adaptProfile({ ...wire, dietCategories: ['VEGAN', 'MUSLIM'] }, null).dietCategories).toEqual(['VEGAN', 'MUSLIM']);
    expect(adaptProfile(wire, null).dietCategories).toEqual([]);
  });

  it('provider 매핑 (P-029) — wire 그대로, 누락은 undefined', () => {
    expect(adaptProfile({ ...wire, provider: 'APPLE' }, null).provider).toBe('APPLE');
    expect(adaptProfile(wire, null).provider).toBeUndefined();
  });
});

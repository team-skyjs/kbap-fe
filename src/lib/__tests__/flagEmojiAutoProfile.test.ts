/**
 * P-130: flagEmoji 변환(정상/방어) · 자동 닉네임 형식/풀 잠금.
 */
import { flagEmoji } from '../flagEmoji';
import { generateNickname, NICKNAME_POOL } from '../onboarding/autoProfile';

it('flagEmoji — alpha-2 → regional indicator (대소문자 무관)', () => {
  expect(flagEmoji('KR')).toBe('🇰🇷');
  expect(flagEmoji('jp')).toBe('🇯🇵');
  expect(flagEmoji('US')).toBe('🇺🇸');
});

it('flagEmoji — 비2글자·비알파벳·null 방어 = 빈 문자열', () => {
  expect(flagEmoji('KOR')).toBe('');
  expect(flagEmoji('K1')).toBe('');
  expect(flagEmoji('')).toBe('');
  expect(flagEmoji(null)).toBe('');
  expect(flagEmoji(undefined)).toBe('');
});

it('자동 닉네임 — ^[A-Za-z]+_\\d{4}$ 형식 + 풀 소속 (100회 샘플)', () => {
  for (let i = 0; i < 100; i++) {
    const n = generateNickname();
    expect(n).toMatch(/^[A-Za-z]+_\d{4}$/);
    expect((NICKNAME_POOL as readonly string[])).toContain(n.split('_')[0]);
  }
});

it('P-140: 랜덤 아바타 — 6종 풀 소속 path (100회 샘플)', () => {
  const { DEFAULT_AVATAR_PATHS, pickDefaultAvatarPath } = require('@/lib/onboarding/autoProfile') as typeof import('@/lib/onboarding/autoProfile');
  expect(DEFAULT_AVATAR_PATHS).toHaveLength(6);
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const p = pickDefaultAvatarPath();
    expect(DEFAULT_AVATAR_PATHS).toContain(p);
    expect(p).toMatch(/^images\/webp\/default_profile\/avatar-(orange|teal|amber|olive|plum|navy)\.png$/);
    seen.add(p);
  }
  expect(seen.size).toBeGreaterThan(1); // 랜덤 분포 — 단일 고정 아님
});

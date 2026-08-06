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

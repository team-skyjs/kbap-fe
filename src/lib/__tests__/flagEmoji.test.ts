/**
 * P-130: flagEmoji 변환(정상/방어).
 * (자동 닉네임/아바타 잠금은 KB-418에서 소멸 — autoProfile 삭제, 서버 지정 전환.)
 */
import { flagEmoji } from '../flagEmoji';

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

/**
 * P-010(KB-177): 온보딩 재개 모달 노출 판정 — "로그인 + 미완 회원"으로 제한.
 * 게스트는 draft/서버 플래그가 어떻든 미노출 (탈퇴 잔재 + 미래의 다른 잔재
 * 방어벽). 회원 흐름(KB-75 서버 플래그 원천)은 무변을 잠근다.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));

import { shouldShowResume } from '../ResumeOnboardingBanner';

describe('shouldShowResume', () => {
  it('게스트 → draft가 있어도 미노출 (P-010 방어 분기)', () => {
    expect(shouldShowResume(true, undefined, true)).toBe(false);
    expect(shouldShowResume(true, false, true)).toBe(false); // 어떤 잔재가 와도
    expect(shouldShowResume(true, undefined, false)).toBe(false);
  });

  it('회원 무변(KB-75): 서버 플래그 원천 — 완료 미노출 / 미완은 draft 없어도 노출', () => {
    expect(shouldShowResume(false, true, true)).toBe(false);
    expect(shouldShowResume(false, false, false)).toBe(true);
  });

  it('회원 무변: 플래그 없음(mock) → 로컬 draft 기준', () => {
    expect(shouldShowResume(false, undefined, true)).toBe(true);
    expect(shouldShowResume(false, undefined, false)).toBe(false);
  });
});

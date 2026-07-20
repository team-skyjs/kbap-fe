/**
 * P-010(KB-177): 탈퇴 시 회원 귀속 로컬 상태 일괄 정리를 잠근다 —
 * 온보딩 draft + 맵기 로컬. 기기 귀속 키(introSeen 등)는 건드리지 않는다.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* eslint-disable @typescript-eslint/no-require-imports */
const asMod = require('@react-native-async-storage/async-storage');
const AsyncStorage = asMod.default ?? asMod;
/* eslint-enable @typescript-eslint/no-require-imports */

import { clearMemberLocalState } from '../clearMemberLocal';

it('draft + 맵기 로컬 키를 지운다 (그 외 키는 미접촉)', async () => {
  await clearMemberLocalState();
  const removed = (AsyncStorage.removeItem as jest.Mock).mock.calls.map((c: string[]) => c[0]);
  expect(removed).toContain('kbap.onboardingDraft.v1');
  expect(removed).toContain('kbap.profile.spice.v1');
  expect(removed).toHaveLength(2); // 기기 귀속 키(introSeen·lang·installed·recentSearches) 미접촉
});

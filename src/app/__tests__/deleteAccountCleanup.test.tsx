/**
 * P-010(KB-177): 탈퇴 완주 시 회원 로컬 잔재 정리가 실제로 배선됐는지 잠근다 —
 * (구글 회원 경로) 동의 → 탈퇴 확정 → withdrawBe + clearMemberLocalState 호출.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// 컴포넌트 인덱스가 reanimated(StickyHeader 등)를 끌고 옴 — 표면 mock (tabStates.test 참조)
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockWithdrawBe = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/auth/beAuth', () => ({ withdrawBe: (...a: unknown[]) => mockWithdrawBe(...a) }));
const mockClearMember = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/auth/clearMemberLocal', () => ({ clearMemberLocalState: (...a: unknown[]) => mockClearMember(...a) }));
jest.mock('@/lib/auth/session', () => ({ logOut: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/auth/appleRevoke', () => ({
  currentIsAppleUser: () => false, // 구글 회원 경로 — 게이트 없이 바로 탈퇴
  reauthAndRevokeApple: jest.fn(),
}));

import DeleteAccount from '../delete-account';
import { Btn } from '@/components/Btn';
import { Txt } from '@/components/Txt';

it('구글 회원 탈퇴 확정 → withdrawBe 후 회원 로컬 잔재 정리 호출', async () => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<DeleteAccount />);
  });
  // 동의 체크 (consent Pressable — 텍스트 profile.delete.confirm 포함 행)
  const consent = tree.root
    .findAll((n) => n.props?.onPress && n.findAllByType(Txt).some((t) => t.props.children === 'profile.delete.confirm'))
    .pop()!;
  act(() => consent.props.onPress());
  // 탈퇴 버튼 (agreed 후 활성)
  const del = tree.root.findAllByType(Btn).find((b) => b.props.children === 'profile.delete.confirmBtn')!;
  await act(async () => {
    del.props.onPress();
    await new Promise((r) => setTimeout(r, 0)); // dynamic import + async 흐름 해소
  });
  expect(mockWithdrawBe).toHaveBeenCalled();
  expect(mockClearMember).toHaveBeenCalled(); // 탈퇴한 계정 draft·맵기 소거
  expect(mockReplace).toHaveBeenCalledWith('/login');
});

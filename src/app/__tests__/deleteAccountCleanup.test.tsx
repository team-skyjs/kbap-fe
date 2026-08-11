/**
 * P-010(KB-177): 탈퇴 완주 시 회원 로컬 잔재 정리가 실제로 배선됐는지 잠근다 —
 * (구글 회원 경로) 동의 → 탈퇴 확정 → withdrawBe + clearMemberLocalState 호출.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// 컴포넌트 인덱스가 reanimated(StickyHeader 등)를 끌고 옴 — 표면 mock (tabStates.test 참조)
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['springify', 'damping', 'stiffness', 'mass', 'duration', 'delay', 'easing']) b[k] = () => b;
    return b;
  };
  return {
    __esModule: true,
    withSpring: (v: unknown) => v,
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeIn: chain(),
    FadeOut: chain(),
    SlideInDown: chain(),
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    ZoomIn: chain(),
    ZoomOut: chain(),
    FadeInDown: chain(),
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
// P-147: Firebase엔 애플 링크가 "잔존"하는 시나리오 — 서버 정본 판별이면 무시돼야 한다
jest.mock('@/lib/auth/appleRevoke', () => ({
  currentIsAppleUser: () => true, // 링크 잔존(과거 애플 로그인) — 구 판별이면 오판됐을 상태
  reauthAndRevokeApple: jest.fn(),
}));
const mockCleanup = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/auth/firebaseCleanup', () => ({ cleanupFirebaseAccount: (...a: unknown[]) => mockCleanup(...a) }));
const mockUseMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({ useMe: () => mockUseMe() }));

import DeleteAccount from '../delete-account';
import { Btn } from '@/components/Btn';
import { Txt } from '@/components/Txt';

const ME = (provider?: string) => ({ data: provider === undefined ? undefined : { id: '1', nickname: 'A', nationality: 'US', readerLanguage: 'en', spiceTolerance: null, restrictions: [], provider, rank: { tier: 'bronze', level: 1, score: 0, nextTier: null, pointsToNext: null } } });

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMe.mockReturnValue(ME('GOOGLE'));
});

async function confirmDelete(tree: ReactTestRenderer) {
  const consent = tree.root
    .findAll((n) => n.props?.onPress && n.findAllByType(Txt).some((t) => t.props.children === 'profile.delete.confirm'))
    .pop()!;
  act(() => consent.props.onPress());
  const del = tree.root.findAllByType(Btn).find((b) => b.props.children === 'profile.delete.confirmBtn')!;
  await act(async () => {
    del.props.onPress();
    await new Promise((r) => setTimeout(r, 0));
  });
}

it('P-147: GOOGLE 회원 + 애플 링크 잔존 → 게이트 미발동, 바로 탈퇴 + Firebase 클린업', async () => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<DeleteAccount />);
  });
  await confirmDelete(tree);
  // 서버 정본(GOOGLE) — Firebase 애플 링크 잔존(currentIsAppleUser=true)이어도 게이트 안 뜸
  expect(JSON.stringify(tree.toJSON())).not.toContain('profile.delete.appleGateBody');
  expect(mockWithdrawBe).toHaveBeenCalled();
  expect(mockClearMember).toHaveBeenCalled(); // 탈퇴한 계정 draft·맵기 소거
  expect(mockCleanup).toHaveBeenCalled(); // P-147 ②: 잔존 링크 재발 방지
  expect(mockReplace).toHaveBeenCalledWith('/login');
});

it('P-147: APPLE 회원 → 재인증 게이트 발동(탈퇴 미진행 — KB-162 현행)', async () => {
  mockUseMe.mockReturnValue(ME('APPLE'));
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<DeleteAccount />);
  });
  await confirmDelete(tree);
  expect(JSON.stringify(tree.toJSON())).toContain('profile.delete.appleGateBody');
  expect(mockWithdrawBe).not.toHaveBeenCalled();
});

it('P-147: 프로필 미로드 → 보수적으로 게이트 발동(revoke 없는 애플 탈퇴 금지)', async () => {
  mockUseMe.mockReturnValue(ME(undefined));
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<DeleteAccount />);
  });
  await confirmDelete(tree);
  expect(JSON.stringify(tree.toJSON())).toContain('profile.delete.appleGateBody');
  expect(mockWithdrawBe).not.toHaveBeenCalled();
});

it('P-147: 클린업 실패해도 탈퇴 흐름 계속(best effort)', async () => {
  mockCleanup.mockRejectedValueOnce(new Error('recent-auth required'));
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<DeleteAccount />);
  });
  await confirmDelete(tree);
  expect(mockWithdrawBe).toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/login');
});

it('P-173 🚨: 탈퇴 확정 연타 → withdrawBe 1회(동기 가드 — PATCH 7발 로그 실증 봉쇄)', async () => {
  // 응답을 지연시켜 연타 창 재현
  let release!: () => void;
  mockWithdrawBe.mockImplementation(() => new Promise<void>((r) => (release = r)));
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<DeleteAccount />);
  });
  const consent = tree.root
    .findAll((n) => n.props?.onPress && n.findAllByType(Txt).some((t2) => t2.props.children === 'profile.delete.confirm'))
    .pop()!;
  act(() => consent.props.onPress());
  const del = tree.root.findAllByType(Btn).find((b) => b.props.children === 'profile.delete.confirmBtn')!;
  await act(async () => {
    del.props.onPress?.();
    del.props.onPress?.();
    del.props.onPress?.();
    await Promise.resolve();
  });
  expect(mockWithdrawBe).toHaveBeenCalledTimes(1);
  // 진행 중 = 버튼 busy(스피너) 표시
  expect(tree.root.findAll((n) => n.props?.testID === 'btn-busy').length).toBeGreaterThanOrEqual(1);
  await act(async () => {
    release();
    await new Promise((r) => setTimeout(r, 0));
  });
});

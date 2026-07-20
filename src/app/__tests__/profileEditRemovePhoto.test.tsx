/**
 * P-013(KB-149 후속): 프로필 사진 삭제 액션을 잠근다.
 * - 사진 설정 상태에서만 노출 (없으면 미노출)
 * - 탭 → PATCH profileImageUrl: ''(PROFILE_IMAGE_CLEAR 잠정 — null/'' 확정 대기)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

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
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/lib/data/profileImage', () => ({
  pickProfileImage: jest.fn(),
  uploadProfileImage: jest.fn(),
  PROFILE_IMAGE_CLEAR: null, // P-014 확정값
}));
const mockMutate = jest.fn();
let mockMe: Record<string, unknown>;
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: mockMe }),
  useMyReviews: () => ({ data: [] }),
  useUpdateMe: () => ({ mutate: mockMutate }),
}));

import EditProfile from '../profile/edit';
import { Txt } from '@/components/Txt';

const BASE = { nickname: 'A', nationality: 'US', readerLanguage: 'en', spiceTolerance: null, restrictions: [], rank: { tier: 'bronze', level: 1, score: 0, nextTier: null, pointsToNext: null }, id: '1' };

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

const removeNode = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => n.props?.onPress && n.findAllByType(Txt).some((t) => t.props.children === 'editProfile.removePhoto'));

beforeEach(() => jest.clearAllMocks());

it('사진 설정 상태 → 삭제 액션 노출, 탭 시 PATCH profileImageUrl null (P-014 확정)', () => {
  mockMe = { ...BASE, profileImageUrl: 'https://cdn/p.jpg' };
  const tree = render(<EditProfile />);
  const btns = removeNode(tree);
  expect(btns.length).toBeGreaterThanOrEqual(1);
  act(() => btns[btns.length - 1].props.onPress());
  expect(mockMutate).toHaveBeenCalledWith({ profileImageUrl: null });
});

it('사진 없음 → 삭제 액션 미노출', () => {
  mockMe = { ...BASE, profileImageUrl: null };
  const tree = render(<EditProfile />);
  expect(removeNode(tree)).toHaveLength(0);
});

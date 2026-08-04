/**
 * P-013/P-016 → **P-120 재작성**: 프로필 사진 UX —
 *  - 사진 변경/삭제 = **로컬 드래프트**(즉시 PATCH 폐기): 저장 탭 시 1회 합류,
 *    뒤로가기 무전송
 *  - 업로드 중(busy) 저장 비활성(헤더+하단), 실패 시 드래프트 미반영+에러 라벨
 *  - iOS: "사진 변경"·"사진 삭제" 텍스트 2종 부재(시트 빨간 삭제로 일원화) /
 *    안드: 삭제 텍스트 버튼 잔존(유일 경로)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Platform } from 'react-native';

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
  choosePhotoSource: jest.fn(),
  pickBySource: jest.fn(),
  uploadProfileImage: jest.fn(),
  PROFILE_IMAGE_CLEAR: 'images/default/profile/profile-default-512.png', // P-016 최종값
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
import { Btn } from '@/components/Btn';

/* eslint-disable @typescript-eslint/no-require-imports */
const pm = require('@/lib/data/profileImage') as {
  choosePhotoSource: jest.Mock;
  pickBySource: jest.Mock;
  uploadProfileImage: jest.Mock;
  PROFILE_IMAGE_CLEAR: string;
};
/* eslint-enable @typescript-eslint/no-require-imports */

const BASE = { nickname: 'A', nationality: 'US', readerLanguage: 'en', spiceTolerance: 'SKIP', restrictions: [], rank: { tier: 'bronze', level: 1, score: 0, nextTier: null, pointsToNext: null }, id: '1' };

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

const textNodes = (tree: ReactTestRenderer, key: string) =>
  tree.root.findAll((n) => n.props?.onPress !== undefined && n.findAllByType(Txt).some((t) => t.props.children === key));
const labelPresent = (tree: ReactTestRenderer, key: string) =>
  tree.root.findAllByType(Txt).some((t) => t.props.children === key);
const headerSave = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => 'disabled' in (n.props ?? {}) && n.findAllByType(Txt).some((t) => t.props.children === 'common.save'))[0];
const saveBtn = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Btn).find((b) => String(b.props.children).includes('editProfile.save'))!;
const avatar = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props?.testID === 'avatar' && typeof n.props.onPress !== 'undefined')[0];

/** 갤러리 선택→업로드 흐름 시동 — resolve/reject 제어권 반환. */
function armUpload() {
  let resolveUpload!: (p: string) => void;
  let rejectUpload!: (e: Error) => void;
  pm.choosePhotoSource.mockResolvedValue('gallery');
  pm.pickBySource.mockResolvedValue({ uri: 'file://new.jpg', width: 100, height: 100 });
  pm.uploadProfileImage.mockImplementation(
    () => new Promise<string>((res, rej) => { resolveUpload = res; rejectUpload = rej; }),
  );
  return { resolve: (p: string) => resolveUpload(p), reject: (e: Error) => rejectUpload(e) };
}

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
  mockMe = { ...BASE, profileImageUrl: 'https://cdn/p.jpg' };
});

it('iOS — "사진 변경"·"사진 삭제" 텍스트 2종 부재 (시트 빨간 삭제로 일원화)', () => {
  const tree = render(<EditProfile />);
  expect(labelPresent(tree, 'editProfile.changePhoto')).toBe(false);
  expect(textNodes(tree, 'editProfile.removePhoto')).toHaveLength(0);
});

it('안드 — 커스텀 사진이면 삭제 텍스트 버튼 잔존(유일 경로), 탭 = 드래프트(즉시 PATCH 0)', () => {
  Platform.OS = 'android';
  const tree = render(<EditProfile />);
  const btns = textNodes(tree, 'editProfile.removePhoto');
  expect(btns.length).toBeGreaterThanOrEqual(1);
  act(() => btns[btns.length - 1].props.onPress());
  expect(mockMutate).not.toHaveBeenCalled(); // P-120: 즉시 PATCH 폐기 — 저장 시 합류
  // 저장 탭 → 1회 PATCH에 삭제 센티널 합류
  act(() => headerSave(tree).props.onPress());
  expect(mockMutate).toHaveBeenCalledTimes(1);
  expect(mockMutate.mock.calls[0][0]).toMatchObject({ profileImageUrl: pm.PROFILE_IMAGE_CLEAR });
});

it('안드 — 사진 없음·서버 기본 사진(P-016 판별)은 삭제 버튼 미노출', () => {
  Platform.OS = 'android';
  mockMe = { ...BASE, profileImageUrl: null };
  expect(textNodes(render(<EditProfile />), 'editProfile.removePhoto')).toHaveLength(0);
  mockMe = { ...BASE, profileImageUrl: 'https://cdn.example/images/default/profile/profile-default-512.png' };
  expect(textNodes(render(<EditProfile />), 'editProfile.removePhoto')).toHaveLength(0);
});

it('업로드 중 — 헤더 저장 disabled + 하단 CTA off, 완료 후 복원', async () => {
  const upload = armUpload();
  const tree = render(<EditProfile />);
  await act(async () => { avatar(tree).props.onPress(); });
  expect(headerSave(tree).props.disabled).toBe(true);
  expect(saveBtn(tree).props.variant).toBe('off');
  await act(async () => { upload.resolve('images/profile/new.jpg'); });
  expect(headerSave(tree).props.disabled).toBe(false);
  expect(saveBtn(tree).props.variant).not.toBe('off');
});

it('드래프트 → 저장 1회 PATCH 합류 · 저장 전(=뒤로가기 경로) 무전송', async () => {
  const upload = armUpload();
  const tree = render(<EditProfile />);
  await act(async () => { avatar(tree).props.onPress(); });
  await act(async () => { upload.resolve('images/profile/new.jpg'); });
  expect(mockMutate).not.toHaveBeenCalled(); // 업로드 완료돼도 전송 없음 — 뒤로가기면 서버 무변
  act(() => headerSave(tree).props.onPress());
  expect(mockMutate).toHaveBeenCalledTimes(1);
  expect(mockMutate.mock.calls[0][0]).toMatchObject({ profileImageUrl: 'images/profile/new.jpg' });
});

it('업로드 실패 — 드래프트 미반영(저장에 사진 필드 생략) + 에러 라벨', async () => {
  const upload = armUpload();
  const tree = render(<EditProfile />);
  await act(async () => { avatar(tree).props.onPress(); });
  await act(async () => { upload.reject(new Error('boom')); });
  expect(labelPresent(tree, 'editProfile.photoError')).toBe(true);
  act(() => headerSave(tree).props.onPress());
  expect(mockMutate).toHaveBeenCalledTimes(1);
  expect('profileImageUrl' in mockMutate.mock.calls[0][0]).toBe(false); // 실패분 미전송
});

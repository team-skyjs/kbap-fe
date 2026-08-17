/**
 * P-233(KB-305): 식이 전체 페이지 — 역추론 프리셀렉트·저장=신규분 합집합(기존
 * 보존)·해제=회피 불변·사후 모달 Yes/No 라우팅·무변경 무모달.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/data/useDietPresets', () => ({
  useDietPresets: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DIET_PRESETS, presetSubstanceCodes } = require('@/lib/onboarding/dietPresets');
    return DIET_PRESETS.map((p: { id: string }) => ({ ...p, codes: [...presetSubstanceCodes(p)], serverName: null }));
  },
}));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  usePathname: () => '/',
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
const mockMutate = jest.fn();
const mockUseMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => mockUseMe(),
  useUpdateMe: () => ({ mutate: mockMutate }),
}));

import DietPresetsScreen from '../profile/diet';
import { DIET_PRESETS, presetSubstanceCodes } from '@/lib/onboarding/dietPresets';

const NO_ALCOHOL = [...presetSubstanceCodes(DIET_PRESETS.find((p) => p.id === 'NO_ALCOHOL')!)];
const VEGAN = [...presetSubstanceCodes(DIET_PRESETS.find((p) => p.id === 'VEGAN')!)];

const ME = (codes: string[]) => ({ data: { id: '1', restrictions: codes.map((code) => ({ kind: 'allergy' as const, code })) } });

const trees: ReactTestRenderer[] = [];
function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<DietPresetsScreen />); });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });

const tap = async (tree: ReactTestRenderer, id: string) => {
  const n = tree.root.findAll((x) => x.props?.testID === id && typeof x.props?.onPress === 'function')[0];
  await act(async () => { n.props.onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMe.mockReturnValue(ME([...NO_ALCOHOL, 'EGG']));
  mockMutate.mockImplementation((_input: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
});

it('프리셀렉트 = 역추론(NO_ALCOHOL 활성 칩) — P-227과 동일 규칙', () => {
  const tree = render();
  const chip = tree.root.findAll((n) => n.props?.testID === 'dietpage-NO_ALCOHOL')[0];
  expect(JSON.stringify(chip.props.style)).toContain('"borderColor":"#E2580C"'); // 활성 톤
});

it('추가 저장 = 신규 선택분 합집합 PATCH(기존 회피 보존) → 사후 모달 → Yes = 회피 편집', async () => {
  const tree = render();
  await tap(tree, 'dietpage-VEGAN'); // Vegan 추가
  await tap(tree, 'diet-save');
  const body = mockMutate.mock.calls[0][0] as { restrictions: { code: string }[] };
  const codes = body.restrictions.map((r) => r.code);
  for (const c of VEGAN) expect(codes).toContain(c); // 신규분 반영
  for (const c of [...NO_ALCOHOL, 'EGG']) expect(codes).toContain(c); // 기존 보존(합집합 — 오삭제 0)
  expect(tree.root.findAll((n) => n.props?.testID === 'diet-saved-modal').length).toBeGreaterThanOrEqual(1);
  await tap(tree, 'diet-saved-yes');
  expect(mockPush).toHaveBeenCalledWith('/profile/restrictions'); // 미세 조정 진입
});

it('사후 모달 No = 프로필 복귀(반영은 이미 됨 — PATCH 1회 유지)', async () => {
  const tree = render();
  await tap(tree, 'dietpage-VEGAN');
  await tap(tree, 'diet-save');
  await tap(tree, 'diet-saved-no');
  expect(mockMutate).toHaveBeenCalledTimes(1); // No가 반영을 되돌리지 않는다
  expect(mockBack).toHaveBeenCalled();
});

it('해제만 하고 저장 = 회피 불변(PATCH 0) + 모달 없이 조용히 복귀', async () => {
  const tree = render();
  await tap(tree, 'dietpage-NO_ALCOHOL'); // 활성 해제
  await tap(tree, 'diet-save');
  expect(mockMutate).not.toHaveBeenCalled(); // 해제 = 성분 안 건드림(오삭제 방지)
  expect(mockBack).toHaveBeenCalled();
  expect(tree.root.findAll((n) => n.props?.testID === 'diet-saved-modal')).toHaveLength(0);
});

it('무변경 저장 = 무모달·조용한 복귀(재량 확인 반영)', async () => {
  const tree = render();
  await tap(tree, 'diet-save');
  expect(mockMutate).not.toHaveBeenCalled();
  expect(mockBack).toHaveBeenCalled();
});

it('배선 소스 잠금 — 프로필 Show all 진입·해제 안내 문구·P-227 승인 팝업 존치(경로 분리)', () => {
  const fs = require('fs');
  expect(fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8')).toContain("router.push('/profile/diet' as Href)");
  const page = fs.readFileSync('src/app/profile/diet.tsx', 'utf8') as string;
  expect(page).toContain("t('profile.dietUncheckHint')"); // 해제 = 회피 불변 안내
  expect(page).toContain('unionResolvedCodes(dietPresets, added, cur)'); // 신규분만 합집합
  // P-227 승인형 팝업은 회피 편집 화면 경로에 존치(두 경로 의도적 상이)
  expect(fs.readFileSync('src/app/profile/restrictions.tsx', 'utf8')).toContain('setPresetConfirm(true)');
});

/**
 * P-233(KB-305) → P-243(KB-340) 서버 정본 전환: 식이 전체 페이지 —
 * 프리셀렉트 = me.dietCategories · 저장 = dietCategories 풀 셋 + 신규분 회피
 * 합집합 **한 PATCH** · 해제 = dietCategories만 감소(회피 불변) · 역추론 잔존 0.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ScrollView, StyleSheet } from 'react-native';

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
const mockReplace = jest.fn();
// KB-776: 이탈 확인 — usePreventRemove(번들 react-navigation) 목: 마지막 호출의 (막는지, 콜백) 기록(KB-708 문의·작성 테스트와 같은 방식)
const mockNavDispatch = jest.fn();
const mockPrevent: { on: boolean; cb: ((o: { data: { action: unknown } }) => void) | null } = { on: false, cb: null };
jest.mock('expo-router/build/react-navigation/core', () => ({
  usePreventRemove: (on: boolean, cb: (o: { data: { action: unknown } }) => void) => {
    mockPrevent.on = on;
    mockPrevent.cb = cb;
  },
}));
jest.mock('expo-router', () => ({
  useNavigation: () => ({ dispatch: (a: unknown) => mockNavDispatch(a) }),
  useSegments: () => [],
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
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

let mockInset = 0;
jest.mock('@/lib/useBottomInset', () => ({ useBottomInset: () => mockInset })); // KB-900: 안드 3버튼 인셋 흉내
import DietPresetsScreen from '../profile/diet';
import { DIET_PRESETS, presetSubstanceCodes } from '@/lib/onboarding/dietPresets';

const NO_ALCOHOL = [...presetSubstanceCodes(DIET_PRESETS.find((p) => p.id === 'NO_ALCOHOL')!)];
const VEGAN = [...presetSubstanceCodes(DIET_PRESETS.find((p) => p.id === 'VEGAN')!)];

const ME = (codes: string[], dietCategories: string[] = []) =>
  ({ data: { id: '1', restrictions: codes.map((code) => ({ kind: 'allergy' as const, code })), dietCategories } });

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
  mockInset = 0;
  mockUseMe.mockReturnValue(ME([...NO_ALCOHOL, 'EGG'], ['NO_ALCOHOL']));
  mockMutate.mockImplementation((_input: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
});

it('P-243: 프리셀렉트 = me.dietCategories(서버 정본) — 역추론 아님', () => {
  // 회피에 VEGAN 전 코드가 있어도(역추론이면 활성일 상황) dietCategories에 없으면 꺼짐
  mockUseMe.mockReturnValue(ME([...VEGAN, ...NO_ALCOHOL], ['NO_ALCOHOL']));
  const tree = render();
  const on = tree.root.findAll((n) => n.props?.testID === 'dietpage-NO_ALCOHOL')[0];
  expect(JSON.stringify(on.props.style)).toContain('"borderColor":"#FF7134"'); // 활성 톤
  const off = tree.root.findAll((n) => n.props?.testID === 'dietpage-VEGAN')[0];
  expect(JSON.stringify(off.props.style)).not.toContain('"borderColor":"#FF7134"');
});

it('추가 저장 = dietCategories 풀 셋 + 신규분 합집합 회피 — 한 PATCH → 사후 모달 → Yes = 회피 편집', async () => {
  const tree = render();
  await tap(tree, 'dietpage-VEGAN'); // Vegan 추가
  await tap(tree, 'diet-save');
  expect(mockMutate).toHaveBeenCalledTimes(1); // 두 필드 한 요청(P-243)
  const body = mockMutate.mock.calls[0][0] as { dietCategories: string[]; restrictions: { code: string }[] };
  expect(new Set(body.dietCategories)).toEqual(new Set(['NO_ALCOHOL', 'VEGAN'])); // 풀 셋 교체
  const codes = body.restrictions.map((r) => r.code);
  for (const c of VEGAN) expect(codes).toContain(c); // 신규분 반영
  for (const c of [...NO_ALCOHOL, 'EGG']) expect(codes).toContain(c); // 기존 보존(합집합 — 오삭제 0)
  expect(tree.root.findAll((n) => n.props?.testID === 'diet-saved-modal').length).toBeGreaterThanOrEqual(1);
  await tap(tree, 'diet-saved-yes');
  // P-261: replace(push 아님) — 회피 저장 back()이 식이를 거치지 않고 프로필 직행
  expect(mockReplace).toHaveBeenCalledWith('/profile/restrictions');
  expect(mockPush).not.toHaveBeenCalled();
});

it('사후 모달 No = 프로필 복귀(반영은 이미 됨 — PATCH 1회 유지)', async () => {
  const tree = render();
  await tap(tree, 'dietpage-VEGAN');
  await tap(tree, 'diet-save');
  await tap(tree, 'diet-saved-no');
  expect(mockMutate).toHaveBeenCalledTimes(1); // No가 반영을 되돌리지 않는다
  expect(mockBack).toHaveBeenCalled();
});

it('P-243 해제 실동작 = dietCategories만 감소(restrictions 미전송 — 회피 불변)', async () => {
  const tree = render();
  await tap(tree, 'dietpage-NO_ALCOHOL'); // 활성 해제
  await tap(tree, 'diet-save');
  expect(mockMutate).toHaveBeenCalledTimes(1); // 이제 해제도 서버 저장(칩 꺼짐)
  const body = mockMutate.mock.calls[0][0] as { dietCategories: string[]; restrictions?: unknown };
  expect(body.dietCategories).toEqual([]); // NO_ALCOHOL 빠짐
  expect(body.restrictions).toBeUndefined(); // 회피 불변 — 필드 자체 미전송(오삭제 0)
});

it('무변경 저장 = 무모달·조용한 복귀(재량 확인 반영)', async () => {
  const tree = render();
  await tap(tree, 'diet-save');
  expect(mockMutate).not.toHaveBeenCalled();
  expect(mockBack).toHaveBeenCalled();
});

it('배선 소스 잠금 — 해제 안내 문구·P-227 승인 팝업 존치(경로 분리)', () => {
  // KB-434 D-6: 프로필 탭 식이 '칩 섹션' 소멸 — 진입은 메뉴 행(/profile/diet, Codex #33 P2 복원)
  const fs = require('fs');
  expect(fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8')).toContain("router.push('/profile/diet' as Href)");
  const page = fs.readFileSync('src/app/profile/diet.tsx', 'utf8') as string;
  expect(page).toContain("t('profile.dietUncheckHint')"); // 해제 = 회피 불변 안내
  expect(page).toContain('unionResolvedCodes(dietPresets, added, cur)'); // 신규분만 합집합
  // P-227 승인형 팝업은 회피 편집 화면 경로에 존치(두 경로 의도적 상이)
  expect(fs.readFileSync('src/app/profile/restrictions.tsx', 'utf8')).not.toContain('setPresetConfirm'); // P-339 ⑧: 프리셋 경로 소멸
});

it('P-243 역추론 잔존 0 — 활성 판정에 codes.every(⊆회피) 패턴 소멸(서버 정본)', () => {
  const fs = require('fs');
  const page = fs.readFileSync('src/app/profile/diet.tsx', 'utf8') as string;
  expect(page).not.toContain('codes.every'); // 역추론 판정식
  expect(page).toContain('me?.dietCategories'); // 서버 정본 소스
  // KB-434 D-6: 프로필 탭은 식이 섹션 자체 소멸 — 역추론 잔존 0
  expect(fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8')).not.toContain('codes.every');
});

/* ---- KB-776(QA B3-3): 미저장 뒤로 = 이탈 확인(문의 작성과 같은 공용 훅·편집 문구) ---- */
it('KB-776: 무변경 = 막지 않음 · 칩 변경 = 막음(헤더·스와이프·하드웨어 뒤로 공통) → 확인 창(편집 문구) → 그만두기 = 막았던 이동 그대로', async () => {
  const tree = render();
  expect(mockPrevent.on).toBe(false);
  await tap(tree, 'dietpage-VEGAN');
  expect(mockPrevent.on).toBe(true);
  await act(async () => { mockPrevent.cb?.({ data: { action: { type: 'GO_BACK' } } }); });
  const modal = tree.root.findAll((n) => n.props?.testID === 'leave-confirm' && typeof n.type === 'string');
  expect(modal).toHaveLength(1);
  const s = JSON.stringify(tree.toJSON());
  expect(s).toContain('common.leaveEditTitle');
  expect(s).toContain('common.keepEditing');
  await tap(tree, 'discard-go');
  expect(mockNavDispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
  expect(mockMutate).not.toHaveBeenCalled(); // 그만두기 = 저장 0
});

it('KB-776: 되돌리면(같은 칩 다시 탭) 막기 해제 · 저장 성공 뒤엔 막지 않음(사후 모달 Yes·No 이동에 확인 창 0)', async () => {
  const tree = render();
  await tap(tree, 'dietpage-VEGAN');
  await tap(tree, 'dietpage-VEGAN');
  expect(mockPrevent.on).toBe(false);
  await tap(tree, 'dietpage-VEGAN');
  await tap(tree, 'diet-save');
  expect(mockMutate).toHaveBeenCalledTimes(1);
  expect(mockPrevent.on).toBe(false);
});

it('KB-900: Save 바 아래 여백 = 인셋 + 10 · 본문 아래 여백도 같이 늘어 마지막 행이 바 뒤로 안 숨음(iOS 34 = 종전 120)', () => {
  mockInset = 48;
  const tree = render();
  const bar = tree.root.findAll((n) => n.props?.testID === 'diet-savebar' && n.props?.style)[0];
  expect(StyleSheet.flatten(bar.props.style).paddingBottom).toBe(58);
  expect(StyleSheet.flatten(tree.root.findByType(ScrollView).props.contentContainerStyle).paddingBottom).toBe(134);
  act(() => trees.pop()!.unmount());
  mockInset = 34;
  expect(StyleSheet.flatten(render().root.findByType(ScrollView).props.contentContainerStyle).paddingBottom).toBe(120);
});

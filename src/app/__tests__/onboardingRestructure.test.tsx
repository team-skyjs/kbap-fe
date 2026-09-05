/**
 * P-080(KB-261) 온보딩 재구조 잠금:
 *  - ① 약관 게이트: 필수 3항목 미동의 시 계속 불가(off) · 전체 동의 시 진행 가능
 *  - ③ 마크 데모: 탭 순환 safe→caution→danger→unable→safe (RiskMark 재사용)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// P-174: 재료 카탈로그 훅 표면 목 — 폴백 경로(서버 무데이터) = 종전 렌더와 동일
jest.mock('@/lib/data/useDietPresets', () => {
  // P-208: 프리셋 서버 훅 표면 목 — 상수 폴백 형태(react-query 무의존)
  const { DIET_PRESETS, presetSubstanceCodes } = jest.requireActual('@/lib/onboarding/dietPresets');
  return { useDietPresets: () => DIET_PRESETS.map((p: { id: string; group: string; labelKey: string }) => ({ ...p, codes: presetSubstanceCodes(p), serverName: null })) };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({
    name: (c: string) => (require('@/lib/mocks/ingredients') as typeof import('@/lib/mocks/ingredients')).ingredientLabel(c),
    imageUrl: () => null,
  }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
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
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeIn: chain(),
    FadeOut: chain(),
    FadeInDown: chain(),
    SlideInDown: chain(),
    ZoomIn: chain(),
    ZoomOut: chain(),
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    cancelAnimation: () => {},
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k },
}));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en', regionCode: 'US' }] }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/lib/data/profileImage', () => ({ choosePhotoSource: jest.fn(), pickBySource: jest.fn(), uploadProfileImage: jest.fn() }));
jest.mock('@/lib/onboarding/submit', () => ({ UNSET: 'UNSET', submitOnboardingProfile: jest.fn() }));
jest.mock('@/lib/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: undefined }),
  useMyReviews: () => ({ data: [] }),
  useUpdateMe: () => ({ mutate: jest.fn() }),
}));
// 테스트별 드래프트 전환: null = 신규(약관 스텝), 'riskdemo' = 데모 직행
let mockDraft: Record<string, unknown> | null = null;
jest.mock('@/lib/onboarding/draft', () => ({
  loadOnboardingDraft: jest.fn(() => Promise.resolve(mockDraft)),
  saveOnboardingDraft: jest.fn(),
  clearOnboardingDraft: jest.fn(),
}));

import Onboarding from '../onboarding/index';
import { Btn } from '@/components/Btn';
import { RiskMark } from '@/components/RiskMark';

async function render(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Onboarding />);
  });
  return tree;
}
const continueBtn = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Btn).find((b) => {
    const c = b.props.children;
    return (Array.isArray(c) ? c.join('') : String(c ?? '')).includes('onboarding.continue');
  })!;
const textNodes = (tree: ReactTestRenderer, text: string) => tree.root.findAll((n) => n.props?.children === text);

it('약관 게이트 — 3항목 미동의면 계속 off, 개별 3행 전부 체크 시 진행 가능', async () => {
  mockDraft = null;
  const tree = await render();
  expect(continueBtn(tree).props.variant).toBe('off');
  expect(continueBtn(tree).props.onPress).toBeUndefined();
  // 개별 행 체크 3개 (hitSlop 6이 지문 — 행 본문 Pressable)
  const rows = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props?.hitSlop === 6);
  expect(rows.length).toBe(3);
  for (const row of rows) {
    await act(async () => {
      row.props.onPress();
    });
  }
  expect(continueBtn(tree).props.variant).toBe('primary');
});

it('약관 게이트 — 전체 동의 한 번으로 3항목 일괄 체크·진행 가능', async () => {
  mockDraft = null;
  const tree = await render();
  const agreeAll = tree.root.findAll(
    (n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'onboarding.agreeAll').length > 0,
  );
  expect(agreeAll.length).toBeGreaterThanOrEqual(1);
  await act(async () => {
    agreeAll[0].props.onPress();
  });
  expect(continueBtn(tree).props.variant).toBe('primary');
  // 계속 → 국적 스텝 진입 (P-130 v3: 프로필 스텝 소멸)
  await act(async () => {
    continueBtn(tree).props.onPress();
  });
  expect(textNodes(tree, 'onboarding.nationalityTitle').length).toBeGreaterThanOrEqual(1);
});

it('P-130 → P-203: 스텝 순서 — 약관→국적→프리셋(신설)→회피→맵기(마지막 CTA=시작하기)', async () => {
  mockDraft = null;
  const tree = await render();
  const agreeAll = tree.root.findAll(
    (n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'onboarding.agreeAll').length > 0,
  );
  await act(async () => { agreeAll[0].props.onPress(); });
  await act(async () => { continueBtn(tree).props.onPress(); }); // → 국적
  expect(textNodes(tree, 'onboarding.nationalityTitle').length).toBeGreaterThanOrEqual(1);
  await act(async () => { continueBtn(tree).props.onPress(); }); // → 프리셋(P-203 — dev 계열)
  expect(textNodes(tree, 'onboarding.presets.title').length).toBeGreaterThanOrEqual(1);
  await act(async () => { continueBtn(tree).props.onPress(); }); // → 회피
  expect(textNodes(tree, 'onboarding.avoidSub').length).toBeGreaterThanOrEqual(1); // P-134 타일 그리드
  await act(async () => { continueBtn(tree).props.onPress(); }); // → 맵기 (CTA = 시작하기)
  const startBtn = tree.root.findAllByType(Btn).find((btn) => String(btn.props.children).includes('onboarding.finishSetup'));
  expect(startBtn).toBeTruthy();
  expect(textNodes(tree, 'onboarding.profileTitle')).toHaveLength(0); // 소멸 스텝 잔재 0
});

it('P-130: 국적 스텝 — 감지국 최상단 + 국기 이모지 + 모국어명 메인', async () => {
  mockDraft = { consented: true, step: 'nationality', nickname: '', nationality: 'US', language: 'en', restrictions: [], spice: 'MEDIUM', updatedAt: '' };
  const tree = await render();
  // expo-localization 목: 감지국 = KR (프렐류드 getLocales)
  const rows = tree.root.findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('nat-'));
  expect(rows[0].props.testID).toBe('nat-US'); // 감지국(목 regionCode US) 최상단
  expect(rows.length).toBeGreaterThan(100); // 전 국가 리스트 즉시 노출
  // 이모지·모국어명 확인 (KR 행)
  const kr = tree.root.findAll((n) => n.props?.testID === 'nat-KR')[0];
  expect(kr.findAll((c) => c.props?.children === '🇰🇷').length).toBeGreaterThanOrEqual(1);
  expect(kr.findAll((c) => c.props?.children === '한국').length).toBeGreaterThanOrEqual(1);
});

it('P-130: 구버전 draft(소멸 스텝) 무해 파싱 — summary → spice로 클램프', async () => {
  mockDraft = { consented: true, step: 'summary', nickname: '구닉네임', nationality: 'JP', language: 'en', restrictions: null, spice: 'HOT', profileImageUrl: 'x', updatedAt: '' };
  const tree = await render();
  const startBtn = tree.root.findAllByType(Btn).find((btn) => String(btn.props.children).includes('onboarding.finishSetup'));
  expect(startBtn).toBeTruthy(); // spice 스텝 도착
});

it('P-101 — 공용 푸터: consent(신규)와 spice(드래프트) CTA 프레임 스타일 동일 + Skip 슬롯 고정', async () => {
  const { StyleSheet } = require('react-native');
  const footerOf = (tree: ReactTestRenderer) => {
    const f = tree.root.findAll((n) => n.props?.testID === 'ob-footer')[0];
    return StyleSheet.flatten(f.props.style) as Record<string, unknown>;
  };
  mockDraft = null; // consent
  const a = footerOf(await render());
  mockDraft = { consented: true, step: 'spice', nickname: 'Y', nationality: 'KR', language: 'en', restrictions: [], spice: null, updatedAt: '2026-07-20T00:00:00Z' };
  const b = footerOf(await render());
  expect(a).toEqual(b); // 스텝이 달라도 푸터 프레임 스타일 동일 (paddingTop·paddingBottom·배경 등)
});

/* ---- KB-433 §0·§3: ORDER 현행 유지 + 진행 점 활성 인덱스 ---- */
it('KB-433 §0: ORDER = consent→nationality→[presets]→restrictions→spice (현행 유지 — 예진 확정 9/5)', () => {
  const src = require('fs').readFileSync('src/app/onboarding/index.tsx', 'utf8') as string;
  expect(src).toContain("['consent', 'nationality', 'presets', 'restrictions', 'spice']");
  expect(src).toContain("['consent', 'nationality', 'restrictions', 'spice']");
  expect(src).toContain("ORDER.filter((st) => st !== 'consent')"); // 진행 점 = consent 제외
});

it('KB-433 §3: 진행 점 — 국가 스텝 = 첫 점 활성, 나머지 비활성(17×4 primary/#DCDEE3)', async () => {
  mockDraft = { consented: true, step: 'nationality', nickname: '', nationality: 'US', language: 'en', restrictions: [], spice: 'MEDIUM', updatedAt: '' };
  const tree = await render();
  expect(tree.root.findAll((n) => n.props?.testID === 'ob-dot-0-on').length).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'ob-dot-1-off').length).toBeGreaterThanOrEqual(1);
  const { StyleSheet } = require('react-native');
  const on = tree.root.findAll((n) => n.props?.testID === 'ob-dot-0-on')[0];
  const st = StyleSheet.flatten(on.props.style) as Record<string, unknown>;
  expect(st.width).toBe(17);
  expect(st.height).toBe(4);
  expect(st.backgroundColor).toBe('#FF7134');
});

it('KB-433 §2 → 9/5 후속: 로그인 콜라주 — 12장 순환 + 마퀴(포커스·모션 게이트) + 그라데이션', () => {
  const src = require('fs').readFileSync('src/app/login.tsx', 'utf8') as string;
  expect((src.match(/dish-\d\d\.jpg/g) ?? []).length).toBe(12); // 추가 에셋 0
  expect(src).toContain('withRepeat'); // 9/5 예진 지시: 행 가로 흐름 무한 루프
  expect(src).toContain('reduceMotion'); // reduce-motion = 정적
  expect(src).toContain('collageFade'); // 상단 흰→투명 그라데이션
  expect(src).toContain('<Wordmark height={46} />'); // 워드마크 144×46
});

it('KB-433(Codex #32 → P-280): 콜라주 = 전면 배경(ceil 3~8행) — 하단 블록 위 레이어 고정', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { collageRows, MIN_COLLAGE_H } = require('@/lib/loginCollage') as typeof import('@/lib/loginCollage');
  expect(MIN_COLLAGE_H).toBe(220);
  expect(collageRows(353)).toBe(3);
  expect(collageRows(2000)).toBe(8); // 상한 8(전면 채움)
  const src = require('fs').readFileSync('src/app/login.tsx', 'utf8') as string;
  expect(src).toContain("collage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }");
  expect(src).toContain('<Collage animate={animate} heroTop={heroTop} />');
});

it('9/5 예진 수정: primary 눌림 = #E8602A(보라 폐기) · Tag 선택 = 색만(체크 0·메트릭 불변)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { color } = require('@/lib/theme') as typeof import('@/lib/theme');
  expect(color.primaryPress).toBe('#E8602A'); // primary 10% 어둡게 — 시안 보라 거부(실기)
  const src = require('fs').readFileSync('src/app/onboarding/index.tsx', 'utf8') as string;
  expect(src).not.toContain('IconCheck size={14}'); // Tag 체크 아이콘 소멸(폭 밀림 방지)
  // 선택/비선택 = 색 키만 상이(P-103/151 프레임 불변 — P-138① 방식)
  const on = src.match(/presetChipOn: \{([^}]*)\}/)?.[1] ?? '';
  expect(on.replace(/\s/g, '')).toBe('borderColor:C.primary,backgroundColor:primaryTint');
  const offKeys = src.match(/presetChip: \{([^}]*)\}/)?.[1] ?? '';
  expect(offKeys).toContain('borderWidth: 1'); // 양 상태 같은 폭 보더(자리 유지)
  const textOn = src.match(/presetChipTextOn: \{([^}]*)\}/)?.[1] ?? '';
  expect(textOn).not.toContain('fontWeight'); // 굵기 무변(폭 고정) — 색만
});

/* ---- P-133 → KB-433 §4-①: 국적 화면 시안 정합 ---- */
it('KB-433: 추천 행(pad16 r8) + 2열 그리드 타일·검색 시 핀 숨김·모국어=영어 생략 규칙', async () => {
  mockDraft = { consented: true, step: 'nationality', nickname: '', nationality: 'US', language: 'en', restrictions: [], spice: 'MEDIUM', updatedAt: '' };
  const tree = await render();
  const { StyleSheet } = require('react-native');
  const flat = (st: unknown) => StyleSheet.flatten(st) as Record<string, unknown>;
  // 추천 행(감지국 US) — pad 16 r8(4150:13845)
  const pin = tree.root.findAll((n) => n.props?.testID === 'nat-US')[0];
  expect(flat(pin.props.style).padding).toBe(16);
  // 일반 = 2열 그리드 타일(47%)
  const jp = tree.root.findAll((n) => n.props?.testID === 'nat-JP')[0];
  expect(flat(jp.props.style).width).toBe('47%');
  // 모국어=영어 생략: SG(=Singapore) 행엔 보조 텍스트 없음, JP(日本≠Japan)엔 있음
  const sg = tree.root.findAll((n) => n.props?.testID === 'nat-SG')[0];
  expect(sg.findAll((c) => c.type === 'Text' && c.props?.children === 'Singapore').length).toBe(1); // 메인 1개뿐(보조 생략)
  expect(jp.findAll((c) => c.type === 'Text' && c.props?.children === 'Japan').length).toBe(1); // 보조 존재
  // 섹션 헤더 존재 → 검색 입력 시 핀 블록 숨김
  const texts = () => tree.root.findAll((n) => n.props?.children === 'onboarding.fromYourPhone');
  expect(texts().length).toBeGreaterThanOrEqual(1);
  const input = tree.root.findAll((n) => typeof n.props?.onChangeText === 'function')[0];
  await act(async () => { input.props.onChangeText('kor'); });
  expect(texts()).toHaveLength(0);
});

/* ---- P-134: 회피 타일 그리드 · 맵기 레일/배지 ---- */
it('P-134 회피: 81종 타일+폴백 약어·카운트/Clear', async () => {
  mockDraft = { consented: true, step: 'restrictions', nickname: '', nationality: 'US', language: 'en', restrictions: ['EGG'], spice: 'MEDIUM', updatedAt: '' };
  const tree = await render();
  const tiles = new Set(tree.root.findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('avoid-') && n.props.testID !== 'avoid-clear').map((n) => n.props.testID as string));
  expect(tiles.size).toBe(81); // 실카탈로그 전량 (시안 30종 아님 — composite/host 중복은 Set으로)
  const egg = tree.root.findAll((n) => n.props?.testID === 'avoid-EGG')[0];
  // P-188: 약어는 로드 **실패시에만** — 체인 소진(onError) 후 노출, 로딩 중엔 스켈레톤
  expect(egg.findAll((c) => c.props?.testID?.startsWith?.('avtile-skel-')).length).toBeGreaterThanOrEqual(1);
  const eggImg = egg.findAll((c) => c.props?.testID === 'avtile-img-EGG')[0];
  await act(async () => { eggImg.props.onError(); });
  expect(egg.findAll((c) => c.props?.children === 'EG').length).toBeGreaterThanOrEqual(1); // 실패 폴백 약어
  expect(textNodes(tree, 'onboarding.selectedCount').length).toBeGreaterThanOrEqual(1); // 1개 선택 카운트
  const clear = tree.root.findAll((n) => n.props?.testID === 'avoid-clear')[0];
  await act(async () => { clear.props.onPress(); });
  expect(textNodes(tree, 'onboarding.noneSelectedYet').length).toBeGreaterThanOrEqual(1); // Clear → 0개 안내
});

it('P-134 → KB-433 맵기: 레벨 전환 시 예시 타일 교체 (kids 배지 = 시안 부재로 소멸)', async () => {
  mockDraft = { consented: true, step: 'spice', nickname: '', nationality: 'US', language: 'en', restrictions: [], spice: 'NONE', updatedAt: '' };
  const tree = await render();
  expect(tree.root.findAll((n) => n.props?.testID === 'rail-246').length).toBeGreaterThanOrEqual(1); // NONE 타일(설렁탕)
  expect(tree.root.findAll((n) => n.props?.testID === 'kid-badge')).toHaveLength(0); // KB-433: 배지 소멸
  // HOT으로 전환 (슬라이더 릴리즈 스냅 — spiceUnset 하네스 지문)
  const { StyleSheet } = require('react-native');
  // P-262: 팬 래퍼 = paddingVertical 32 지문·onLayout = 내부 트랙 래퍼(분리)
  const isPan = (n: { props?: { style?: unknown; onResponderRelease?: unknown } }) =>
    typeof n.props?.onResponderRelease === 'function' &&
    (StyleSheet.flatten(n.props?.style as never) as { paddingVertical?: number } | undefined)?.paddingVertical === 32;
  const pan = tree.root.findAll(isPan)[0];
  const layoutNode = pan.findAll((n) => typeof n.props?.onLayout === 'function')[0];
  await act(async () => { layoutNode.props.onLayout({ nativeEvent: { layout: { width: 300, height: 44 } } }); });
  await act(async () => { tree.root.findAll(isPan)[0].props.onResponderRelease({ nativeEvent: { pageX: 225 } }); }); // HOT
  expect(tree.root.findAll((n) => n.props?.testID === 'rail-483').length).toBeGreaterThanOrEqual(1); // HOT 타일(국물떡볶이)
});

/* ---- P-148① → P-151: 핀 카드 강조 = 선택 바인딩 + 프레임 메트릭 불변 ---- */
it('P-148/151: 타국 선택 시 핀 카드 색 강조만 해제 — 프레임 메트릭(높이·보더 폭·패딩·라운딩·마진) 완전 동일', async () => {
  mockDraft = { consented: true, step: 'nationality', nickname: '', nationality: 'US', language: 'en', restrictions: [], spice: 'MEDIUM', updatedAt: '' };
  const tree = await render();
  const { StyleSheet: RNSheet } = require('react-native') as typeof import('react-native');
  const flat2 = (s2: unknown) => RNSheet.flatten(s2) as Record<string, unknown>;
  const metrics = (st: Record<string, unknown>) => ({
    minHeight: st.minHeight, borderWidth: st.borderWidth, borderRadius: st.borderRadius,
    marginBottom: st.marginBottom, paddingHorizontal: st.paddingHorizontal,
  });
  const pin = () => tree.root.findAll((n) => n.props?.testID === 'nat-US')[0];
  const selectedStyle = flat2(pin().props.style);
  // 선택 상태 — 주황 보더·틴트 존재
  expect(selectedStyle.borderColor).toBe('#FF7134');
  // 타국(JP) 선택 → 색 강조만 소멸(#EAEBEE 동폭 보더 — KB-433 시안), 메트릭 픽셀 동일 (P-103)
  const jp = tree.root.findAll((n) => n.props?.testID === 'nat-JP')[0];
  await act(async () => { jp.props.onPress(); });
  const unselectedStyle = flat2(pin().props.style);
  expect(unselectedStyle.borderColor).toBe('#EAEBEE'); // 색만 전환 — 폭 1 유지
  expect(String(unselectedStyle.backgroundColor ?? '')).not.toContain('rgba(255,113,52');
  expect(metrics(unselectedStyle)).toEqual(metrics(selectedStyle)); // 밀림 봉쇄
  expect(unselectedStyle.borderWidth).toBe(1);
  // 그리드 타일(JP — 선택됨)도 메트릭 무변: 선택 강조는 색뿐
  const jpStyle = flat2(tree.root.findAll((n) => n.props?.testID === 'nat-JP')[0].props.style);
  expect(jpStyle.borderWidth).toBe(1);
});

it('P-154 ①: 일반 행 선택 = 핀 카드와 동일 강조(주황 보더+틴트) — 메트릭 불변·강조 1곳', async () => {
  mockDraft = { consented: true, step: 'nationality', nickname: '', nationality: 'US', language: 'en', restrictions: [], spice: 'MEDIUM', updatedAt: '' };
  const tree = await render();
  const { StyleSheet: RNSheet } = require('react-native') as typeof import('react-native');
  const flat2 = (s2: unknown) => RNSheet.flatten(s2) as Record<string, unknown>;
  const jpStyle = () => flat2(tree.root.findAll((n) => n.props?.testID === 'nat-JP')[0].props.style);
  const before = jpStyle();
  // 미선택 그리드 타일 — 상시 동폭 보더(#EAEBEE — KB-433 시안, 프레임 상비)
  expect(before.borderWidth).toBe(1);
  expect(before.borderColor).toBe('#EAEBEE');
  const jp = tree.root.findAll((n) => n.props?.testID === 'nat-JP')[0];
  await act(async () => { jp.props.onPress(); });
  const after = jpStyle();
  // 선택 = 핀 카드와 동일 색 강조, 메트릭(높이·보더 폭·라운딩) 픽셀 동일
  expect(after.borderColor).toBe('#FF7134');
  expect(String(after.backgroundColor)).toContain('rgba(255,113,52');
  expect(after.minHeight).toBe(before.minHeight);
  expect(after.borderWidth).toBe(before.borderWidth);
  expect(after.borderRadius).toBe(before.borderRadius);
  // 강조 단일성 — 추천 행(US)은 무강조로 전환(#EAEBEE)
  const pin = flat2(tree.root.findAll((n) => n.props?.testID === 'nat-US')[0].props.style);
  expect(pin.borderColor).toBe('#EAEBEE');
});

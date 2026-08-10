/**
 * P-080(KB-261) 온보딩 재구조 잠금:
 *  - ① 약관 게이트: 필수 3항목 미동의 시 계속 불가(off) · 전체 동의 시 진행 가능
 *  - ③ 마크 데모: 탭 순환 safe→caution→danger→unable→safe (RiskMark 재사용)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

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

it('P-130: 4스텝 순서 — 약관→국적→회피→맵기(마지막 CTA=시작하기)', async () => {
  mockDraft = null;
  const tree = await render();
  const agreeAll = tree.root.findAll(
    (n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'onboarding.agreeAll').length > 0,
  );
  await act(async () => { agreeAll[0].props.onPress(); });
  await act(async () => { continueBtn(tree).props.onPress(); }); // → 국적
  expect(textNodes(tree, 'onboarding.nationalityTitle').length).toBeGreaterThanOrEqual(1);
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

/* ---- P-133: 국적 화면 시안 정합 ---- */
it('P-133: 행 62 고정·핀 카드 70·검색 시 핀 숨김·모국어=영어 생략 규칙', async () => {
  mockDraft = { consented: true, step: 'nationality', nickname: '', nationality: 'US', language: 'en', restrictions: [], spice: 'MEDIUM', updatedAt: '' };
  const tree = await render();
  const { StyleSheet } = require('react-native');
  const flat = (st: unknown) => StyleSheet.flatten(st) as Record<string, unknown>;
  // 핀 카드(감지국 US) — minHeight 70 + 기본 선택(체크 채움)
  const pin = tree.root.findAll((n) => n.props?.testID === 'nat-US')[0];
  expect(flat(pin.props.style).minHeight).toBe(70);
  // 일반 행 — 62 고정
  const jp = tree.root.findAll((n) => n.props?.testID === 'nat-JP')[0];
  expect(flat(jp.props.style).minHeight).toBe(62);
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
  expect(egg.findAll((c) => c.props?.children === 'EG').length).toBeGreaterThanOrEqual(1); // 폴백 약어 2글자
  expect(textNodes(tree, 'onboarding.selectedCount').length).toBeGreaterThanOrEqual(1); // 1개 선택 카운트
  const clear = tree.root.findAll((n) => n.props?.testID === 'avoid-clear')[0];
  await act(async () => { clear.props.onPress(); });
  expect(textNodes(tree, 'onboarding.noneSelectedYet').length).toBeGreaterThanOrEqual(1); // Clear → 0개 안내
});

it('P-134 맵기: 레벨 전환 시 레일 교체 · 👶 배지 NONE/MILD 한정', async () => {
  mockDraft = { consented: true, step: 'spice', nickname: '', nationality: 'US', language: 'en', restrictions: [], spice: 'NONE', updatedAt: '' };
  const tree = await render();
  expect(tree.root.findAll((n) => n.props?.testID === 'rail-246').length).toBeGreaterThanOrEqual(1); // NONE 레일(설렁탕)
  expect(tree.root.findAll((n) => n.props?.testID === 'kid-badge').length).toBeGreaterThanOrEqual(1); // 👶 NONE
  // HOT으로 전환 (슬라이더 릴리즈 스냅 — spiceUnset 하네스 지문)
  const { StyleSheet } = require('react-native');
  const isTrack = (n: { props?: { style?: unknown; onResponderRelease?: unknown } }) =>
    typeof n.props?.onResponderRelease === 'function' &&
    (StyleSheet.flatten(n.props?.style as never) as { height?: number } | undefined)?.height === 84;
  const track = tree.root.findAll(isTrack)[0];
  await act(async () => { track.props.onLayout({ nativeEvent: { layout: { width: 300, height: 44 } } }); });
  await act(async () => { tree.root.findAll(isTrack)[0].props.onResponderRelease({ nativeEvent: { pageX: 225 } }); }); // HOT
  expect(tree.root.findAll((n) => n.props?.testID === 'rail-483').length).toBeGreaterThanOrEqual(1); // HOT 레일(국물떡볶이)
  expect(tree.root.findAll((n) => n.props?.testID === 'kid-badge')).toHaveLength(0); // 배지 소멸
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
  expect(selectedStyle.borderColor).toBe('#E2580C');
  // 타국(JP) 선택 → 색 강조만 소멸(투명 보더 동폭), 메트릭은 픽셀 동일 (P-103)
  const jp = tree.root.findAll((n) => n.props?.testID === 'nat-JP')[0];
  await act(async () => { jp.props.onPress(); });
  const unselectedStyle = flat2(pin().props.style);
  expect(unselectedStyle.borderColor).toBe('transparent'); // 색만 소멸 — 폭은 유지
  expect(String(unselectedStyle.backgroundColor ?? '')).not.toContain('rgba(226,88,12');
  expect(metrics(unselectedStyle)).toEqual(metrics(selectedStyle)); // 8pt 밀림 봉쇄
  expect(unselectedStyle.minHeight).toBe(70);
  expect(unselectedStyle.borderWidth).toBe(1.5);
  // 일반 목록 행(JP — 선택됨)도 메트릭 무변: 선택 강조는 색뿐(natRow 62 고정)
  const jpStyle = flat2(tree.root.findAll((n) => n.props?.testID === 'nat-JP')[0].props.style);
  expect(jpStyle.minHeight).toBe(62);
  expect(jpStyle.borderWidth).toBeUndefined(); // 일반 행 — 선택돼도 보더 미부여
});

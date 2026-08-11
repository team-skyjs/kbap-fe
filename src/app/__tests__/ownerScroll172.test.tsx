/**
 * P-172: 사장님 확인 화면 스크롤 — 긴 나열 질문(P-163 38종 실증)도 끝까지 읽힘.
 * 짧은 질문 = flexGrow 센터 유지 · X/Done 고정(스크롤 밖) · 40자 초과 = 1단계 축소(27 하한).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ id: '7' }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/useBottomInset', () => ({ useBottomInset: () => 0 }));
const mockOwner = jest.fn();
jest.mock('@/lib/data/useOwnerConfirmation', () => ({ useOwnerConfirmation: () => mockOwner() }));

import OwnerConfirm, { isLongQuestion } from '../food/[id]/owner';

const LONG_Q = '김치찌개에 알코올, 미림, 우유, 버터, 계란, 새우, 게, 오징어, 땅콩이 들어가나요?';
const SHORT_Q = '김치찌개에 새우가 들어가나요?';
const DATA = (q: string) => ({ data: { questionKo: q, explanationKo: '저는 이 재료들을 먹지 못해요. 확인 부탁드려요.', menuNameKo: '김치찌개', placeLanguage: 'ko' } });

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<OwnerConfirm />);
  });
  return tree;
}
const { StyleSheet } = require('react-native');

beforeEach(() => {
  jest.clearAllMocks();
  mockOwner.mockReturnValue(DATA(LONG_Q));
});

it('본문 = ScrollView(flexGrow 센터 문법) — 짧은 질문 센터·긴 질문 스크롤 겸용', () => {
  const tree = render();
  const sv = tree.root.findAll((n) => n.props?.testID === 'owner-scroll')[0];
  const cc = StyleSheet.flatten(sv.props.contentContainerStyle) as Record<string, unknown>;
  expect(cc.flexGrow).toBe(1);
  expect(cc.justifyContent).toBe('center');
  expect(cc.paddingTop).toBeGreaterThanOrEqual(54); // X(40) 클리어 — 겹침 봉쇄
});

it('X·Done = 스크롤 밖 고정', () => {
  const tree = render();
  const sv = tree.root.findAll((n) => n.props?.testID === 'owner-scroll')[0];
  const inScroll = JSON.stringify(sv.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children));
  expect(inScroll).not.toContain('owner.done'); // Done은 푸터(고정)
  expect(JSON.stringify(tree.toJSON())).toContain('owner.done'); // 화면엔 존재
});

it('40자 초과 = 폰트 1단계 축소(27/40 — 하한), 짧은 질문 = 34 무변', () => {
  expect(isLongQuestion(LONG_Q)).toBe(true);
  expect(isLongQuestion(SHORT_Q)).toBe(false);
  const long = render();
  const q1 = long.root.findAll((n) => typeof n.props?.style === 'object' && StyleSheet.flatten(n.props.style)?.fontSize === 27);
  expect(q1.length).toBeGreaterThanOrEqual(1);
  mockOwner.mockReturnValue(DATA(SHORT_Q));
  const short = render();
  const q2 = short.root.findAll((n) => typeof n.props?.style === 'object' && StyleSheet.flatten(n.props.style)?.fontSize === 34);
  expect(q2.length).toBeGreaterThanOrEqual(1);
});

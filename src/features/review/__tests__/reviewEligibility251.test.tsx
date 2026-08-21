/**
 * P-251(KB-361 2차): 리뷰 자격 강제 — reviewEligible 게이트·REVIEW-004 분기.
 * 서버 정본(상세 reviewEligible·403 REVIEW-004) — 클라 이력 추정 금지.
 * 게스트 = 가입 게이트 우선(자격 게이트 대상 아님 — 순서 잠금).
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
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate, push: jest.fn(), back: jest.fn() }),
  useSegments: () => [],
  usePathname: () => '/',
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

import { EligibilityGate } from '../EligibilityGate';
import { adaptFoodDetail } from '@/lib/api/foodAdapter';
import type { FoodDetailWire } from '@/lib/api/foodDetailTypes';

const BASE = {
  name: 'Kimchi Stew', koreanName: '김치찌개', imageRef: null, description: 'stew',
  spiciness: 4, bookmarked: false, overallRiskStatus: 'CAUTION', ingredients: [],
} as unknown as FoodDetailWire;

const trees: ReactTestRenderer[] = [];
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });

beforeEach(() => jest.clearAllMocks());

it('어댑터 — reviewEligible boolean만 통과·부재(prod 구응답) = undefined(게이트 없음)', () => {
  expect(adaptFoodDetail({ ...BASE, reviewEligible: true }, '7').reviewEligible).toBe(true);
  expect(adaptFoodDetail({ ...BASE, reviewEligible: false }, '7').reviewEligible).toBe(false);
  expect(adaptFoodDetail({ ...BASE }, '7').reviewEligible).toBeUndefined();
});

it('게이트 시트 — P-245 문구·CTA 재사용(신규 키 0) + 스캔 CTA = navigate(P-246 문법)', () => {
  const onClose = jest.fn();
  const tree = render(<EligibilityGate open onClose={onClose} />);
  const s = JSON.stringify(tree.toJSON());
  expect(s).toContain('community.reviewEligibleNote'); // 새 문구 발명 금지
  expect(s).toContain('community.goScanCta');
  const cta = tree.root.findAll((n) => n.props?.testID === 'review-elig-scan' && typeof n.props?.onPress === 'function')[0];
  act(() => cta.props.onPress());
  expect(onClose).toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith('/scan'); // P-246: push 아님(연타 가드 승계)
});

it('게이트 시트 — open=false = 미렌더(빈 컨테이너 금지)', () => {
  expect(render(<EligibilityGate open={false} onClose={jest.fn()} />).toJSON()).toBeNull();
});

it('배선 소스 잠금 — 상세·목록 CTA 게이트 + 게스트 = 가입 게이트 우선(순서)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  const detail = fs.readFileSync('src/app/food/[id]/index.tsx', 'utf8') as string;
  // 회원 && false만 게이트 — 게스트는 기존 흐름(작성 화면 AuthGateSheet가 먼저)
  expect(detail).toContain('if (!guest && food.reviewEligible === false)');
  expect(detail).toContain('<EligibilityGate');
  const list = fs.readFileSync('src/app/food/[id]/reviews.tsx', 'utf8') as string;
  expect(list).toContain("if (!isGuest && food?.reviewEligible === false)");
  expect(list).toContain('<EligibilityGate');
  // 작성 화면: 게스트 라우트 가드(AuthGateSheet)가 게이트보다 위(이른 return) — 순서 잠금
  const write = fs.readFileSync('src/app/food/[id]/review.tsx', 'utf8') as string;
  expect(write.indexOf('AuthGateSheet')).toBeLessThan(write.indexOf('<EligibilityGate'));
  expect(write).toContain("code === 'REVIEW-004'"); // 제출 403 분기(BE message 미노출)
});

it('P-251 ③ 픽커 정합 확인 — P-245 자격 UX 무변(전체 비활성 + 안내 문법 존치)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const picker = require('fs').readFileSync('src/app/community/compose.tsx', 'utf8') as string;
  expect(picker).toContain('const eligible = isReview && !isGuest;');
  expect(picker).toContain('searchDisabled'); // "전체에서 찾기" 결과 비활성 유지
});

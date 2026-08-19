/**
 * P-202 → P-236(KB-347): 리뷰 확장 별점 **2축**(속도·친절) 서버 배선 —
 * 전송 실측(미평가 0)·서버 프리필·0 비표시·Getting there 잔존 0.
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
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/data/useReviewMutations', () => ({ useToggleReviewLike: () => ({ mutate: jest.fn() }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/api/client', () => ({ api: { get: jest.fn().mockResolvedValue([]) }, apiLang: () => 'en' }));

import { ExtrasRater, ReviewExtrasLine, ReviewEditSheet } from '../ReviewCellParts';
import { buildReviewExtras, extrasFromReview, EMPTY_EXTRAS } from '@/lib/review/reviewExtras';
import type { Review } from '@/lib/api/types';

const t = (k: string) => k;

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const has = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id).length > 0;
const tap = (tree: ReactTestRenderer, id: string) =>
  act(() => tree.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress());

const RV = (over: Partial<Review>): Review =>
  ({ id: 'r1', foodId: '7', rating: 4, anonymized: false, createdAt: '2026-08-19', authorNationality: null, authorRankTier: null, ...over }) as Review;

it('P-236: 축 = 속도·친절 2종 — Getting there 행 잔존 0(서버 필드 부재)', () => {
  const tree = render(<ExtrasRater extras={EMPTY_EXTRAS} onChange={jest.fn()} t={t} />);
  expect(has(tree, 'extras-row-speed')).toBe(true);
  expect(has(tree, 'extras-row-service')).toBe(true);
  expect(has(tree, 'extras-row-access')).toBe(false);
});

it('별 탭 = 값 · 같은 값 재탭 = 해제(null) — 2축 시맨틱', () => {
  const onChange = jest.fn();
  const tree = render(<ExtrasRater extras={{ ...EMPTY_EXTRAS, speed: 4 }} onChange={onChange} t={t} />);
  tap(tree, 'extras-speed-2');
  expect(onChange).toHaveBeenCalledWith({ speed: 2, service: null });
  tap(tree, 'extras-speed-4'); // 같은 값 재탭
  expect(onChange).toHaveBeenLastCalledWith({ speed: null, service: null });
});

it('전송 = servingSpeed·staffKindness(미평가 0 — 서버 규약)', () => {
  expect(buildReviewExtras({ speed: 5, service: 4 })).toEqual({ servingSpeed: 5, staffKindness: 4 });
  expect(buildReviewExtras(EMPTY_EXTRAS)).toEqual({ servingSpeed: 0, staffKindness: 0 });
  // 뮤테이션 배선(작성·수정 모두 buildReviewExtras 경유)
  const src = require('fs').readFileSync('src/lib/data/useReviewMutations.ts', 'utf8') as string;
  expect((src.match(/buildReviewExtras\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
});

it('셀 축약 = 서버 값(전 리뷰) — 0 축 비표시·둘 다 0(구 리뷰) = 줄 미렌더', () => {
  // 구 리뷰(0·0) = 미렌더 — 빈 컨테이너 금지
  expect(render(<ReviewExtrasLine review={RV({ servingSpeed: 0, staffKindness: 0 })} mine={false} />).toJSON()).toBeNull();
  // 타인 리뷰도 서버 값이면 표시(로컬 프리뷰 폐기 — mine 제한 소멸)
  const tree = render(<ReviewExtrasLine review={RV({ servingSpeed: 4, staffKindness: 0 })} mine={false} />);
  expect(has(tree, 'extras-line')).toBe(true);
  const s = JSON.stringify(tree.toJSON());
  expect(s).toContain('"4"');
  expect(s).not.toContain('"0"'); // 0(미평가) 축은 그리지 않는다(오독 방지)
});

it('수정 시트 — 서버 값 프리필 + 저장 페이로드에 extras 포함', () => {
  const onSave = jest.fn();
  const review = RV({ body: 'b', servingSpeed: 3, staffKindness: 5 });
  const tree = render(<ReviewEditSheet review={review} onClose={jest.fn()} onSave={onSave} t={t} />);
  // 프리필 확인 — speed 3·service 5 (extrasFromReview 경유)
  expect(extrasFromReview(review)).toEqual({ speed: 3, service: 5 });
  tap(tree, 'extras-service-2'); // 친절 5 → 2 수정
  tap(tree, 'edit-save');
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ extras: { speed: 3, service: 2 } }));
});

it('extrasFromReview — 0 = 미평가 = null(프리필·표시 공용 변환)', () => {
  expect(extrasFromReview({ servingSpeed: 0, staffKindness: 0 })).toEqual({ speed: null, service: null });
  expect(extrasFromReview({})).toEqual({ speed: null, service: null });
});

it('플래그·잔존 소스 잠금 — access·로컬 프리뷰 전면 소멸', () => {
  const fs = require('fs');
  expect(fs.readFileSync('src/lib/flags.ts', 'utf8')).toContain('reviewExtrasEnabled: !PROD_CHANNEL');
  const parts = fs.readFileSync('src/features/review/ReviewCellParts.tsx', 'utf8') as string;
  expect(parts).toContain('if (!FLAGS.reviewExtrasEnabled) return null;');
  expect(parts).not.toContain("'access'"); // Getting there 잔존 0
  const extras = fs.readFileSync('src/lib/review/reviewExtras.ts', 'utf8') as string;
  expect(extras).not.toContain('access');
  expect(extras).not.toContain('localExtras'); // 로컬 임시 저장 전면 폐기(서버 정본)
  // 작성 화면 = 로컬 저장 잔존 0 + 전송 배선
  const compose = fs.readFileSync('src/app/food/[id]/review.tsx', 'utf8') as string;
  expect(compose).not.toContain('saveLocalExtras');
  expect(compose).toContain('extras, // P-236');
});

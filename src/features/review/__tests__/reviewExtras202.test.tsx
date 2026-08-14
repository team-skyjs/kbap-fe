/**
 * P-202: 리뷰 확장 별점 3축 — 섹션 조건 노출(장소 태그 연동)·재탭 해제·
 * 전송 0(계약 전 no-op)·로컬 프리뷰·플래그 분기.
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
import { buildReviewExtras, saveLocalExtras, getLocalExtras, _clearLocalExtrasForTest, EMPTY_EXTRAS } from '@/lib/review/reviewExtras';
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

beforeEach(() => _clearLocalExtrasForTest());

it('섹션 조건 노출 — Speed·Service 항상, 찾아가기 = 장소 태그 있을 때만', () => {
  const noPlace = render(<ExtrasRater extras={EMPTY_EXTRAS} onChange={jest.fn()} hasPlace={false} t={t} />);
  expect(has(noPlace, 'extras-row-speed')).toBe(true);
  expect(has(noPlace, 'extras-row-service')).toBe(true);
  expect(has(noPlace, 'extras-row-access')).toBe(false);
  const withPlace = render(<ExtrasRater extras={EMPTY_EXTRAS} onChange={jest.fn()} hasPlace t={t} />);
  expect(has(withPlace, 'extras-row-access')).toBe(true);
});

it('별 탭 = 값 · 같은 값 재탭 = 해제(null)', () => {
  const onChange = jest.fn();
  const tree = render(<ExtrasRater extras={{ ...EMPTY_EXTRAS, speed: 4 }} onChange={onChange} hasPlace={false} t={t} />);
  tap(tree, 'extras-speed-2');
  expect(onChange).toHaveBeenCalledWith({ speed: 2, service: null, access: null });
  tap(tree, 'extras-speed-4'); // 같은 값 재탭
  expect(onChange).toHaveBeenLastCalledWith({ speed: null, service: null, access: null });
});

it('전송 격리 — buildReviewExtras = no-op(null, 계약 전 전송 필드 0)', () => {
  expect(buildReviewExtras({ speed: 5, service: 4, access: 3 })).toBeNull();
  // 뮤테이션에 확장 필드 배선 부재(소스 잠금 — 계약 발주에서 어댑터만 배선)
  const src = require('fs').readFileSync('src/lib/data/useReviewMutations.ts', 'utf8') as string;
  expect(src).not.toMatch(/speedRating|serviceRating|accessRating/);
});

it('셀 축약 — 본인+로컬 값 있는 축만 렌더 · 타인/값 없음 = 미렌더', () => {
  const rv = { id: 'r1', foodId: '7', rating: 4, anonymized: false, createdAt: '2026-08-14', authorNationality: null, authorRankTier: null } as Review;
  expect(render(<ReviewExtrasLine review={rv} mine />).toJSON()).toBeNull(); // 값 없음
  saveLocalExtras('7', { speed: 4, service: null, access: 2 });
  const mineTree = render(<ReviewExtrasLine review={rv} mine />);
  expect(has(mineTree, 'extras-line')).toBe(true);
  const texts = JSON.stringify(mineTree.toJSON());
  expect(texts).toContain('"4"');
  expect(texts).toContain('"2"'); // 값 있는 축만(2개)
  expect(render(<ReviewExtrasLine review={rv} mine={false} />).toJSON()).toBeNull(); // 타인 = 로컬 미표시
});

it('수정 시트 — 로컬 프리필·장소 해제 시 찾아가기 행/값 소거·저장 = 로컬 갱신', () => {
  saveLocalExtras('7', { speed: null, service: null, access: 3 });
  const review = {
    id: 'r1', foodId: '7', rating: 4, body: 'b', anonymized: false, createdAt: '2026-08-14',
    authorNationality: null, authorRankTier: null,
    place: { name: '강남 김밥', roadAddress: '강남대로 1', latitude: 37.49, longitude: 127.02 },
  } as Review;
  const tree = render(<ReviewEditSheet review={review} onClose={jest.fn()} onSave={jest.fn()} t={t} />);
  expect(has(tree, 'extras-row-access')).toBe(true); // 장소 있음 = 행 노출(값 3 프리필)
  tap(tree, 'edit-place-clear'); // 장소 해제
  expect(has(tree, 'extras-row-access')).toBe(false); // 행 소거
  tap(tree, 'edit-save');
  expect(getLocalExtras('7')).toBeNull(); // access 값도 소거 → 전부 null = 로컬 제거
});

it('플래그 분기 — dev 계열만(소스 잠금) + 게이트는 파츠 한 곳', () => {
  const fs = require('fs');
  expect(fs.readFileSync('src/lib/flags.ts', 'utf8')).toContain('reviewExtrasEnabled: !PROD_CHANNEL');
  const parts = fs.readFileSync('src/features/review/ReviewCellParts.tsx', 'utf8') as string;
  expect(parts).toContain('if (!FLAGS.reviewExtrasEnabled) return null;'); // ExtrasRater 게이트
  expect(parts).toContain('if (!FLAGS.reviewExtrasEnabled || !mine) return null;'); // 셀 축약 게이트
});

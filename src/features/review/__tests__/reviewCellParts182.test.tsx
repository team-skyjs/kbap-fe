/**
 * P-182: 리뷰 2depth 셀 파츠 — 펼침/접기·사진 뷰어·수정 시트 + 디테일 라우트 소멸 잠금.
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
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));

import { ExpandableBody, ReviewEditSheet, ReviewPhotoStrip } from '../ReviewCellParts';
import type { Review } from '@/lib/api/types';

const t = (k: string) => k;

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const flat = (t2: ReactTestRenderer) => JSON.stringify(t2.toJSON());

it('디테일 라우트 소멸 — review/[id] 파일 부재(2depth 전환)', () => {
  expect(require('fs').existsSync('src/app/review/[id].tsx')).toBe(false);
});

it('ExpandableBody — 3줄 도달 시 See more, 탭 = 전문 펼침(See less), 재탭 = 접기', () => {
  const tree = render(<ExpandableBody body="long text" t={t} />);
  expect(flat(tree)).not.toContain('reviews.seeMore'); // 클램프 감지 전 토글 없음
  const text = tree.root.findAll((n) => typeof n.props?.onTextLayout === 'function')[0];
  act(() => text.props.onTextLayout({ nativeEvent: { lines: [{}, {}, {}] } })); // 3줄
  expect(flat(tree)).toContain('reviews.seeMore');
  const toggle = tree.root.findAll((n) => n.props?.testID === 'body-toggle')[0];
  act(() => toggle.props.onPress());
  expect(flat(tree)).toContain('reviews.seeLess'); // 펼침 상태
  act(() => tree.root.findAll((n) => n.props?.testID === 'body-toggle')[0].props.onPress());
  expect(flat(tree)).toContain('reviews.seeMore'); // 다시 접힘
});

it('ReviewPhotoStrip — 사진 탭 = 풀스크린 뷰어, X = 닫기, 0장 = 미렌더', () => {
  const none = render(<ReviewPhotoStrip photos={[]} />);
  expect(none.toJSON()).toBeNull();
  const tree = render(<ReviewPhotoStrip photos={['https://cdn/a.jpg', 'https://cdn/b.jpg']} />);
  expect(tree.root.findAll((n) => n.props?.testID === 'photo-viewer').length).toBe(0);
  act(() => tree.root.findAll((n) => n.props?.testID === 'photo-1')[0].props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'photo-viewer').length).toBeGreaterThanOrEqual(1);
  act(() => tree.root.findAll((n) => n.props?.testID === 'viewer-close')[0].props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'photo-viewer').length).toBe(0);
});

it('ReviewEditSheet — 기존 값 프리필·저장 콜백에 변경값 전달(구 디테일 editing 대체)', () => {
  const onSave = jest.fn();
  const review = { id: 'r1', foodId: '7', rating: 4, body: 'old body', authorNationality: null, authorRankTier: null, anonymized: false, createdAt: '2026-08-12' } as Review;
  const tree = render(<ReviewEditSheet review={review} onClose={jest.fn()} onSave={onSave} t={t} />);
  expect(tree.root.findAll((n) => n.props?.testID === 'review-edit-sheet').length).toBeGreaterThanOrEqual(1);
  act(() => tree.root.findAll((n) => n.props?.testID === 'edit-star-5')[0].props.onPress());
  const save = tree.root.findAll((n) => n.props?.testID === 'edit-save' && typeof n.props?.onPress === 'function')[0];
  act(() => save.props.onPress());
  expect(onSave).toHaveBeenCalledWith({ rating: 5, body: 'old body' });
});

/**
 * KB-709(P-449 ③) — QA 자동화용 testID(화면 변화 없음). QA는 좌표 대신 이 ID로 누른다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'fs';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

// eslint-disable-next-line import/first -- jest.mock 선언 뒤(팩토리 호이스팅) — 레포 관례
import { ActionSheet } from '../ActionSheet';

it('ActionSheet testID — 시트 = testID · 행 = `${testID}-${key}` (생략 시 행 ID 없음)', () => {
  const items = ['popular', 'new', 'rating'].map((key) => ({ key, label: key, onPress: jest.fn() }));
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<ActionSheet open title="Sort" items={items} onClose={jest.fn()} testID="food-sort-sheet" />); });
  const ids = (p: (id: string) => boolean) => t.root.findAll((n) => typeof n.props?.testID === 'string' && typeof n.props?.onPress === 'function' && p(n.props.testID)).map((n) => n.props.testID as string);
  expect(new Set(ids((id) => id.startsWith('food-sort-sheet-')))).toEqual(new Set(['food-sort-sheet-popular', 'food-sort-sheet-new', 'food-sort-sheet-rating']));
  // 행 누름 = 그 항목
  act(() => t.root.findAll((n) => n.props?.testID === 'food-sort-sheet-rating' && typeof n.props?.onPress === 'function')[0].props.onPress());
  expect(items[2].onPress).toHaveBeenCalledTimes(1);
  act(() => { t.update(<ActionSheet open title="Sort" items={items} onClose={jest.fn()} />); });
  expect(ids((id) => id.includes('-popular'))).toEqual([]);
});

describe('화면별 testID 존재(소스 잠금)', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  it.each([
    ['src/features/food/FoodExplorer.tsx', ['testID="food-sort-sheet"']],
    ['src/app/food/[id]/reviews.tsx', ['testID="reviews-sort-sheet"', 'testID={`review-item-${review.id}`}', 'testID="reviews-load-more"']],
    ['src/features/community/ReviewFeed.tsx', ['testID="feed-sort-sheet"']],
    ['src/app/food/[id]/owner.tsx', ['testID="owner-done"']],
    ['src/app/delete-account.tsx', ['testID="delete-agree"', 'testID="delete-cancel"', 'testID="delete-confirm"']],
  ])('%s', (file, needles) => {
    const src = read(file);
    for (const n of needles) expect({ file, n, has: src.includes(n) }).toEqual({ file, n, has: true });
  });
  it('프로필 메뉴 행 전부 — MenuRow 사용처마다 testID(profile-menu-*) · 새 행이 생기면 여기서 깨진다', () => {
    const src = read('src/app/(tabs)/profile.tsx');
    const uses = src.match(/<MenuRow\b[\s\S]*?\/>/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(14);
    for (const u of uses) expect({ row: u.slice(0, 60), id: /testID="profile-menu-[a-z-]+"/.test(u) }).toEqual({ row: u.slice(0, 60), id: true });
    for (const id of ['language', 'feedback', 'safety', 'my-foods', 'saved', 'reviews', 'diet', 'notifications', 'blocked', 'logout', 'delete']) {
      expect(src).toContain(`testID="profile-menu-${id}"`);
    }
  });
});

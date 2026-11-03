/**
 * KB-956(P-572) 음식 탭 Popular = 리뷰 많은 순 — 서버 #521 sort=reviews(GET /foods 3.1+). 라벨 그대로.
 * 게이트 = popularByReviews(P-587부터 전 채널 true — 운영 서버 26.11.2 반영) · off = 기존 기본 정렬(파라미터 없음).
 * 저장 목록(/bookmarks)엔 reviews 정렬이 없어 이름 정렬만 넘긴다.
 */
import * as fs from 'fs';

jest.mock('@/lib/flags', () => ({ FLAGS: { popularByReviews: true } }));

describe('KB-956 Popular 정렬 매핑', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FLAGS } = require('@/lib/flags') as { FLAGS: { popularByReviews: boolean } };
  const { nameSortOf } = jest.requireActual('@/features/food/foodSort') as typeof import('@/features/food/foodSort');
  afterEach(() => { FLAGS.popularByReviews = true; });

  it('플래그 on = Popular → reviews · New → 기본(없음) · 이름 정렬 그대로', () => {
    expect((['popular', 'new', 'name_asc', 'name_desc'] as const).map(nameSortOf)).toEqual(['reviews', undefined, 'name_asc', 'name_desc']);
  });
  it('플래그 off(운영 서버 릴리스 전) = Popular → 기본(파라미터 없음 — 운영 서버 INVALID_REQUEST 회피)', () => {
    FLAGS.popularByReviews = false;
    expect(nameSortOf('popular')).toBeUndefined();
  });
});

describe('KB-956 배선(소스)', () => {
  const read = (p: string) => fs.readFileSync(p, 'utf8');
  it('플래그 = 전 채널 true(P-587) · 저장 목록은 reviews를 넘기지 않음 · 정렬 선요청 목록에 reviews(플래그 on)', () => {
    expect(read('src/lib/flags.ts')).toContain('popularByReviews: true,');
    const fe = read('src/features/food/FoodExplorer.tsx');
    expect(fe).toContain("const bookmarkSort = nameSort === 'reviews' ? undefined : nameSort;");
    expect(fe).toContain('sort: bookmarkSort });');
    expect(read('src/lib/data/useFoods.ts')).toContain("...(FLAGS.popularByReviews ? (['reviews'] as const) : [])");
  });
});

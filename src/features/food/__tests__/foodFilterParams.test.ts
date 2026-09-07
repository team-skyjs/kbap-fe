/** P-317/318 — 홈 See all → 음식 탭 필터 승계 파라미터 순수 유닛. */
import { foodTabHref, parseFoodFilterParams } from '../foodFilterParams';

it('foodTabHref — segment·risk가 쿼리로 직렬화', () => {
  expect(foodTabHref('popular', 'all')).toBe('/food?segment=popular&risk=all');
  expect(foodTabHref('saved', 'danger')).toBe('/food?segment=saved&risk=danger');
});

it('parseFoodFilterParams — 왕복 보존 + 미지/부재 값은 popular·all 강등(딥링크 방어)', () => {
  expect(parseFoodFilterParams({ segment: 'saved', risk: 'caution' })).toEqual({ segment: 'saved', risk: 'caution' });
  expect(parseFoodFilterParams({})).toEqual({ segment: 'popular', risk: 'all' });
  expect(parseFoodFilterParams({ segment: 'hack', risk: 'DROP TABLE' })).toEqual({ segment: 'popular', risk: 'all' });
});

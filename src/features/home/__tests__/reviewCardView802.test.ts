/* eslint-disable import/first -- jest.mock 선언 뒤에 대상 모듈을 import(레포 테스트 관례) */
/**
 * KB-802(R-16) — 리뷰 탭 카드 노출 review_card_view: 홈 KB-784 판정(50%↑ · 스크롤 정지 · 포커스당 1회)을 그대로 쓰고,
 * 키 = 리뷰 id(셀 재사용·순번 변동에도 같은 포커스 안 재전송 없음).
 */
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  EVENTS: { home_section_view: 'home_section_view', home_card_view: 'home_card_view', review_card_view: 'review_card_view' },
  track: (...a: unknown[]) => mockTrack(...a),
}));

import { ImpressionTracker, type Rect } from '../homeImpressions';

const VP = { top: 100, bottom: 700, left: 0, right: 375 };
const node = (r: Rect) => ({ measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(r.x, r.y, r.width, r.height) });
const review = (position: number, reviewId: string, photoCount = 3) => ({ kind: 'review' as const, position, reviewId, photoCount });

beforeEach(() => {
  jest.useFakeTimers();
  mockTrack.mockReset();
});
afterEach(() => jest.useRealTimers());

it('50% 이상 카드만 review_card_view{photo_count,position,review_id} — 50% 미만 미전송', () => {
  const t = new ImpressionTracker(VP);
  t.focus();
  t.register(review(0, '42'), node({ x: 0, y: 110, width: 375, height: 481 }));
  t.register(review(1, '43', 0), node({ x: 0, y: 591, width: 375, height: 236 })); // 109/236 ≈ 46%
  jest.advanceTimersByTime(400);
  expect(mockTrack.mock.calls).toEqual([['review_card_view', { photo_count: 3, position: 0, review_id: '42' }]]);
});

it('스크롤 중 미전송 → 정지 후 측정', () => {
  const t = new ImpressionTracker(VP);
  t.focus();
  t.scrollBegin();
  t.register(review(0, '42'), node({ x: 0, y: 110, width: 375, height: 481 }));
  jest.advanceTimersByTime(1000);
  expect(mockTrack).not.toHaveBeenCalled();
  t.scrollEnd(true);
  jest.advanceTimersByTime(0);
  expect(mockTrack).toHaveBeenCalledTimes(1);
});

it('같은 포커스 안 재등록(셀 재사용·순번 변동) 재전송 없음 · 재포커스(탭 재진입) 후 다시 1회', () => {
  const t = new ImpressionTracker(VP);
  t.focus();
  t.register(review(0, '42'), node({ x: 0, y: 110, width: 375, height: 481 }));
  jest.advanceTimersByTime(400);
  t.register(review(0, '42'), null); // 언마운트
  t.register(review(3, '42'), node({ x: 0, y: 110, width: 375, height: 481 })); // 새로고침으로 순번이 바뀐 같은 리뷰
  jest.advanceTimersByTime(400);
  expect(mockTrack).toHaveBeenCalledTimes(1);
  t.blur();
  t.focus();
  jest.advanceTimersByTime(400);
  expect(mockTrack).toHaveBeenCalledTimes(2);
  expect(mockTrack).toHaveBeenLastCalledWith('review_card_view', { photo_count: 3, position: 3, review_id: '42' });
});

it('홈 카드와 키 공간이 섞이지 않는다(같은 id 문자열이어도 각자 전송)', () => {
  const t = new ImpressionTracker(VP);
  t.focus();
  t.register({ kind: 'card', section: 'popular', position: 0, foodId: '42' }, node({ x: 0, y: 110, width: 100, height: 100 }));
  t.register(review(0, '42'), node({ x: 0, y: 220, width: 375, height: 300 }));
  jest.advanceTimersByTime(400);
  expect(mockTrack.mock.calls.map((c) => c[0])).toEqual(['home_card_view', 'review_card_view']);
});

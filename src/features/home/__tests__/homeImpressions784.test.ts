/* eslint-disable import/first -- jest.mock 선언 뒤에 대상 모듈을 import(레포 테스트 관례) */
/**
 * KB-784 — 홈 노출 판정: 면적 50%↑ · 스크롤 정지 때만 · 홈 진입(포커스)당 같은 대상 1회 · 섹션/카드 이벤트 속성.
 */
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  EVENTS: { home_section_view: 'home_section_view', home_card_view: 'home_card_view', home_card_click: 'home_card_click' },
  track: (...a: unknown[]) => mockTrack(...a),
}));

import { ImpressionTracker, trackHomeCardClick, visibleFraction, VISIBLE_THRESHOLD, type Rect } from '../homeImpressions';

const VP = { top: 100, bottom: 700, left: 0, right: 400 };
const node = (r: Rect) => ({ measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(r.x, r.y, r.width, r.height) });

beforeEach(() => {
  jest.useFakeTimers();
  mockTrack.mockReset();
});
afterEach(() => jest.useRealTimers());

it('visibleFraction — 면적 비율(세로·가로), 경계·0 크기', () => {
  expect(visibleFraction({ x: 0, y: 200, width: 100, height: 100 }, VP)).toBe(1);
  expect(visibleFraction({ x: 0, y: 650, width: 100, height: 100 }, VP)).toBe(0.5); // 아래 탭바에 반 가림
  expect(visibleFraction({ x: 0, y: 50, width: 100, height: 100 }, VP)).toBe(0.5); // 위 헤더에 반 가림
  expect(visibleFraction({ x: 350, y: 200, width: 100, height: 100 }, VP)).toBe(0.5); // 가로 레일 오른쪽 반
  expect(visibleFraction({ x: 0, y: 800, width: 100, height: 100 }, VP)).toBe(0);
  expect(visibleFraction({ x: 0, y: 200, width: 0, height: 100 }, VP)).toBe(0);
  expect(VISIBLE_THRESHOLD).toBe(0.5);
});

it('50% 이상만 · 포커스 뒤 정착 지연 후 1회 측정 · 섹션/카드 속성', () => {
  const t = new ImpressionTracker(VP);
  t.focus();
  t.register({ kind: 'section', section: 'popular' }, node({ x: 0, y: 200, width: 400, height: 300 }));
  t.register({ kind: 'card', section: 'popular', position: 0, foodId: '7' }, node({ x: 20, y: 650, width: 100, height: 100 })); // 정확히 50%
  t.register({ kind: 'card', section: 'popular', position: 3, foodId: '9' }, node({ x: 380, y: 300, width: 100, height: 100 })); // 20%
  expect(mockTrack).not.toHaveBeenCalled();
  jest.advanceTimersByTime(400);
  expect(mockTrack.mock.calls).toEqual([
    ['home_section_view', { section: 'popular' }],
    ['home_card_view', { section: 'popular', position: 0, food_id: '7' }],
  ]);
});

it('스크롤 중엔 판정 0 — 손 뗌 뒤 관성이 이어지면 관성 끝에서만', () => {
  const t = new ImpressionTracker(VP);
  t.focus();
  jest.advanceTimersByTime(400);
  t.scrollBegin();
  t.register({ kind: 'section', section: 'safe' }, node({ x: 0, y: 200, width: 400, height: 200 }));
  jest.advanceTimersByTime(1000);
  expect(mockTrack).not.toHaveBeenCalled(); // 드래그 중
  t.scrollEnd(false); // 손 뗌
  t.scrollBegin(); // 곧바로 관성 시작
  jest.advanceTimersByTime(1000);
  expect(mockTrack).not.toHaveBeenCalled();
  t.scrollEnd(true); // 관성 끝 = 정지
  jest.advanceTimersByTime(0);
  expect(mockTrack).toHaveBeenCalledWith('home_section_view', { section: 'safe' });
});

it('관성 없는 손 뗌 = 짧은 지연 뒤 판정', () => {
  const t = new ImpressionTracker(VP);
  t.focus();
  jest.advanceTimersByTime(400);
  t.scrollBegin();
  t.register({ kind: 'section', section: 'most_reviewed' }, node({ x: 0, y: 200, width: 400, height: 200 }));
  t.scrollEnd(false);
  jest.advanceTimersByTime(200);
  expect(mockTrack).toHaveBeenCalledWith('home_section_view', { section: 'most_reviewed' });
});

it('홈 진입당 1회 — 같은 진입의 재정지·재등록은 재전송 0, 다시 포커스(새 진입)면 다시 1회', () => {
  const t = new ImpressionTracker(VP);
  const n = node({ x: 0, y: 200, width: 400, height: 200 });
  t.focus();
  t.register({ kind: 'section', section: 'recent' }, n);
  jest.advanceTimersByTime(400);
  t.scrollBegin();
  t.scrollEnd(true);
  jest.advanceTimersByTime(0);
  t.register({ kind: 'section', section: 'recent' }, n); // 새로고침 재마운트
  jest.advanceTimersByTime(400);
  expect(mockTrack).toHaveBeenCalledTimes(1);
  t.blur();
  t.focus();
  jest.advanceTimersByTime(400);
  expect(mockTrack).toHaveBeenCalledTimes(2);
});

it('블러(홈을 떠남) 뒤엔 측정 0 · 언마운트(null 등록) 대상은 제외', () => {
  const t = new ImpressionTracker(VP);
  t.focus();
  t.register({ kind: 'section', section: 'reviews' }, node({ x: 0, y: 200, width: 400, height: 200 }));
  t.register({ kind: 'section', section: 'reviews' }, null);
  t.register({ kind: 'section', section: 'guest_cta' }, node({ x: 0, y: 200, width: 400, height: 200 }));
  t.blur();
  jest.advanceTimersByTime(1000);
  expect(mockTrack).not.toHaveBeenCalled();
});

it('PR 280 Codex P2: 비동기 측정 응답 전에 스크롤이 다시 시작되면 그 측정은 버리고, 다음 정지에서 다시', () => {
  const t = new ImpressionTracker(VP);
  let pendingCb: ((x: number, y: number, w: number, h: number) => void) | null = null;
  const asyncNode = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => { pendingCb = cb; } };
  t.focus();
  t.register({ kind: 'section', section: 'popular' }, asyncNode);
  jest.advanceTimersByTime(400); // 측정 요청(응답 대기)
  t.scrollBegin(); // 응답 전에 다시 스크롤
  pendingCb!(0, 200, 400, 200); // 늦은 응답(보이는 위치였더라도)
  expect(mockTrack).not.toHaveBeenCalled();
  t.scrollEnd(true);
  jest.advanceTimersByTime(0);
  pendingCb!(0, 200, 400, 200); // 정지 뒤 새 측정 응답
  expect(mockTrack).toHaveBeenCalledWith('home_section_view', { section: 'popular' });
});

it('KB-786(#280 P2): 빠른 blur→refocus — 이전 방문의 늦은 측정 응답은 새 방문에 기록 0(새 방문 측정은 정상)', () => {
  const t = new ImpressionTracker(VP);
  const cbs: ((x: number, y: number, w: number, h: number) => void)[] = [];
  const asyncNode = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => { cbs.push(cb); } };
  t.focus();
  t.register({ kind: 'section', section: 'recent' }, asyncNode);
  jest.advanceTimersByTime(400); // 방문 1 측정 요청
  t.blur();
  t.focus(); // 방문 2
  cbs[0](0, 200, 400, 200); // 방문 1의 늦은 응답
  expect(mockTrack).not.toHaveBeenCalled();
  jest.advanceTimersByTime(400); // 방문 2 측정
  cbs[1](0, 200, 400, 200);
  expect(mockTrack).toHaveBeenCalledTimes(1);
});

it('카드 클릭 = home_card_click {section, position, food_id}', () => {
  trackHomeCardClick('most_reviewed', 2, '41');
  expect(mockTrack).toHaveBeenCalledWith('home_card_click', { section: 'most_reviewed', position: 2, food_id: '41' });
});

describe('배선 잠금(소스) — 홈 섹션 7종·카드 클릭·스크롤 정지·하트', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const read = (p: string) => (require('fs') as typeof import('fs')).readFileSync(p, 'utf8') as string;
  const home = read('src/app/(tabs)/index.tsx');
  const fx = read('src/features/food/FoodExplorer.tsx');
  it('홈: 포커스 리셋·컨텍스트·세로 정지 props · recent/guest_cta/reviews 섹션 · recent/reviews 카드 클릭', () => {
    for (const s of ["impressions.focus();", "impressions.blur()", '<HomeImpressionContext.Provider value={impressions}>', '{...listScrollProps}', "useImpressionRef('recent')", "useImpressionRef('guest_cta')", "useImpressionRef('reviews')", "trackHomeCardClick('recent', position", "trackHomeCardClick('reviews', index, rv.foodId)"]) {
      expect({ s, has: home.includes(s) }).toEqual({ s, has: true });
    }
  });
  it('FoodExplorer: 레일(탭 = 섹션)·safe·most_reviewed 섹션 · 카드 위치 · 가로 정지 props · 홈 카드 하트 = food_bookmark_toggle(기존 이름·속성)', () => {
    for (const s of ["useImpressionRef(variant === 'embedded' ? gridTab : null)", "'safe', safePicks.indexOf(item)", "'most_reviewed', mostReviewed.indexOf(item)", 'card(item, { width: cardW }, gridTab, i)', '{...railScrollProps}', 'track(EVENTS.food_bookmark_toggle, { on: !isSaved(f) });', 'trackHomeCardClick(section, position, rest.food.foodId)']) {
      expect({ s, has: fx.includes(s) }).toEqual({ s, has: true });
    }
  });
});

/**
 * homeImpressions (KB-784) — 홈 섹션·카드 노출 계측(home_section_view · home_card_view)과 카드 클릭(home_card_click).
 *
 * 노출 판정(예진 10/14):
 *  - 화면(뷰포트)에 **면적 50% 이상** 보일 것 — 뷰포트 = 창에서 위 스티키 헤더 높이·아래 탭바를 뺀 영역(visibleFraction).
 *  - **스크롤이 멈췄을 때만** 판정 — 세로 홈 목록·가로 레일 둘 다 스크롤 시작에 판정 중지, 관성 끝(또는 관성 없는 손 뗌)에 측정.
 *    첫 진입·데이터 도착(등록)은 짧은 지연 뒤 1회 측정.
 *  - **홈 진입(포커스)당 같은 대상 1회** — 포커스마다 본 목록을 비운다. 같은 진입 안에서 새로고침·레일 탭 왕복은 다시 보내지 않는다.
 *  - 측정 = measureInWindow(정지 시점만 — 스크롤 중 비용 0). JS 스크롤 콜백(onMomentumScrollEnd 등)만 쓰고 reanimated onScroll 워클릿은 건드리지 않는다.
 * 섹션 키 = popular|saved|food(레일 탭) · safe · most_reviewed · recent · top_rated(KB-800 — 구 reviews 피드 대체) · guest_cta · curation · idol_pick(KB-836 배너). 카드 food_id = 카탈로그 id(PII 아님).
 */
import * as React from 'react';
import type { View } from 'react-native';
import { EVENTS, track } from '@/lib/analytics';

export type HomeSection = 'popular' | 'saved' | 'food' | 'safe' | 'most_reviewed' | 'recent' | 'top_rated' | 'guest_cta' | 'curation' | 'idol_pick'; // KB-796 curation = 큐레이션 배너 · KB-836 idol_pick = K-POP & K-FOOD 배너
export type Rect = { x: number; y: number; width: number; height: number };
export type Viewport = { top: number; bottom: number; left: number; right: number };

/** 사각형이 뷰포트 안에 보이는 면적 비율(0~1). 크기 0 = 0 */
export function visibleFraction(r: Rect, v: Viewport): number {
  if (r.width <= 0 || r.height <= 0) return 0;
  const w = Math.max(0, Math.min(r.x + r.width, v.right) - Math.max(r.x, v.left));
  const h = Math.max(0, Math.min(r.y + r.height, v.bottom) - Math.max(r.y, v.top));
  return (w * h) / (r.width * r.height);
}

export const VISIBLE_THRESHOLD = 0.5;
const SETTLE_MS = 350; // 등록·포커스 뒤 첫 측정 지연(레이아웃 정착)
const DRAG_END_MS = 120; // 손 뗌 뒤 관성 시작 여부를 기다리는 창

type Target = { kind: 'section'; section: HomeSection } | { kind: 'card'; section: HomeSection; position: number; foodId: string };
type Measurable = Pick<View, 'measureInWindow'>;

const keyOf = (t: Target) => (t.kind === 'section' ? `s:${t.section}` : `c:${t.section}:${t.position}:${t.foodId}`);

/** 순수 상태기 — 테스트가 측정·타이머를 직접 몰 수 있게 RN·React 밖에 둔다 */
export class ImpressionTracker {
  private nodes = new Map<string, { node: Measurable; target: Target }>();
  private seen = new Set<string>();
  private scrolling = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  /** KB-786(#280 Codex P2): 방문 세대 — 빠른 blur→refocus 때 이전 방문의 늦은 측정 응답이 새 방문의 seen을 채우지 않게 */
  private visit = 0;
  constructor(private viewport: Viewport) {}

  /** 창 크기·헤더·탭바가 바뀌면 화면이 effect에서 갱신(렌더 중 ref 읽기 없이) */
  setViewport(v: Viewport): void {
    this.viewport = v;
  }

  /** 포커스 = 새 홈 진입: 본 목록 비우고 정착 뒤 측정 */
  focus(): void {
    this.visit += 1;
    this.active = true;
    this.seen.clear();
    this.scrolling = 0;
    this.schedule(SETTLE_MS);
  }
  blur(): void {
    this.active = false;
    this.clearTimer();
  }
  register(target: Target, node: Measurable | null): void {
    const k = keyOf(target);
    if (!node) {
      this.nodes.delete(k);
      return;
    }
    this.nodes.set(k, { node, target });
    if (!this.scrolling) this.schedule(SETTLE_MS);
  }
  scrollBegin(): void {
    this.scrolling += 1;
    this.clearTimer();
  }
  /** momentum=true: 관성 끝(확정 정지) · false: 손 뗌(관성이 이어질 수 있어 짧게 기다림) */
  scrollEnd(momentum: boolean): void {
    this.scrolling = Math.max(0, this.scrolling - 1);
    if (!this.scrolling) this.schedule(momentum ? 0 : DRAG_END_MS);
  }
  /** 지금 등록된 대상 중 안 본 것만 측정 → 50%↑면 1회 전송 */
  measureNow(): void {
    if (!this.active || this.scrolling) return;
    const v = this.viewport;
    const visit = this.visit;
    for (const [k, { node, target }] of this.nodes) {
      if (this.seen.has(k)) continue;
      try {
        node.measureInWindow((x, y, width, height) => {
          // PR 280 Codex P2: 측정은 비동기 — 응답 전에 스크롤이 다시 시작됐으면(정지 아님) 버린다. 다음 정지에서 다시 잰다
          if (!this.active || this.visit !== visit || this.scrolling || this.seen.has(k)) return;
          if (visibleFraction({ x, y, width, height }, v) < VISIBLE_THRESHOLD) return;
          this.seen.add(k);
          if (target.kind === 'section') track(EVENTS.home_section_view, { section: target.section });
          else track(EVENTS.home_card_view, { section: target.section, position: target.position, food_id: target.foodId });
        });
      } catch {
        /* 언마운트 중 측정 — 다음 정지에서 */
      }
    }
  }
  private schedule(ms: number): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.measureNow();
    }, ms);
  }
  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

/** id = 음식 카드는 foodId, 큐레이션 배너(KB-796)는 collectionKey(→ collection_key — food_id에 섞지 않는다).
 *  KB-836: id 없음 = 음식 1개가 아닌 배너(idol_pick) — {section, position}만(가짜 food_id 로 음식별 분석을 오염시키지 않는다). */
export function trackHomeCardClick(section: HomeSection, position: number, id?: string): void {
  if (id == null) track(EVENTS.home_card_click, { section, position });
  else track(EVENTS.home_card_click, section === 'curation' ? { section, position, collection_key: id } : { section, position, food_id: id });
}

/** 홈 밖(음식 탭 등 같은 컴포넌트 재사용)에선 null — 노출 계측 없음 */
export const HomeImpressionContext = React.createContext<ImpressionTracker | null>(null);

/** 섹션·카드 노드 등록용 콜백 ref(원시값 키 — 렌더마다 재등록·측정 타이머 재시작이 없게). tracker 없으면(홈 밖) undefined */
export function useImpressionRef(section: HomeSection | null, position?: number, foodId?: string): ((node: Measurable | null) => void) | undefined {
  const tracker = React.useContext(HomeImpressionContext);
  const cb = React.useCallback(
    (node: Measurable | null) => {
      if (!tracker || !section) return;
      tracker.register(position == null || foodId == null ? { kind: 'section', section } : { kind: 'card', section, position, foodId }, node);
    },
    [tracker, section, position, foodId],
  );
  return tracker && section ? cb : undefined;
}

/** 스크롤 뷰(세로 홈 목록·가로 레일)에 붙이는 정지 감지 props — 홈 밖이면 빈 객체 */
export function useImpressionScrollProps() {
  const tracker = React.useContext(HomeImpressionContext);
  if (!tracker) return {};
  return {
    onScrollBeginDrag: () => tracker.scrollBegin(),
    onScrollEndDrag: () => tracker.scrollEnd(false),
    onMomentumScrollBegin: () => tracker.scrollBegin(),
    onMomentumScrollEnd: () => tracker.scrollEnd(true),
  };
}

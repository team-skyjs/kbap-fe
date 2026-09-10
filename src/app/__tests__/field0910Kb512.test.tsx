/**
 * P-349(KB-512) — 9/10 실기 4건 잠금:
 * ① Star strokeWidth 16/size(vectorEffect 금지 — clipPath 충돌) + fillPct 클립
 * ② PhotoViewer 임계 상수·줌 계약(scale>1 = pager·닫기 pan 비활성)
 * ③ 3탭 RefreshControl + progressViewOffset(스피너가 헤더 아래)
 * ④ Tag a food 시트 — scanned isPending = 스켈레톤(구역·배너는 판정 후)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-svg', () => {
  const R = require('react') as typeof import('react');
  const mk = (name: string) => (props: Record<string, unknown>) => R.createElement(name, props, props.children as never);
  return { __esModule: true, default: mk('Svg'), Svg: mk('Svg'), Path: mk('Path'), Rect: mk('Rect'), Defs: mk('Defs'), ClipPath: mk('ClipPath'), Circle: mk('Circle'), G: mk('G'), Line: mk('Line'), Polyline: mk('Polyline') };
});

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

describe('① 별 채움 회귀', () => {
  it('Star = strokeWidth sw(=16/size) · vectorEffect 부재 · P-375 클립 의존 소멸', () => {
    const st = read('src/components/Stars.tsx');
    expect(st).toContain('const sw = 16 / size;');
    expect((st.match(/strokeWidth=\{sw\}/g) ?? []).length).toBe(2);
    expect(st).not.toContain('vectorEffect=');
    // P-375(KB-539): Android에서 url(#id)가 안 풀려 채움이 통째로 클립됨 → SVG 클립 폐기
    expect(st).not.toContain('ClipPath');
    expect(st).not.toContain('useId');
    expect(st).not.toContain('clipPath=');
    expect(st).toContain("overflow: 'hidden'"); // 부분 채움 = View 오버레이
  });

  it('Star 렌더 — 100%/0% = 단일 Path, size 48 = strokeWidth 1/3', () => {
    const { Star } = require('@/components/Stars') as typeof import('@/components/Stars');
    const render = (props: { size?: number; fillPct?: number }) => {
      let tree!: ReactTestRenderer;
      act(() => { tree = renderer.create(<Star {...props} />); });
      return tree;
    };
    const full = render({ size: 48, fillPct: 100 });
    const fullPaths = full.root.findAll((n) => n.type === 'Path');
    expect(fullPaths).toHaveLength(1); // 채운 별 하나(빈 별 아래 깔지 않음)
    expect(fullPaths[0].props.fill).toBe('#FFED47');
    expect(fullPaths[0].props.strokeWidth).toBeCloseTo(16 / 48);
    const none = render({ size: 48, fillPct: 0 });
    const nonePaths = none.root.findAll((n) => n.type === 'Path');
    expect(nonePaths).toHaveLength(1);
    expect(nonePaths[0].props.fill).toBe('#EAEBEE'); // 빈 별
  });

  it('P-375: 부분 채움 = 오버레이 폭 size×pct% · Path 2개(빈+채움) · Rect/클립 0', () => {
    const { Star } = require('@/components/Stars') as typeof import('@/components/Stars');
    let tree!: ReactTestRenderer;
    act(() => { tree = renderer.create(<Star size={20} fillPct={50} />); });
    expect(tree.root.findAll((n) => n.type === 'Path')).toHaveLength(2);
    expect(tree.root.findAll((n) => n.type === 'Rect')).toHaveLength(0); // 클립 Rect 소멸
    const overlay = tree.root
      .findAll((n) => n.type === 'View' && (n.props?.style as { overflow?: string })?.overflow === 'hidden')[0];
    const st = overlay.props.style as { width: number; height: number; position: string };
    expect(st.width).toBe(10); // 20 × 50%
    expect(st.height).toBe(20);
    expect(st.position).toBe('absolute');
    // 범위 밖 값도 안전하게 클램프(음수·100 초과)
    let over!: ReactTestRenderer;
    act(() => { over = renderer.create(<Star size={20} fillPct={140} />); });
    expect(over.root.findAll((n) => n.type === 'Path')).toHaveLength(1);
  });
});

describe('② PhotoViewer 줌 계약', () => {
  const pv = read('src/components/PhotoViewer.tsx');
  it('닫기 pan 임계 — activeOffsetY ±16 · failOffsetX ±40(아래 스와이프 가로 드리프트 허용)', () => {
    expect(pv).toContain('export const VIEWER_PAN_ACTIVE_Y = 16;');
    expect(pv).toContain('export const VIEWER_PAN_FAIL_X = 40;');
    expect(pv).toContain('.activeOffsetY([-VIEWER_PAN_ACTIVE_Y, VIEWER_PAN_ACTIVE_Y])');
    expect(pv).toContain('.failOffsetX([-VIEWER_PAN_FAIL_X, VIEWER_PAN_FAIL_X])');
    // 닫기 판정은 위·아래 대칭(abs) 현행
    expect(pv).toContain('Math.abs(e.translationY) > VIEWER_DISMISS_DY || Math.abs(e.velocityY) > VIEWER_DISMISS_VY');
  });

  it('줌 — scale 1~4·더블탭 2배·scale>1이면 pager scrollEnabled=false + 닫기 pan enabled(!zoomed), 페이지 전환 리셋', () => {
    expect(pv).toContain('export const VIEWER_MAX_SCALE = 4;');
    expect(pv).toContain('export const VIEWER_DOUBLE_TAP_SCALE = 2;');
    expect(pv).toContain('scrollEnabled={!zoomed}');
    expect(pv).toMatch(/const closePan = Gesture\.Pan\(\)\s*\n\s*\.enabled\(!zoomed\)/);
    expect(pv).toMatch(/const zoomPan = Gesture\.Pan\(\)\s*\n\s*\.enabled\(zoomed\)/);
    expect(pv).toContain('Gesture.Exclusive(Gesture.Simultaneous(pinch, zoomPan), doubleTap, closePan)');
    expect(pv).toContain('resetZoom(false); // 페이지 전환 = 줌 리셋');
  });
});

describe('③ 당겨서 새로고침 3탭', () => {
  it('홈 — RefreshControl + progressViewOffset=headerH + 키 접두 3종 무효화', () => {
    const home = read('src/app/(tabs)/index.tsx');
    expect(home).toContain('refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink3} progressViewOffset={headerH} />}');
    for (const key of ["['home']", "['foods']", "['bookmarks']", "['reviews', 'global']"]) {
      expect(home).toContain(`queryClient.invalidateQueries({ queryKey: ${key} })`);
    }
  });

  it('음식 탭 — RefreshControl + progressViewOffset=topPad + savedOnly면 bookmarks 동반', () => {
    const fe = read('src/features/food/FoodExplorer.tsx');
    expect(fe).toContain('refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink3} progressViewOffset={topPad} />}');
    expect(fe).toContain("? [saved.refetch()] // 5R ②: 같은 키 두 관찰자 — refetch 1회"); // #112 3R ②→5R ②: 활성 쿼리만
  });

  it('리뷰 탭 — 기존 RefreshControl에 progressViewOffset=headerH(스피너가 헤더 뒤에 숨던 실기)', () => {
    const rf = read('src/features/community/ReviewFeed.tsx');
    expect(rf).toContain('refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink3} progressViewOffset={headerH} />}');
  });
});

describe('④ Tag a food 시트 첫 렌더', () => {
  const cp = read('src/app/community/compose.tsx');
  it('scanned isPending = 스켈레톤 행(원 48 + 바 2줄) — 구역 헤더·배너·목록 미렌더 게이트', () => {
    expect(cp).toContain("const scanPending = kind === 'food' && useScanScope && scanned.isPending;");
    expect(cp).toContain('testID="picker-skeleton"');
    expect(cp).toContain("skelThumb: { width: 48, height: 48, borderRadius: 24 }");
    // 구역 분기·본문 목록·자격 블록 전부 scanPending 게이트 뒤
    expect(cp).toContain('{!(scanPending && isBrowse) && isBrowse && (kind !== ');
    expect(cp).toContain("{!(scanPending && isBrowse) && (kind === 'food'");
    expect(cp).toContain("{!scanPending && kind === 'food' && isBrowse && eligible && (");
  });

  it('판정 후 분기 현행 — 0건 = 안내+CTA(eligNote 메인), n건 = RECENTLY SCANNED 헤더', () => {
    // 소스 구조 잠금: eligNote(배너)는 eligible 블록 안·스켈레톤 게이트 뒤에만
    expect(cp).toContain("t(kind === 'food' ? (eligible || reviewInitial ? 'community.sectionRecentlyScanned' : 'community.sectionPopular') : 'community.sectionRecent')");
    expect(cp).toContain("<Text style={styles.eligNoteText}>{t('community.reviewEligibleNote')}</Text>");
  });
});

describe('P-351(KB-513) 소형 2건', () => {
  it('① 프로필 Show all — 0건 = showAllEmpty 라벨 + 꺾쇠, 1건 이상 = 카운트 라벨·꺾쇠 없음(시안 A-PF-09)', () => {
    const pf = read('src/app/(tabs)/profile.tsx');
    expect(pf).toContain("? t('profile.showAll', { count: me.restrictions.length })");
    expect(pf).toContain(": t('profile.showAllEmpty')}");
    expect(pf).toContain('iconEnd={me.restrictions.length === 0 ? <IconChevron size={16} color={C.ink3} /> : undefined}');
    for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
      expect(read(`src/lib/i18n/${loc}.json`)).toContain('"showAllEmpty"');
    }
  });

  it('② 음식 탭 그리드 — 칩 헤어라인 아래 12 = chipRowScreen marginBottom(#114 P2: contentContainer paddingTop은 헤더째 밀림)', () => {
    const fe = read('src/features/food/FoodExplorer.tsx');
    expect(fe).toContain('contentContainerStyle={{ paddingTop: topPad, paddingBottom: 110 }}');
    expect(fe).toMatch(/chipRowScreen: \{[^}]*marginBottom: 12/);
    expect(fe).toContain('progressViewOffset={topPad}');  });
});

describe('P-352(KB-514) 리뷰 작성 부제·건너뛰기', () => {
  it('① 부제 3케이스 — 0건 = 한글명만 / 한글명 없음 = subtitle만(0건이면 줄 생략) / 5건 = " | " 결합', () => {
    // 렌더 경유 없이 순수 헬퍼 검증(배선은 소스 잠금)
    const { foodSubtitle } = require('@/lib/review/foodSubtitle') as typeof import('@/lib/review/foodSubtitle');
    // #115 P1: 결합형 = review.foodSubtitle 키 경유(구분자·어순 로케일 소유)
    const t = (k: string, o?: Record<string, unknown>) =>
      k === 'review.foodSubtitle' ? `${o?.nameKo} | ${o?.reviews}` : `${o?.count} reviews`;
    expect(foodSubtitle({ name: 'Kimbap', nameKo: '김밥', overall: { count: 0 } }, t)).toBe('김밥');
    expect(foodSubtitle({ name: 'Kimbap', nameKo: null, overall: { count: 5 } }, t)).toBe('5 reviews');
    expect(foodSubtitle({ name: 'Kimbap', nameKo: null, overall: { count: 0 } }, t)).toBeNull(); // 줄 생략
    expect(foodSubtitle({ name: 'Kimbap', nameKo: '김밥', overall: { count: 5 } }, t)).toBe('김밥 | 5 reviews');
    const src = read('src/lib/review/foodSubtitle.ts');
    expect(src).toContain("t('review.foodSubtitle', { nameKo: ko, reviews })");
    for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
      expect((JSON.parse(read(`src/lib/i18n/${loc}.json`)) as { review: { foodSubtitle: string } }).review.foodSubtitle).toBe('{{nameKo}} | {{reviews}}');
    }
    const rv = read('src/app/food/[id]/review.tsx');
    expect(rv).toContain('const sub = foodSubtitle(food, t);'); // 배선 잠금
    expect(rv).not.toContain('`${food.nameKo} `'); // 구 공백 구분 소멸
  });

  it('② placeSkip 10로케일 축약 — " — " 꼬리 부재', () => {
    for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
      const j = JSON.parse(read(`src/lib/i18n/${loc}.json`)) as { review: { placeSkip: string } };
      expect(j.review.placeSkip).not.toContain('—');
    }
    expect(JSON.parse(read('src/lib/i18n/ko.json')).review.placeSkip).toBe('건너뛰기');
    expect(JSON.parse(read('src/lib/i18n/en.json')).review.placeSkip).toBe('Skip this');
  });
});

it('P-368 ②(KB-531): dietGrid = 행 chunk + flex 셀 — 열 수가 폭과 무관하게 4(375pt 접힘 픽스)', () => {
  const pf = read('src/app/(tabs)/profile.tsx');
  expect(pf).toContain('testID="diet-grid-pad"');
  expect(pf).toContain('Math.ceil(Math.min(me.restrictions.length, 8) / 4)');
  expect(pf).toContain('Array.from({ length: 4 - row.length })'); // 빈 자리 = 빈 flex 셀
  expect(pf).toMatch(/dietRow: \{ flexDirection: 'row', columnGap: 8 \}/);
  expect(pf).toContain("dietTile: { width: '100%', height: 86,");
  expect(pf).not.toContain("flexWrap: 'wrap'"); // 구 wrap 그리드 소멸(스페이서 로직 포함)
  // 7개 = 행2(4+3) → 마지막 행 빈 셀 1
  const rows = (n: number) => Math.ceil(Math.min(n, 8) / 4);
  const padsLast = (n: number) => (rows(n) * 4 - Math.min(n, 8)) % 4;
  expect([rows(7), padsLast(7)]).toEqual([2, 1]);
  expect([rows(5), padsLast(5)]).toEqual([2, 3]);
  expect([rows(8), padsLast(8)]).toEqual([2, 0]);
});

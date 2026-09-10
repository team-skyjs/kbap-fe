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
  it('Star = strokeWidth 16/size 2곳 · vectorEffect 부재 · fillPct 클립 Rect 유지', () => {
    const st = read('src/components/Stars.tsx');
    expect((st.match(/strokeWidth=\{16 \/ size\}/g) ?? []).length).toBe(2);
    expect(st).not.toContain('vectorEffect=');
    expect(st).toContain('width={(16 * fillPct) / 100}'); // 부분 채움 클립 폭
  });

  it('Star 렌더 — fillPct 100 = 클립 Rect 폭 16, size 48 = strokeWidth 1/3', () => {
    const { Star } = require('@/components/Stars') as typeof import('@/components/Stars');
    let tree!: ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Star size={48} fillPct={100} />);
    });
    const rect = tree.root.findAll((n) => n.type === 'Rect')[0];
    expect(rect.props.width).toBe(16);
    const paths = tree.root.findAll((n) => n.type === 'Path');
    expect(paths.length).toBe(2);
    for (const path of paths) expect(path.props.strokeWidth).toBeCloseTo(16 / 48);
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

  it('② 음식 탭 그리드 — paddingTop = topPad + 12(progressViewOffset은 topPad 유지)', () => {
    const fe = read('src/features/food/FoodExplorer.tsx');
    expect(fe).toContain('contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 110 }}');
    expect(fe).toContain('progressViewOffset={topPad}');
  });
});

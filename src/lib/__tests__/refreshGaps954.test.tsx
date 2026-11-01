/**
 * KB-954(P-570) — 새로고침 공백·리뷰 후 카드 평점·회피 변경 재조회·탭바 재탭/진입.
 * 회피 변경 reset은 useUpdateMe.test · Reviews 탭바는 reviewFeed179 · Packaged 당김 요청은 processedFood812에서.
 */
import * as fs from 'fs';
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { emitTabPress, topThenRefresh, useTabPress, type TabPressKind } from '../tabPress';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('KB-954 탭바 신호(useTabPress)', () => {
  it('구독한 탭만 · enabled false = 반응 0 · 언마운트 = 해제', () => {
    const got: TabPressKind[] = [];
    function Probe({ on }: { on: boolean }) { useTabPress('community', (k) => got.push(k), on); return null; }
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Probe on={false} />); });
    act(() => emitTabPress('community', 'enter'));
    expect(got).toEqual([]);
    act(() => t.update(<Probe on />));
    act(() => { emitTabPress('index', 'reselect'); emitTabPress('community', 'enter'); emitTabPress('community', 'reselect'); });
    expect(got).toEqual(['enter', 'reselect']);
    act(() => t.unmount());
    act(() => emitTabPress('community', 'reselect'));
    expect(got).toEqual(['enter', 'reselect']);
  });
  it('탭 바가 누를 때마다 신호를 낸다 — 지금 탭 = reselect · 다른 탭 = enter', () => {
    expect(read('src/app/(tabs)/_layout.tsx')).toContain("emitTabPress(name, focused ? 'reselect' : 'enter');");
  });
  it('홈·음식(Dishes·Packaged)·Reviews·Profile 전부 재탭 = 애니메이션 없는 맨 위 → 다음 프레임 새로고침(QA Q-388 ②)', () => {
    expect(read('src/app/(tabs)/index.tsx')).toContain("topThenRefresh(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }), onRefresh)");
    expect(read('src/features/food/FoodExplorer.tsx')).toContain('topThenRefresh(() => gridRef.current?.scrollToOffset({ offset: 0, animated: false }), onRefresh);');
    expect(read('src/features/processedFood/PackagedExplorer.tsx')).toContain('topThenRefresh(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }), pull.onRefresh);');
    expect(read('src/features/community/ReviewFeed.tsx')).toContain("if (kind === 'reselect') { topThenRefresh(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }), onRefresh); return; }");
    expect(read('src/app/(tabs)/profile.tsx')).toContain('topThenRefresh(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), pull.onRefresh);');
    for (const f of ['src/app/(tabs)/profile.tsx', 'src/features/food/FoodExplorer.tsx', 'src/features/processedFood/PackagedExplorer.tsx']) expect(read(f)).not.toMatch(/scroll(To|ToOffset)\(\{[^}]*animated: true \}\);\s*(pull\.)?onRefresh\(\)/);
  });
  it('topThenRefresh = 맨 위 이동이 먼저(동기) · 새로고침은 다음 프레임', () => {
    jest.useFakeTimers();
    const order: string[] = [];
    topThenRefresh(() => order.push('top'), () => order.push('refresh'));
    expect(order).toEqual(['top']);
    jest.runOnlyPendingTimers();
    expect(order).toEqual(['top', 'refresh']);
    jest.useRealTimers();
  });
  it('QA Q-388 ①: 음식 상세 당김 스피너 = 히어로가 상태 표시줄까지 올라가 기본 스피너가 가려짐 → Android offset · iOS 헤더 아래 Spinner', () => {
    const src = read('src/app/food/[id]/index.tsx');
    expect(src).toContain('progressViewOffset={insets.top + 48}');
    expect(src).toContain("{Platform.OS === 'ios' && pull.refreshing && (");
    expect(src).toContain('testID="detail-pull-spinner"');
  });
});

describe('KB-954 무효화 키 잠금', () => {
  it('리뷰 작성·수정·삭제 = 카드 평점 목록 키(foods·bookmarks·processedFoods search)도', () => {
    const src = read('src/lib/data/useReviewMutations.ts');
    for (const k of ["['foods']", "['bookmarks']", "['processedFoods', 'search']"]) expect(src).toContain(`void qc.invalidateQueries({ queryKey: ${k} });`);
  });
  it('홈 새로고침 = + me·알림 수 · Dishes·Reviews 새로고침 = + me', () => {
    const home = read('src/app/(tabs)/index.tsx');
    expect(home).toContain("queryClient.invalidateQueries({ queryKey: ['me'] }),");
    expect(home).toContain('queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),');
    expect(read('src/features/food/FoodExplorer.tsx')).toContain("jobs.push(qc.invalidateQueries({ queryKey: ['me'] }));");
    expect(read('src/features/community/ReviewFeed.tsx')).toContain("void Promise.all([refetchFirstPage(), qc.invalidateQueries({ queryKey: ['me'] })])");
  });
  it('회피 변경·온보딩 = resetPersonalizedQueries(온보딩 clear() 0 — 마운트된 탭 재조회 보장)', () => {
    expect(read('src/lib/data/useMe.ts')).toContain('void resetPersonalizedQueries(qc);');
    const ob = read('src/app/onboarding/index.tsx');
    expect(ob).toContain('void resetPersonalizedQueries(queryClient);');
    expect(ob).not.toContain('queryClient.clear()');
  });
  it('당겨서 새로고침 = 저장 목록(bookmarks)·음식 상세(food id)·가공 상세(detail id + 리뷰)·Profile(me) — 공용 훅은 + me', () => {
    expect(read('src/app/profile/saved.tsx')).toContain("usePullRefresh([['bookmarks']])");
    expect(read('src/app/food/[id]/index.tsx')).toContain("usePullRefresh([['food', id]])");
    expect(read('src/app/processed-foods/[id].tsx')).toContain("usePullRefresh([['processedFoods', 'detail', id], processedReviewsKey(id ?? '')])");
    expect(read('src/app/(tabs)/profile.tsx')).toContain('usePullRefresh([])');
    expect(read('src/lib/data/usePullRefresh.ts')).toContain("[...keys, ['me']].map((queryKey) => qc.invalidateQueries({ queryKey }))");
  });
});

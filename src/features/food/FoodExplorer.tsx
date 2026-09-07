/**
 * FoodExplorer (KB-430 후속 → P-317/318 v2) — 홈·음식 탭 공용 음식 블록.
 * 정본: specs/001-personalized-menu-mvp/home-food-tabs-v2.md — 같은 카드, 다른 배치.
 * - variant 'embedded'(홈, KB-483): 검색+스캔 · 세그먼트 탭 · 위험 칩 · 가로 레일
 *   (상한 10 + See all → 음식 탭 필터 승계) · Safe for you 레일.
 * - variant 'screen'(음식 탭, KB-484): 검색 · **세그먼트 없음** · 칩 줄(위험 4 +
 *   Saved 토글 — 게스트 게이트) + 우측 정렬 드롭다운(인기/NEW=KB-439 전 비활성/가나다) ·
 *   2열 그리드 무한 스크롤, 스켈레톤·에러 블록 소유. 홈 See all 파라미터 초기 적용.
 * 게스트 칩(9/5 발주): 칩 행은 게스트에게도 렌더 — Safe/Avoid/Warning 탭 시
 * AuthGateSheet(저장 게이트와 동일 문맥)로 로그인 유도, 선택은 All 유지.
 * 데이터 훅·북마크 토글·위험 필터 로직 = 홈 구현 이동(무변).
 */
import * as React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, radius } from '@/lib/theme';
import { Chip, IconSearch, IconTabScan, IconChevronDown, IconCheck, Spinner, SkeletonFoodGrid, QueryErrorBlock, ScreenCenterFill } from '@/components';
import { ActionSheet } from '@/components/ActionSheet';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { FoodGridCard } from '@/features/food/FoodCards';
import { foodTabHref, type GridSegment, type RiskChipParam } from '@/features/food/foodFilterParams';
import { railCardW } from '@/features/food/railLayout';
import { SectionHead } from '@/components/SectionHead';
import { FLAGS } from '@/lib/flags';
import { useInfiniteFoods } from '@/lib/data/useFoods';
import { useBookmarks, useToggleBookmark } from '@/lib/data/bookmarks';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import { popularPhotoFoods } from '@/lib/search/discovery';
import type { FoodCard } from '@/lib/api/types';

const INK_TITLE = '#2F3137'; // 시안 gray-900

export type GridTab = 'popular' | 'saved' | 'food';
/** 위험 칩 4종 — All + personalRisk 3상태(라벨은 현 위험 키: Avoid=danger·Warning=caution).
 *  P-318: See all 파라미터(RiskChipParam)와 같은 유니언 — 홈→음식 탭 승계 무변환. */
type RiskChip = RiskChipParam;
const RISK_CHIPS: RiskChip[] = ['all', 'safe', 'danger', 'caution'];

/** P-318 정렬 3종 — new(publishedAt)는 KB-439 배포 전 시트에서 비활성(선택 불가). */
type FoodSort = 'popular' | 'new' | 'alpha';
const FOOD_SORTS: FoodSort[] = ['popular', 'new', 'alpha'];

export const HOME_RAIL_N = 10; // P-317: 홈 레일 최대 10 + See all 카드
// P-319: 카드 폭 174 고정 → 화면 폭 기준 railCardW(2장 + 3번째 peek) — railLayout.ts

export function FoodExplorer({
  variant,
  guest,
  initialTab = 'popular',
  initialRisk,
  initialSaved,
  paramsKey,
  srcTag,
  onScroll,
  topPad = 0,
}: {
  variant: 'embedded' | 'screen';
  /** 홈 = useHome().authenticated 판정 승계 / 음식 탭 = useIsGuest() */
  guest: boolean;
  initialTab?: GridTab;
  /** P-318(screen): 홈 See all 파라미터 초기 적용 — 게스트는 개인화 칩 강등(게이트 정합). */
  initialRisk?: RiskChipParam;
  initialSaved?: boolean;
  /** Codex #81 P1: See all 내비게이션 식별자(t 파라미터) — 같은 값의 재진입도 재동기화. */
  paramsKey?: string;
  /** 상세 진입 src 파라미터 — 홈 'home' / 음식 탭 'list' */
  srcTag: string;
  /** screen 전용 — 화면이 StickyHeader hidden을 소유 */
  onScroll?: React.ComponentProps<typeof Animated.FlatList<FoodCard>>['onScroll'];
  topPad?: number;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  // P-319: 레일 카드 폭 = 화면 폭 기준(2장 + 3번째 peek — 가로 스크롤임을 보이게)
  const cardW = railCardW(useWindowDimensions().width);
  const { data: me } = useMe();
  const hasR = (me?.restrictions.length ?? 0) > 0;

  const browse = useInfiniteFoods();
  const saved = useBookmarks();
  const toggleBookmark = useToggleBookmark();

  const [gridTab, setGridTab] = React.useState<GridTab>(initialTab);
  // P-318: 딥링크 초기값 — 게스트는 개인화 상태 강등(칩 게이트·저장 게이트 우회 방지)
  const [riskChip, setRiskChip] = React.useState<RiskChip>(guest ? 'all' : (initialRisk ?? 'all'));
  const [savedOnly, setSavedOnly] = React.useState(initialSaved === true && !guest);
  const [sort, setSort] = React.useState<FoodSort>('popular');
  const [sortSheet, setSortSheet] = React.useState(false);
  // Codex #80 2R P1: 탭 네비게이터가 음식 탭을 마운트 유지 — 두 번째 See all(파라미터 변경)이
  // useState 초기값에 막히지 않게 파라미터 변경 시 재동기화(P-318: saved 세그먼트 = Saved 칩).
  // 사용자가 화면에서 바꾼 칩은 다음 파라미터 변경 전까지 유지(마운트 시엔 초기값과 동일해 무동작).
  // Codex #80 3R P2: guest는 deps에서 분리(ref) — 세션 상태 전환이 파라미터 재적용으로
  // 사용자 선택을 리셋하지 않게. 게스트 강등은 아래 별도 effect가 개인화 상태만 내린다.
  const guestRef = React.useRef(guest);
  guestRef.current = guest;
  // Codex #81 P1: paramsKey(See all마다 갱신되는 t) 포함 — 같은 segment/risk의 재진입도 발화.
  React.useEffect(() => {
    if (variant !== 'screen') return;
    setSavedOnly(initialSaved === true && !guestRef.current);
    setRiskChip(guestRef.current ? 'all' : (initialRisk ?? 'all'));
  }, [variant, initialSaved, initialRisk, paramsKey]);
  React.useEffect(() => {
    if (!guest) return; // 게스트 전환(만료) = 개인화 필터만 강등 — 그 외 선택 보존
    setSavedOnly(false);
    setRiskChip('all');
  }, [guest]);
  const [gate, setGate] = React.useState(false);
  // P-320(KB-485) 계측 — teamtest 한정 오버레이(원인 확정 후 다음 발주에서 제거)
  const [dbg, setDbg] = React.useState<Record<string, number>>({});
  const measure = (k: string) =>
    FLAGS.layoutDebug
      ? (e: LayoutChangeEvent) => {
          const h = Math.round(e.nativeEvent.layout.height);
          setDbg((d) => (d[k] === h ? d : { ...d, [k]: h }));
        }
      : undefined;

  // Codex #28: 북마크 커서 전 페이지 드레인 — 저장 판정 소스(집합 방식 정본)
  React.useEffect(() => {
    if (saved.hasNextPage && !saved.isFetchingNextPage) void saved.fetchNextPage();
  }, [saved, saved.hasNextPage, saved.isFetchingNextPage]);
  const savedFoods = saved.data ?? [];
  const savedIds = new Set(savedFoods.map((f) => f.foodId));
  const gridSource: FoodCard[] =
    variant === 'screen'
      ? savedOnly ? savedFoods : (browse.data ?? []) // P-318: 세그먼트 소멸 — Saved는 토글 칩
      : gridTab === 'popular' ? popularPhotoFoods(browse.data) : gridTab === 'saved' ? savedFoods : (browse.data ?? []);
  // 칩 = 클라이언트 위험도 필터(personalRisk 결과 기준 — 발주 §1-4)
  const filtered =
    riskChip === 'all' ? gridSource : gridSource.filter((f) => personalRisk(f.risk, hasR) === riskChip);
  // P-318 정렬(클라): 인기 = 현행(목록 응답) 순서 그대로 · 가나다 = 표시명(요청 언어).
  // ponytail: 'new'는 KB-439(publishedAt) 배포 전 시트 비활성 — 정렬 분기는 그때 추가.
  const sorted =
    // Codex #81 P2: 표시명은 reader 언어 산출물 — 콜레이션도 그 로케일로(런타임 기본 금지)
    variant === 'screen' && sort === 'alpha' ? [...filtered].sort((a, b) => a.name.localeCompare(b.name, i18n.language)) : filtered;
  const gridFoods = variant === 'embedded' ? filtered.slice(0, HOME_RAIL_N) : sorted;
  const openFood = (foodId: string) => router.push(`/food/${foodId}?src=${srcTag}` as Href);

  const onBookmark = (f: FoodCard) => {
    if (guest) return setGate(true);
    toggleBookmark.mutate({
      snap: { foodId: f.foodId, name: f.name, nameKo: f.nameKo, risk: f.risk, photoUrl: f.photoUrl },
      add: !savedIds.has(f.foodId),
    });
  };

  // 9/5 발주: 게스트 칩 = 렌더하되 개인화 칩 탭 = 게이트(선택 All 유지)
  const onChip = (c: RiskChip) => {
    if (c !== 'all' && guest) return setGate(true);
    setRiskChip(c);
  };
  // P-318: Saved 토글 칩 — 게스트는 저장 게이트(북마크·개인화 칩과 동일 문맥)
  const onSavedChip = () => {
    if (guest) return setGate(true);
    setSavedOnly((v) => !v);
  };

  const top = (
    <View>
      {/* 검색 행 + 스캔 버튼 (4150:16377 @y100) */}
      <View style={styles.searchRow}>
        <Pressable style={styles.searchBox} onPress={() => router.push('/search' as Href)} testID="home-search">
          <Text style={styles.searchPh} numberOfLines={1}>
            {t('food.searchPlaceholder')}
          </Text>
          <IconSearch size={20} color={C.ink3} />
        </Pressable>
        <Pressable style={styles.scanBtn} onPress={() => router.navigate('/scan')} testID="home-scan">
          <IconTabScan size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* 언더라인 탭 (4123:3884): Popular | Saved | Food — P-318: 홈(embedded) 전용,
          음식 탭은 세그먼트 소멸(v2 정본 — 카탈로그 단일 뷰 + 필터·정렬) */}
      {variant === 'embedded' && (
        <>
          <View style={styles.tabsRow}>
            {(
              [
                ['popular', t('home.popularTitle')],
                ['saved', t('saved.title')],
                ['food', t('food.title')],
              ] as [GridTab, string][]
            ).map(([key, label]) => (
              <Pressable key={key} style={styles.tab} onPress={() => setGridTab(key)} testID={`home-tab-${key}`}>
                <Text style={[styles.tabLabel, gridTab === key && styles.tabLabelOn]} numberOfLines={1}>
                  {label}
                </Text>
                {/* 활성 바 — 프레임 불변(P-151): 비활성도 같은 높이의 투명 바 */}
                <View style={[styles.tabBar, gridTab === key && styles.tabBarOn]} />
              </Pressable>
            ))}
          </View>
          <View style={styles.tabsDivider} />
        </>
      )}

      {/* 위험도 칩 필터 (§1-4) — 9/5: 게스트에게도 렌더(시안 4150:16403), 탭 = 게이트.
          P-318(screen): + Saved 토글 칩 · 우측 정렬 드롭다운 */}
      <View style={styles.chipRow}>
        <View style={styles.chipGroup}>
          {RISK_CHIPS.map((c) => (
            <Chip
              key={c}
              label={c === 'all' ? t('home.filterAll') : t(`risk.${c}`)}
              selected={riskChip === c}
              onPress={() => onChip(c)}
              testID={`home-chip-${c}`}
            />
          ))}
          {variant === 'screen' && (
            <Chip label={t('saved.title')} selected={savedOnly} onPress={onSavedChip} testID="food-chip-saved" />
          )}
        </View>
        {variant === 'screen' && (
          <Pressable style={styles.sortBtn} onPress={() => setSortSheet(true)} testID="food-sort">
            <Text style={styles.sortLabel} numberOfLines={1}>{t(`food.sort_${sort}`)}</Text>
            <IconChevronDown size={16} color="#4B4F58" />
          </Pressable>
        )}
      </View>
    </View>
  );

  const card = (item: FoodCard, cellStyle?: object, onLayout?: (e: LayoutChangeEvent) => void) => (
    <FoodGridCard
      key={item.foodId}
      food={item}
      risk={personalRisk(item.risk, hasR)}
      guest={guest}
      saved={savedIds.has(item.foodId)}
      riskLabel={t(`risk.${personalRisk(item.risk, hasR)}`)}
      onPress={() => openFood(item.foodId)}
      onBookmark={() => onBookmark(item)}
      style={cellStyle}
      onLayout={onLayout}
    />
  );

  if (variant === 'screen') {
    if (browse.isError) {
      return (
        <ScreenCenterFill>
          <QueryErrorBlock error={browse.error} onRetry={() => void browse.refetch()} />
        </ScreenCenterFill>
      );
    }
    return (
      <>
        <Animated.FlatList
          data={gridFoods}
          keyExtractor={(f: FoodCard) => f.foodId}
          numColumns={2}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: topPad, paddingBottom: 110 }}
          columnWrapperStyle={styles.gridRowWrap}
          ListHeaderComponent={top}
          ListEmptyComponent={
            browse.isLoading ? (
              <SkeletonFoodGrid />
            ) : savedOnly ? (
              <Text style={styles.gridEmpty}>{t('saved.emptyBody')}</Text>
            ) : null
          }
          ListFooterComponent={browse.isFetchingNextPage ? <Spinner /> : null}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            // 무한 스크롤(발주 ② — Popular/Saved도 전량: popular 파생·saved 드레인은 browse 확장으로 커버)
            if (browse.hasNextPage && !browse.isFetchingNextPage) void browse.fetchNextPage();
          }}
          renderItem={({ item }) => <View style={styles.gridCell}>{card(item, styles.gridCellCard)}</View>}
          testID="food-explorer-list"
        />
        {/* P-318: 정렬 시트 — 공용 ActionSheet(리뷰 P-237 문법), 현재값 = SVG 체크 */}
        <ActionSheet
          open={sortSheet}
          title={t('reviews.sortTitle')}
          items={FOOD_SORTS.map((v) => ({
            key: v,
            label: t(`food.sort_${v}`),
            icon: v === sort ? <IconCheck size={15} color={C.primary} /> : undefined,
            disabled: v === 'new', // KB-439(publishedAt) 배포 전 비활성 — 배포 시 disabled 해제 + 정렬 분기
            onPress: () => setSort(v),
          }))}
          onClose={() => setSortSheet(false)}
        />
        <AuthGateSheet context="save" open={gate} onClose={() => setGate(false)} />
      </>
    );
  }

  // P-317(KB-483): Safe for you today 레일 — 회원+회피≥1 && Popular·All 상태에서만,
  // 현 목록 데이터에서 personalRisk === safe 5~10개(3개 미만 숨김 — v2 정본).
  const safeRail =
    !guest && hasR && gridTab === 'popular' && riskChip === 'all'
      ? (browse.data ?? []).filter((f) => personalRisk(f.risk, hasR) === 'safe').slice(0, 10)
      : [];

  return (
    <View onLayout={measure('root')}>
      <View onLayout={measure('top')}>{top}</View>
      {/* P-320: horizontal FlatList → 평범한 ScrollView + map — 세로 FlatList 헤더 안
          중첩 VirtualizedList 경로(CellRenderer·spacer 측정) 자체를 제거. 항목 ≤11이라
          가상화 불필요. flexGrow:0 유지(#83 — ScrollView 기본 flexGrow:1 차단). */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rail}
        contentContainerStyle={styles.railContent}
        onLayout={measure('rail')}
        testID="home-rail"
      >
        {gridFoods.map((item, i) => card(item, { width: cardW }, i === 0 ? measure('cell0') : undefined))}
        {gridFoods.length === 0 && gridTab === 'saved' && (
          <Text style={styles.gridEmpty}>{t('saved.emptyBody')}</Text>
        )}
        {gridFoods.length > 0 && (
          <Pressable
            style={[styles.seeAllCard, { width: cardW }]}
            onPress={() => router.push(foodTabHref(gridTab as GridSegment, riskChip as RiskChipParam, Date.now()) as Href)}
            testID="home-rail-see-all"
          >
            <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
          </Pressable>
        )}
      </ScrollView>
      {safeRail.length >= 3 && (
        <>
          <SectionHead label={t('home.safeForYou')} title={t('home.safeForYouSub')} testID="home-safe-rail-head" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.rail}
            contentContainerStyle={styles.railContent}
            onLayout={measure('safeRail')}
            testID="home-safe-rail"
          >
            {safeRail.map((item) => card(item, { width: cardW }))}
          </ScrollView>
        </>
      )}
      {FLAGS.layoutDebug && (
        <Text style={styles.layoutDbg} testID="layout-debug">
          {`root:${dbg.root ?? '-'} top:${dbg.top ?? '-'} rail:${dbg.rail ?? '-'} cell0:${dbg.cell0 ?? '-'} safeRail:${dbg.safeRail ?? '-'}`}
        </Text>
      )}
      <AuthGateSheet context="save" open={gate} onClose={() => setGate(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // 검색 행 (§1-2)
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  searchBox: {
    flex: 1,
    height: 48,
    borderRadius: 4,
    backgroundColor: C.surface2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  searchPh: { flex: 1, fontSize: 15, fontWeight: '400', color: C.ink3, marginRight: 8 },
  scanBtn: { width: 48, height: 48, borderRadius: 8, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },

  // 언더라인 탭 (§1-3)
  tabsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 20, gap: 4 },
  tab: { paddingHorizontal: 8, height: 40, justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  tabLabel: { fontSize: 14, fontWeight: '600', color: C.ink2 },
  tabLabelOn: { color: INK_TITLE },
  tabBar: { alignSelf: 'stretch', height: 2, backgroundColor: 'transparent' },
  tabBarOn: { backgroundColor: INK_TITLE },
  tabsDivider: { height: 0.5, backgroundColor: C.line2 },

  // P-318: 칩 그룹(래핑) + 우측 정렬 버튼 — embedded는 우측 요소 없음(시각 무변)
  chipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 20, paddingVertical: 16 },
  chipGroup: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F2F3F6', borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 8 },
  sortLabel: { fontSize: 14, fontWeight: '700', color: '#4B4F58' },

  // P-317 홈 레일(그리드 카드 동일 비율 — 폭 174 고정, gap 12, 좌우 20)
  // P-319(KB-485) 공백 근본 원인: RN ScrollView 기본 스타일(baseHorizontal)이 flexGrow:1 —
  // 세로 FlatList 헤더(column) 안에서 가로 레일이 잔여 세로 공간을 흡수해 화면 높이만큼
  // 늘어났다(Fabric). 레일 자신은 세로로 자라면 안 되는 요소 — flexGrow:0으로 차단
  // (고정 height 가리기 아님 — 높이는 콘텐츠(카드)가 결정).
  rail: { flexGrow: 0 },
  railContent: { paddingHorizontal: 20, gap: 12 },
  // 폭은 렌더 시 cardW로 주입(P-319) — 비율·모양만 여기서
  seeAllCard: { aspectRatio: 174 / 203, borderRadius: 4, borderWidth: 1, borderColor: C.line2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  seeAllText: { fontSize: 14, fontWeight: '600', color: C.ink2 },
  // P-320 계측 오버레이(teamtest만 렌더 — layoutDebug)
  layoutDbg: { fontSize: 12, color: C.ink3, paddingHorizontal: 20, paddingTop: 8, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  gridEmpty: { fontSize: 14, fontWeight: '400', color: C.ink2, paddingVertical: 24, paddingHorizontal: 20 },

  // 음식 탭(FlatList) 그리드 — 셀이 폭 소유(저장 목록과 같은 문법)
  gridRowWrap: { columnGap: 16, paddingHorizontal: 20 },
  gridCell: { flex: 1, marginBottom: 16 },
  gridCellCard: { width: '100%' },
});

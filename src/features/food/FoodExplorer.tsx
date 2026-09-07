/**
 * FoodExplorer (KB-430 후속, 9/5 예진) — 홈 상단 음식 블록(검색+스캔 · 언더라인 탭
 * Popular|Saved|Food · 위험 칩 · 2열 FoodGridCard 그리드) 공용화.
 * - variant 'embedded'(홈): 4장 제한 + More 버튼, 부모 ScrollView 소속.
 * - variant 'screen'(음식 탭): 자체 FlatList + 무한 스크롤(전량 — Popular/Saved 포함),
 *   스켈레톤·에러 블록 소유.
 * 게스트 칩(9/5 발주): 칩 행은 게스트에게도 렌더 — Safe/Avoid/Warning 탭 시
 * AuthGateSheet(저장 게이트와 동일 문맥)로 로그인 유도, 선택은 All 유지.
 * 데이터 훅·북마크 토글·위험 필터 로직 = 홈 구현 이동(무변).
 */
import * as React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import { Btn, Chip, IconSearch, IconTabScan, Spinner, SkeletonFoodGrid, QueryErrorBlock, ScreenCenterFill } from '@/components';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { FoodGridCard } from '@/features/food/FoodCards';
import { foodTabHref, type GridSegment, type RiskChipParam } from '@/features/food/foodFilterParams';
import { SectionHead } from '@/components/SectionHead';
import { useInfiniteFoods } from '@/lib/data/useFoods';
import { useBookmarks, useToggleBookmark } from '@/lib/data/bookmarks';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import { popularPhotoFoods } from '@/lib/search/discovery';
import type { FoodCard } from '@/lib/api/types';

const INK_TITLE = '#2F3137'; // 시안 gray-900

export type GridTab = 'popular' | 'saved' | 'food';
/** 위험 칩 4종 — All + personalRisk 3상태(라벨은 현 위험 키: Avoid=danger·Warning=caution). */
type RiskChip = 'all' | 'safe' | 'danger' | 'caution';
const RISK_CHIPS: RiskChip[] = ['all', 'safe', 'danger', 'caution'];

export const HOME_RAIL_N = 10; // P-317: 홈 레일 최대 10 + See all 카드
export const RAIL_CARD_W = 174; // 그리드 카드 비율(174×203) 동일

export function FoodExplorer({
  variant,
  guest,
  initialTab = 'popular',
  initialRisk,
  srcTag,
  onScroll,
  topPad = 0,
}: {
  variant: 'embedded' | 'screen';
  /** 홈 = useHome().authenticated 판정 승계 / 음식 탭 = useIsGuest() */
  guest: boolean;
  initialTab?: GridTab;
  /** Codex #80 P1: 홈 See all 파라미터 초기 적용(음식 탭) — 게스트는 개인화 칩 강등(게이트 정합). */
  initialRisk?: RiskChipParam;
  /** 상세 진입 src 파라미터 — 홈 'home' / 음식 탭 'list' */
  srcTag: string;
  /** screen 전용 — 화면이 StickyHeader hidden을 소유 */
  onScroll?: React.ComponentProps<typeof Animated.FlatList<FoodCard>>['onScroll'];
  topPad?: number;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: me } = useMe();
  const hasR = (me?.restrictions.length ?? 0) > 0;

  const browse = useInfiniteFoods();
  const saved = useBookmarks();
  const toggleBookmark = useToggleBookmark();

  const [gridTab, setGridTab] = React.useState<GridTab>(initialTab);
  // Codex #80 P1: 딥링크 초기 칩 — 게스트는 'all' 강등(개인화 칩 게이트 우회 방지)
  const [riskChip, setRiskChip] = React.useState<RiskChip>(guest ? 'all' : (initialRisk ?? 'all'));
  // Codex #80 2R P1: 탭 네비게이터가 음식 탭을 마운트 유지 — 두 번째 See all(파라미터 변경)이
  // useState 초기값에 막히지 않게 파라미터 변경 시 재동기화. 사용자가 화면에서 바꾼
  // 탭/칩은 다음 파라미터 변경 전까지 유지(마운트 시엔 초기값과 동일해 무동작).
  React.useEffect(() => {
    if (variant !== 'screen') return;
    setGridTab(initialTab);
    setRiskChip(guest ? 'all' : (initialRisk ?? 'all'));
  }, [variant, guest, initialTab, initialRisk]);
  const [gate, setGate] = React.useState(false);

  // Codex #28: 북마크 커서 전 페이지 드레인 — 저장 판정 소스(집합 방식 정본)
  React.useEffect(() => {
    if (saved.hasNextPage && !saved.isFetchingNextPage) void saved.fetchNextPage();
  }, [saved, saved.hasNextPage, saved.isFetchingNextPage]);
  const savedFoods = saved.data ?? [];
  const savedIds = new Set(savedFoods.map((f) => f.foodId));
  const gridSource: FoodCard[] =
    gridTab === 'popular' ? popularPhotoFoods(browse.data) : gridTab === 'saved' ? savedFoods : (browse.data ?? []);
  // 칩 = 클라이언트 위험도 필터(personalRisk 결과 기준 — 발주 §1-4)
  const filtered =
    riskChip === 'all' ? gridSource : gridSource.filter((f) => personalRisk(f.risk, hasR) === riskChip);
  const gridFoods = variant === 'embedded' ? filtered.slice(0, HOME_RAIL_N) : filtered;
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

      {/* 언더라인 탭 (4123:3884): Popular | Saved | Food */}
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

      {/* 위험도 칩 필터 (§1-4) — 9/5: 게스트에게도 렌더(시안 4150:16403), 탭 = 게이트 */}
      <View style={styles.chipRow}>
        {RISK_CHIPS.map((c) => (
          <Chip
            key={c}
            label={c === 'all' ? t('home.filterAll') : t(`risk.${c}`)}
            selected={riskChip === c}
            onPress={() => onChip(c)}
            testID={`home-chip-${c}`}
          />
        ))}
      </View>
    </View>
  );

  const card = (item: FoodCard, cellStyle?: object) => (
    <FoodGridCard
      food={item}
      risk={personalRisk(item.risk, hasR)}
      guest={guest}
      saved={savedIds.has(item.foodId)}
      riskLabel={t(`risk.${personalRisk(item.risk, hasR)}`)}
      onPress={() => openFood(item.foodId)}
      onBookmark={() => onBookmark(item)}
      style={cellStyle}
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
          ListEmptyComponent={browse.isLoading ? <SkeletonFoodGrid /> : null}
          ListFooterComponent={browse.isFetchingNextPage ? <Spinner /> : null}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            // 무한 스크롤(발주 ② — Popular/Saved도 전량: popular 파생·saved 드레인은 browse 확장으로 커버)
            if (browse.hasNextPage && !browse.isFetchingNextPage) void browse.fetchNextPage();
          }}
          renderItem={({ item }) => <View style={styles.gridCell}>{card(item, styles.gridCellCard)}</View>}
          testID="food-explorer-list"
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
  const railCard = (item: FoodCard) => card(item, styles.railCard);

  return (
    <View>
      {top}
      {/* P-317: 세로 그리드 → 가로 레일(카드 = 그리드 카드 동일 컴포넌트·비율, 최대 10 + See all) */}
      <FlatList
        horizontal
        data={gridFoods}
        keyExtractor={(f: FoodCard) => f.foodId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
        renderItem={({ item }) => railCard(item)}
        ListEmptyComponent={
          gridTab === 'saved' ? <Text style={styles.gridEmpty}>{t('saved.emptyBody')}</Text> : null
        }
        ListFooterComponent={
          gridFoods.length > 0 ? (
            <Pressable
              style={styles.seeAllCard}
              onPress={() => router.push(foodTabHref(gridTab as GridSegment, riskChip as RiskChipParam) as Href)}
              testID="home-rail-see-all"
            >
              <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
            </Pressable>
          ) : null
        }
        testID="home-rail"
      />
      {safeRail.length >= 3 && (
        <>
          <SectionHead label={t('home.safeForYou')} title={t('home.safeForYouSub')} testID="home-safe-rail-head" />
          <FlatList
            horizontal
            data={safeRail}
            keyExtractor={(f: FoodCard) => `safe-${f.foodId}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.railContent}
            renderItem={({ item }) => railCard(item)}
            testID="home-safe-rail"
          />
        </>
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

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, paddingVertical: 16 },

  // P-317 홈 레일(그리드 카드 동일 비율 — 폭 174 고정, gap 12, 좌우 20)
  railContent: { paddingHorizontal: 20, gap: 12 },
  railCard: { width: RAIL_CARD_W },
  seeAllCard: { width: RAIL_CARD_W, aspectRatio: 174 / 203, borderRadius: 4, borderWidth: 1, borderColor: C.line2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  seeAllText: { fontSize: 14, fontWeight: '600', color: C.ink2 },
  gridEmpty: { fontSize: 14, fontWeight: '400', color: C.ink2, paddingVertical: 24, paddingHorizontal: 20 },

  // 음식 탭(FlatList) 그리드 — 셀이 폭 소유(저장 목록과 같은 문법)
  gridRowWrap: { columnGap: 16, paddingHorizontal: 20 },
  gridCell: { flex: 1, marginBottom: 16 },
  gridCellCard: { width: '100%' },
});

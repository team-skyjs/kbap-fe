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
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import { Btn, Chip, IconSearch, IconTabScan, Spinner, SkeletonFoodGrid, QueryErrorBlock, ScreenCenterFill } from '@/components';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { FoodGridCard } from '@/features/food/FoodCards';
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

export const HOME_GRID_N = 4; // 홈: 첫 화면 2행(4장) 후 More

export function FoodExplorer({
  variant,
  guest,
  initialTab = 'popular',
  srcTag,
  onScroll,
  topPad = 0,
}: {
  variant: 'embedded' | 'screen';
  /** 홈 = useHome().authenticated 판정 승계 / 음식 탭 = useIsGuest() */
  guest: boolean;
  initialTab?: GridTab;
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
  const [riskChip, setRiskChip] = React.useState<RiskChip>('all');
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
  const gridFoods = variant === 'embedded' ? filtered.slice(0, HOME_GRID_N) : filtered;
  const gridMoreHref: Href = gridTab === 'saved' ? ('/profile/saved' as Href) : ('/food' as Href);
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

  return (
    <View>
      {top}
      {/* 음식 카드 2열 그리드 (4150:13806) — 홈 = 4장 + More */}
      <View style={styles.grid}>
        {gridFoods.map((f) => (
          <React.Fragment key={f.foodId}>{card(f)}</React.Fragment>
        ))}
        {gridFoods.length === 0 && gridTab === 'saved' && (
          <Text style={styles.gridEmpty}>{t('saved.emptyBody')}</Text>
        )}
      </View>
      {filtered.length > HOME_GRID_N && (
        <View style={styles.moreWrap}>
          <Btn variant="ghost" onPress={() => router.push(gridMoreHref)} testID="home-grid-more">
            {t('home.seeAll')}
          </Btn>
        </View>
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

  // 홈 임베드 그리드
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 16, paddingHorizontal: 20 },
  gridEmpty: { fontSize: 14, fontWeight: '400', color: C.ink2, paddingVertical: 24 },
  moreWrap: { paddingHorizontal: 20, paddingTop: 20 },

  // 음식 탭(FlatList) 그리드 — 셀이 폭 소유(저장 목록과 같은 문법)
  gridRowWrap: { columnGap: 16, paddingHorizontal: 20 },
  gridCell: { flex: 1, marginBottom: 16 },
  gridCellCard: { width: '100%' },
});

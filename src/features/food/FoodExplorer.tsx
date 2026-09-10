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
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, radius } from '@/lib/theme';
import { Btn, Chip, IconSearch, IconTabScan, IconChevron, IconChevronDown, IconCheck, Spinner, SkeletonFoodGrid, QueryErrorBlock, ScreenCenterFill } from '@/components';
import { EmptyBlock } from '@/components/StateBlock';
import { Shimmer } from '@/components/Skeleton';
import { ActionSheet } from '@/components/ActionSheet';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { FoodGridCard, isGridPad, padOddGrid } from '@/features/food/FoodCards';
import { foodTabHref, type GridSegment, type RiskChipParam } from '@/features/food/foodFilterParams';
import { railCardW } from '@/features/food/railLayout';
import { LinearGradient } from 'expo-linear-gradient';
import { SectionHead } from '@/components/SectionHead';
import { useInfiniteFoods, FOODS_PAGE_SIZE } from '@/lib/data/useFoods';
import { useBookmarks, useSavedIds, useToggleBookmark } from '@/lib/data/bookmarks';
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

/** P-318 정렬 — new(publishedAt)는 KB-439 배포 전 시트에서 비활성(선택 불가).
 *  P-335(9/8 예진): A–Z 제거 — 커서 페이지네이션 위 클라 정렬은 페이지 도착마다
 *  전체가 재정렬돼 항목이 튐(구조 결함). 서버 sort=name 생기면 재도입(TODO). */
type FoodSort = 'popular' | 'new';
const FOOD_SORTS: FoodSort[] = ['popular', 'new'];

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
  const { t } = useTranslation();
  const router = useRouter();
  // P-319: 레일 카드 폭 = 화면 폭 기준(2장 + 3번째 peek — 가로 스크롤임을 보이게)
  const cardW = railCardW(useWindowDimensions().width);
  const { data: me } = useMe();
  const hasR = (me?.restrictions.length ?? 0) > 0;

  const [gridTab, setGridTab] = React.useState<GridTab>(initialTab);
  // P-318: 딥링크 초기값 — 게스트는 개인화 상태 강등(칩 게이트·저장 게이트 우회 방지)
  const [riskChip, setRiskChip] = React.useState<RiskChip>(guest ? 'all' : (initialRisk ?? 'all'));
  const [savedOnly, setSavedOnly] = React.useState(initialSaved === true && !guest);
  const [sort, setSort] = React.useState<FoodSort>('popular');
  const [sortSheet, setSortSheet] = React.useState(false);

  // P-350(KB-492): 위험 칩 = 서버 필터 — browse는 riskChip 전달, 저장은 두 쿼리:
  // saved(무필터) = 북마크 판정 소스(드레인 유지) / savedList(risk) = Saved 목록 소스
  // (riskChip 'all'이면 같은 쿼리키 = 캐시 공유, 추가 요청 없음).
  const savedTabActive = variant === 'screen' ? savedOnly : gridTab === 'saved';
  const browse = useInfiniteFoods(riskChip, { enabled: !savedTabActive }); // #112 2R ②: Saved 활성 = browse 휴면
  const saved = useBookmarks();
  const savedList = useBookmarks(savedTabActive ? riskChip : 'all');
  const toggleBookmark = useToggleBookmark();

  // P-349 ③(KB-512): 당겨서 새로고침 — #112 3R ②: 활성 쿼리만(browse는 Saved 활성 중
  // enabled:false인데 refetch가 이를 우회해 휴면 쿼리를 깨움 → 명시 분기).
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    const jobs: Promise<unknown>[] = savedOnly
      ? riskChip === 'all'
        ? [saved.refetch()] // 5R ②: 같은 키 두 관찰자 — refetch 1회
        : [savedList.refetch(), saved.refetch()] // 목록 + 북마크 판정 소스
      : [browse.refetch()];
    void Promise.all(jobs).finally(() => setRefreshing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedOnly, riskChip, browse.refetch, saved.refetch, savedList.refetch]);

  // P-350 ③: 얇은 페이지 — risk 지정 목록은 hasNext=true·items 미만(0 포함)이 정상.
  // onEndReached만으론 빈 화면에서 다음 페이지가 안 당겨짐 → 화면을 채울 때까지
  // 연속 페치(상한 없음 — 서버 5배치 상한이 유한 보장, P-332 cancelRefetch:false 문법).
  const gridQ = savedTabActive ? savedList : browse;
  const gridLen = gridQ.data?.length ?? 0;
  // #112 2R ①: 에러 = 빈 상태보다 먼저(가짜 no-matches 금지) — 레일·그리드 공통 판정.
  // 캐시 카드가 있으면(백그라운드 에러) 목록 유지(Codex #85 3R 원칙 승계).
  // #112 3R ① → 5R ①: 실패한 채움 시도 기억 — **쿼리 스코프 키 + 길이(커서 프록시)**.
  // 키 없이 길이만 기억하면 칩 전환 중 도착한 옛 실패 콜백이 새 쿼리를 잠근다.
  // 재개는 에러 블록의 수동 재시도(onRetry가 클리어)만.
  const fillKey = `${savedTabActive}:${riskChip}`;
  // 6R P2: dataUpdatedAt 동봉 — 리마운트 자동 재조회(retryGrid 우회) 성공 시 마커 무효
  const fillFailedAtRef = React.useRef<{ key: string; len: number; at: number } | null>(null);
  // #112 4R: 재시도 핸들러 공유(레일 블록·screen 전체 화면 게이트) — 실패 기억
  // 클리어 없이 refetch만 하면 재시도 성공 후 얇은 페이지에서 채움 effect가
  // 영구 정지(fillFailedAtRef === gridLen 그대로 → 스켈레톤 고정).
  const retryGrid = () => {
    fillFailedAtRef.current = null; // 수동 재시도 = 자동 채움 재개 허용(3R ①)
    void gridQ.refetch();
  };
  const gridErrorBlock = (
    <View style={styles.railState} testID="food-grid-error">
      <QueryErrorBlock error={gridQ.error} onRetry={retryGrid} />
    </View>
  );
  React.useEffect(() => {
    if (riskChip === 'all') return; // 무필터 = 기존 스크롤 페이징만(드레인은 saved 판정 소스 몫)
    if (gridQ.isError) return; // 3R ①: 에러 = 자동 페치 중단(무한 재시도 금지)
    if (
      fillFailedAtRef.current?.key === fillKey &&
      fillFailedAtRef.current.len === gridLen &&
      fillFailedAtRef.current.at === gridQ.dataUpdatedAt // 성공 재조회(갱신 시각 변화) = 마커 무효(6R P2)
    ) return; // 같은 쿼리·커서 재시도 금지
    const updatedAt = gridQ.dataUpdatedAt;
    if (gridLen < FOODS_PAGE_SIZE && gridQ.hasNextPage && !gridQ.isFetching)
      void Promise.resolve(gridQ.fetchNextPage({ cancelRefetch: false })).then((r) => {
        if (r?.isError) fillFailedAtRef.current = { key: fillKey, len: gridLen, at: updatedAt }; // 발화 시점 키 — 옛 실패는 새 쿼리 안 잠금(5R ①)
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillKey, gridLen, gridQ.isError, gridQ.hasNextPage, gridQ.isFetching, gridQ.dataUpdatedAt, gridQ.fetchNextPage]);
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
  // P-340 2-A → Codex #101 P2: 선택 칩 가시화 — 마운트뿐 아니라 See all 파라미터
  // 재동기화(마운트 유지 화면) 뒤에도 재실행(riskChip/savedOnly/paramsKey deps).
  const chipScrollRef = React.useRef<ScrollView | null>(null);
  React.useEffect(() => {
    if (variant !== 'screen') return;
    const idx = savedOnly ? RISK_CHIPS.length : RISK_CHIPS.indexOf(riskChip);
    if (idx > 1) chipScrollRef.current?.scrollTo({ x: idx * 72, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, riskChip, savedOnly, paramsKey]);

  // Codex #28 → #116 P2 ①: 북마크 커서 전 페이지 드레인(판정 소스) = 공용 useSavedIds
  // (P-332 가드 문법 포함 — 중복 배선 금지, 검색 등 다른 표면과 공유).
  const savedFoods = saved.data ?? []; // 무필터 — 북마크 판정 소스(savedIds)·저장 0건 판단
  const savedListFoods = savedList.data ?? []; // Saved 목록 소스(risk 적용분)
  const savedIds = useSavedIds();
  const gridSource: FoodCard[] =
    variant === 'screen'
      ? savedOnly ? savedListFoods : (browse.data ?? []) // P-318: 세그먼트 소멸 — Saved는 토글 칩
      : gridTab === 'popular' ? popularPhotoFoods(browse.data) : gridTab === 'saved' ? savedListFoods : (browse.data ?? []);
  // P-350: 위험 칩 = 서버 필터(&risk=) — 클라 personalRisk 필터 소멸(무한로딩 원인)
  const filtered = gridSource;
  // P-318 정렬: 인기 = 목록 응답 순서 그대로(서버 정렬 정본 — P-335로 클라 정렬 소멸).
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
          P-340 2-A(KB-495): screen = 한 줄 고정 가로 스크롤(우측 페이드 24) + 정렬 버튼
          스크롤 밖 우측 고정. 홈(embedded)은 현행 무변. */}
      {variant === 'screen' ? (
        <View style={styles.chipRowScreen}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ScrollView
              ref={chipScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScrollContent}
              testID="food-chip-scroll"
            >
              {RISK_CHIPS.map((c) => (
                <Chip
                  key={c}
                  label={c === 'all' ? t('home.filterAll') : t(`risk.${c}`)}
                  selected={riskChip === c}
                  onPress={() => onChip(c)}
                  testID={`home-chip-${c}`}
                />
              ))}
              <Chip label={t('saved.title')} selected={savedOnly} onPress={onSavedChip} testID="food-chip-saved" />
            </ScrollView>
            {/* 우측 흰→투명 페이드 24 — 스크롤 가능함을 암시(터치 투과) */}
            <LinearGradient
              colors={['rgba(255,255,255,0)', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.chipFade}
              pointerEvents="none"
            />
          </View>
          <Pressable style={styles.sortBtn} onPress={() => setSortSheet(true)} testID="food-sort">
            <Text style={styles.sortLabel} numberOfLines={1}>{t(`food.sort_${sort}`)}</Text>
            <IconChevronDown size={16} color="#4B4F58" />
          </Pressable>
        </View>
      ) : (
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
          </View>
        </View>
      )}
    </View>
  );

  const card = (item: FoodCard, cellStyle?: object) => (
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
    />
  );

  if (variant === 'screen') {
    // #112 2R ②: 전체 화면 에러 게이트 = 활성 쿼리(gridQ — Saved 활성이면 savedList)
    if (gridQ.isError) {
      return (
        <ScreenCenterFill>
          <QueryErrorBlock error={gridQ.error} onRetry={retryGrid} />
        </ScreenCenterFill>
      );
    }
    return (
      <>
        <Animated.FlatList
          data={padOddGrid(gridFoods)}
          keyExtractor={(f) => f.foodId}
          numColumns={2}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: topPad, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink3} progressViewOffset={topPad} />}
          columnWrapperStyle={styles.gridRowWrap}
          ListHeaderComponent={top}
          ListEmptyComponent={
            gridQ.isError ? (
              /* #112 1R ③→2R ①: 쿼리 에러 = 빈 상태보다 먼저 — 공통 판정 블록 */
              gridErrorBlock
            ) : gridQ.isLoading || gridQ.hasNextPage ? (
              /* P-350: 빈 판정은 !hasNextPage && 0건일 때만 — 얇은 페이지 채움 중 = 스켈레톤 */
              <SkeletonFoodGrid />
            ) : savedOnly ? (
              riskChip !== 'all' ? (
                <View style={styles.railState} testID="food-grid-filter-empty">
                  <EmptyBlock label={t('saved.filterEmpty')} />
                </View>
              ) : (
                <Text style={styles.gridEmpty}>{t('saved.emptyBody')}</Text>
              )
            ) : riskChip !== 'all' ? (
              <View style={styles.railState} testID="food-grid-filter-empty">
                <EmptyBlock label={t('home.railFilterEmpty', { risk: t(`risk.${riskChip}`) })} />
              </View>
            ) : null
          }
          ListFooterComponent={gridQ.isFetchingNextPage ? <Spinner /> : null}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            // 무한 스크롤 — 활성 목록(gridQ: browse 또는 Saved+risk) 페이징
            if (gridQ.hasNextPage && !gridQ.isFetchingNextPage) void gridQ.fetchNextPage();
          }}
          renderItem={({ item }) => (isGridPad(item) ? <View style={styles.gridCell} testID="food-grid-pad" /> : <View style={styles.gridCell}>{card(item, styles.gridCellCard)}</View>)}
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
            // P-342 ②: NEW = "준비 중" 칩(KB-439 배포 시 칩 제거)
            trailing: v === 'new' ? (
              <View style={styles.soonChip}>
                <Text style={styles.soonChipText}>{t('food.sortNewSoon')}</Text>
              </View>
            ) : undefined,
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
  // P-321: Safe picks — 가로 레일 → 음식 탭 그리드와 같은 2열 정적 그리드 최대 4장(2×2),
  // safe ≥2(한 행)일 때만(구 ≥3 규칙 대체 — v2 정본 §홈 4 갱신).
  const safePicks =
    !guest && hasR && gridTab === 'popular' && riskChip === 'all'
      ? (browse.data ?? []).filter((f) => personalRisk(f.risk, hasR) === 'safe').slice(0, 4)
      : [];

  // P-321 레일 상태: 로딩/에러/빈은 전부 ScrollView 밖 세로 블록(가로 컨테이너 안 문장이
  // 줄바꿈 없이 잘리던 실기 결함) — ScrollView는 카드 ≥1일 때만 마운트.
  // Codex #85 2R P2: Saved 탭 데이터 = 북마크 쿼리 독립 — 로딩도 에러처럼 탭별 스코프
  // (카탈로그 콜드 로딩이 캐시된 저장 카드를 스켈레톤으로 가리지 않게).
  const railLoading =
    (gridTab === 'saved' ? savedList.isLoading : browse.isLoading) ||
    // P-350: 얇은 페이지 채움 중(0건·hasNext) = 빈 상태 아님 — 스켈레톤 유지
    (riskChip !== 'all' && gridFoods.length === 0 && gridQ.hasNextPage);

  return (
    <View>
      {top}
      {railLoading ? (
        /* 원격 콘텐츠 = 스켈레톤 기본(P-188 계열) — 카드 비율·cardW 동일 2장 */
        <View style={styles.railSkel} testID="home-rail-skel">
          {[0, 1].map((i) => (
            <Shimmer key={i} style={{ width: cardW, aspectRatio: 174 / 203, borderRadius: 4 }} />
          ))}
        </View>
      ) : gridQ.isError && gridFoods.length === 0 ? (
        /* #112 2R ①: 활성 쿼리(gridQ — Saved 탭 = savedList) 에러도 빈 상태보다 먼저.
           캐시 카드가 있으면(백그라운드 refetch 실패) 레일 유지(Codex #85 3R 원칙). */
        gridErrorBlock
      ) : gridFoods.length === 0 ? (
        gridTab === 'saved' && savedFoods.length === 0 ? (
          /* 저장 자체 0건 — 공용 EmptyBlock(제목) + 본문(줄바꿈) + Browse CTA */
          <View style={styles.railState} testID="home-rail-saved-empty">
            <EmptyBlock label={t('saved.emptyTitle')} />
            <Text style={styles.railEmptyBody}>{t('saved.emptyBody')}</Text>
            <Btn variant="ghost" onPress={() => router.push('/food' as Href)} testID="home-rail-browse">
              {t('saved.emptyCta')}
            </Btn>
          </View>
        ) : (
          /* 칩이 전부 걸러냄 — Saved = 기존 filterEmpty / Popular·Food = railFilterEmpty({{risk}}).
             All + 소스 0(카탈로그 빈 극단)은 "{All} 메뉴" 문장이 깨져 기존 noResultsTitle 재사용. */
          <View style={styles.railState} testID="home-rail-filter-empty">
            <EmptyBlock
              label={
                gridTab === 'saved'
                  ? t('saved.filterEmpty')
                  : riskChip === 'all'
                    ? t('search.noResultsTitle')
                    : t('home.railFilterEmpty', { risk: t(`risk.${riskChip}`) })
              }
            />
          </View>
        )
      ) : (
        /* P-320: 평범한 ScrollView + map — 세로 FlatList 헤더 안 중첩 VirtualizedList가
           레일마다 화면 높이 공백을 만들던 원인(#84 실기 확정). flexGrow:0 유지(#83). */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.rail}
          contentContainerStyle={styles.railContent}
          testID="home-rail"
        >
          {gridFoods.map((item) => card(item, { width: cardW }))}
          <Pressable
            style={[styles.seeAllCard, { width: cardW }]}
            onPress={() => router.push(foodTabHref(gridTab as GridSegment, riskChip as RiskChipParam, Date.now()) as Href)}
            testID="home-rail-see-all"
          >
            <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
            <IconChevron size={16} color={INK_TITLE} />
          </Pressable>
        </ScrollView>
      )}
      {safePicks.length >= 2 && (
        <>
          <SectionHead label={t('home.safeForYou')} title={t('home.safeForYouSub')} testID="home-safe-rail-head" />
          {/* P-326: 행 단위 2열(flex:1 셀) — 구 47% 근사가 우측 ≈5pt 잔여로 좌우 비대칭.
              홀수(3장) 마지막 행은 빈 셀로 채워 카드가 행 전체로 늘어나지 않게(#85 2R 유지). */}
          <View style={styles.safeGrid} testID="home-safe-grid">
            {[safePicks.slice(0, 2), safePicks.slice(2, 4)]
              .filter((row) => row.length > 0)
              .map((row, i) => (
                <View key={i} style={styles.safeGridRow}>
                  {row.map((item) => card(item, styles.safeGridCell))}
                  {row.length === 1 && <View style={styles.safeGridCell} testID="home-safe-grid-filler" />}
                </View>
              ))}
          </View>
        </>
      )}
      <AuthGateSheet context="save" open={gate} onClose={() => setGate(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // 검색 행 (§1-2)
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 0 }, // A-HM-02
  searchBox: {
    flex: 1,
    height: 48,
    borderRadius: 4,
    backgroundColor: C.surface2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, // A-HM-02
  },
  searchPh: { flex: 1, fontSize: 15, fontWeight: '500', color: '#D1D3D8', marginRight: 8 }, // A-HM-02(scanBtn bg는 C 이관)
  scanBtn: { width: 48, height: 48, borderRadius: 8, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },

  // 언더라인 탭 (§1-3)
  tabsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 14, gap: 4 }, // A-HM-03
  // A-DS-03(KB-486): 라벨 14/700 · 비활성 #9196A1 · 패딩 10
  tab: { paddingHorizontal: 10, height: 40, justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  tabLabel: { fontSize: 14, fontWeight: '700', color: '#9196A1' },
  tabLabelOn: { color: INK_TITLE },
  tabBar: { alignSelf: 'stretch', height: 2, backgroundColor: 'transparent' },
  tabBarOn: { backgroundColor: INK_TITLE },
  tabsDivider: { height: 0.5, backgroundColor: C.line2 },

  // P-318: 칩 그룹(래핑) + 우측 정렬 버튼 — embedded는 우측 요소 없음(시각 무변)
  chipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 }, // A-HM-04(홈 무변)
  // P-340 2-A: 한 줄 고정(칩 34) + pad 14/12 + 하단 헤어라인 — 정렬 버튼은 스크롤 밖 우측
  chipRowScreen: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 14, paddingBottom: 12, paddingRight: 20, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EAEBEE' }, // P-351 ②(#114 P2): 헤어라인 아래 12 — top은 ListHeader라 contentContainer paddingTop은 헤더째 밀림
  chipScrollContent: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 20, paddingRight: 8, height: 34 },
  chipFade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 24 },
  // P-342 ②: 정렬 시트 NEW "준비 중" 칩(DS 소형 pill)
  soonChip: { backgroundColor: '#F2F3F6', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  soonChipText: { fontSize: 12, fontWeight: '500', color: '#6A6F7C' },
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
  // P-339 ①(KB-494): 점선 카드 폐기 — 카드 높이 세로 중앙 텍스트+chevron, 배경·보더 없음
  seeAllCard: { aspectRatio: 174 / 203, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 12 },
  seeAllText: { fontSize: 14, fontWeight: '600', color: INK_TITLE }, // P-339 ①
  // P-321 레일 상태 블록(전부 ScrollView 밖 세로 배치 — 줄바꿈 보장)
  railSkel: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  // 디자이너 빈 상태(4003:6689) = 중앙 정렬 — EmptyBlock과 본문·CTA 정렬 통일
  railState: { paddingHorizontal: 20, alignItems: 'center', gap: 4 },
  railEmptyBody: { fontSize: 14, fontWeight: '400', color: C.ink2, lineHeight: 20, textAlign: 'center', maxWidth: 335 },
  // Safe picks 2×2 — 홈 구 그리드 문법(카드 기본 47% + grow)
  // P-326: 음식 탭 그리드 문법(행 row + 셀 flex:1) — 47% 근사 폐기(좌우 패딩 대칭)
  safeGrid: { gap: 16, paddingHorizontal: 20 },
  safeGridRow: { flexDirection: 'row', columnGap: 16 },
  safeGridCell: { flex: 1, minWidth: 0 },
  gridEmpty: { fontSize: 14, fontWeight: '400', color: C.ink2, paddingVertical: 24, paddingHorizontal: 20 },

  // 음식 탭(FlatList) 그리드 — 셀이 폭 소유(저장 목록과 같은 문법)
  gridRowWrap: { columnGap: 16, paddingHorizontal: 20 },
  gridCell: { flex: 1, marginBottom: 16 },
  gridCellCard: { width: '100%' },
});

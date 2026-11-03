/**
 * Menu search (KB-21 UI · KB-71 실연결) — full-screen search reached from the
 * header search icon. Three states:
 *   1. empty  → recent searches (local, per-row delete + clear all; dashed hint
 *      when none) + editorial "popular" list.
 *      ⚠️ popular block is still MOCK — 인기순 계약 미배포. 인기 API가 배포되면
 *      (KB-310에서 완료 — 카탈로그 = probe 라이브 재사용, 목 잔재 소멸.)
 *   2. results → LIVE GET /foods/search (KB-71): submit-only (자동완성 MVP 제외),
 *      keyword 부분일치(한국어명+리더 언어 번역명, 대소문자 무시는 서버 몫),
 *      nextCursor 무한스크롤(hasNext=false까지) — 목록과 같은 커서 패턴.
 *   3. none    → empty items page (정상 응답) → friendly empty state.
 *
 * Risk badges are personalized (personalRisk false-safe guard) and rendered with
 * the KB-25 RiskPill. Blank keywords never leave the client (server 400s).
 *
 * KB-967 통합 검색(processedFoodEnabled 채널만): 결과 위 칩 All / Dishes / Packaged.
 *   All = 섹션별 4개(첫 페이지가 많은 쪽 위 · 동률 Dishes) + See all = 그 칩으로, 0건 섹션 숨김 · 한쪽 실패는 그 섹션만.
 *   Dishes = 위 음식 검색 그대로 · Packaged = 가공식품 검색(useProcessedSearchPaged) 무한스크롤 · 카드 = Packaged 탭 ProductCard.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, type as T, type RiskState } from '@/lib/theme';
import { Spinner, QueryErrorBlock, classifyQueryError, CardPhoto, Chip, PressScale, IconArrowLeft, IconSearch, IconClose, IconFood, Input } from '@/components';
import { EmptyBlock } from '@/components/StateBlock';
import { FOODS_PAGE_SIZE, useInfiniteFoods, useSearchFoods } from '@/lib/data/useFoods';
import { PROCESSED_PAGE_SIZE, useProcessedSearchPaged } from '@/lib/data/useProcessedFoods';
import { ProductCard, ProductCardSkeleton, type FoodSegment } from '@/features/processedFood/PackagedExplorer';
import { SkeletonFoodGrid } from '@/components/Skeleton';
import { FLAGS } from '@/lib/flags';
import { CARD_TITLE, FoodGridCard, isGridPad, padOddGrid } from '@/features/food/FoodCards';
import { AdBanner } from '@/features/ads/AdBanner';
import { useBottomInset } from '@/lib/useBottomInset';
import { placeholderKeyword, popularPhotoFoods } from '@/lib/search/discovery';
import { useMe } from '@/lib/data/useMe';
import { useRecentSearches } from '@/lib/data/useRecentSearches';
import { personalRisk } from '@/lib/risk';
import { EVENTS, track } from '@/lib/analytics';
import { airbridge } from '@/lib/airbridge';
import { searchKeywordProps } from '@/lib/search/keywordPrivacy';
import { useIsGuest } from '@/lib/auth/useSession';
import type { FoodCard } from '@/lib/api/types';
import type { ProcessedFoodSummary } from '@/lib/api/processedFoodAdapter';

type SearchSegment = 'all' | FoodSegment;
const SEGMENTS = [['all', 'home.filterAll'], ['dishes', 'packaged.segmentDishes'], ['packaged', 'packaged.segmentPackaged']] as const;
/** All 섹션 하나에 보이는 카드 수 */
export const SECTION_PREVIEW = 4;

export default function Search() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // MOCK — 인기 한식 블록 전용 (인기순 API 미배포; 배포 시 교체)
  const { data: me } = useMe();
  const { recent, add, remove, clear } = useRecentSearches();

  const bodyRef = useRef<FlatList>(null);
  const [query, setQuery] = useState(''); // input text
  const [submitted, setSubmitted] = useState(''); // executed search term (submit-only)

  const hasR = (me?.restrictions.length ?? 0) > 0;
  const isGuest = useIsGuest();
  const search = useSearchFoods(submitted);
  const results = search.data ?? [];
  // KB-967: 가공식품 꺼진 채널 = 칩·가공식품 요청 없이 음식 검색 그대로
  const packagedOn = FLAGS.processedFoodEnabled;
  const [segment, setSegment] = useState<SearchSegment>('all');
  const seg: SearchSegment = packagedOn ? segment : 'dishes';
  const pkg = useProcessedSearchPaged(submitted, {}, packagedOn && submitted.trim().length > 0);
  const pkgItems = pkg.data?.items ?? [];
  // 판정 리본 = Packaged 탭과 같은 기준(회피 1개 이상 회원 = 서버 판정 · 회피 미설정 확인 = safe 근거 있는 제품만)
  const personalized = !isGuest && !!me && me.restrictions.length > 0;
  const unset = isGuest || (!!me && me.restrictions.length === 0);
  const { width: winW } = useWindowDimensions();
  const cellW = (winW - 40 - 16) / 2; // 그리드 줄(gridRowWrap) 여백 20 + 열 간격 16

  // P-028(KB-174 후속): 오프라인 판정 프로브 — empty 상태(최근+인기)는 로컬·mock이라
  // 스스로는 에러가 안 나므로, 음식탭과 같은 live 쿼리(캐시 공유·같은 키)를 신호로 쓴다.
  // 오프라인(J4)만 empty를 대체 — 서버 5xx(J3)는 로컬 콘텐츠를 가릴 이유가 없다.
  const probe = useInfiniteFoods();
  const offline = probe.isError && classifyQueryError(probe.error) === 'offline';

  // KB-959(예진 11/2): 결과 카드 저장 버튼 제거 — 저장은 상세에서만(구 P-353 ⑤ 카드 별·게스트 게이트 소멸)

  // P-143: 검색 유도 — placeholder 시드(진입 시마다 로테이션·재량 보고)+인기 사진
  // 섹션. 큐레이션·스왑 지점은 discovery.ts 격리(BE ⑥ 배포 시 그쪽만 교체).
  // KB-310: 카탈로그 = probe(useInfiniteFoods) 재사용 — 구 useFoods() 목(photoUrl
  // 전부 null) 잔재 제거. 인기 랭크는 BE ⑥ 대기(999 폴백 = 서버 순서·사진 우선 유지).
  const catalog = probe.data;
  const seedKeyword = useMemo(() => placeholderKeyword(catalog), [catalog]);
  const popular = popularPhotoFoods(catalog);

  const riskOf = (f: FoodCard): RiskState => personalRisk(f.risk, hasR);
  const openFood = (id: string) => router.push(`/food/${id}?src=search` as Href);
  const openProduct = (id: string) => router.push(`/processed-foods/${id}` as Href);
  const pickSegment = (next: SearchSegment) => {
    setSegment(next);
    bodyRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const doSearch = (term: string) => {
    const tterm = term.trim();
    if (!tterm) return; // blank never hits the server (400)
    setQuery(tterm);
    setSubmitted(tterm);
    bodyRef.current?.scrollToOffset({ offset: 0, animated: false });
    add(tterm);
  };

  // P-144 → P-214 🔒 교정: 검색어 자유 텍스트 전송 중단 — 카탈로그 매칭 시에만
  // 매칭된 카탈로그 값 전송, 미매칭은 matched:false + 길이 버킷만(keywordPrivacy).
  const trackedFor = useRef<string | null>(null);
  useEffect(() => {
    // KB-786(#278 Codex P2): 요청이 **성공한** 검색만 — 실패(오프라인·5xx)를 "결과 0건"으로 남기지 않고, 같은 검색어 재시도 성공분이 기록되게
    // KB-967 정책(#397 Codex P2) — 제출 1번에 1회, 기준은 제출 때 칩:
    //   Dishes(가공식품 꺼진 채널 포함) = 음식 성공 때 · result_count = 음식 건수
    //   Packaged = 가공식품 성공 때 · result_count = 가공식품 건수
    //   All = 두 요청이 다 끝난 뒤 하나라도 성공했으면 · result_count = 음식 건수(기존 대시보드 의미 — 음식 실패면 생략), packaged_count = 가공식품 건수(성공 때만)
    if (!submitted || trackedFor.current === submitted) return;
    const food = search.isSuccess;
    const pf = packagedOn && pkg.isSuccess;
    if (seg === 'dishes' ? !food : seg === 'packaged' ? !pf : search.isPending || pkg.isPending || (!food && !pf)) return;
    trackedFor.current = submitted;
    const names = [
      ...(food ? results.flatMap((f) => [f.name, f.nameKo]) : []),
      ...(pf ? pkgItems.flatMap((it) => [it.name, it.nameKo]) : []),
    ].filter(Boolean) as string[];
    const count = seg === 'packaged' ? pkgItems.length : food ? results.length : null;
    const { result_count: _drop, ...kw } = searchKeywordProps(submitted, names, count ?? 0);
    track(EVENTS.search_query, { ...kw, ...(count != null ? { result_count: count } : {}), segment: seg, ...(pf ? { packaged_count: pkgItems.length } : {}) });
    airbridge.searchResults({ keyword: kw.keyword, resultCount: count ?? pkgItems.length }); // KB-783 ⑦ — 같은 프라이버시 규칙(매칭값만)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, seg, search.isSuccess, search.isPending, pkg.isSuccess, pkg.isPending]);
  const reset = () => {
    setQuery('');
    setSubmitted('');
    bodyRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const showingSearch = submitted.length > 0;
  // All: 0건 섹션 숨김 · 실패 섹션은 남긴다(다시 시도) · 둘 다 0건이면 기존 빈 상태
  // Q-397 ①: 두 요청이 다 끝날(성공·실패) 때까지 두 섹션 스켈레톤을 고정 순서(Dishes 위)로 — 먼저 온 쪽이 위에 그려졌다 뒤바뀌는 점프 0
  const allSettled = !search.isPending && !pkg.isPending;
  const foodShown = !allSettled || search.isError || results.length > 0;
  const pkgShown = !allSettled || pkg.isError || pkgItems.length > 0;
  const foodFirst = !allSettled || Math.min(results.length, FOODS_PAGE_SIZE) >= Math.min(pkgItems.length, PROCESSED_PAGE_SIZE); // 첫 페이지 건수(두 쪽 다 20개 페이지)
  const listData: (FoodCard | ProcessedFoodSummary)[] =
    !showingSearch || seg === 'all' ? [] :
    seg === 'packaged' ? pkgItems : // #397 Codex P2: 다음 페이지 실패에도 받은 카드 유지(PackagedExplorer와 같은 규칙 — 실패는 푸터 재시도)
    !search.isLoading && !search.isError ? results : [];
  const active = seg === 'packaged' ? pkg : search;
  // 첫 페이지 실패만 오류 블록 — 다음 페이지 실패(isFetchNextPageError)는 받은 카드 유지 + 푸터 다시 시도
  const pkgFailed = pkg.isError && !pkg.isFetchNextPageError;
  const dishesSection = foodShown ? (
    <View style={styles.section} testID="search-section-dishes">
      <SectionHead title={t('packaged.segmentDishes')} more={allSettled && (results.length > SECTION_PREVIEW || !!search.hasNextPage)} /* Q-397 후속: 스켈레톤 동안 See all 0 */ onMore={() => pickSegment('dishes')} moreLabel={t('home.seeAll')} id="dishes" />
      {!allSettled ? (
        <SkeletonFoodGrid rowStyle={styles.gridRowWrap} cellStyle={{ width: cellW }} />
      ) : search.isError ? (
        <View style={styles.sectionErr}><QueryErrorBlock error={search.error} onRetry={() => void search.refetch()} /></View>
      ) : (
        <View style={[styles.gridRowWrap, styles.previewGrid]}>
          {results.slice(0, SECTION_PREVIEW).map((f) => (
            <View key={f.foodId} style={[styles.gridCell, { width: cellW, flex: 0 }]}>
              <FoodGridCard food={f} risk={riskOf(f)} guest={isGuest} riskLabel={t(`risk.${riskOf(f)}`)} onPress={() => openFood(f.foodId)} style={styles.gridCellCard} />
            </View>
          ))}
        </View>
      )}
    </View>
  ) : null;
  const packagedSection = pkgShown ? (
    <View style={styles.section} testID="search-section-packaged">
      <SectionHead title={t('packaged.segmentPackaged')} more={allSettled && (pkgItems.length > SECTION_PREVIEW || pkg.hasNextPage)} onMore={() => pickSegment('packaged')} moreLabel={t('home.seeAll')} id="packaged" />
      {!allSettled ? (
        <View style={[styles.gridRowWrap, styles.previewGrid]} testID="search-packaged-skeleton">
          {[0, 1, 2, 3].map((i) => <ProductCardSkeleton key={i} width={cellW} />)}
        </View>
      ) : pkgFailed ? (
        <View style={styles.sectionErr}><QueryErrorBlock error={pkg.error} onRetry={() => void pkg.refetch()} /></View>
      ) : (
        <View style={[styles.gridRowWrap, styles.previewGrid]}>
          {pkgItems.slice(0, SECTION_PREVIEW).map((it) => (
            <ProductCard key={it.id} item={it} width={cellW} personalized={personalized} unset={unset} onOpen={() => openProduct(it.id)} />
          ))}
        </View>
      )}
    </View>
  ) : null;
  const bottomInset = useBottomInset();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  // Once a person interacts, a late ad must not replace the content they were aiming at.
  const interacted = useRef(false);
  const [interactListeners] = useState(() => new Set<() => void>());
  const [onInteract] = useState(() => (listener: () => void) => { interactListeners.add(listener); return () => { interactListeners.delete(listener); }; });
  const markInteraction = () => {
    if (interacted.current) return;
    interacted.current = true;
    interactListeners.forEach((listener) => listener());
  };
  const canReveal = () => !interacted.current;

  return (
    <View style={styles.root} onTouchStart={markInteraction}>
      {/* header: back + input + clear */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <PressScale onPress={() => router.back()} hitSlop={8} style={styles.back} testID="search-back">
          <IconArrowLeft size={22} color={C.ink} />
        </PressScale>
        {/* P-345(KB-506): 홈 searchBox 동일(h48 r4 surface2 pad16, 보더 없음) — 포커스 시
            시각 변화 없음(배민·토스·iOS UISearchBar 관례, 커서만 브랜드색). 아이콘 우측,
            입력 중엔 같은 자리 Clear(원 배경 #D9D9D9 + X 흰). */}
        <View style={styles.box}>
          <Input
            style={styles.input}
            value={query}
            onChangeText={(text) => { markInteraction(); setQuery(text); }}
            placeholder={seedKeyword ? t('search.placeholderSeed', { name: seedKeyword }) : t('food.searchPlaceholder')} /* KB-722: 홈 검색창과 한 키(중복 키 제거) */
            placeholderTextColor="#D1D3D8"
            selectionColor={C.primary}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => doSearch(query)}
          />
          {query.length > 0 ? (
            <Pressable onPress={reset} hitSlop={8} style={styles.clearDot} testID="search-clear">
              <IconClose size={10} color="#FFFFFF" />
            </Pressable>
          ) : (
            <IconSearch size={20} color={C.ink3} />
          )}
        </View>
      </View>

      <FlatList
        ref={bodyRef}
        testID="search-body"
        style={{ flex: 1 }}
        onLayout={(e) => setViewport(e.nativeEvent.layout)}
        onScrollBeginDrag={markInteraction}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 + bottomInset, flexGrow: 1 }}
        data={padOddGrid(listData)}
        keyExtractor={(f) => ('id' in f ? `pf-${f.id}` : f.foodId)}
        numColumns={2}
        columnWrapperStyle={styles.gridRowWrap}
        ListHeaderComponent={
          <View>
            {!showingSearch && !offline && <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
              <View style={styles.secHead}>
                <Text style={styles.secTag}>{t('search.recent')}</Text>
                {recent.length > 0 && (
                  <Pressable testID="search-recent-clear-all" onPress={clear} hitSlop={6}>
                    <Text style={styles.clearAll}>{t('search.recentClearAll')}</Text>
                  </Pressable>
                )}
              </View>
              {recent.length === 0 ? (
                <View style={styles.recentHint}>
                  <Text style={styles.recentHintText}>{t('search.recentEmptyHint')}</Text>
                </View>
              ) : (
                <View>
                  {recent.map((rterm) => (
                    <View key={rterm} style={styles.recentRow}>
                      <IconSearch size={16} color={C.ink3} />
                      <Pressable testID="search-recent-term" style={styles.recentTap} onPress={() => doSearch(rterm)}>
                        <Text style={styles.recentText} numberOfLines={1}>{rterm}</Text>
                      </Pressable>
                      <Pressable testID="search-recent-remove" onPress={() => remove(rterm)} hitSlop={8}>
                        <IconClose size={15} color={C.ink3} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

            </View>}
            {showingSearch && packagedOn && (
              <View style={styles.segRow} testID="search-segments">
                {SEGMENTS.map(([id, k]) => (
                  <Chip key={id} label={t(k)} selected={seg === id} onPress={() => pickSegment(id)} testID={`search-seg-${id}`} />
                ))}
              </View>
            )}
            <View style={{ marginHorizontal: showingSearch ? 20 : 18 }}>
              {viewport.width > 40 && viewport.height > 0 && (
                <AdBanner placement="search_banner" content={{
                  width: viewport.width - 40,
                  viewportHeight: viewport.height,
                  canReveal,
                  onInteract,
                }} />
              )}
            </View>
            {!showingSearch ? offline ? (
              <QueryErrorBlock error={probe.error} onRetry={() => void probe.refetch()} />
            ) : <View style={{ paddingHorizontal: 18 }}>
              {/* P-143: 인기 사진 섹션 — 랭크 큐레이션(discovery), 탭 = 상세 진입. 게스트 노출(열람 영역).
                  KB-310 Codex P2: 프로브 실패·콜드 캐시(popular 0) = 섹션 통째 미렌더 —
                  빈 레일 잔존 금지(홈 popularSearch.length>0 게이트와 동일 문법). */}
              {popular.length > 0 && (
              <>
              <Text style={[styles.secTag, { marginTop: 22 }]}>{t('search.popular')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popRail}>
                {popular.map((f) => (
                  <Pressable key={f.foodId} style={styles.popCard} onPress={() => openFood(f.foodId)} testID={`pop-${f.foodId}`}>
                    <View style={styles.popThumb}>
                      {f.photoUrl ? <CardPhoto uri={f.photoUrl} recyclingKey={f.foodId} borderRadius={radius.md} /> : <IconFood size={22} color={C.ink3} />}
                    </View>
                    {/* KB-903(T-057): 한 줄 자르기("Seasoned Co…") → 두 줄 + 넘치면 줄이기(홈 카드와 같은 규칙) */}
                    <Text style={styles.popCardName} {...CARD_TITLE}>{f.name}</Text>
                    {f.nameKo !== f.name && <Text style={styles.popCardKo} numberOfLines={1}>{f.nameKo}</Text>}
                  </Pressable>
                ))}
              </ScrollView>
              </>
              )}
              </View> : seg === 'all' ? (
              !foodShown && !pkgShown ? (
                <View style={styles.body}><EmptyBlock label={t('search.noResultsTitle')} testID="search-empty" /></View>
              ) : (
                <View>
                  {foodFirst ? <>{dishesSection}{packagedSection}</> : <>{packagedSection}{dishesSection}</>}
                </View>
              )
            ) : seg === 'packaged' ? (
              pkg.isPending ? (
                <View style={[styles.gridRowWrap, styles.previewGrid]} testID="search-packaged-skeleton">
                  {[0, 1, 2, 3].map((i) => <ProductCardSkeleton key={i} width={cellW} />)}
                </View>
              ) : pkgFailed ? (
                <View style={styles.body}><QueryErrorBlock error={pkg.error} onRetry={() => void pkg.refetch()} /></View>
              ) : pkgItems.length > 0 ? (
                // Q-397 ②: 서버 total이 없어 불러온 개수(20 → 40 …)만 셀 수 있다 — 결과 수 줄 숨김(자리만)
                <View style={styles.countGap} testID="search-packaged-no-count" />
              ) : (
                <View style={styles.body}><EmptyBlock label={t('search.noResultsTitle')} testID="search-empty" /></View>
              )
            ) : search.isLoading ? (
              <View style={styles.body}><Spinner /></View>
            ) : search.isError ? (
              <View style={styles.body}><QueryErrorBlock error={search.error} onRetry={() => void search.refetch()} /></View>
            ) : results.length > 0 ? (
              <Text style={[styles.count, packagedOn && styles.countUnderChips]}>{t('search.resultCount', { count: results.length })}</Text>
            ) : (
              <View style={styles.body}><EmptyBlock label={t('search.noResultsTitle')} testID="search-empty" /></View>
            )}
          </View>
        }
        ListFooterComponent={showingSearch && seg !== 'all' && active.isFetchingNextPage ? <Spinner /> : showingSearch && seg === 'packaged' && pkg.isFetchNextPageError ? (
          <Pressable style={styles.moreErr} onPress={() => void pkg.fetchNextPage()} accessibilityRole="button" testID="search-packaged-more-retry">
            <Text style={styles.moreErrText}>{t('packaged.loadMoreFailed')}</Text>
            <Text style={styles.moreErrCta}>{t('common.tryAgain')}</Text>
          </Pressable>
        ) : null}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          // 다음 페이지 실패 뒤엔 자동으로 다시 부르지 않는다(푸터 수동만 — Packaged 탭 Codex #308 P2와 같은 규칙)
          if (showingSearch && seg !== 'all' && active.hasNextPage && !active.isFetchingNextPage && !active.isFetchNextPageError) void active.fetchNextPage();
        }}
          renderItem={({ item }) =>
            isGridPad(item) ? (
              <View style={styles.gridCell} testID="food-grid-pad" />
            ) : 'id' in item ? (
              <View style={styles.gridCell}>
                <ProductCard item={item} width={cellW} personalized={personalized} unset={unset} onOpen={() => openProduct(item.id)} />
              </View>
            ) : (
              <View style={styles.gridCell}>
                <FoodGridCard
                  food={item}
                  risk={riskOf(item)}
                  guest={isGuest}
                  riskLabel={t(`risk.${riskOf(item)}`)}
                  onPress={() => openFood(item.foodId)}
                  style={styles.gridCellCard}
                />
              </View>
            )
          }
      />
      {/* #116 P2 ②: 게스트 북마크 = 저장 게이트(홈/음식 탭 동일) */}
    </View>
  );
}


function SectionHead({ title, more, onMore, moreLabel, id }: { title: string; more: boolean; onMore: () => void; moreLabel: string; id: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {more && (
        <Pressable onPress={onMore} hitSlop={8} accessibilityRole="button" testID={`search-see-all-${id}`}>
          <Text style={styles.seeAll}>{moreLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20, // P-345: 홈 searchRow 정렬
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hair,
  },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  // P-345(KB-506): 홈 searchBox 동일 - h48 r4 surface2 pad16, 보더/그림자 없음
  box: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, borderRadius: radius.md, paddingHorizontal: 16 }, // KB-909: 입력창 = md
  input: { flex: 1, fontSize: 16, fontWeight: '500', color: C.ink, padding: 0 },
  clearDot: { width: 16, height: 16, borderRadius: radius.pill, backgroundColor: '#D9D9D9', alignItems: 'center', justifyContent: 'center' }, // DS 9:3898

  body: { padding: 18, paddingBottom: 40 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secTag: { fontFamily: font.bodyBold, fontSize: 13, letterSpacing: 0.3, color: C.ink2, textTransform: 'uppercase', marginBottom: 8 },
  clearAll: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },

  recentHint: { borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', borderRadius: radius.md, padding: 16, alignItems: 'center' },
  recentHintText: { fontFamily: font.body, fontSize: 14, color: C.ink3, textAlign: 'center' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  recentTap: { flex: 1 },
  recentText: { fontFamily: font.bodyBold, fontSize: 16, color: C.ink },

  // P-143 인기 사진 레일
  popRail: { gap: 10, paddingRight: 8 },
  popCard: { width: 108 },
  popThumb: { width: 108, height: 84, borderRadius: radius.md, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, // P-345: 사진 r4 통일
  popCardName: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink, marginTop: 6 },
  popCardKo: { fontFamily: font.ko, fontSize: 12, color: C.ink2, marginTop: 1 },

  // P-353 ⑤: 음식 탭 그리드 값 그대로(FoodExplorer :576-578)

  gridRowWrap: { columnGap: 16, paddingHorizontal: 20 },

  gridCell: { flex: 1, marginBottom: 16 },

  gridCellCard: { width: '100%' },

  count: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink2, marginBottom: 12, paddingHorizontal: 20 }, // P-369 ①: 그리드 여백 정렬
  // P-345: dish-item(2200:21188) - pad12 gap12 r8 #EAEBEE 흰, 그림자 없음

  // KB-967: 결과 칩 줄(리뷰 탭 targetRow와 같은 칩) · All 섹션 = 제목 + 오른쪽 See all · 미리보기 2열 4장
  segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }, // 리뷰 탭 targetRow와 같은 아래 8
  // Q-397 ②: 칩 → 첫 내용 = 리뷰 탭과 같은 30(칩 줄 8 + 리뷰 카드 위 패딩 22)
  countUnderChips: { marginTop: 22 },
  countGap: { height: 22 },
  // 다음 페이지 실패 푸터 = Packaged 탭(PackagedExplorer st.moreErr*)과 같은 모양
  moreErr: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 8, minHeight: 44, paddingHorizontal: 20 },
  moreErrText: { ...T.meta, fontFamily: font.body, color: C.ink3 },
  moreErrCta: { ...T.meta, fontFamily: font.bodyBold, color: C.primaryText },
  section: { marginTop: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { ...T.appBar, fontFamily: font.bodyBold, color: C.ink, flexShrink: 1 },
  seeAll: { ...T.meta, fontFamily: font.bodyBold, color: C.primaryText },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  sectionErr: { paddingHorizontal: 20 },

  noResults: { flex: 1, justifyContent: 'center', paddingBottom: 60 }, // P-154 ②: 상하 센터(앱 통일 — 키보드 감안 소폭 상향)
});

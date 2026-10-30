/**
 * Food 탭 Packaged (KB-812, D-32 R-95 12338:38030) — 가공식품 검색 중심 목록 + Food 탭 상단 Dishes|Packaged 세그먼트.
 * - 전체 둘러보기 없음: 검색어가 있을 때만 조회(빈 검색어 = 서버 400). 첫 화면 = 검색 안내.
 * - 유형 칩(Snacks/Ramen/…)은 3.2에 필터 파라미터가 없어 1차 제외(클라 필터 금지) — 카드에 유형 라벨만.
 * - 카드 = 시안 dish-item(2200:21188 — pad 12 · r8 · #EAEBEE): 왼쪽 72 썸네일(사진 없으면 유형 플레이스홀더) + 제품명·제조사.
 *   리뷰 수·평점은 3.2 목록에 없어 숨김(리뷰 2차). 판정 칩도 목록 응답에 검출이 없어 없음 — 판정은 상세에서.
 * - 로딩 = 시안 loading(335×104 회색 4장) · 결과 0 = 시안 empty(유형 플레이스홀더 + 문구, 성분표 촬영 버튼은 F2 전까지 숨김).
 */
import * as React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { Btn, Chip, Input, IconSearch, IconClose, IconCamera, IconTabFood, OverallRating, RiskBadge, Spinner, QueryErrorBlock } from '@/components';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { FLAGS } from '@/lib/flags';
import { useIsGuest } from '@/lib/auth/useSession';
import { useMe } from '@/lib/data/useMe';
import { RemoteImage } from '@/components/RemoteImage';
import { Shimmer } from '@/components/Skeleton';
import { color as C, font, radius } from '@/lib/theme';
import { EVENTS, track } from '@/lib/analytics';
import { browseUnsupported, emptyPageAction, endReachedShouldFetch, useProcessedSearch, useProcessedSearchPaged } from '@/lib/data/useProcessedFoods';
import { PACKAGED_TYPES, packagedTypeKey, VERDICT_RISK, verdictsForRisk, type PackagedType, type ProcessedFoodSummary, type VerdictChipRisk } from '@/lib/api/processedFoodAdapter';
import { chipRowHeight, SearchScanButton } from '@/features/food/FoodExplorer';
import { ChipScrollRow } from '@/components/ChipScrollRow';
import { ProductName } from './ProductName';

export type FoodSegment = 'dishes' | 'packaged';

/** R-95 반응형 탭(9:4546) — 두 칸 반반, 활성 = 진한 글자 + 칸 폭 2pt 밑줄, 아래 0.5 구분선. 밑줄은 비활성도 투명으로 자리 유지(프레임 불변). */
export function FoodSegmentRow({ value, onChange }: { value: FoodSegment; onChange: (s: FoodSegment) => void }) {
  const { t } = useTranslation();
  return (
    <View>
      <View style={seg.row} accessibilityRole="tablist">
        {(['dishes', 'packaged'] as FoodSegment[]).map((s) => (
          <Pressable
            key={s}
            style={seg.tab}
            onPress={() => onChange(s)}
            accessibilityRole="tab"
            accessibilityState={{ selected: value === s }}
            testID={`food-segment-${s}`}
          >
            <Text style={[seg.label, value === s && seg.labelOn]} numberOfLines={1}>{t(s === 'dishes' ? 'packaged.segmentDishes' : 'packaged.segmentPackaged')}</Text>
            <View style={[seg.bar, value === s && seg.barOn]} />
          </Pressable>
        ))}
      </View>
      <View style={seg.divider} />
    </View>
  );
}

/** 유형 플레이스홀더(시안: Ramen = soup 아이콘, 나머지 = camera 아이콘 + 유형 글자) — 목록 썸네일·상세 사진 자리 공용. */
export function PackagedPlaceholder({ type, foodType, style }: { type: PackagedType | null; foodType: string | null; style: object }) {
  const { t } = useTranslation();
  const label = type ? t(packagedTypeKey(type)) : foodType;
  return (
    <View style={[ph.box, style]} testID="packaged-placeholder">
      {/* 시안 07(12371:70519) 실측: 바탕 #F2F3F6 · 라면 그릇 #D1D3D8 · 그 밖 카메라 #000000 · 유형 글자 #6A6F7C */}
      {type === 'RAMEN' ? <IconTabFood size={24} color={C.inkDisabled} /> : <IconCamera size={24} color="#000000" />}
      {!!label && <Text style={ph.label} numberOfLines={1}>{label}</Text>}
    </View>
  );
}

export function ProductRow({ item, onOpen }: { item: ProcessedFoodSummary; onOpen: () => void }) {
  const { t } = useTranslation();
  const typeLabel = item.type ? t(packagedTypeKey(item.type)) : item.foodType;
  return (
    <Pressable style={st.row} onPress={onOpen} accessibilityRole="button" accessibilityLabel={[item.name, item.maker].filter(Boolean).join(', ')} testID={`packaged-item-${item.id}`} uiTarget="packaged-item">
      {item.imageUrl ? (
        <RemoteImage uri={item.imageUrl} style={st.thumb} recyclingKey={`pf-${item.id}`} />
      ) : (
        <PackagedPlaceholder type={item.type} foodType={item.foodType} style={st.thumb} />
      )}
      <View style={st.card}>
        <Text style={st.name} numberOfLines={2}>{item.name}</Text>
        {!!item.maker && <Text style={st.maker} numberOfLines={1}>{item.maker}</Text>}
        {!!typeLabel && <Text style={st.type} numberOfLines={1}>{typeLabel}</Text>}
      </View>
    </Pressable>
  );
}


/** v4 상품 카드(시안 01 12371:70305 — 2열 161.5 · 사진 161.5×176 r12 #F7F8FA, 상품은 8 안쪽 contain · 판정 리본 22×29 좌상단 x10 y0 그림자 없음
 *  → 제조사 → 표시명 → 한국어명 → 빈 별 18 + "4.7 (12)"). 판정·한국어명·평점은 서버 v4 필드가 있을 때만(없으면 줄째 숨김). */
export function ProductCard({ item, width, onOpen, personalized = true, unset = false }: { item: ProcessedFoodSummary; width: number; onOpen: () => void; personalized?: boolean; unset?: boolean }) {
  const { t } = useTranslation();
  const [failed, setFailed] = React.useState(false);
  // 리본 = 회피 1개 이상 회원은 서버 판정(Codex #338 P1 — 회피를 비운 직후 남은 판정 캐시를 그리지 않는다)
  // KB-947(예진 10/31 결정): 회피 미설정(비회원·회피 0개 회원 — 프로필 확인 뒤) = safe 리본. 프로필 대기·실패 = 리본 0
  const risk = personalized ? (item.verdict ? VERDICT_RISK[item.verdict] : null) : unset ? 'safe' : null;
  const rating = item.rating ? `${item.rating.average.toFixed(1)} (${item.rating.count})` : null; // 스크린리더 라벨용
  return (
    <Pressable
      style={[card.root, { width }]}
      onPress={onOpen}
      accessibilityRole="button"
      // SAFE_WITH_NOTE = 리본은 safe(결정 4·시안 11b "Safe for you + 한 줄 주의")지만 스크린리더엔 단서를 붙인다(Codex #336 — 조건 없는 safe로 읽히지 않게)
      accessibilityLabel={[item.name, item.nameKo, item.maker, risk && t(`risk.${risk}`), item.verdict === 'SAFE_WITH_NOTE' && t('packaged.unclearNoteA11y'), rating].filter(Boolean).join(', ')}
      testID={`packaged-item-${item.id}`}
      uiTarget="packaged-item"
    >
      <View style={card.photo}>
        {item.imageUrl && !failed ? (
          <RemoteImage uri={item.imageUrl} style={card.image} contentFit="contain" recyclingKey={`pf-${item.id}`} hideUntilLoaded onError={() => setFailed(true)} />
        ) : (
          <PackagedPlaceholder type={item.type} foodType={item.foodType} style={StyleSheet.absoluteFill} />
        )}
        {risk && <View style={card.badge}><RiskBadge state={risk} size={22} flat testID={`packaged-verdict-${item.id}`} /></View>}
      </View>
      {!!item.maker && <Text style={card.maker} numberOfLines={1}>{item.maker}</Text>}
      {/* KB-914(R-140): 이름 = 공용 ProductName(영어 굵게 + 한국어 작게, hangul-word — QA AQ 어절 줄바꿈 그대로) */}
      <ProductName name={item.name} nameKo={item.nameKo} style={card.nameBox} testID={`packaged-name-${item.id}`} />
      {item.rating && (
        <View testID={`packaged-rating-${item.id}`}>
          <OverallRating average={item.rating.average} count={item.rating.count} style={card.rating} />
        </View>
      )}
    </Pressable>
  );
}

/** 시안 05 — 사진 자리 + 막대 130×16 · 90×12(각 8 아래), 2열 2줄(로딩 스피너 중복 없음) */
function SkeletonGrid({ width }: { width: number }) {
  return (
    <View style={card.skelGrid} testID="packaged-skeleton">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[card.root, { width }]}>
          <Shimmer style={[card.photo, card.skelPhoto]} />
          <Shimmer style={card.skelBar1} />
          <Shimmer style={card.skelBar2} />
        </View>
      ))}
    </View>
  );
}

export function PackagedExplorer({ top, topPad = 0, onScroll }: { top: React.ReactNode; topPad?: number; onScroll?: React.ComponentProps<typeof Animated.FlatList<ProcessedFoodSummary>>['onScroll'] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { width: winW, fontScale } = useWindowDimensions();
  const cardW = (winW - 40 - 12) / 2;
  const [draft, setDraft] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [type, setType] = React.useState<PackagedType | null>(null);
  const [verdictChip, setVerdictChip] = React.useState<'all' | VerdictChipRisk>('all');
  const [searchSeq, setSearchSeq] = React.useState(0); // 제출 회차 — 같은 검색어를 다시 제출해도 1회로 센다(Codex #308 R2)
  const [gate, setGate] = React.useState(false);
  const guest = useIsGuest();
  const { data: me } = useMe();
  const personalized = !guest && !!me && me.restrictions.length > 0;
  const unset = guest || (!!me && me.restrictions.length === 0); // KB-947: 회피 미설정이 확인된 사용자만(로그인 + 프로필 대기 = false)
  const inputRef = React.useRef<React.ComponentRef<typeof Input>>(null);
  // v4 판별 = 검색어 없는 둘러보기 1페이지의 성패(구서버 400). 확인 전·구서버 = 유형 칩 없음(구서버는 type을 무시해 거른 척이 된다)
  const browse = useProcessedSearch('');
  const v4 = browse.isSuccess;
  const term = query.trim();
  // KB-927(R-142): 판정 칩 = 회피 1개 이상 회원만(비회원·회피 0개는 서버가 verdict를 무시해 전체를 준다 — 보여 주면 거짓 필터) · v4 확인 뒤에만(유형 칩과 같은 이유)
  const verdictChips = v4 && personalized;
  const verdicts = verdictChips && verdictChip !== 'all' ? verdictsForRisk(verdictChip) : null;
  const q = useProcessedSearchPaged(query, { type: v4 ? type : null, verdicts });
  const items = q.data?.items ?? [];
  const pageSizes = q.data?.pageSizes ?? [];
  // 판정 필터는 서버가 최대 200행만 살펴 0건 페이지 + hasNext가 올 수 있다 — 연속 3번까지 자동으로 이어 부르고 그 뒤엔 "더 찾아보기"(누를 때마다 다시 3번)
  const filterKey = `${term}|${v4 ? type ?? '' : ''}|${verdicts?.join(',') ?? ''}`;
  const [resume, setResume] = React.useState({ key: filterKey, at: 0 });
  const resumeAt = resume.key === filterKey ? resume.at : 0; // 검색어·칩이 바뀌면 처음부터 센다
  const emptyAction = q.isSuccess ? emptyPageAction(pageSizes, q.hasNextPage, resumeAt) : 'none';
  const canFetchMore = !q.isFetchingNextPage && !q.isFetchNextPageError;
  const fetchNext = q.fetchNextPage;
  const pageCount = pageSizes.length;
  React.useEffect(() => {
    // cancelRefetch false = 이미 가는 요청을 끊고 다시 보내지 않는다(렌더마다 다시 판정해도 1발).
    // pageCount = 페이지가 붙을 때마다 다시 판정 — "가는 중"과 "도착"이 한 렌더로 묶이면 나머지 deps가 그대로라 둘째 빈 페이지 뒤에 멈췄다(jest 재현)
    if (emptyAction === 'fetch' && canFetchMore) void fetchNext({ cancelRefetch: false });
  }, [emptyAction, canFetchMore, fetchNext, pageCount]);
  const findMore = () => { setResume({ key: filterKey, at: pageSizes.length }); void q.fetchNextPage(); };
  const legacyGuide = !term && q.isError && browseUnsupported(q.error);

  // 검색 1회 = 제출 1번마다 결과(첫 페이지) 도착 시 1번 — 검색어 원문은 보내지 않는다(길이·결과 수만)
  const tracked = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!term || !q.isSuccess || tracked.current === searchSeq) return;
    tracked.current = searchSeq;
    track(EVENTS.food_packaged_search, { query_length: Array.from(term).length, result_count: items.length });
  }, [term, q.isSuccess, items.length, searchSeq]);

  // KB-901(T-017): 돋보기·키보드 검색 = 키보드 내림(안 내려가 빈 결과 안내가 키보드에 가렸다)
  const submit = () => { setQuery(draft); setSearchSeq((n) => n + 1); inputRef.current?.blur(); };
  const clear = () => { setDraft(''); setQuery(''); };
  // 시안 04·47: 성분표 찍기(비회원 = 가입 게이트) — 상세 "성분표 직접 확인"과 같은 진입(새 분석)
  const scanLabel = () => {
    if (guest) { setGate(true); return; }
    router.navigate(`/scan?mode=packaged&label=1&t=${Date.now()}` as Href);
  };
  const changeSearch = () => { clear(); inputRef.current?.focus(); };
  const pickVerdict = (next: 'all' | VerdictChipRisk) => setVerdictChip(next);
  const pickType = (next: PackagedType | null) => {
    setType(next);
    track(EVENTS.food_packaged_type_select, { type: next ? next.toLowerCase() : 'all' }); // 계측 값은 소문자 유지(1단계와 같은 값)
  };

  const header = (
    <View>
      {top}
      {/* KB-914(R-142): 상단 = Dishes와 같은 검색 행(검색칸 + 주황 스캔 버튼 — 가공식품 모드로).
          KB-927: 판정 칩 = 서버 verdict 필터(클라 필터 0 — 받은 페이지만 걸러 0건처럼 보이는 일 없음) */}
      <View style={st.searchRow}>
      <View style={st.searchBox}>
        <Input
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          placeholder={t('packaged.searchPlaceholder')}
          placeholderTextColor={C.ink2}
          returnKeyType="search"
          style={st.searchInput}
          testID="packaged-search-input"
        />
        {draft ? (
          <Pressable onPress={clear} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('packaged.clearSearch')} testID="packaged-search-clear">
            <IconClose size={18} color={C.ink3} />
          </Pressable>
        ) : null}
        <Pressable onPress={submit} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('packaged.searchPlaceholder')} testID="packaged-search-submit">
          <IconSearch size={20} color={C.inkMute} />
        </Pressable>
      </View>
      <SearchScanButton onPress={() => router.navigate(`/scan?mode=packaged&t=${Date.now()}` as Href)} testID="packaged-scan" />
      </View>
      {/* KB-927: 칩 줄 = Dishes와 같은 공용 줄(가로 스크롤·끝 여백·숨은 칩 페이드). 첫 줄 판정 칩(회원 판정이 있을 때만) · 둘째 줄 유형 칩(항상) */}
      {verdictChips && (
        <ChipScrollRow style={st.chips} minHeight={chipRowHeight(fontScale)} keyboardShouldPersistTaps="handled" scrollTestID="packaged-verdicts" fadeTestID="packaged-verdicts-fade">
          {(['all', 'safe', 'danger', 'caution'] as const).map((c) => (
            <Chip
              key={c}
              label={c === 'all' ? t('home.filterAll') : t(`risk.${c}`)}
              selected={verdictChip === c}
              onPress={() => pickVerdict(c)}
              testID={`packaged-verdict-${c}`}
              risk={c === 'all' ? undefined : c} // 리본·Dishes 칩과 같은 상태색·마크
            />
          ))}
        </ChipScrollRow>
      )}
      {v4 && (
        // KB-901(T-017): 바깥 목록만 handled면 안쪽 가로 칩 줄의 첫 탭은 키보드 닫기에 쓰였다(✕ 뒤 Drinks 첫 탭 무반응)
        <ChipScrollRow style={verdictChips ? st.chipsSecond : st.chips} minHeight={chipRowHeight(fontScale)} keyboardShouldPersistTaps="handled" scrollTestID="packaged-types" fadeTestID="packaged-types-fade">
          <Chip label={t('food.categories.all')} selected={type == null} onPress={() => pickType(null)} testID="packaged-type-all" />
          {PACKAGED_TYPES.map((k) => <Chip key={k} label={t(packagedTypeKey(k))} selected={type === k} onPress={() => pickType(k)} testID={`packaged-type-${k.toLowerCase()}`} />)}
        </ChipScrollRow>
      )}
      {/* KB-901(T-105): 유형 칩을 고르면 제목 = 그 유형명(Drinks인데 "Popular picks"였다) */}
      {!legacyGuide && (items.length > 0 || q.isPending) && (
        <Text style={st.heading} accessibilityRole="header" testID="packaged-heading">
          {term ? t('packaged.searchResults') : v4 && type ? t(packagedTypeKey(type)) : t('packaged.popularPicks')}
        </Text>
      )}
    </View>
  );

  let empty: React.ReactElement | null = null;
  if (legacyGuide) {
    // 구서버(v4 미배포) — 검색 안내 그대로(P-523 Q2)
    empty = (
      <View style={st.state} testID="packaged-guide">
        <PackagedPlaceholder type={null} foodType={null} style={st.stateArt} />
        <Text style={st.stateTitle}>{t('packaged.guideTitle')}</Text>
        <Text style={st.stateBody}>{t('packaged.guideBody')}</Text>
      </View>
    );
  } else if (q.isPending) {
    empty = <SkeletonGrid width={cardW} />;
  } else if (q.isError) {
    empty = <View style={st.errorPad}><QueryErrorBlock error={q.error} onRetry={() => void q.refetch()} /></View>;
  } else if (q.hasNextPage) {
    // KB-927: 지금까지 0건이어도 다음이 있으면 "결과 없음"이 아니다 — 이어 부르는 중 = 스켈레톤 · 3번 빈 뒤 = 더 찾아보기 · 다음 페이지 실패 = 다시 시도
    empty = emptyAction === 'button' && canFetchMore ? (
      <View style={st.findMorePad} testID="packaged-find-more-empty">
        <Btn variant="ghost" onPress={findMore} testID="packaged-find-more">{t('packaged.findMore')}</Btn>
      </View>
    ) : q.isFetchNextPageError ? null : <SkeletonGrid width={cardW} />;
  } else {
    // 시안 04(검색 0)·47(유형 칩으로 0) — 탭 안에서 목록 자리만 바꾼다(예진 10/22: 검색창·칩 유지, 버튼은 본문)
    const filtered = v4 && (type != null || verdicts != null); // KB-927: 판정 칩으로 0건도 "필터 결과 없음"
    empty = (
      <View style={st.noMatch} testID={filtered ? 'packaged-no-filter-match' : 'packaged-empty'}>
        <View style={st.noMatchArt}><IconSearch size={32} color="#000000" /></View>
        <Text style={st.noMatchTitle} accessibilityRole="header">{t(filtered ? 'packaged.noFilterMatchTitle' : 'packaged.emptyTitle')}</Text>
        <Text style={st.noMatchBody}>{t(filtered ? 'packaged.noFilterMatchBody' : FLAGS.packagedLabelScan ? 'packaged.emptyBodyLabel' : 'packaged.emptyBody')}</Text>
        <View style={st.noMatchActions}>
          {FLAGS.packagedLabelScan && <Btn onPress={scanLabel} testID="packaged-empty-scan-label">{t('packaged.scanIngredientLabel')}</Btn>}
          {filtered ? (
            // KB-901(T-016): "모든 제품" = 칩 All + 검색어도 지움(검색어가 남아 두 번째 빈 화면으로 갔다)
            <Btn variant="ghost" onPress={() => { clear(); pickType(null); pickVerdict('all'); }} testID="packaged-empty-show-all">{t('packaged.showAllProducts')}</Btn>
          ) : (
            <Btn variant="ghost" onPress={changeSearch} testID="packaged-empty-change-search">{t('packaged.changeSearch')}</Btn>
          )}
        </View>
      </View>
    );
  }

  return (
    <>
    <Animated.FlatList
      data={items}
      numColumns={2}
      columnWrapperStyle={st.columns}
      keyExtractor={(it: ProcessedFoodSummary) => it.id}
      renderItem={({ item }: { item: ProcessedFoodSummary }) => <ProductCard item={item} width={cardW} personalized={personalized} unset={unset} onOpen={() => router.push(`/processed-foods/${item.id}` as Href)} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={
        q.isFetchingNextPage ? <Spinner /> : items.length > 0 && emptyAction === 'button' ? (
          <View style={st.findMorePad}><Btn variant="ghost" onPress={findMore} testID="packaged-find-more">{t('packaged.findMore')}</Btn></View>
        ) : q.isFetchNextPageError ? (
          // Codex #308 P2: 다음 페이지 실패 = 안내 + 다시 시도(자동 재요청은 멈춤 — 수동만)
          <Pressable style={st.moreErr} onPress={() => void q.fetchNextPage()} accessibilityRole="button" testID="packaged-more-retry">
            <Text style={st.moreErrText}>{t('packaged.loadMoreFailed')}</Text>
            <Text style={st.moreErrCta}>{t('common.tryAgain')}</Text>
          </Pressable>
        ) : null
      }
      onEndReachedThreshold={0.6}
      // Codex #374 P2 → QA(pr374b): 목록 끝은 마지막 페이지에 건이 있을 때(emptyAction 'none')만 — 빈 페이지면 자동 효과·"더 찾아보기"만 이어 부른다.
      // 빈 목록은 늘 바닥이라 자동 이어 부르기와 같은 커서를 한 번 더 보냈다(cancelRefetch 기본 = 진행 중 요청을 끊고 다시 — 11페이지에 19요청)
      onEndReached={() => { if (endReachedShouldFetch({ hasNext: q.hasNextPage, emptyAction, fetching: q.isFetchingNextPage, nextError: q.isFetchNextPageError })) void q.fetchNextPage(); }}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: 110 }}
      keyboardShouldPersistTaps="handled"
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      testID="packaged-list"
    />
    <AuthGateSheet context="scan" open={gate} onClose={() => setGate(false)} />
    </>
  );
}

// 시안 01 실측(2x PNG): 사진 끝 → 제조사(13/18, 위 6) → 이름(17/24, 위 5) → 한국어명(14/20, 위 3) → 평점 줄(20, 위 6) · 다음 줄 사진까지 20
const card = StyleSheet.create({
  root: { marginBottom: 20 },
  photo: { aspectRatio: 161.5 / 176, borderRadius: radius.md, backgroundColor: C.surface2, overflow: 'hidden' },
  image: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8 },
  badge: { position: 'absolute', left: 10, top: 0 },
  maker: { fontFamily: font.body, fontSize: 14, lineHeight: 19, color: C.ink2, marginTop: 6 },
  nameBox: { marginTop: 5 }, // KB-914(R-140): 이름 글자 = ProductName(row 16 굵게 + 14) — 구 17/24 · 16/23
  rating: { marginTop: 7 }, // 음식 목록 카드 평점 줄(18) 그대로(예진 10/22) — 시안 평점 줄 중심(이름 열 아래)에 맞춤
  // 시안 05: 사진 #F2F3F6(=hair, Shimmer 바탕) · 막대 r 알약
  skelGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, paddingHorizontal: 20 },
  skelPhoto: { backgroundColor: C.hair },
  skelBar1: { width: 130, height: 16, borderRadius: radius.pill, marginTop: 8 },
  skelBar2: { width: 90, height: 12, borderRadius: radius.pill, marginTop: 8 },
});

// R-95 실측(2x PNG): 탭 높이 48(라벨 16/24 semibold · 밑줄 2) · 활성 #2F3137 · 비활성 gray-700 · 구분선 0.5 gray-300
const seg = StyleSheet.create({
  row: { flexDirection: 'row' },
  tab: { flex: 1, height: 48, justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  label: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 24, color: C.ink2 },
  labelOn: { color: '#2F3137' },
  bar: { alignSelf: 'stretch', height: 2, backgroundColor: 'transparent' },
  barOn: { backgroundColor: '#212124' },
  divider: { height: 0.5, backgroundColor: C.line2 },
});

const ph = StyleSheet.create({
  box: { backgroundColor: C.hair, alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden' },
  label: { fontFamily: font.body, fontSize: 14, lineHeight: 19, color: C.ink2, paddingHorizontal: 6 },
});

// R-95 실측: 검색 335×48(세그먼트 아래 24) · 행 72(썸네일 72 r8) 간격 20 · 이름 16 bold ink · 제조사 14 gray-600 · 카드 보더 #EAEBEE
const st = StyleSheet.create({
  // 시안 01: 탭 구분선 아래 16 · 335×48 · 칩 줄(36) 위 16 · 제목(20 bold) 위 26·아래 16
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 20 }, // KB-914: Dishes 검색 행(A-HM-02)과 같은 줄
  searchBox: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: C.surface2, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  searchInput: { flex: 1, height: 48, fontSize: 16, color: C.ink, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0 },
  chips: { marginTop: 16 },
  chipsSecond: { marginTop: 8 }, // KB-927: 판정 줄 아래 유형 줄
  findMorePad: { paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center' },
  heading: { fontFamily: font.bodyBold, fontSize: 22, lineHeight: 28, color: C.ink, marginTop: 26, marginBottom: 16, marginHorizontal: 20 },
  columns: { paddingHorizontal: 20, gap: 12 },
  row: { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginBottom: 20 },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
  card: { flex: 1, minWidth: 0, minHeight: 72, justifyContent: 'center', borderWidth: 1, borderColor: C.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.card },
  name: { fontFamily: font.bodyBold, fontSize: 16, lineHeight: 22, color: C.ink },
  maker: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: C.ink3 },
  type: { fontFamily: font.body, fontSize: 13, lineHeight: 17, color: C.ink3 },
  skel: { paddingHorizontal: 20, gap: 20 },
  moreErr: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 8, minHeight: 44, paddingHorizontal: 20 },
  moreErrText: { fontFamily: font.body, fontSize: 14, color: C.ink3 },
  moreErrCta: { fontFamily: font.bodyBold, fontSize: 14, color: C.primaryText },
  skelCard: { height: 104, borderRadius: radius.md },
  errorPad: { paddingHorizontal: 20, paddingTop: 24 },
  // 시안 04·47 실측: 아트 335×148 r16 #F7F8FA(돋보기 32) 위 16 → 제목(24 bold, 위 16) → 본문(16/26 gray-700, 위 18) → 버튼 48 둘(간격 8, 위 24)
  noMatch: { paddingHorizontal: 20, paddingTop: 16 },
  noMatchArt: { height: 148, borderRadius: radius.lg, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  noMatchTitle: { fontFamily: font.bodyBold, fontSize: 24, lineHeight: 32, color: C.ink, marginTop: 16 },
  noMatchBody: { fontFamily: font.body, fontSize: 16, lineHeight: 26, color: C.ink2, marginTop: 18 },
  noMatchActions: { gap: 8, marginTop: 24 },
  // 시안 empty(12338:37301): 유형 아트 335×150 r8 → 제목 → 본문
  state: { paddingHorizontal: 20, paddingTop: 16, gap: 16 }, // QA(10/22): 검색창과 안내 상자가 붙어 있었다 — 시안 04 아트 상자와 같은 16
  stateArt: { height: 150, borderRadius: radius.md },
  stateTitle: { fontFamily: font.bodyBold, fontSize: 20, lineHeight: 28, color: C.ink, marginTop: 8 },
  stateBody: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: C.ink },
});

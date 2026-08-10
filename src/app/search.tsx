/**
 * Menu search (KB-21 UI · KB-71 실연결) — full-screen search reached from the
 * header search icon. Three states:
 *   1. empty  → recent searches (local, per-row delete + clear all; dashed hint
 *      when none) + editorial "popular" list.
 *      ⚠️ popular block is still MOCK — 인기순 계약 미배포. 인기 API가 배포되면
 *      useFoods() 몫을 실호출로 교체할 것.
 *   2. results → LIVE GET /foods/search (KB-71): submit-only (자동완성 MVP 제외),
 *      keyword 부분일치(한국어명+리더 언어 번역명, 대소문자 무시는 서버 몫),
 *      nextCursor 무한스크롤(hasNext=false까지) — 목록과 같은 커서 패턴.
 *   3. none    → empty items page (정상 응답) → friendly empty state.
 *
 * Risk badges are personalized (personalRisk false-safe guard) and rendered with
 * the KB-25 RiskPill. Blank keywords never leave the client (server 400s).
 */
import { useState, useEffect, useRef } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow, type RiskState } from '@/lib/theme';
import { RiskPill, Spinner, StateBlock, stateIconColor, QueryErrorBlock, classifyQueryError, CardPhoto, PressScale, IconArrowLeft, IconSearch, IconClose, IconChevron, IconFood, Input } from '@/components';
import { useFoods, useInfiniteFoods, useSearchFoods } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { useRecentSearches } from '@/lib/data/useRecentSearches';
import { personalRisk } from '@/lib/risk';
import { EVENTS, track } from '@/lib/analytics';
import { useIsGuest } from '@/lib/auth/useSession';
import type { FoodCard } from '@/lib/api/types';

const POPULAR_N = 6;

export default function Search() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // MOCK — 인기 한식 블록 전용 (인기순 API 미배포; 배포 시 교체)
  const { data: mockCatalog } = useFoods();
  const { data: me } = useMe();
  const { recent, add, remove, clear } = useRecentSearches();

  const [query, setQuery] = useState(''); // input text
  const [submitted, setSubmitted] = useState(''); // executed search term (submit-only)

  const hasR = (me?.restrictions.length ?? 0) > 0;
  const isGuest = useIsGuest();
  const search = useSearchFoods(submitted);
  const results = search.data ?? [];

  // P-028(KB-174 후속): 오프라인 판정 프로브 — empty 상태(최근+인기)는 로컬·mock이라
  // 스스로는 에러가 안 나므로, 음식탭과 같은 live 쿼리(캐시 공유·같은 키)를 신호로 쓴다.
  // 오프라인(J4)만 empty를 대체 — 서버 5xx(J3)는 로컬 콘텐츠를 가릴 이유가 없다.
  const probe = useInfiniteFoods();
  const offline = probe.isError && classifyQueryError(probe.error) === 'offline';

  const popular = [...(mockCatalog ?? [])]
    .sort((a, b) => (a.popularityRank ?? 999) - (b.popularityRank ?? 999))
    .slice(0, POPULAR_N);

  const riskOf = (f: FoodCard): RiskState => personalRisk(f.risk, hasR);
  const openFood = (id: string) => router.push(`/food/${id}?src=search` as Href);

  const doSearch = (term: string) => {
    const tterm = term.trim();
    if (!tterm) return; // blank never hits the server (400)
    setQuery(tterm);
    setSubmitted(tterm);
    add(tterm);
  };

  // P-144: search_query — 결과 수신 후 1회(keyword 소문자 정규화 + result_count).
  // 인기 검색어·메타데이터 보완 재료(멘토 #39). 검색어는 PII 아님(재료명/닉네임 미포함 규정과 별개 축).
  const trackedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!submitted || search.isLoading || trackedFor.current === submitted) return;
    trackedFor.current = submitted;
    track(EVENTS.search_query, { keyword: submitted.toLowerCase(), result_count: results.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, search.isLoading]);
  const reset = () => {
    setQuery('');
    setSubmitted('');
  };

  const showingSearch = submitted.length > 0;

  return (
    <View style={styles.root}>
      {/* header: back + input + clear */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <PressScale onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <IconArrowLeft size={22} color={C.ink} />
        </PressScale>
        <View style={styles.box}>
          <IconSearch size={18} color={C.ink2} />
          <Input
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={C.ink3}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => doSearch(query)}
          />
          {query.length > 0 && (
            <Pressable onPress={reset} hitSlop={8}>
              <IconClose size={16} color={C.ink3} />
            </Pressable>
          )}
        </View>
      </View>

      {!showingSearch && offline ? (
        /* 1a. offline: 전체화면 J4 — 홈·음식탭과 톤 통일 (P-028) */
        <View style={styles.fill}>
          <QueryErrorBlock error={probe.error} onRetry={() => void probe.refetch()} />
        </View>
      ) : !showingSearch ? (
        /* 1. empty state: recent (local) + popular (mock) */
        <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.secHead}>
            <Text style={styles.secTag}>{t('search.recent')}</Text>
            {recent.length > 0 && (
              <Pressable onPress={clear} hitSlop={6}>
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
                  <Pressable style={styles.recentTap} onPress={() => doSearch(rterm)}>
                    <Text style={styles.recentText} numberOfLines={1}>{rterm}</Text>
                  </Pressable>
                  <Pressable onPress={() => remove(rterm)} hitSlop={8}>
                    <IconClose size={15} color={C.ink3} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* popular editorial — MOCK (인기순 API 미배포) */}
          <Text style={[styles.secTag, { marginTop: 22 }]}>{t('search.popular')}</Text>
          <View style={{ gap: 2 }}>
            {popular.map((f) => (
              <PopularRow key={f.foodId} food={f} onPress={() => doSearch(f.nameKo)} />
            ))}
          </View>
        </ScrollView>
      ) : search.isLoading ? (
        <View style={styles.fill}>
          <Spinner />
        </View>
      ) : search.isError ? (
        /* 제출 검색 에러 — 공용 J3/J4 렌더로 톤 통일 (P-028 재량 항목) */
        <View style={[styles.body, styles.noResults]}>
          <QueryErrorBlock error={search.error} onRetry={() => void search.refetch()} />
        </View>
      ) : results.length > 0 ? (
        /* 2. results: live pages, cursor infinite scroll */
        <FlatList keyboardDismissMode="on-drag"
          data={results}
          keyExtractor={(f: FoodCard) => f.foodId}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<Text style={styles.count}>{t('search.resultCount', { count: results.length })}</Text>}
          ListFooterComponent={search.isFetchingNextPage ? <Spinner /> : null}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <ResultCard food={item} risk={riskOf(item)} guest={isGuest} onPress={() => openFood(item.foodId)} />
          )}
        />
      ) : (
        /* 3. no results — empty page 1 is a normal response */
        <View style={[styles.body, styles.noResults]}>
          <StateBlock
            icon={<IconSearch size={34} color={stateIconColor.default} />}
            title={t('search.noResultsTitle')}
            body={t('search.noResultsBody')}
            primary={{ label: t('search.backToPopular'), onPress: reset }}
          />
        </View>
      )}
    </View>
  );
}

// Popularity chart is editorial (what's popular), not a personalized safety
// read — no risk badge here (per canonical design); badges live on results.
function PopularRow({ food, onPress }: { food: FoodCard; onPress: () => void }) {
  const top = food.popularityRank === 1;
  return (
    <Pressable style={styles.popRow} onPress={onPress}>
      <Text style={[styles.rank, top && styles.rankTop]}>{food.popularityRank ?? '·'}</Text>
      <View style={styles.popMeta}>
        <Text style={styles.popName} numberOfLines={1}>{food.name}</Text>
        {food.nameKo !== food.name && <Text style={styles.popKo} numberOfLines={1}>{food.nameKo}</Text>}
      </View>
      <IconChevron size={16} color={C.ink3} />
    </Pressable>
  );
}

export function ResultCard({ food, risk, guest, onPress }: { food: FoodCard; risk: RiskState; guest: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.thumb}>
        {food.photoUrl ? (
          <CardPhoto uri={food.photoUrl} recyclingKey={food.foodId} borderRadius={12} />
        ) : (
          <IconFood size={22} color={C.ink3} />
        )}
      </View>
      <View style={styles.cardMeta}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={1}>{food.name}</Text>
          {food.nameKo !== food.name && <Text style={styles.cardKo} numberOfLines={1}>{food.nameKo}</Text>}
        </View>
        {!!food.blurb && <Text style={styles.cardBlurb} numberOfLines={1}>{food.blurb}</Text>}
      </View>
      {/* 게스트에겐 개인화 뱃지 미렌더 (guest-access-policy §1) */}
      {!guest && <RiskPill state={risk} size="sm" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hair,
  },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
    ...shadow.sh1,
  },
  input: { flex: 1, fontFamily: font.body, fontSize: 14.5, color: C.ink, padding: 0 },

  body: { padding: 18, paddingBottom: 40 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secTag: { fontFamily: font.bodyBold, fontSize: 12, letterSpacing: 0.3, color: C.ink2, textTransform: 'uppercase', marginBottom: 8 },
  clearAll: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primaryText },

  recentHint: { borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', borderRadius: 13, padding: 16, alignItems: 'center' },
  recentHintText: { fontFamily: font.body, fontSize: 13, color: C.ink3, textAlign: 'center' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  recentTap: { flex: 1 },
  recentText: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },

  popRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 11 },
  rank: { width: 22, textAlign: 'center', fontFamily: font.display, fontSize: 16, color: C.ink3 },
  rankTop: { color: C.primary },
  popMeta: { flex: 1, minWidth: 0 },
  popName: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink },
  popKo: { fontFamily: font.ko, fontSize: 12.5, color: C.ink2, marginTop: 1 },

  count: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink2, marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 12, ...shadow.sh1 },
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  cardMeta: { flex: 1, minWidth: 0, gap: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  cardName: { flexShrink: 1, fontFamily: font.bodyBold, fontSize: 15, color: C.ink },
  cardKo: { fontFamily: font.ko, fontSize: 12, color: C.ink2 },
  cardBlurb: { fontFamily: font.body, fontSize: 12.5, color: C.ink3 },

  noResults: { paddingTop: 40 },
});

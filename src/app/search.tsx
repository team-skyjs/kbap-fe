/**
 * Menu search (KB-21, mockup "Menu Search") — full-screen search reached from
 * the header search icon. Three states:
 *   1. empty  → recent searches (local, per-row delete + clear all; dashed hint
 *      when none) + editorial "popular" list (catalog popularityRank).
 *   2. results → count + result cards (thumb, EN/KO name, blurb, risk badge).
 *   3. none    → friendly empty state with a route back to popular.
 *
 * Risk badges are personalized (personalRisk false-safe guard) and rendered with
 * the KB-25 RiskPill — never reimplemented here. Live querying/history are mock/
 * local; real search lands with KB-71. Reader text is i18n (9 languages).
 */
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow, type RiskState } from '@/lib/theme';
import { RiskPill, StateBlock, stateIconColor, IconArrowLeft, IconSearch, IconClose, IconChevron, IconFood } from '@/components';
import { useFoods } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { useRecentSearches } from '@/lib/data/useRecentSearches';
import { personalRisk } from '@/lib/risk';
import type { FoodCard } from '@/lib/api/types';

const POPULAR_N = 6;

export default function Search() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const { data: foods } = useFoods();
  const { data: me } = useMe();
  const { recent, add, remove, clear } = useRecentSearches();
  const [query, setQuery] = useState('');

  const hasR = (me?.restrictions.length ?? 0) > 0;
  const catalog = foods ?? [];
  const term = query.trim();
  const q = term.toLowerCase();

  const popular = useMemo(
    () => [...catalog].sort((a, b) => (a.popularityRank ?? 999) - (b.popularityRank ?? 999)).slice(0, POPULAR_N),
    [catalog],
  );
  const results = useMemo(
    () => (q ? catalog.filter((f) => f.name.toLowerCase().includes(q) || f.nameKo.includes(term)) : []),
    [catalog, q, term],
  );

  const riskOf = (f: FoodCard): RiskState => personalRisk(f.risk, hasR);
  const openFood = (id: string, record: boolean) => {
    if (record) add(term);
    router.push(`/food/${id}` as Href);
  };

  return (
    <View style={styles.root}>
      {/* header: back + input + clear */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <IconArrowLeft size={22} color={C.ink} />
        </Pressable>
        <View style={styles.box}>
          <IconSearch size={18} color={C.ink2} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={C.ink3}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => add(term)}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); inputRef.current?.focus(); }} hitSlop={8}>
              <IconClose size={16} color={C.ink3} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {q === '' ? (
          <>
            {/* recent */}
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
                    <Pressable style={styles.recentTap} onPress={() => setQuery(rterm)}>
                      <Text style={styles.recentText} numberOfLines={1}>{rterm}</Text>
                    </Pressable>
                    <Pressable onPress={() => remove(rterm)} hitSlop={8}>
                      <IconClose size={15} color={C.ink3} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* popular editorial */}
            <Text style={[styles.secTag, { marginTop: 22 }]}>{t('search.popular')}</Text>
            <View style={{ gap: 2 }}>
              {popular.map((f) => (
                <PopularRow key={f.foodId} food={f} onPress={() => openFood(f.foodId, false)} />
              ))}
            </View>
          </>
        ) : results.length > 0 ? (
          <>
            <Text style={styles.count}>{t('search.resultCount', { count: results.length })}</Text>
            <View style={{ gap: 10 }}>
              {results.map((f) => (
                <ResultCard key={f.foodId} food={f} risk={riskOf(f)} onPress={() => openFood(f.foodId, true)} />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.noResults}>
            <StateBlock
              icon={<IconSearch size={34} color={stateIconColor.default} />}
              title={t('search.noResultsTitle')}
              body={t('search.noResultsBody')}
              primary={{ label: t('search.backToPopular'), onPress: () => { setQuery(''); inputRef.current?.focus(); } }}
            />
          </View>
        )}
      </ScrollView>
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
        <Text style={styles.popKo} numberOfLines={1}>{food.nameKo}</Text>
      </View>
      <IconChevron size={16} color={C.ink3} />
    </Pressable>
  );
}

function ResultCard({ food, risk, onPress }: { food: FoodCard; risk: RiskState; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.thumb}>
        {food.photoUrl ? (
          <Image source={food.photoUrl} recyclingKey={food.foodId} contentFit="cover" transition={150} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
        ) : (
          <IconFood size={22} color={C.ink3} />
        )}
      </View>
      <View style={styles.cardMeta}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={1}>{food.name}</Text>
          <Text style={styles.cardKo} numberOfLines={1}>{food.nameKo}</Text>
        </View>
        {!!food.blurb && <Text style={styles.cardBlurb} numberOfLines={1}>{food.blurb}</Text>}
      </View>
      <RiskPill state={risk} size="sm" />
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

  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secTag: { fontFamily: font.bodyBold, fontSize: 12, letterSpacing: 0.3, color: C.ink2, textTransform: 'uppercase', marginBottom: 8 },
  clearAll: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primary },

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

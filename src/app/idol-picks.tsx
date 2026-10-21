/**
 * K-POP & K-FOOD 목록 (KB-836, 02_designer_spec 화면 2) — `/idol-picks`.
 * 데이터 = 전용 쿼리 useIdolPicks(GET /api/foods/idol-picks — 음식 요약 + 대표 영상, D2). 이 캐시를 상세 V1 카드가 읽는다(D3).
 * 다크 헤더(이 화면 전용, StatusBar light) + 2열 3:4 포스터 그리드(BE 순서 그대로, 칩 필터 없음).
 * 상태: 로딩 = Shimmer 6칸 · 오류·캐시 없음 = QueryErrorBlock · 0건 = EmptyBlock · 캐시 있는 백그라운드 실패 = 목록 유지.
 * 위험도 배지 = 회원만(useIsGuest() === false — R-07). 계측: 포커스마다 home_idol_pick_list_view{count} · 카드 → 상세 src=idol_pick.
 */
import * as React from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useIsFocused, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { Shimmer } from '@/components/Skeleton';
import { EmptyBlock, QueryErrorBlock } from '@/components/StateBlock';
import { IconArrowLeft, IconQuestion } from '@/components/icons';
import { IdolPosterCard } from '@/features/home/IdolPosterCard';
import { isGridPad, padOddGrid } from '@/features/food/FoodCards';
import { useIdolPicks } from '@/lib/data/useIdolPicks';
import { useIsGuest } from '@/lib/auth/useSession';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import { EVENTS, track } from '@/lib/analytics';
import { color as C, font } from '@/lib/theme';

const GUTTER = 20;
const GAP = 12;
/** 셀 폭 = (W − 좌우 20·20 − 열 간격 12) / 2 — 375 = 161.5, 320 = 134 */
export const cellWidth = (w: number) => (w - GUTTER * 2 - GAP) / 2;

export default function IdolPicksScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const cellW = cellWidth(useWindowDimensions().width);
  const { data: picks, isPending, isError, error, refetch } = useIdolPicks();
  const { data: me } = useMe();
  const member = useIsGuest() === false;
  const hasR = (me?.restrictions ?? []).length > 0;
  const count = picks?.length;

  // Codex #313 P2: 포커스당 1회 — 캐시 표시 뒤 refetch 로 count 가 바뀌어도 같은 포커스에서 다시 쏘지 않는다. blur 에 리셋
  const sent = React.useRef(false);
  useFocusEffect(
    React.useCallback(
      () => () => {
        sent.current = false;
      },
      [],
    ),
  );
  React.useEffect(() => {
    if (!isFocused || count == null || sent.current) return;
    sent.current = true;
    track(EVENTS.home_idol_pick_list_view, { count });
  }, [isFocused, count]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(tabs)' as Href))} hitSlop={4} style={styles.back} accessibilityRole="button" accessibilityLabel={t('common.goBack')} testID="idol-picks-back">
        <IconArrowLeft size={24} color="#FFFFFF" />
      </Pressable>
      <View style={styles.headRow}>
        <View style={styles.headText}>
          <Text style={styles.label}>{t('idolPicks.label')}</Text>
          <Text style={styles.title} accessibilityRole="header">{t('idolPicks.title')}</Text>
          <Text style={styles.sub}>{t('idolPicks.sub')}</Text>
        </View>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <IconQuestion size={56} color={C.primary} />
        </View>
      </View>
    </View>
  );

  let empty: React.ReactElement | null = null;
  if (!picks && isPending) {
    empty = (
      <View style={[styles.grid, styles.skelGrid]} testID="idol-picks-skeleton">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Shimmer key={i} style={{ width: cellW, height: (cellW * 4) / 3, borderRadius: 12 }} />
        ))}
      </View>
    );
  } else if (!picks && isError) {
    empty = <QueryErrorBlock error={error} onRetry={() => void refetch()} />;
  } else if (picks?.length === 0) {
    empty = <EmptyBlock label={t('idolPicks.empty')} testID="idol-picks-empty" />;
  }

  return (
    <View style={styles.root}>
      {isFocused && <StatusBar style="light" />}
      <FlatList
        data={picks ? padOddGrid(picks) : []}
        keyExtractor={(f) => f.foodId}
        numColumns={2}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        renderItem={({ item: f }) =>
          isGridPad(f) ? (
            <View style={{ width: cellW }} />
          ) : (
            <IdolPosterCard
              food={f}
              width={cellW}
              risk={member ? personalRisk(f.risk, hasR) : null}
              onOpen={() => router.push(`/food/${f.foodId}?src=idol_pick` as Href)}
            />
          )
        }
        testID="idol-picks-list"
      />
      {/* Codex #313 P2: 다크 헤더가 스크롤로 사라져도 light 상태바 아이콘 뒤는 항상 ink — 상태바 영역 고정 면(색만, 레이아웃 무관) */}
      <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} testID="idol-picks-status-scrim" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  statusScrim: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: C.ink },
  header: { backgroundColor: C.ink, paddingHorizontal: GUTTER, paddingBottom: 24, gap: 12, marginBottom: 20 },
  back: { width: 36, height: 36, justifyContent: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  headText: { flex: 1, gap: 6 },
  label: { fontFamily: font.bodyBold, fontSize: 11, lineHeight: 16, letterSpacing: 1.6, color: C.primary },
  title: { fontFamily: font.bodyBlack, fontSize: 24, lineHeight: 32, color: '#FFFFFF' },
  sub: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: '#FFFFFF', opacity: 0.7 },
  row: { paddingHorizontal: GUTTER, gap: GAP },
  grid: { paddingHorizontal: GUTTER },
  skelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});

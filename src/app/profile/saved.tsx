/**
 * Saved (bookmarks) — KB-434 D-6(4150:14448). AppBar "Saved" → 헤더 메타
 * ("n dishes · Newest first") → 위험 칩(All·Safe·Avoid·Warning — D-2 홈 동일 문법)
 * → 음식 카드 2열 그리드(4150:13816 — 홈 FoodGridCard 재사용, 북마크 별 = 해제 토글).
 *
 * Data: LIVE GET /bookmarks 커서 무한스크롤(KB-142) — 훅·언세이브(낙관적 제거+Undo
 * 스낵바) 무변. 구 스와이프 행 문법 소멸(시안 = 그리드 + 별 토글).
 * risk = personalRisk() false-safe 가드 경유(칩 필터도 동일 값 기준).
 */
import { useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import { SubHeader, Spinner, Btn, IconStar, IconFood } from '@/components';
import { Chip } from '@/components/Chip';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { QueryErrorBlock } from '@/components/StateBlock';
import { Snackbar } from '@/components/Snackbar';
import { useIsGuest } from '@/lib/auth/useSession';
import { useMe } from '@/lib/data/useMe';
import { EVENTS, track } from '@/lib/analytics';
import { useBookmarks, useRemoveBookmark, useRestoreBookmark, type BookmarkSnapshot } from '@/lib/data/bookmarks';
import type { FoodCard } from '@/lib/api/types';
import { personalRisk } from '@/lib/risk';
import type { RiskState } from '@/lib/theme';
import { FoodGridCard } from '@/features/food/FoodCards';

const UNDO_MS = 5000;
type RiskChip = 'all' | RiskState;
const RISK_CHIPS: RiskChip[] = ['all', 'safe', 'danger', 'caution'];

export default function SavedScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isGuest = useIsGuest();
  const { data: list, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useBookmarks(); // P-164
  const { data: me } = useMe();
  const remove = useRemoveBookmark();
  const restore = useRestoreBookmark();
  const [chip, setChip] = useState<RiskChip>('all');

  // Undo snackbar: 마지막 제거 스냅샷을 ~5s 보관 (즉시 제거 + 되돌리기 — 확인 모달 없음)
  const [undo, setUndo] = useState<BookmarkSnapshot | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRemove = (snap: BookmarkSnapshot) => {
    track(EVENTS.food_bookmark_toggle, { on: false }); // P-214: 해제가 상세분만 잡히던 집계 왜곡 보정
    remove.mutate(snap.foodId);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(snap);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  };
  const onUndo = () => {
    if (!undo) return;
    track(EVENTS.food_bookmark_toggle, { on: true }); // P-214: 되돌리기 = 재등록(기존 이벤트 재사용 — 신규 없음)
    restore.mutate(undo);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
  };

  // 라우트 자체 가드 (⑧-b 패턴) — 진입로는 프로필 탭(게이트)뿐이지만 딥링크 이중 방어
  if (isGuest) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('saved.title')} onBack={() => router.back()} />
        <AuthGateSheet context="profile" open onClose={() => router.back()} />
      </View>
    );
  }

  const hasR = (me?.restrictions.length ?? 0) > 0;
  const items = (list ?? []).filter((b) => chip === 'all' || personalRisk(b.risk, hasR) === chip);

  return (
    <View style={styles.root}>
      <SubHeader title={t('saved.title')} onBack={() => router.back()} />
      {/* P-164: 로드 실패 = 공용 에러(+재시도) — 빈 상태로 위장 금지 */}
      {isError && !list ? (
        <QueryErrorBlock error={error} onRetry={() => void refetch()} onGoBack={() => router.back()} />
      ) : isLoading ? null : (list ?? []).length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIc}>
            <IconStar size={30} color={C.ink3} />
          </View>
          <Text style={styles.emptyTitle}>{t('saved.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('saved.emptyBody')}</Text>
          {/* P-159: Btn sm 기본 alignSelf flex-start가 부모 센터를 오버라이드 — 명시 센터 */}
          <Btn sm style={{ alignSelf: 'center' }} icon={<IconFood size={17} color="#fff" />} onPress={() => router.push('/(tabs)/food' as Href)}>
            {t('saved.emptyCta')}
          </Btn>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b: FoodCard) => b.foodId}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          ListFooterComponent={isFetchingNextPage ? <Spinner /> : null}
          ListHeaderComponent={
            <View style={{ gap: 4 }}>
              {/* 헤더 메타(pad 8/24 상당) — "2 dishes" 16/600 + "· Newest first" 14/400 */}
              <View style={styles.meta}>
                <Text style={styles.metaCount}>{t('saved.count', { count: (list ?? []).length })}</Text>
                <Text style={styles.metaSub}>· {t('saved.newestFirst')}</Text>
              </View>
              {/* 위험 칩 필터(@y146) — D-2 홈과 동일 칩·순서 */}
              <View style={styles.chipRow}>
                {RISK_CHIPS.map((c) => (
                  <Chip
                    key={c}
                    label={c === 'all' ? t('home.filterAll') : t(`risk.${c}`)}
                    selected={chip === c}
                    onPress={() => setChip(c)}
                    testID={`saved-chip-${c}`}
                  />
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.gridCell}>
              <FoodGridCard
                style={styles.gridCard}
                food={item}
                risk={personalRisk(item.risk, hasR)}
                guest={false}
                saved
                riskLabel={t(`risk.${personalRisk(item.risk, hasR)}`)}
                onPress={() => router.push(`/food/${item.foodId}?src=saved` as Href)}
                onBookmark={() => onRemove(item)}
              />
            </View>
          )}
        />
      )}

      {undo && (
        <Snackbar
          icon={<IconStar size={15} color="#fff" />}
          text={t('saved.removed')}
          actionLabel={t('saved.undo')}
          onAction={onUndo}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  meta: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingVertical: 8 },
  metaCount: { fontSize: 16, fontWeight: '600', color: '#1C1E21' },
  metaSub: { fontSize: 14, fontWeight: '400', color: C.ink3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 12 },
  gridRow: { gap: 10 },
  gridCell: { flex: 1, marginBottom: 10 },
  gridCard: { width: '100%' }, // 셀(FlatList numColumns)이 폭 소유 — 홈 47% 오버라이드

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyIc: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.ink },
  emptyBody: { fontSize: 13.5, fontWeight: '400', color: C.ink2, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
});

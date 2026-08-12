/**
 * Saved (bookmarks) list — design "K-Bap Saved" (hifi-saved, Direction G).
 * Member-only stack-push from the Profile tab. Food-tab card vocab + KB-25
 * 4-state personalized badge (always shown — no guest case on this screen;
 * guests hit the route guard). Newest-first, no sort/filter UI.
 * Un-save = swipe-left → Remove, immediate + Undo snackbar (~5s), no confirm.
 *
 * Data: LIVE GET /bookmarks 커서 무한스크롤 (KB-142 실연결 2026-07-15).
 * 카드는 목록과 동일 어댑터(FoodCard) — risk는 다른 목록과 동일하게
 * personalRisk() false-safe 가드 경유. 해제=PATCH(낙관적 제거), Undo=재등록.
 */
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, riskTone, shadow } from '@/lib/theme';
import { SubHeader, RiskMark, Btn, CardPhoto, Spinner, IconChevron, IconFood, IconStar, IconTrash } from '@/components';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { QueryErrorBlock } from '@/components/StateBlock';
import { Snackbar } from '@/components/Snackbar';
import { useIsGuest } from '@/lib/auth/useSession';
import { useMe } from '@/lib/data/useMe';
import { useBookmarks, useRemoveBookmark, useRestoreBookmark, type BookmarkSnapshot } from '@/lib/data/bookmarks';
import type { FoodCard } from '@/lib/api/types';
import { personalRisk } from '@/lib/risk';
import type { RiskState } from '@/lib/theme';

const RISK_LABEL: Record<RiskState, string> = {
  safe: 'risk.safe',
  caution: 'risk.caution',
  danger: 'risk.danger',
  unable: 'risk.unable',
};
const UNDO_MS = 5000;

export default function SavedScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isGuest = useIsGuest();
  const { data: list, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useBookmarks(); // P-164
  const { data: me } = useMe();
  const remove = useRemoveBookmark();
  const restore = useRestoreBookmark();

  // Undo snackbar: 마지막 제거 스냅샷을 ~5s 보관 (즉시 제거 + 되돌리기 — 확인 모달 없음)
  const [undo, setUndo] = useState<BookmarkSnapshot | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRemove = (snap: BookmarkSnapshot) => {
    remove.mutate(snap.foodId);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(snap);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  };
  const onUndo = () => {
    if (!undo) return;
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
  const items = list ?? [];

  return (
    <View style={styles.root}>
      <SubHeader title={t('saved.title')} onBack={() => router.back()} />
      {/* P-164: 로드 실패 = 공용 에러(+재시도) — 빈 상태로 위장 금지 */}
      {isError && !list ? (
        <QueryErrorBlock error={error} onRetry={() => void refetch()} onGoBack={() => router.back()} />
      ) : isLoading ? null : items.length === 0 ? (
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
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          ListFooterComponent={isFetchingNextPage ? <Spinner /> : null}
          ListHeaderComponent={
            <View style={{ gap: 8, marginBottom: 12 }}>
              <View style={styles.meta}>
                <Text style={styles.metaCount}>{t('saved.count', { count: items.length })}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaSub}>{t('saved.newestFirst')}</Text>
              </View>
              <Text style={styles.hint}>{t('saved.swipeHint')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <SavedRow
              snap={item}
              risk={personalRisk(item.risk, hasR)}
              riskLabel={t(RISK_LABEL[personalRisk(item.risk, hasR)])}
              onPress={() => router.push(`/food/${item.foodId}` as Href)}
              onRemove={() => onRemove(item)}
            />
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

function SavedRow({
  snap,
  risk,
  riskLabel,
  onPress,
  onRemove,
}: {
  snap: BookmarkSnapshot;
  risk: RiskState;
  riskLabel: string;
  onPress: () => void;
  onRemove: () => void;
}) {
  const ref = useRef<SwipeableMethods>(null);
  return (
    <Swipeable
      ref={ref}
      friction={2}
      rightThreshold={36}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          style={styles.removeBg}
          onPress={() => {
            ref.current?.close();
            onRemove();
          }}
        >
          <IconTrash size={20} color="#fff" />
        </Pressable>
      )}
    >
      <Pressable style={styles.card} onPress={onPress}>
        <View style={styles.thumb}>
          {snap.photoUrl ? (
            <CardPhoto uri={snap.photoUrl} borderRadius={radius.sm} />
          ) : (
            <IconFood size={22} color={C.ink3} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>
              {snap.name}
            </Text>
            <Text numberOfLines={1} style={styles.ko}>
              {snap.nameKo}
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: riskTone[risk].bg, borderColor: riskTone[risk].line }]}>
            <RiskMark state={risk} size={15} />
            <Text style={[styles.pillText, { color: riskTone[risk].fg }]}>{riskLabel}</Text>
          </View>
        </View>
        <IconChevron size={17} color={C.ink3} />
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  errorFill: { flex: 1, justifyContent: 'center' }, // P-164
  root: { flex: 1, backgroundColor: C.surface },
  body: { padding: 16, paddingBottom: 40, gap: 10 },
  meta: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  metaCount: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  metaDot: { color: C.ink3 },
  metaSub: { fontFamily: font.body, fontSize: 12.5, color: C.ink3 },
  hint: { fontFamily: font.body, fontSize: 12, color: C.ink3 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: radius.lg,
    padding: 10,
    ...shadow.sh1,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, minWidth: 0 },
  name: { fontFamily: font.display, fontSize: 15.5, color: C.ink, flexShrink: 1 },
  ko: { fontFamily: font.ko, fontSize: 12, color: C.ink3 },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
  },
  pillText: { fontFamily: font.bodyBold, fontSize: 12 },
  removeBg: {
    width: 72,
    marginLeft: 10,
    borderRadius: radius.lg,
    backgroundColor: C.riskDanger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyIc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: { fontFamily: font.display, fontSize: 17, color: C.ink },
  emptyBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
});

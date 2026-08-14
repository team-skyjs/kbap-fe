/**
 * Community tab — 피드 (P-087/KB-251 목 선작업, 트위터형).
 *
 * 최신순 무한스크롤(커서) · 게스트 = 2페이지까지, 이후 로그인 게이트(AuthGateSheet)
 * · 헤더 알림 벨 = 자리만(무동작) · 작성 FAB(회원) · ⋯ = 공용 ModerationFlow.
 * 데이터는 전부 community/adapter(목) 경유 — 계약 배포 시 어댑터만 스왑.
 */
import * as React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { accentTint, color as C, font, radius, shadow } from '@/lib/theme';
import { IconBell, IconBubbleEmpty, IconLock, IconPlus, QueryErrorBlock, ShellPlaceholder, Spinner, stateIconColor, StateBlock } from '@/components';
import { Snackbar } from '@/components/Snackbar';
import { useIsGuest } from '@/lib/auth/useSession';
import { FLAGS } from '@/lib/flags';
import { ReviewFeed } from '@/features/community/ReviewFeed';
import { AuthGateSheet, type GateContext } from '@/components/AuthGateSheet';
import { useCommunityFeed, useDeletePost, useReact } from '@/lib/community/hooks';
import { useMe } from '@/lib/data/useMe';
import { consumePendingToast } from '@/lib/community/pendingToast';
import type { CommunityPost } from '@/lib/community/types';
import { PostCard } from '@/features/community/parts';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import { FoodTagSheet, PlaceTagSheet } from '@/features/community/tagSheets';

/** 게스트 무한스크롤 상한 — 2페이지 (7/29 확정). */
const GUEST_PAGE_LIMIT = 2;

export default function Community() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isGuest = useIsGuest();
  const myId = useMe().data?.id ?? ''; // P-142: 내 글 판별 = 실 회원 id

  const feed = useCommunityFeed();
  const react = useReact();
  const deletePost = useDeletePost();

  const [gate, setGate] = React.useState<GateContext | null>(null);
  const [mod, setMod] = React.useState<ModTarget | null>(null);
  const [foodSheet, setFoodSheet] = React.useState<{ foodId: string; name: string } | null>(null);
  const [placeSheet, setPlaceSheet] = React.useState<CommunityPost | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  // P-113(KB-280, Q-27 반려): prod 채널 = 탭 유지 + coming-soon 플레이스홀더
  // (P-110의 빈 화면 가드 대체 — 원조 잠금 화면 870a942 재사용, 카피만 스토어 톤)
  if (!FLAGS.communityEnabled) return <ComingSoon t={t} />;
  // P-179: 탭 = 전역 리뷰 피드(⚠️ 반드시 coming-soon 가드 **뒤** — prod는 버전리스
  // /api/reviews 미배포라 현행 유지). 글 기능은 보존형 플래그 뒤(코드 무삭제).
  if (!FLAGS.communityPostsEnabled) return <ReviewFeed />;

  const pages = feed.data?.pages ?? [];
  const posts = pages.flatMap((p) => p.items);
  const guestCapped = isGuest && pages.length >= GUEST_PAGE_LIMIT;

  const loadMore = () => {
    if (!feed.hasNextPage || feed.isFetchingNextPage) return;
    if (guestCapped) return; // 푸터 게이트가 안내
    void feed.fetchNextPage();
  };

  const requireMember = (action: () => void) => {
    if (isGuest) return setGate('profile');
    action();
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // 상세발 차단 → 피드 복귀 시 대기 토스트 소비 (확정 플로우)
  useFocusEffect(
    React.useCallback(() => {
      const pending = consumePendingToast();
      if (pending) showToast(pending);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 헤더 — P-181: 장식 벨 제거(무동작) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('community.title')}</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.list, { paddingBottom: 96, flexGrow: 1 }]} // P-099 여백 + P-154: 빈 상태 센터를 위한 flexGrow
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            t={t}
            onOpen={() => router.push(`/community/post/${item.id}` as Href)}
            onMore={() => setMod({ type: 'post', id: item.id, author: item.author, mine: item.author.id === myId })}
            onReact={(r) => requireMember(() => react.mutate({ target: 'post', id: item.id, reaction: r }))}
            onTagFood={(foodId, name) => setFoodSheet({ foodId, name })}
            onTagPlace={() => setPlaceSheet(item)}
          />
        )}
        ListEmptyComponent={
          feed.isLoading ? (
            <View style={styles.center}>
              <Spinner size={22} color={C.ink2} />
            </View>
          ) : feed.isError ? (
            /* P-164: 로드 실패 = 공용 에러(+재시도) — 탭 루트라 goBack 생략(홈 탭 문법) */
            <QueryErrorBlock error={feed.error} onRetry={() => void feed.refetch()} />
          ) : (
            /* P-154 ②: 빈 상태 = 상하 센터(앱 통일 — 화면 소유 빈 상태 규칙) */
            <StateBlock
              fill
              icon={<IconBubbleEmpty size={38} color={stateIconColor.default} />}
              title={t('community.emptyTitle')}
              body={t('community.emptyBody')}
            />
          )
        }
        ListFooterComponent={
          guestCapped && feed.hasNextPage ? (
            /* 게스트 2페이지 상한 — 이후는 로그인 게이트 */
            <Pressable style={styles.guestGate} onPress={() => setGate('profile')}>
              <Text style={styles.guestGateTitle}>{t('community.guestGateTitle')}</Text>
              <Text style={styles.guestGateSub}>{t('community.guestGateSub')}</Text>
            </Pressable>
          ) : feed.isFetchingNextPage ? (
            <View style={styles.center}>
              <Spinner size={18} color={C.ink3} />
            </View>
          ) : null
        }
      />

      {/* 작성 FAB — 쓰기 = 회원 */}
      {/* P-099(Q-25): 탭 콘텐츠는 탭바 위에서 끝남 — 고정 18pt(관례 위치) */}
      <Pressable
        style={styles.fab}
        onPress={() => requireMember(() => router.push('/community/compose' as Href))}
      >
        <IconPlus size={24} color="#fff" />
      </Pressable>

      {/* 태그 미리보기 시트 (음식/장소) */}
      <FoodTagSheet target={foodSheet} onClose={() => setFoodSheet(null)} />
      <PlaceTagSheet place={placeSheet?.placeTag ?? null} onClose={() => setPlaceSheet(null)} />

      {/* ⋯ 플로우 — 신고/차단·수정/삭제 */}
      <ModerationFlow
        target={mod}
        onClose={() => setMod(null)}
        onEdit={(m) => router.push(`/community/compose?editId=${m.id}` as Href)}
        onDelete={(m) => deletePost.mutate(m.id)}
        onBlocked={() => {
          // 피드발 차단 — 목록 재조회(무효화는 훅이 수행), 토스트 안내
          showToast(t('community.blockedToast'));
        }}
      />

      <AuthGateSheet context={gate ?? 'profile'} trigger="community" open={gate != null} onClose={() => setGate(null)} />
      {toast && <Snackbar text={toast} />}
    </View>
  );
}

/** P-113: prod 채널 플레이스홀더 — 흐린 셸 + 잠금 카드 (이모지 0, SVG only). */
function ComingSoon({ t }: { t: ReturnType<typeof useTranslation>['t'] }) {
  return (
    <View style={styles.root}>
      <View style={{ flex: 1, opacity: 0.5 }} pointerEvents="none">
        <ShellPlaceholder />
      </View>
      <View style={styles.csScrim}>
        <View style={styles.csCard}>
          <View style={styles.csIc}>
            <IconLock size={26} color={C.accent} />
          </View>
          <Text style={styles.csTitle}>{t('community.lockedTitle')}</Text>
          <Text style={styles.csBody}>{t('community.lockedBody')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyFill: { flex: 1, justifyContent: 'center' }, // P-154 ②
  root: { flex: 1, backgroundColor: C.surface },
  csScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(42,33,27,0.42)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  csCard: { width: '86%', backgroundColor: C.card, borderRadius: radius.lg, padding: 26, alignItems: 'center', gap: 9, ...shadow.shPop },
  csIc: { width: 60, height: 60, borderRadius: 30, backgroundColor: accentTint, alignItems: 'center', justifyContent: 'center' },
  csTitle: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  csBody: { fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: C.ink2, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  headerTitle: { fontFamily: font.display, fontSize: 24, color: C.ink, letterSpacing: -0.4 },
  bell: { padding: 4 },
  list: { paddingHorizontal: 16, gap: 12 },
  center: { paddingVertical: 30, alignItems: 'center' },

  guestGate: { alignItems: 'center', gap: 5, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 18, marginTop: 4, ...shadow.sh1 },
  guestGateTitle: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  guestGateSub: { fontFamily: font.body, fontSize: 12.5, color: C.ink2 },

  fab: { position: 'absolute', right: 18, bottom: 18, width: 54, height: 54, borderRadius: 27, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', ...shadow.shPop },
});

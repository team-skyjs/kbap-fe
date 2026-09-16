/**
 * 알림함 (P-216/KB-39 → KB-499 서버 정본) — 놓친 히스토리 화면(멘토 8/15 개념 구분: push=앱 밖 /
 * **notification=이 화면** / toast=앱 안 실시간).
 *
 * 데이터 = GET /api/notifications(lib/data/useNotifications) — 이 기기(X-Installation-Id)로 온 최근 7일, 최신순.
 * 제목·본문은 발송 시점 언어로 서버가 저장한 문자열 그대로(앱 가공 0). 상대 시각은 커뮤니티 공용 timeAgo.
 * 항목 탭 = 미읽음이면 낙관 읽음(PATCH) + routeForNotificationData(type·foodId — BE 확장분, 없으면 이동 없음).
 * 전체 읽음 계약이 없어 "모두 읽음"은 없다. 게스트 = 로그인 직행(Redirect, 2026-09-16 clarify).
 */
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, primaryTint } from '@/lib/theme';
import { SubHeader } from '@/components';
import { EmptyBlock, QueryErrorBlock } from '@/components/StateBlock';
import { SkeletonInbox } from '@/components/Skeleton';
import { FLAGS } from '@/lib/flags';
import { useIsGuest } from '@/lib/auth/useSession';
import { useInbox, useMarkRead } from '@/lib/data/useNotifications';
import type { InboxItem } from '@/lib/api/notificationAdapter';
import { openNotificationRoute } from '@/lib/nav';
import { routeForNotificationData } from '@/lib/push/pushAdapter';
import { timeAgo } from '@/features/community/parts';

export default function Notifications() {
  const router = useRouter();
  const { t } = useTranslation();
  const isGuest = useIsGuest();
  const { data, isPending, isError, error, refetch } = useInbox();
  const markRead = useMarkRead();
  // 플래그 문법 P-114 — 채널 차단
  if (!FLAGS.notificationCenter) return <Redirect href="/" />;
  // KB-499 clarify Q5 — 게스트 = 로그인 직행(시트 없음). Redirect = replace라 로그인 화면의 뒤로 = 종 아이콘 탭.
  // 라우트 가드 1곳(헤더 3곳 onBell 무변·딥링크 방어). 로그인 완료 시 returnTo로 여기 복귀.
  if (isGuest) return <Redirect href={`/login?returnTo=${encodeURIComponent('/notifications')}` as Href} />;

  const items = data ?? [];

  // 이동은 읽음 응답을 기다리지 않는다(US3 ③). type·foodId는 BE 확장분 — 없거나 미지 유형이면 null → 알림함 유지.
  const open = (n: InboxItem) => {
    if (!n.read) markRead.mutate(n.id);
    const href = routeForNotificationData({ type: n.type, foodId: n.foodId });
    if (href) openNotificationRoute(router, href); // KB-573: 홈은 스택 리셋(알림함 화면도 닫힘)
  };

  return (
    <View style={styles.root}>
      <SubHeader title={t('inbox.title')} onBack={() => router.back()} />
      {isError && !data ? (
        /* P-164/P-207: 로드 실패 = 공용 에러(+재시도) — 빈 상태로 위장 금지 */
        <QueryErrorBlock error={error} onRetry={() => void refetch()} onGoBack={() => router.back()} />
      ) : isPending ? (
        <SkeletonInbox />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={[styles.list, items.length === 0 && { flexGrow: 1 }]}
          renderItem={({ item }) => (
            /* KB-430(4123:4113/4120): 좌측 아이콘 소멸 — unread = primaryTint bg + 우측 8px 점.
               프레임 불변(P-103/P-151): 점 슬롯·패딩은 읽음/안읽음 동일, 바뀌는 건 색뿐. */
            <Pressable style={[styles.row, !item.read && styles.rowUnread]} onPress={() => open(item)} testID={`inbox-${item.id}`}>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.body} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={styles.when}>{timeAgo(item.at, t)}</Text>
              </View>
              <View style={styles.dotSlot}>{!item.read && <View style={styles.dot} testID={`unread-${item.id}`} />}</View>
            </Pressable>
          )}
          ListEmptyComponent={
            /* P-330(4003:7113): 빈 상태 = 리스트 영역 세로 중앙(flexGrow 1 + 중앙 래퍼 —
               pull-to-refresh 유지라 ScreenCenterFill(absolute) 대신 인라인 센터) */
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <EmptyBlock label={t('inbox.empty')} testID="notif-empty" />
            </View>
          }
        />
      )}
    </View>
  );
}

// KB-430(4150:17104): 카드 톤 → 구분선 리스트, unread = primaryTint + 점
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  list: { paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.hair },
  rowUnread: { backgroundColor: primaryTint },
  title: { fontSize: 15, fontWeight: '700', color: C.ink }, // A-NF-01(KB-486)
  body: { fontSize: 14, fontWeight: '500', color: '#4B4F58', lineHeight: 20 },
  when: { fontSize: 13, fontWeight: '500', color: C.inkInfo }, // P-284: 정보성 시각 텍스트 대비
  dotSlot: { width: 8, alignItems: 'center', paddingTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
});

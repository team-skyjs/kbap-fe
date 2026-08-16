/**
 * 알림함 (P-216/KB-39) — 놓친 히스토리 화면(멘토 8/15 개념 구분: push=앱 밖 /
 * **notification=이 화면** / toast=앱 안 실시간).
 *
 * ⚠️ **디자이너 캡쳐용 러프** — 데이터는 로컬 목(lib/notifications/inbox.ts),
 * BE 계약 오면 그 파일 한 곳만 스왑. 시각 문법은 전부 기존 것 재사용
 * (SubHeader · StateBlock · 리뷰 목록 행 톤 · 상대 시각 키 reviews.*).
 * 항목 탭 = P-192 routeForNotificationData 재사용(HELPFUL→내 리뷰 등).
 */
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius } from '@/lib/theme';
import { SubHeader, IconBell } from '@/components';
import { StateBlock, stateIconColor } from '@/components/StateBlock';
import { FLAGS } from '@/lib/flags';
import { markAllInboxRead, markInboxRead, useInbox, type InboxItem } from '@/lib/notifications/inbox';
import { routeForNotificationData } from '@/lib/push/pushAdapter';

type TFn = ReturnType<typeof useTranslation>['t'];

/** 상대 시각 — 리뷰 목록과 같은 키(reviews.today/daysAgo/weeksAgo) 재사용. */
function relativeDate(iso: string, t: TFn): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return t('reviews.today');
  if (days < 7) return t('reviews.daysAgo', { count: days });
  return t('reviews.weeksAgo', { count: Math.floor(days / 7) });
}

export default function Notifications() {
  const router = useRouter();
  const { t } = useTranslation();
  const items = useInbox();
  // 러프 단계 — prod 채널은 진입 자체 차단(플래그 문법 P-114)
  if (!FLAGS.notificationCenter) return <Redirect href="/" />;

  const open = (n: InboxItem) => {
    markInboxRead(n.id);
    const href = routeForNotificationData(n.data);
    if (href) router.push(href as Href);
  };

  return (
    <View style={styles.root}>
      <SubHeader
        title={t('inbox.title')}
        onBack={() => router.back()}
        trailing={
          items.some((n) => !n.read) ? (
            <Pressable hitSlop={8} onPress={markAllInboxRead} testID="inbox-mark-all">
              <Text style={styles.markAll}>{t('inbox.markAllRead')}</Text>
            </Pressable>
          ) : undefined
        }
      />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={[styles.list, items.length === 0 && { flexGrow: 1 }]}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => open(item)} testID={`inbox-${item.id}`}>
            <View style={[styles.ic, !item.read && styles.icUnread]}>
              <IconBell size={17} color={item.read ? C.ink3 : C.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
                {t(item.titleKey)}
              </Text>
              <Text style={styles.body} numberOfLines={2}>
                {t(item.bodyKey)}
              </Text>
              <Text style={styles.when}>{relativeDate(item.at, t)}</Text>
            </View>
            {/* 안 읽음 표식 = 점 하나(프레임 불변 — 읽음도 같은 슬롯 유지, P-103) */}
            <View style={styles.dotSlot}>{!item.read && <View style={styles.dot} testID={`unread-${item.id}`} />}</View>
          </Pressable>
        )}
        ListEmptyComponent={
          <StateBlock
            fill
            icon={<IconBell size={38} color={stateIconColor.default} />}
            title={t('inbox.empty')}
            body={t('inbox.emptyBody')}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  list: { padding: 18, gap: 10 },
  markAll: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 14 },
  ic: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  icUnread: { backgroundColor: C.surface2 },
  title: { fontFamily: font.body, fontSize: 14, color: C.ink2 },
  titleUnread: { fontFamily: font.bodyBold, color: C.ink },
  body: { fontFamily: font.body, fontSize: 12.5, color: C.ink2, lineHeight: 18 },
  when: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },
  dotSlot: { width: 8, alignItems: 'center', paddingTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
});

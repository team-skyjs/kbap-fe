/**
 * My Foods — KB-434 D-6(4150:14562). AppBar → 언더라인 탭 2개(Ordered|Scanned,
 * 현 scope 무변) → 주문 카드 리스트(좌 70 map-pin 박스 · 정보 컬럼 · "n items" 필 ·
 * 장소 미태그 = "+ tag a place" 아웃라인 필(장소 태그 기능 부재 — 시안 렌더·무동작) ·
 * chevron · 하단 line). Scanned 탭 = D-2 recent-row(홈 RecentRow 재사용).
 *
 * 통계 패널(14 orders / 41 dishes)은 전체 카운트 소스 부재(커서 페이지네이션 —
 * 서버 total 없음)로 생략(발주 규정 — REPORTS 기재). 데이터 훅 무변.
 */
import * as React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import { IconScanLines, IconChevron, SubHeader, Spinner } from '@/components';
import { D4MapPin } from '@/components/design4Assets';
import { QueryErrorBlock, ScreenCenterFill, StateBlock, stateIconColor } from '@/components/StateBlock';
import { useOrders, type OrderSummary } from '@/lib/data/useOrders';
import { useScannedFoods } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import { EVENTS, track } from '@/lib/analytics';
import { RecentRow } from '@/features/food/FoodCards';
import i18n from '@/lib/i18n';

type Tab = 'ordered' | 'scanned';
const INK_TITLE = '#2F3137';

export default function MyFoodsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<Tab>('ordered');
  const orders = useOrders(tab === 'ordered');
  const scanned = useScannedFoods(tab === 'scanned');
  const { data: me } = useMe();
  const hasR = (me?.restrictions.length ?? 0) > 0;

  const goScan = () => router.navigate('/scan'); // P-246: 연타 가드 승계
  const empty = (titleKey: string, bodyKey: string) => (
    <ScreenCenterFill>
      <StateBlock
        icon={<IconScanLines size={38} color={stateIconColor.default} />}
        title={t(titleKey)}
        body={t(bodyKey)}
        primary={{ label: t('community.goScanCta'), onPress: goScan }}
      />
    </ScreenCenterFill>
  );

  return (
    <View style={styles.root}>
      <SubHeader title={t('profile.myFoods')} onBack={() => router.back()} />
      {/* 언더라인 탭 2개(responsive) — 전환은 색만(프레임 불변 P-103/151) */}
      <View style={styles.tabsRow}>
        {(['ordered', 'scanned'] as Tab[]).map((k) => (
          <Pressable key={k} style={styles.tab} onPress={() => setTab(k)} testID={`myfoods-tab-${k}`}>
            <Text style={[styles.tabLabel, tab === k && styles.tabLabelOn]}>{t(`myFoods.${k}`)}</Text>
            <View style={[styles.tabBar, tab === k && styles.tabBarOn]} />
          </Pressable>
        ))}
      </View>
      <View style={styles.tabsDivider} />

      {tab === 'ordered' ? (
        orders.isError ? (
          <QueryErrorBlock error={orders.error} onRetry={() => void orders.refetch()} />
        ) : orders.isLoading ? (
          <ScreenCenterFill><Spinner /></ScreenCenterFill>
        ) : (orders.data ?? []).length === 0 ? (
          empty('myFoods.emptyOrdersTitle', 'myFoods.emptyOrdersBody')
        ) : (
          <FlatList
            data={orders.data}
            keyExtractor={(o) => o.orderId}
            contentContainerStyle={styles.list}
            onEndReached={() => {
              if (orders.hasNextPage && !orders.isFetchingNextPage) void orders.fetchNextPage();
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={orders.isFetchingNextPage ? <Spinner /> : null}
            renderItem={({ item }) => (
              <OrderCard order={item} onPress={() => router.push(`/profile/order/${item.orderId}` as Href)} />
            )}
          />
        )
      ) : scanned.isError ? (
        <QueryErrorBlock error={scanned.error} onRetry={() => void scanned.refetch()} />
      ) : scanned.isLoading ? (
        <ScreenCenterFill><Spinner /></ScreenCenterFill>
      ) : (scanned.data ?? []).length === 0 ? (
        empty('myFoods.emptyScansTitle', 'myFoods.emptyScansBody')
      ) : (
        <FlatList
          data={scanned.data}
          keyExtractor={(f) => f.foodId}
          contentContainerStyle={styles.recentList}
          onEndReached={() => {
            if (scanned.hasNextPage && !scanned.isFetchingNextPage) void scanned.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={scanned.isFetchingNextPage ? <Spinner /> : null}
          renderItem={({ item }) => (
            /* Scanned = D-2 recent-row(4129:10705) 재사용 — 개인화 위험·리뷰 숏컷 동일 문법 */
            <RecentRow
              food={item}
              risk={personalRisk(item.risk, hasR)}
              reviewLabel={t('home.review')}
              onPress={() => router.push(`/food/${item.foodId}?src=list` as Href)}
              onReview={() => {
                track(EVENTS.review_write_tap, { source: 'home' });
                router.push(`/food/${item.foodId}/review` as Href);
              }}
            />
          )}
        />
      )}
    </View>
  );
}

/** 주문 시각 표기 — 리더 언어 로케일 날짜. */
export function formatOrderDate(epochMs: number): string {
  try {
    return new Date(epochMs).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return new Date(epochMs).toDateString();
  }
}

/** 주문 카드(4150:14562) — 좌 70 map-pin 박스(장소 썸네일 데이터 부재 대체) ·
 *  정보 컬럼(주소 15/600 2줄 → 메타 행: 날짜 12/400 + "n items" 필) · chevron. */
function OrderCard({ order, onPress }: { order: OrderSummary; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable style={styles.card} onPress={onPress} testID={`order-${order.orderId}`}>
      <View style={styles.pinBox}>
        <D4MapPin size={24} color={C.ink3} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        {/* 장소명 데이터 부재 — roadAddress가 장소 줄(있을 때), 없으면 미태그 변형 필 */}
        {order.roadAddress ? (
          <Text style={styles.placeName} numberOfLines={2}>{order.roadAddress}</Text>
        ) : (
          <View style={styles.tagPill} testID={`order-tag-place-${order.orderId}`}>
            <Text style={styles.tagPillText}>+ {t('community.tagPlace')}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.metaDate}>{formatOrderDate(order.orderedAt)}</Text>
          <View style={styles.qtyPill}>
            <Text style={styles.qtyPillText}>{t('myFoods.itemCount', { count: order.totalQuantity })}</Text>
          </View>
        </View>
      </View>
      <IconChevron size={16} color={C.ink3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },

  // 언더라인 탭(responsive 2분할)
  tabsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 8 },
  tab: { flex: 1, height: 40, justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  tabLabel: { fontSize: 14, fontWeight: '600', color: C.ink2 },
  tabLabelOn: { color: INK_TITLE },
  tabBar: { alignSelf: 'stretch', height: 2, backgroundColor: 'transparent' },
  tabBarOn: { backgroundColor: INK_TITLE },
  tabsDivider: { height: 0.5, backgroundColor: C.line2 },

  list: { paddingBottom: 40 },
  recentList: { paddingBottom: 40 },

  // 주문 카드 — pad 16/20 gap 14 하단 line
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.hair },
  pinBox: { width: 70, height: 70, borderRadius: 8, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  placeName: { fontSize: 15, fontWeight: '600', color: '#1C1E21', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaDate: { fontSize: 12, fontWeight: '400', color: C.ink3 },
  qtyPill: { backgroundColor: C.hair, borderRadius: 100, paddingVertical: 2, paddingHorizontal: 8 },
  qtyPillText: { fontSize: 12, fontWeight: '500', color: C.ink2 },
  // 장소 미태그 변형 — 아웃라인 필(primary 1px r8 pad 4/8, 12/600) · 태그 기능 부재 = 무동작
  tagPill: { alignSelf: 'flex-start', borderWidth: 1, borderColor: C.primary, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  tagPillText: { fontSize: 12, fontWeight: '600', color: C.primary },
});

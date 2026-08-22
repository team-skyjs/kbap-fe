/**
 * My Foods (P-253/KB-360 1차 러프) — Ordered/Scanned 모아보기.
 * D-20 러프 **구조만** 참고(세그·카드 위계) — 디자이너 시안 오면 리스타일 전제라
 * 기존 컴포넌트(SubHeader·StateBlock·RemoteImage) 재사용·새 시각 문법 없음(P-216 방식).
 * read-only 확정(수정·장소 태그·공유 카드 = 비범위 — 예진×종한 합의). prod 미배포.
 * Scanned = 러프의 '세션 카드'가 아니라 **음식 단위 리스트**(/foods/scanned 계약 정본).
 */
import * as React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, primaryTint, radius } from '@/lib/theme';
import { IconScanLines, SubHeader, Spinner } from '@/components';
import { QueryErrorBlock, ScreenCenterFill, StateBlock, stateIconColor } from '@/components/StateBlock';
import { RemoteImage } from '@/components/RemoteImage';
import { useOrders, type OrderSummary } from '@/lib/data/useOrders';
import { useScannedFoods } from '@/lib/data/useFoods';
import i18n from '@/lib/i18n';

type Tab = 'ordered' | 'scanned';

export default function MyFoodsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<Tab>('ordered');
  const orders = useOrders(tab === 'ordered');
  const scanned = useScannedFoods(tab === 'scanned');

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
      {/* D-20 구조: 상단 대형 세그(가로 꽉) — 상태 전환은 색만(프레임 불변, P-103) */}
      <View style={styles.seg}>
        {(['ordered', 'scanned'] as Tab[]).map((k) => (
          <Pressable
            key={k}
            style={[styles.segBtn, tab === k && styles.segBtnOn]}
            onPress={() => setTab(k)}
            testID={`myfoods-tab-${k}`}
          >
            <Text style={[styles.segText, tab === k && styles.segTextOn]}>{t(`myFoods.${k}`)}</Text>
          </Pressable>
        ))}
      </View>

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
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (scanned.hasNextPage && !scanned.isFetchingNextPage) void scanned.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={scanned.isFetchingNextPage ? <Spinner /> : null}
          renderItem={({ item }) => (
            <Pressable
              style={styles.foodRow}
              onPress={() => router.push(`/food/${item.foodId}?src=list` as Href)}
              testID={`myfoods-food-${item.foodId}`}
            >
              {item.photoUrl ? (
                <RemoteImage uri={item.photoUrl} style={styles.foodThumb} />
              ) : (
                <View style={[styles.foodThumb, styles.thumbFallback]} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
                {!!item.nameKo && item.nameKo !== item.name && (
                  <Text style={styles.foodSub} numberOfLines={1}>{item.nameKo}</Text>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

/** 주문 시각 표기 — 리더 언어 로케일 날짜(러프 — 시안 후 형식 확정). */
export function formatOrderDate(epochMs: number): string {
  try {
    return new Date(epochMs).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return new Date(epochMs).toDateString();
  }
}

/** D-20: 4분할 썸네일 — 서버 thumbnails(1~4장) 그대로. 1장 = 크게, 2장 = 세로 반씩,
 *  3~4장 = 2×2(3장째는 하단 풀폭). 부재 = 빈 타일(서버가 기본 이미지를 채워 오는 계약). */
function ThumbGrid({ urls }: { urls: string[] }) {
  const n = urls.length;
  if (n === 0) return <View style={[styles.thumbBox, styles.thumbFallback]} testID="thumb-0" />;
  if (n === 1) {
    return (
      <View style={styles.thumbBox} testID="thumb-1">
        <RemoteImage uri={urls[0]} style={{ flex: 1 }} />
      </View>
    );
  }
  if (n === 2) {
    return (
      <View style={styles.thumbBox} testID="thumb-2">
        {urls.map((u, i) => (
          <RemoteImage key={i} uri={u} style={{ flex: 1 }} />
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.thumbBox, styles.thumbGrid]} testID={`thumb-${n}`}>
      {/* P-263: key·풀폭 판정 = 인덱스 — 준비중 음식 2+ 주문은 기본 대체 이미지
          URL이 중복이라 URL key = React 중복 key 에러 + 값 비교 풀폭 오적용 */}
      {urls.map((u, i) => (
        <RemoteImage key={i} uri={u} style={n === 3 && i === 2 ? styles.thumbCellWide : styles.thumbCell} />
      ))}
    </View>
  );
}

function OrderCard({ order, onPress }: { order: OrderSummary; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable style={styles.card} onPress={onPress} testID={`order-${order.orderId}`}>
      <ThumbGrid urls={order.thumbnails} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={styles.cardDate}>{formatOrderDate(order.orderedAt)}</Text>
        {/* roadAddress null = 미표시(위치 미동의 — "Unknown place" 표기 대신 생략 재량) */}
        {!!order.roadAddress && (
          <Text style={styles.cardAddr} numberOfLines={1}>{order.roadAddress}</Text>
        )}
        {/* 기호(×) 텍스트 렌더 금지(P-040 계열) — 수량은 i18n 문구로 */}
        <View style={styles.qtyBadge}>
          <Text style={styles.qtyBadgeText}>{t('myFoods.itemCount', { count: order.totalQuantity })}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const THUMB = 76;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  seg: { flexDirection: 'row', marginHorizontal: 16, marginTop: 6, marginBottom: 10, borderRadius: 999, backgroundColor: C.surface2, padding: 3 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: 'transparent' },
  segBtnOn: { backgroundColor: '#fff', borderColor: C.line },
  segText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink3 },
  segTextOn: { color: C.ink },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },

  card: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: C.line, padding: 12 },
  cardDate: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  cardAddr: { fontFamily: font.body, fontSize: 12.5, color: C.ink3 },
  qtyBadge: { alignSelf: 'flex-start', marginTop: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: primaryTint },
  qtyBadgeText: { fontFamily: font.bodyBold, fontSize: 12, color: C.primaryText },

  thumbBox: { width: THUMB, height: THUMB, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: C.surface2 },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  thumbCell: { width: THUMB / 2, height: THUMB / 2 },
  thumbCellWide: { width: THUMB, height: THUMB / 2 },
  thumbFallback: { backgroundColor: C.surface2 },

  foodRow: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: C.line, padding: 12 },
  foodThumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: C.surface2 },
  foodName: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  foodSub: { fontFamily: font.body, fontSize: 12.5, color: C.ink3 },
});

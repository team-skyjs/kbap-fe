/**
 * scan-order (P-136 발주 B8 → P-138 시안 재정합) — 스캔 리스트에서 담은 다중
 * 항목의 주문 카드. 진입 = 리치 리스트/캡슐 뷰 "View order" 필(카트 화면 없음).
 * items = 쿼리 param JSON(스캔 세션 한정 데이터라 전역 스토어 불필요).
 * P-138 ⑥: 모달풍 X 폐기 → 콰이엇 헤더(백+"Your order"+서브).
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '@/lib/useBottomInset';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { IconChevron } from '@/components';
import { useMe } from '@/lib/data/useMe';
import { resolveCurrency } from '@/lib/exchange';
import { ingredientLabel } from '@/lib/mocks/ingredients';
import { useIngredientCatalog } from '@/lib/data/useIngredientCatalog';
import { FlippedOrderCard, type OrderItem } from '@/features/order/FlippedOrderCard';
import { EVENTS, track } from '@/lib/analytics';

export default function ScanOrder() {
  const { items: itemsParam } = useLocalSearchParams<{ items: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  const { t } = useTranslation();
  const { data: me } = useMe();
  const ingCat = useIngredientCatalog(); // P-174: 요약 칩 서버 번역명 우선

  const items = React.useMemo<OrderItem[]>(() => {
    try {
      const parsed = JSON.parse(itemsParam ?? '[]') as OrderItem[];
      return Array.isArray(parsed) ? parsed.filter((i) => i && i.nameKo && i.qty > 0) : [];
    } catch {
      return [];
    }
  }, [itemsParam]);

  const [currency, setCurrency] = React.useState('USD');
  React.useEffect(() => {
    void resolveCurrency(me?.nationality, me?.currency).then(setCurrency); // P-165: 서버 통화 정본
  }, [me?.nationality, me?.currency]);

  const codes = (me?.restrictions ?? []).map((r) => r.code);
  const count = items.reduce((a, i) => a + i.qty, 0);

  // P-144: 스캔→주문 퍼널 종점 (멘토 퍼널 2)
  React.useEffect(() => {
    track(EVENTS.order_card_open, { item_count: count, has_avoids: codes.length > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: bottom + 18 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} testID="order-back">
          <IconChevron size={18} color={C.ink2} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('order.title')}</Text>
          <Text style={styles.sub}>{t('order.headerSub', { count })}</Text>
        </View>
      </View>
      <FlippedOrderCard
        items={items}
        avoidCodes={codes}
        avoidNames={codes.map((c) => ingCat.name(c))}
        currency={currency}
        onDone={() => {
          // P-162: 완료 모달 확인 = 홈으로 (스캔 스택 정리 후 탭 홈)
          if (router.canDismiss()) router.dismissAll();
          router.replace('/(tabs)');
        }}
        t={t}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.bodyBold, fontSize: 17, color: C.ink },
  sub: { fontFamily: font.body, fontSize: 11.5, color: C.ink3, marginTop: 1 },
});

/**
 * scan-order (P-136 발주 B8) — 스캔 리스트에서 담은 다중 항목의 주문 카드.
 * 진입 = 리치 리스트/캡슐 뷰 "View order" 필(카트 화면 없음 — 2단 확정).
 * items = 쿼리 param JSON(스캔 세션 한정 데이터라 전역 스토어 불필요).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '@/lib/useBottomInset';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import { IconClose, PressScale } from '@/components';
import { useMe } from '@/lib/data/useMe';
import { resolveCurrency } from '@/lib/exchange';
import { ingredientLabel } from '@/lib/mocks/ingredients';
import { FlippedOrderCard, type OrderItem } from '@/features/order/FlippedOrderCard';

export default function ScanOrder() {
  const { items: itemsParam } = useLocalSearchParams<{ items: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  const { t } = useTranslation();
  const { data: me } = useMe();

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
    void resolveCurrency(me?.nationality).then(setCurrency);
  }, [me?.nationality]);

  const codes = (me?.restrictions ?? []).map((r) => r.code);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 54, paddingBottom: bottom + 18 }]}>
      <PressScale style={[styles.close, { top: insets.top + 10 }]} onPress={() => router.back()} hitSlop={8} testID="order-close">
        <IconClose size={22} color={C.ink2} />
      </PressScale>
      <FlippedOrderCard
        items={items}
        avoidCodes={codes}
        avoidNames={codes.map((c) => ingredientLabel(c))}
        currency={currency}
        onDone={() => router.back()}
        t={t}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  close: {
    position: 'absolute',
    left: 18,
    zIndex: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

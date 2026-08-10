/**
 * Order card — single food (KB-205/P-030 → P-136 시안 S2 레이아웃으로 대체).
 * FlippedOrderCard 공용 뷰(뒤집힌 카드+미러+Done) + 수량 스테퍼(P-042 존치).
 * 본문 한국어는 orderCard.ts 조립 무변(P-045·052·109) — 상세·프로필 캐시 재사용.
 */
import * as React from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '@/lib/useBottomInset';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { IconChevron, IconMinus, IconPlus, PressScale } from '@/components';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { resolveCurrency } from '@/lib/exchange';
import { ingredientLabel } from '@/lib/mocks/ingredients';
import { FlippedOrderCard } from '@/features/order/FlippedOrderCard';
import { spring } from '@/lib/motion';
import { EVENTS, track } from '@/lib/analytics';

const QTY_MIN = 1;
const QTY_MAX = 5;

export default function OrderCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset(); // P-055: 안드 내비바 보정
  const { t } = useTranslation();
  const { data: food } = useFoodDetail(id ?? '');
  const { data: me } = useMe();
  const [qty, setQty] = useState(QTY_MIN);

  // P-032: Quantity Stepper 값 팝 — 탭 모멘텀이 있어 소량 바운스(spring.pop)
  const qtyScale = useSharedValue(1);
  const qtyPop = useAnimatedStyle(() => ({ transform: [{ scale: qtyScale.value }] }));
  const bump = (next: number) => {
    if (next === qty) return;
    setQty(next);
    qtyScale.value = withSequence(withTiming(1.22, { duration: 60 }), withSpring(1, spring.pop));
  };

  const [currency, setCurrency] = React.useState('USD');
  React.useEffect(() => {
    void resolveCurrency(me?.nationality).then(setCurrency);
  }, [me?.nationality]);

  const codes = (me?.restrictions ?? []).map((r) => r.code);
  const nameKo = food?.nameKo ?? '';

  // P-144: 주문 카드 진입(단일 음식 경로) — item_count 1 고정
  React.useEffect(() => {
    track(EVENTS.order_card_open, { item_count: 1, has_avoids: codes.length > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: bottom + 18 }]}>
      {/* P-138 ⑥: 모달풍 X 폐기 → 콰이엇 헤더(scan-order와 동일 패밀리) */}
      <View style={styles.header}>
        <PressScale style={styles.back} onPress={() => router.back()} hitSlop={10}>
          <IconChevron size={18} color={C.ink2} style={{ transform: [{ rotate: '180deg' }] }} />
        </PressScale>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('order.title')}</Text>
          <Text style={styles.sub}>{t('order.headerSub', { count: qty })}</Text>
        </View>
      </View>
      <FlippedOrderCard
        items={nameKo ? [{ nameKo, name: food?.name ?? nameKo, qty, priceKrw: null }] : []}
        avoidCodes={codes}
        avoidNames={codes.map((c) => ingredientLabel(c))}
        currency={currency}
        stepper={
          <View style={styles.stepper}>
            {/* P-040(Q-17): −/+는 SVG — 폰트 어센트 편향 방지(영구 규칙) */}
            <StepBtn testID="qty-dec" icon={<IconMinus size={20} color={C.ink} />} disabled={qty <= QTY_MIN} onPress={() => bump(Math.max(QTY_MIN, qty - 1))} />
            <Animated.View style={qtyPop}>
              <Text style={styles.qty}>{qty}</Text>
            </Animated.View>
            <StepBtn testID="qty-inc" icon={<IconPlus size={20} color={C.ink} />} disabled={qty >= QTY_MAX} onPress={() => bump(Math.min(QTY_MAX, qty + 1))} />
          </View>
        }
        onDone={() => router.back()}
        t={t}
      />
    </View>
  );
}

function StepBtn({ icon, disabled, onPress, testID }: { icon: React.ReactNode; disabled: boolean; onPress: () => void; testID?: string }) {
  return (
    <PressScale style={[styles.step, disabled && styles.stepOff]} onPress={onPress} disabled={disabled} hitSlop={6} testID={testID}>
      {icon}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.bodyBold, fontSize: 17, color: C.ink },
  sub: { fontFamily: font.body, fontSize: 11.5, color: C.ink3, marginTop: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 14 },
  step: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  stepOff: { opacity: 0.35 },
  qty: { fontFamily: font.display, fontSize: 24, color: C.ink, minWidth: 30, textAlign: 'center' },
});

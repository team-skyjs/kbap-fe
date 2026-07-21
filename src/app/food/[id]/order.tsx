/**
 * Order + allergy-notice card (KB-205/P-030) — owner.tsx(Screen F)와 같은
 * 패밀리: 사장님에게 보여주는 풀스크린 한국어 카드 한 장. 안전 판정의 다음
 * 행동(주문)에 알레르기 고지가 무임승차한다.
 *
 * 본문은 place=ko 고정 DATA(orderCard.ts 조립 — 번역 아님), 하단 요약/버튼만
 * reader 언어 i18n. BE 호출 0 — 상세·프로필 캐시 재사용.
 */
import * as React from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { IconClose, IconMinus, IconPlus, PressScale } from '@/components';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { avoidSentenceKo, orderSentenceKo } from '@/lib/order/orderCard';
import { spring } from '@/lib/motion';

const QTY_MIN = 1;
const QTY_MAX = 5;

export default function OrderCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const codes = (me?.restrictions ?? []).map((r) => r.code);
  const avoid = avoidSentenceKo(codes); // 기피 0개 → null → 고지 생략(순수 주문 카드)
  const nameKo = food?.nameKo ?? '';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <PressScale style={[styles.close, { top: insets.top + 10 }]} onPress={() => router.back()} hitSlop={8}>
        <IconClose size={22} color={C.ink2} />
      </PressScale>

      <View style={styles.center}>
        {!!nameKo && (
          <Text style={styles.order}>
            <Text style={styles.menu}>{nameKo}</Text>
            {orderSentenceKo(nameKo, qty).slice(nameKo.length)}
          </Text>
        )}

        {!!avoid && <Text style={styles.note}>{avoid}</Text>}

        <Text style={styles.caption}>{t('order.caption')}</Text>
      </View>

      <View style={[styles.foot, { paddingBottom: insets.bottom + 18 }]}>
        {/* P-042(Q-18 5번): 스테퍼는 Done 바로 위 — 문장은 위(사장님 시선),
            조작은 아래 손 근처. 문장 내 {n}개 갱신은 무변.
            P-040(Q-17): −/+는 텍스트가 아니라 SVG — 폰트 어센트 편향으로 원
            중심을 벗어나던 문제. 기호는 전부 icons.tsx (영구 규칙). */}
        <View style={styles.stepper}>
          <StepBtn icon={<IconMinus size={20} color={C.ink} />} disabled={qty <= QTY_MIN} onPress={() => bump(Math.max(QTY_MIN, qty - 1))} />
          <Animated.View style={qtyPop}>
            <Text style={styles.qty}>{qty}</Text>
          </Animated.View>
          <StepBtn icon={<IconPlus size={20} color={C.ink} />} disabled={qty >= QTY_MAX} onPress={() => bump(Math.min(QTY_MAX, qty + 1))} />
        </View>
        <PressScale style={styles.done} onPress={() => router.back()}>
          <Text style={styles.doneText}>{t('owner.done')}</Text>
        </PressScale>
      </View>
    </View>
  );
}

function StepBtn({ icon, disabled, onPress }: { icon: React.ReactNode; disabled: boolean; onPress: () => void }) {
  return (
    <PressScale style={[styles.step, disabled && styles.stepOff]} onPress={onPress} disabled={disabled} hitSlop={6}>
      {icon}
    </PressScale>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 22 },
  order: { fontFamily: font.koBold, fontSize: 34, lineHeight: 46, color: C.ink, textAlign: 'center' },
  menu: { color: C.primary },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 14 },
  step: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  stepOff: { opacity: 0.35 },
  qty: { fontFamily: font.display, fontSize: 24, color: C.ink, minWidth: 30, textAlign: 'center' },
  note: { fontFamily: font.koBold, fontSize: 19, lineHeight: 29, color: C.ink2, textAlign: 'center' },
  caption: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink3, textAlign: 'center', marginTop: 4 },
  foot: { paddingHorizontal: 22 },
  done: { backgroundColor: C.ink, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  doneText: { fontFamily: font.display, fontSize: 17, color: '#fff' },
});

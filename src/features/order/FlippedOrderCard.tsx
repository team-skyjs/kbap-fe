/**
 * FlippedOrderCard (P-136 시안 S2) — 주문 카드 공용 뷰(스캔 다중 / 상세 단일 겸용).
 *
 * 상단 = **180° 뒤집힌 primary 틴트 카드** — 테이블 맞은편 직원이 그대로 읽는
 * 방향. 확대 버튼 → 풀스크린(뒤집힘 유지). 아래 = 정방향 미러("This is what
 * staff will read") · Estimated total(₩+환산, 가격 있는 항목만 합산) · Done.
 *
 * 🚫 한국어 문구는 시안 이식 금지(발주 7) — 기존 orderCard.ts 조립
 * (orderSentenceKo·avoidSentenceKo, P-045·052·109 무변)만 렌더. 미러는 같은
 * 데이터의 리더 언어 표현(신규 한국어 0).
 */
import * as React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, primaryTint, radius, shadow } from '@/lib/theme';
import { Btn, IconSearch } from '@/components';
import { avoidSentenceKo, orderSentenceKo } from '@/lib/order/orderCard';
import { convertKrw } from '@/lib/exchange';
import { formatKrw } from '@/lib/scan/segmentMenu';

export interface OrderItem {
  nameKo: string;
  /** 리더 언어 표시명 — 미러 줄에 사용 */
  name: string;
  qty: number;
  priceKrw: number | null;
}

type TFn = (k: string, o?: Record<string, unknown>) => string;

export function FlippedOrderCard({
  items,
  avoidCodes,
  avoidNames,
  currency,
  stepper,
  onDone,
  t,
}: {
  items: OrderItem[];
  avoidCodes: string[];
  /** 리더 언어 재료명(미러 기피 줄) — codes와 같은 순서 */
  avoidNames: string[];
  currency: string;
  /** 단일 모드(음식 상세)의 수량 스테퍼 슬롯 — Done 위에 렌더 */
  stepper?: React.ReactNode;
  onDone: () => void;
  t: TFn;
}) {
  const [zoomed, setZoomed] = React.useState(false);
  const lines = items.map((i) => orderSentenceKo(i.nameKo, i.qty));
  const avoid = avoidSentenceKo(avoidCodes);
  const totalKrw = items.reduce((a, i) => a + (i.priceKrw ?? 0) * i.qty, 0);
  const converted = totalKrw > 0 ? convertKrw(totalKrw, currency) : null;

  const koCard = (big = false) => (
    <View style={{ gap: big ? 16 : 8 }}>
      {lines.map((l, i) => (
        <Text key={i} style={[styles.koLine, big && styles.koLineBig]} testID={big ? undefined : `ko-line-${i}`}>
          {l}
        </Text>
      ))}
      {!!avoid && <Text style={[styles.koAvoid, big && styles.koAvoidBig]} testID={big ? undefined : 'ko-avoid'}>{avoid}</Text>}
    </View>
  );

  return (
    <View style={styles.body}>
      {/* 뒤집힌 카드 — 맞은편에서 정방향으로 읽힌다 */}
      <View style={styles.flipCard} testID="flip-card">
        <Pressable style={styles.zoomBtn} hitSlop={8} onPress={() => setZoomed(true)} testID="zoom-open">
          <IconSearch size={15} color={C.ink2} />
        </Pressable>
        <View style={styles.flipInner}>{koCard()}</View>
      </View>

      {/* 정방향 미러 — 같은 데이터의 리더 언어 표현(발주 7) */}
      <View style={styles.mirror} testID="order-mirror">
        <Text style={styles.mirrorTitle}>{t('order.mirrorTitle')}</Text>
        {items.map((i, k) => (
          <Text key={k} style={styles.mirrorLine}>
            {i.qty} × {i.name}
          </Text>
        ))}
        {avoidNames.length > 0 && (
          <Text style={styles.mirrorAvoid}>{t('order.mirrorAvoid', { list: avoidNames.join(', ') })}</Text>
        )}
      </View>

      {totalKrw > 0 && (
        <View style={styles.totalRow} testID="est-total">
          <Text style={styles.totalLabel}>{t('order.estimatedTotal')}</Text>
          <Text style={styles.totalVal}>
            {formatKrw(totalKrw)}
            {converted ? ` · ${converted}` : ''}
          </Text>
        </View>
      )}

      <View style={styles.foot}>
        {stepper}
        <Btn onPress={onDone}>{t('order.done')}</Btn>
      </View>

      {/* 풀스크린 확대 — 방향 유지(직원에게 크게 보여주는 용도) */}
      <Modal visible={zoomed} animationType="fade" onRequestClose={() => setZoomed(false)}>
        <Pressable style={styles.zoomFull} onPress={() => setZoomed(false)} testID="zoom-close">
          <View style={styles.flipInner}>{koCard(true)}</View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 18, paddingTop: 10 },
  flipCard: {
    backgroundColor: primaryTint,
    borderWidth: 1.5,
    borderColor: 'rgba(226,88,12,0.22)',
    borderRadius: radius.lg,
    paddingVertical: 26,
    paddingHorizontal: 20,
    minHeight: 150,
    justifyContent: 'center',
    ...shadow.sh1,
  },
  flipInner: { transform: [{ rotate: '180deg' }] },
  zoomBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...shadow.sh1,
  },
  koLine: { fontFamily: font.koBold, fontSize: 22, lineHeight: 32, color: C.ink, textAlign: 'center' },
  koLineBig: { fontSize: 32, lineHeight: 46 },
  koAvoid: { fontFamily: font.koBold, fontSize: 15, lineHeight: 22, color: C.ink2, textAlign: 'center', marginTop: 4 },
  koAvoidBig: { fontSize: 20, lineHeight: 30 },
  mirror: {
    marginTop: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: radius.sm,
    padding: 14,
    gap: 4,
  },
  mirrorTitle: {
    fontFamily: font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: C.ink3,
    marginBottom: 3,
  },
  mirrorLine: { fontFamily: font.bodySemi, fontSize: 14, color: C.ink },
  mirrorAvoid: { fontFamily: font.body, fontSize: 12.5, color: C.ink2, marginTop: 3 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  totalLabel: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink2 },
  totalVal: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink, fontVariant: ['tabular-nums'] },
  foot: { marginTop: 'auto', paddingTop: 14 },
  zoomFull: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', padding: 28 },
});

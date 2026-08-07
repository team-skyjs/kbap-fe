/**
 * FlippedOrderCard (P-136 → P-138 시안 S2 재정합) — 주문 카드 공용 뷰.
 *
 * emo 스샷(IMG_1799) 구조: 뒤집힌 틴트 카드 **크게 중앙**(확대 = IconExpand
 * 좌상단, 내부 타이포 시안 비율) → 정방향 미러 박스(하단 캡션) → Estimated
 * total → Done. 모달풍 X·여백 낭비 제거 — 헤더는 스크린 몫(백+타이틀+서브).
 *
 * 🚫 한국어 문구는 시안 이식 금지(P-136 발주 7 유지) — 기존 orderCard.ts 조립
 * (orderSentenceKo·avoidSentenceKo, P-045·052·109 무변)만 렌더. 미러는 같은
 * 데이터의 리더 언어 표현(신규 한국어 0).
 */
import * as React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, primaryTint, radius, shadow } from '@/lib/theme';
import { Btn, IconExpand } from '@/components';
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
    <View style={{ gap: big ? 18 : 10 }}>
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
      {/* 뒤집힌 카드 — 크게 중앙(시안), 맞은편에서 정방향으로 읽힌다 */}
      <View style={styles.flipCard} testID="flip-card">
        {/* 확대 = IconExpand 좌상단(시안 — 돋보기 아님) */}
        <Pressable style={styles.zoomBtn} hitSlop={8} onPress={() => setZoomed(true)} testID="zoom-open">
          <IconExpand size={16} color={C.ink2} />
        </Pressable>
        <View style={styles.flipInner}>{koCard()}</View>
      </View>

      {/* 정방향 미러 — 같은 데이터의 리더 언어 표현, 캡션은 박스 하단(시안) */}
      <View style={styles.mirror} testID="order-mirror">
        {items.map((i, k) => (
          <Text key={k} style={styles.mirrorLine}>
            {i.qty} × {i.name}
          </Text>
        ))}
        {avoidNames.length > 0 && (
          <Text style={styles.mirrorAvoid}>{t('order.mirrorAvoid', { list: avoidNames.join(', ') })}</Text>
        )}
        <Text style={styles.mirrorCaption}>{t('order.mirrorTitle')}</Text>
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
  body: { flex: 1, paddingHorizontal: 18 },
  flipCard: {
    backgroundColor: primaryTint,
    borderWidth: 1.5,
    borderColor: 'rgba(226,88,12,0.22)',
    borderRadius: radius.lg,
    paddingVertical: 30,
    paddingHorizontal: 22,
    minHeight: 260,
    justifyContent: 'center',
    ...shadow.sh1,
  },
  flipInner: { transform: [{ rotate: '180deg' }] },
  // 시안: 확대 버튼은 카드 좌상단 — 뒤집힌 텍스트 기준으론 우하단이라 본문과 안 겹침
  zoomBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...shadow.sh1,
  },
  koLine: { fontFamily: font.koBold, fontSize: 24, lineHeight: 35, color: C.ink, textAlign: 'center' },
  koLineBig: { fontSize: 34, lineHeight: 48 },
  koAvoid: { fontFamily: font.koBold, fontSize: 16, lineHeight: 24, color: C.ink2, textAlign: 'center', marginTop: 6 },
  koAvoidBig: { fontSize: 21, lineHeight: 31 },
  mirror: {
    marginTop: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 3,
  },
  mirrorLine: { fontFamily: font.bodySemi, fontSize: 14, color: C.ink },
  mirrorAvoid: { fontFamily: font.body, fontSize: 12.5, color: C.ink2, marginTop: 2 },
  // 시안(IMG_1799): 캡션은 미러 박스 하단 중앙 뮤트
  mirrorCaption: { fontFamily: font.body, fontSize: 11.5, color: C.ink3, textAlign: 'center', marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair, paddingTop: 8 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  totalLabel: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink2 },
  totalVal: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink, fontVariant: ['tabular-nums'] },
  foot: { marginTop: 'auto', paddingTop: 12 },
  zoomFull: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', padding: 28 },
});

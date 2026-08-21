/**
 * 주문 상세 (P-253/KB-360 1차 러프) — GET /api/orders/{orderId} 스냅샷 read-only.
 * 메뉴판 사진(탭 = 풀스크린 contain 뷰어 — P-149 문법 간단판)·메뉴별 행(행 탭 =
 * 음식 상세·우측 리뷰 쓰기 = 작성 — 주문했으니 자격 상시 보유, P-251)·총액·주소·날짜.
 * 비범위: 수정·장소 태그·공유 카드·dish 위험도(서버 items에 riskLevel 없음).
 */
import * as React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius } from '@/lib/theme';
import { IconClose, SubHeader, Spinner } from '@/components';
import { QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { RemoteImage } from '@/components/RemoteImage';
import { useOrderDetail } from '@/lib/data/useOrders';
import { formatOrderDate } from '../my-foods';
import { formatKrw } from '@/lib/scan/segmentMenu';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const q = useOrderDetail(id ?? '');
  const [viewer, setViewer] = React.useState(false);

  return (
    <View style={styles.root}>
      <SubHeader title={t('myFoods.orderTitle')} onBack={() => router.back()} />
      {q.isError ? (
        <QueryErrorBlock error={q.error} onRetry={() => void q.refetch()} onGoBack={() => router.back()} />
      ) : !q.data ? (
        <ScreenCenterFill><Spinner /></ScreenCenterFill>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.date}>{formatOrderDate(q.data.orderedAt)}</Text>
          {!!q.data.roadAddress && <Text style={styles.addr}>{q.data.roadAddress}</Text>}

          {/* 메뉴판 사진 — 탭 = 풀스크린 뷰어(contain — P-248 잘림 금지 문법) */}
          {!!q.data.scanImageUrl && (
            <Pressable onPress={() => setViewer(true)} testID="order-scan-image">
              <RemoteImage uri={q.data.scanImageUrl} style={styles.scanImage} contentFit="cover" />
            </Pressable>
          )}

          <View style={styles.itemsCard}>
            {q.data.items.map((it, k) => (
              <Pressable
                key={`${it.foodId ?? 'x'}-${k}`}
                style={[styles.itemRow, k > 0 && styles.itemRowDivider]}
                disabled={it.foodId == null}
                onPress={() => it.foodId && router.push(`/food/${it.foodId}?src=list` as Href)}
                testID={`order-item-${k}`}
              >
                {it.imageUrl ? (
                  <RemoteImage uri={it.imageUrl} style={styles.itemThumb} />
                ) : (
                  <View style={[styles.itemThumb, { backgroundColor: C.surface2 }]} />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{it.menuName}</Text>
                  <Text style={styles.itemSub}>
                    {t('myFoods.itemCount', { count: it.quantity })}
                    {it.price != null ? `  ${formatKrw(it.price)}` : ''}
                  </Text>
                </View>
                {/* 리뷰 쓰기 — 주문 = 스캔 경유라 자격 상시 보유(P-251 게이트 불요) */}
                {it.foodId != null && (
                  <Pressable
                    hitSlop={8}
                    style={styles.reviewLink}
                    onPress={() => router.push(`/food/${it.foodId}/review` as Href)}
                    testID={`order-item-review-${k}`}
                  >
                    <Text style={styles.reviewLinkText}>{t('reviews.writeReview')}</Text>
                  </Pressable>
                )}
              </Pressable>
            ))}
            {/* 총액 — 가격 있는 항목만 합산(서버 계산 그대로) */}
            {q.data.totalPrice != null && q.data.totalPrice > 0 && (
              <View style={styles.totalRow} testID="order-total">
                <Text style={styles.totalLabel}>{t('myFoods.total')}</Text>
                <Text style={styles.totalValue}>{formatKrw(q.data.totalPrice)}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* 풀스크린 메뉴판 뷰어 — contain(전체 표시) + 명시 닫기 */}
      {viewer && q.data?.scanImageUrl && (
        <Modal visible transparent={false} animationType="fade" onRequestClose={() => setViewer(false)}>
          <View style={styles.viewerRoot}>
            <RemoteImage uri={q.data.scanImageUrl} style={StyleSheet.absoluteFill} contentFit="contain" />
            <Pressable style={styles.viewerClose} onPress={() => setViewer(false)} hitSlop={10} testID="order-viewer-close">
              <IconClose size={22} color="#fff" />
            </Pressable>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  date: { fontFamily: font.bodyBold, fontSize: 16, color: C.ink },
  addr: { fontFamily: font.body, fontSize: 13, color: C.ink3, marginTop: -6 },
  scanImage: { height: 160, borderRadius: radius.lg, backgroundColor: C.surface2 },

  itemsCard: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  itemRowDivider: { borderTopWidth: 0.5, borderTopColor: C.line },
  itemThumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: C.surface2 },
  itemName: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink },
  itemSub: { fontFamily: font.body, fontSize: 12.5, color: C.ink3, fontVariant: ['tabular-nums'] },
  reviewLink: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.line },
  reviewLinkText: { fontFamily: font.bodyBold, fontSize: 12, color: C.primaryText },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line },
  totalLabel: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink2 },
  totalValue: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink, fontVariant: ['tabular-nums'] },

  viewerRoot: { flex: 1, backgroundColor: '#16110d' },
  viewerClose: { position: 'absolute', top: 54, right: 18, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});

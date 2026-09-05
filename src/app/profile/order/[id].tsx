/**
 * 주문 상세 — KB-434 D-6(4150:14634). 메뉴판 사진(기능 유지 — 탭 = 풀스크린 뷰어) ·
 * 영수증 카드(DATE/LOCATION/TOTAL — PLACE 행은 장소명 데이터 부재로 생략, 조립 금지) ·
 * 8px 디바이더 · "Dishes" + dish-item 리스트(4150:14675 — 썸네일 58 r4, xN + 환산가.
 * RiskBadge는 items 위험도 계약 부재로 생략) · FixedBottom outline "Write a review".
 *
 * 생략(발주 규정·REPORTS): 사진 슬롯 4개(주문 사진 기능 부재) · 공유 섹션(스토리
 * 카드/다운로드 — 공유 기능 부재, 기획 필요). 데이터 훅·뷰어 무변.
 */
import * as React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import { Btn, IconClose, SubHeader, Spinner } from '@/components';
import { QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { RemoteImage } from '@/components/RemoteImage';
import { useOrderDetail } from '@/lib/data/useOrders';
import { useMe } from '@/lib/data/useMe';
import { useBottomInset } from '@/lib/useBottomInset';
import { convertKrw, currencyForCountry } from '@/lib/exchange';
import { formatOrderDate } from '../my-foods';
import { formatKrw } from '@/lib/scan/segmentMenu';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const q = useOrderDetail(id ?? '');
  const { data: me } = useMe();
  const bottom = useBottomInset(); // P-055: 안드 내비바 보정
  const [viewer, setViewer] = React.useState(false);

  // 환산 통화 = 서버 정본(me.currency) → 국적 파생 폴백(P-165 체인 간단판)
  const cur = me?.currency ?? currencyForCountry(me?.nationality);
  const conv = (krw: number) => convertKrw(krw, cur)?.replace(/^= /, '') ?? null;

  // FixedBottom Write a review — 시안 단일 버튼: 첫 리뷰 가능 항목(질문 누적 — 다중 dish 대상)
  const reviewable = (q.data?.items ?? []).find((it) => it.foodId != null && it.ready !== false);

  return (
    <View style={styles.root}>
      <SubHeader title={t('profile.myFoods')} onBack={() => router.back()} />
      {q.isError ? (
        <QueryErrorBlock error={q.error} onRetry={() => void q.refetch()} onGoBack={() => router.back()} />
      ) : !q.data ? (
        <ScreenCenterFill><Spinner /></ScreenCenterFill>
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 110 + bottom }]} showsVerticalScrollIndicator={false}>
          {/* 메뉴판 사진 — 시안 외(기능 유지) — 탭 = 풀스크린 contain 뷰어(P-248) */}
          {!!q.data.scanImageUrl && (
            <Pressable onPress={() => setViewer(true)} testID="order-scan-image" style={{ paddingHorizontal: 20 }}>
              <RemoteImage uri={q.data.scanImageUrl} style={styles.scanImage} contentFit="cover" />
            </Pressable>
          )}

          {/* 장소명 18/600 — 데이터 부재라 주소가 대체(있을 때만, 조립 금지) */}
          {!!q.data.roadAddress && (
            <Text style={styles.placeTitle} numberOfLines={2}>{q.data.roadAddress}</Text>
          )}

          {/* 영수증 카드(4150:14634) — 라벨 12/600 #B1B5BD + 값 14/500 #1C1E21 */}
          <View style={styles.receipt} testID="order-receipt">
            <View style={styles.rcptRow}>
              <Text style={styles.rcptLbl}>DATE</Text>
              <Text style={styles.rcptVal}>{formatOrderDate(q.data.orderedAt)}</Text>
            </View>
            {!!q.data.roadAddress && (
              <View style={styles.rcptRow}>
                <Text style={styles.rcptLbl}>LOCATION</Text>
                <Text style={[styles.rcptVal, styles.rcptValWrap]} numberOfLines={2}>{q.data.roadAddress}</Text>
              </View>
            )}
            {q.data.totalPrice != null && q.data.totalPrice > 0 && (
              <>
                <View style={styles.rcptLine} />
                <View style={styles.rcptRow} testID="order-total">
                  <Text style={styles.rcptLbl}>TOTAL</Text>
                  <Text style={styles.rcptTotal}>
                    {formatKrw(q.data.totalPrice)}
                    {conv(q.data.totalPrice) ? ` · ${conv(q.data.totalPrice)}` : ''}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* 8px 디바이더 */}
          <View style={styles.divider8} />

          {/* Dishes 16/500 + 수량 14/500 #9196A1 */}
          <View style={styles.dishesHead}>
            <Text style={styles.dishesTitle}>{t('myFoods.dishes')}</Text>
            <Text style={styles.dishesCount}>{q.data.items.length}</Text>
          </View>

          {/* dish-item 리스트(4150:14675) — h86 gap 12, 썸네일 58 r4(RiskBadge = 계약 부재 생략) */}
          <View style={styles.items}>
            {q.data.items.map((it, k) => (
              <Pressable
                key={`${it.foodId ?? 'x'}-${k}`}
                style={styles.itemRow}
                /* P-259: ready === false = 준비중(FOOD-001) — 진입 비활성(서버 ready만 판단) */
                disabled={it.foodId == null || it.ready === false}
                onPress={() => it.foodId && it.ready !== false && router.push(`/food/${it.foodId}?src=list` as Href)}
                testID={`order-item-${k}`}
              >
                {it.imageUrl ? (
                  <RemoteImage uri={it.imageUrl} style={styles.itemThumb} />
                ) : (
                  <View style={[styles.itemThumb, { backgroundColor: C.surface2 }]} />
                )}
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{it.menuName}</Text>
                  {/* P-259: 준비중 표시 — 보조 텍스트 */}
                  {it.ready === false && (
                    <Text style={styles.itemPending} testID={`order-item-pending-${k}`}>{t('myFoods.itemPending')}</Text>
                  )}
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemQty}>x{it.quantity}</Text>
                  {it.price != null && (
                    <Text style={styles.itemPrice}>{conv(it.price) ?? formatKrw(it.price)}</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {/* FixedBottom — outline Write a review(시안 단일 버튼) */}
      {!!q.data && !!reviewable && (
        <View style={[styles.bottomBar, { paddingBottom: bottom + 10 }]} testID="order-bottom-bar">
          <Btn variant="ghost" onPress={() => router.push(`/food/${reviewable.foodId}/review` as Href)} testID="order-write-review">
            {t('reviews.writeReview')}
          </Btn>
        </View>
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
  body: { paddingTop: 8, gap: 16 },
  scanImage: { height: 160, borderRadius: 8, backgroundColor: C.surface2 },
  placeTitle: { fontSize: 18, fontWeight: '600', color: '#1C1E21', paddingHorizontal: 20 },

  // 영수증 카드 — pad 16, 행 space-between, line #DCDEE3
  receipt: { marginHorizontal: 20, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 16, gap: 12 },
  rcptRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  rcptLbl: { fontSize: 12, fontWeight: '600', color: C.inkMute },
  rcptVal: { fontSize: 14, fontWeight: '500', color: '#1C1E21' },
  rcptValWrap: { flex: 1, textAlign: 'right' },
  rcptLine: { height: 1, backgroundColor: C.line2 },
  rcptTotal: { fontSize: 15, fontWeight: '600', color: '#1C1E21', fontVariant: ['tabular-nums'] },

  divider8: { height: 8, backgroundColor: C.hair },

  dishesHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 20 },
  dishesTitle: { fontSize: 16, fontWeight: '500', color: '#1C1E21' },
  dishesCount: { fontSize: 14, fontWeight: '500', color: C.ink3 },

  items: { paddingHorizontal: 20, gap: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 86, paddingVertical: 14 },
  itemThumb: { width: 58, height: 58, borderRadius: 4, backgroundColor: C.surface2 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1C1E21' },
  itemPending: { fontSize: 11.5, fontWeight: '500', color: C.ink3 },
  itemRight: { alignItems: 'flex-end', gap: 2 },
  itemQty: { fontSize: 13, fontWeight: '500', color: C.ink3 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: '#1C1E21', fontVariant: ['tabular-nums'] },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: C.line },

  viewerRoot: { flex: 1, backgroundColor: '#16110d' },
  viewerClose: { position: 'absolute', top: 54, right: 18, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});

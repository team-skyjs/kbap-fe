/**
 * 주문 상세 — KB-434 D-6(4150:14634). 메뉴판 사진(기능 유지 — 탭 = 풀스크린 뷰어) ·
 * 영수증 카드(DATE/LOCATION/TOTAL — PLACE 행은 장소명 데이터 부재로 생략, 조립 금지) ·
 * 8px 디바이더 · "Dishes" + dish-item 리스트(4150:14675 — 썸네일 58 r4, xN + 환산가.
 * RiskBadge는 items 위험도 계약 부재로 생략) · FixedBottom outline "Download image" → 공유 카드 시트.
 *
 * 생략(발주 규정·REPORTS): 사진 슬롯 4개(주문 사진 기능 부재). 데이터 훅·뷰어 무변.
 *
 * P-380(KB-518): 하단 공유 섹션 부활 — 스토리 카드 미리보기 + 저장/인스타 버튼.
 * P-409(KB-636, 예진 b36 실기): 공유 섹션을 본문에서 빼 **시트**로 옮겼다(본문 = 메뉴판·영수증·항목까지).
 *   하단 버튼 "Download image" → 시트(공용 SheetShell — 장소 태그 시트와 같은 골격). 시트 안 내용·치수·동작은
 *   본문 시절 그대로. **시트가 닫혀 있으면 카드·캡처 캔버스 미마운트 = 이미지 요청 0**(프리페치는 열 때 시작).
 *   "Write a review" 제거 — 리뷰 진입은 항목 행 → 음식 상세.
 */
import * as React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import { ActionSheet, Btn, SubHeader } from '@/components';
import { SheetShell } from '@/components/SheetShell';
import { TopToastHost } from '@/components/TopToast';
import { QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { SkeletonOrderDetail } from '@/components/Skeleton';
import { RemoteImage } from '@/components/RemoteImage';
import { PhotoViewer } from '@/components/PhotoViewer';
import { orderPlaceLabel, useOrderDetail } from '@/lib/data/useOrders';
import { OrderShareExportCanvas, OrderShareSection } from '@/features/order/OrderShareCard';
import { shareMenuLine, shareMetaCity, sharePhotos } from '@/features/order/shareCard';
import { lastShareErrorHint, saveCardToPhotos, shareCardToStory, storyShareAvailable } from '@/features/order/shareExport';
import { showTopToast } from '@/components/topToastStore';
import { openAppSettings } from '@/lib/openExternal';
import { EVENTS, track } from '@/lib/analytics';
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
  // P-380 4단계: 캡처 대상 = 화면 밖 9:16 캔버스(미리보기 카드가 아니다)
  const exportRef = React.useRef<View>(null);
  const shareBusy = React.useRef(false); // 연타 차단(캡처는 수백 ms 걸린다)
  const [photoDenied, setPhotoDenied] = React.useState(false); // 사진첩 권한 거부 안내 시트
  // Codex #151 P2: 내보내기 캔버스의 원격 이미지가 로드되기 전에 찍으면 빈 칸·셔머가 박힌다.
  // 프리페치가 끝나기 전까지 캡처 액션을 잠근다(캐시가 차면 양쪽 인스턴스가 같이 산다).
  // 5R: **실패도 잠금 유지** — RemoteImage 실패 칸은 빈 칸이라 그대로 찍으면 사진 없는 카드가 저장된다.
  // 7R: 게이트 기준 = 프리페치(= URL 캐시됨)가 아니라 **내보내기 캔버스의 실제 렌더 완료**.
  // 캐시돼 있어도 디코드·마운트·페이드가 남아서, 프리페치만 보면 반쯤 그려진 카드가 찍힌다.
  const [photosState, setPhotosState] = React.useState<'loading' | 'ready' | 'failed'>('loading');
  const [retry, setRetry] = React.useState(0); // 재시도 = 캔버스 리마운트(칸 로드 재시작)

  // P-380: 카드 데이터 — 미리보기와 내보내기 캔버스가 **같은 값**을 쓴다(둘이 어긋나면
  // 사용자가 본 것과 저장된 것이 달라진다)
  // Codex 8R: thumbnails는 준비중·무사진 항목에 **서버 대체 이미지**가 섞인다(계약 명시) —
  // 카드엔 실사진만(9/14 예진 ①: 빈 칸·기본 이미지로 채우지 않는다). 판별은 items.ready(계약)로.
  const cardPhotos = q.data ? sharePhotos(q.data.items) : [];
  const shareCard = q.data
    ? {
        photos: cardPhotos,
        placeName: orderPlaceLabel(q.data),
        menuLine: shareMenuLine(
          q.data.items.map((it) => it.menuName),
          (count) => t('myFoods.shareMenuMore', { count }),
        ),
        // 도시는 place.address(회원 언어 해석)가 올 때만 — roadAddress는 한국어라
        // 파싱해도 시안의 "Seoul"이 안 나오고, 카드를 보는 사람은 외국인이다
        metaCity: shareMetaCity(q.data.placeAddress),
        metaDate: formatOrderDate(q.data.orderedAt),
      }
    : null;
  // 계측 속성 = 음식 개수·장소 유무까지만(발주 고정 — 가게명·주소·좌표 금지).
  // Codex #151 P2: has_place = **카드에 장소 줄이 떴는가**(orderPlaceLabel과 같은 판정) —
  // placeName만 보면 주소 폴백으로 장소가 보이는 기존 주문이 전부 false로 잡힌다.
  const shareProps = { item_count: q.data?.items.length ?? 0, has_place: !!(q.data && orderPlaceLabel(q.data)) };
  // KB-636: 카드 노출 = **시트가 열렸을 때**(주문 1건당 1회). 본문 시절의 "뷰포트 진입" 판정(Codex #151 4R)은
  // 카드가 본문에서 빠져 소멸 — 시트를 연 것 자체가 노출이다.
  const viewTracked = React.useRef(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const openShare = () => {
    setShareOpen(true);
    if (viewTracked.current) return;
    viewTracked.current = true;
    track(EVENTS.order_share_view, shareProps);
  };

  const photosKey = cardPhotos.join('|');
  React.useEffect(() => {
    // 사진이 바뀌면(주문 전환·재시도) · **시트를 다시 열면**(캔버스 새로 마운트) 다시 잠근다 — 캔버스가
    // 로드 완료를 다시 알려 준다. 닫힌 동안엔 캔버스가 없으니 잠금 상태로 둔다.
    setPhotosState(photosKey ? 'loading' : 'ready');
  }, [photosKey, retry, shareOpen]);

  // 실패 문구 + (비production 한정) 단계·원인 1줄
  const shareFailText = (base: string) => {
    const hint = lastShareErrorHint();
    return hint ? `${base} (${hint})` : base;
  };

  const onDownload = React.useCallback(async () => {
    if (shareBusy.current) return;
    shareBusy.current = true;
    track(EVENTS.order_share_save, { ...shareProps, result: 'tap' });
    const r = await saveCardToPhotos(exportRef);
    shareBusy.current = false;
    track(EVENTS.order_share_save, { ...shareProps, result: r });
    if (r === 'success') return showTopToast(t('myFoods.shareSaved'));
    // 권한 거부 = 안내 + 설정 열기(P-381 openAppSettings 재사용 — 앱이 직접 못 연다).
    // 네이티브 Alert가 아니라 공용 시트 — 이 화면은 P-355로 Alert를 걷어낸 자리다.
    if (r === 'denied') return setPhotoDenied(true);
    // P-399: teamtest·development에서만 실패 요지 1줄을 덧붙인다(production은 문구 무변 —
    // 사용자에게 내부 메시지를 보이지 않는다). 예진이 기기에서 바로 단계를 읽을 수 있게.
    showTopToast(shareFailText(t('myFoods.shareFailed')), { error: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, shareProps.item_count, shareProps.has_place]);

  const onInstagram = React.useCallback(async () => {
    if (shareBusy.current) return;
    shareBusy.current = true;
    track(EVENTS.order_share_story, { ...shareProps, result: 'tap' });
    const r = await shareCardToStory(exportRef);
    shareBusy.current = false;
    track(EVENTS.order_share_story, { ...shareProps, result: r });
    if (r === 'success') return;
    // 미설치는 앱스토어로 보내지 않는다(발주 고정) — 문구만
    showTopToast(
      r === 'not_installed' ? t('myFoods.shareNoInstagram') : shareFailText(t('myFoods.shareFailed')),
      { error: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, shareProps.item_count, shareProps.has_place]);

  // 환산 통화 = 서버 정본(me.currency) → 국적 파생 폴백(P-165 체인 간단판)
  const cur = me?.currency ?? currencyForCountry(me?.nationality);
  const conv = (krw: number) => convertKrw(krw, cur)?.replace(/^= /, '') ?? null;

  return (
    <View style={styles.root}>
      <SubHeader title={t('profile.myFoods')} onBack={() => router.back()} />
      {q.isError ? (
        <QueryErrorBlock error={q.error} onRetry={() => void q.refetch()} onGoBack={() => router.back()} />
      ) : !q.data ? (
        /* P-287(4003:12906): 첫 로드 = 영수증·dish 스켈레톤 */
        <SkeletonOrderDetail />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: 110 + bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* 메뉴판 사진 — 시안 외(기능 유지) — 탭 = 풀스크린 contain 뷰어(P-248) */}
          {!!q.data.scanImageUrl && (
            <Pressable onPress={() => setViewer(true)} testID="order-scan-image" style={{ paddingHorizontal: 20 }}>
              <RemoteImage uri={q.data.scanImageUrl} style={styles.scanImage} contentFit="cover" />
            </Pressable>
          )}

          {/* 장소명 18/600 — P-386(KB-456): 서버 식당명 우선, 없으면 주소 대체(조립 금지) */}
          {!!orderPlaceLabel(q.data) && (
            <Text style={styles.placeTitle} numberOfLines={2}>{orderPlaceLabel(q.data)}</Text>
          )}

          {/* 영수증 카드(4150:14634) — 라벨 12/600 #B1B5BD + 값 14/500 #1C1E21 */}
          <View style={styles.receipt} testID="order-receipt">
            <View style={styles.rcptRow}>
              <Text style={styles.rcptLbl}>{t('myFoods.receiptDate')}</Text>
              <Text style={styles.rcptVal}>{formatOrderDate(q.data.orderedAt)}</Text>
            </View>
            {!!q.data.roadAddress && (
              <View style={styles.rcptRow}>
                <Text style={styles.rcptLbl}>{t('myFoods.receiptLocation')}</Text>
                <Text style={[styles.rcptVal, styles.rcptValWrap]} numberOfLines={2}>{q.data.roadAddress}</Text>
              </View>
            )}
            {q.data.totalPrice != null && q.data.totalPrice > 0 && (
              <>
                <View style={styles.rcptLine} />
                <View style={styles.rcptRow} testID="order-total">
                  <Text style={styles.rcptLbl}>{t('myFoods.receiptTotal')}</Text>
                  {/* P-196(9/14 예진 재확인): 원화·환산가 사이 가운뎃점 폐기 — 문자 구분자
                      대신 gap으로 가른다(공유 카드 메타줄과 같은 처리) */}
                  <View style={styles.rcptTotalRow}>
                    <Text style={styles.rcptTotal}>{formatKrw(q.data.totalPrice)}</Text>
                    {!!conv(q.data.totalPrice) && (
                      <Text style={styles.rcptTotalConv}>{conv(q.data.totalPrice)}</Text>
                    )}
                  </View>
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

      {/* FixedBottom — outline "Download image"(KB-636, 예진 지정 · 기존 키) → 공유 카드 시트.
          사진 0장이면 카드 자체가 없으니(빈 카드 금지 — P-380) 버튼도 없다. */}
      {!!q.data && cardPhotos.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: bottom + 10 }]} testID="order-bottom-bar">
          <Btn variant="ghost" onPress={openShare} testID="order-share-open">
            {t('myFoods.shareDownload')}
          </Btn>
        </View>
      )}

      {/* KB-636 공유 카드 시트 — 열렸을 때만 마운트(닫힘 = 카드·캡처 캔버스·이미지 요청 0).
          overlay = 모달 컨텍스트 토스트 호스트(P-370 — 저장 완료·실패 토스트가 시트 위에 뜬다). */}
      {shareOpen && shareCard && (
        <SheetShell
          // Codex #193 P2: 저장·스토리 진행 중(권한 요청·캡처 대기)에 닫으면 캔버스가 언마운트돼 captureRef가 null —
          // 진행 중엔 스크림 탭·안드 백을 무시한다. export 함수는 내부 catch로 항상 결과를 돌려 shareBusy가 반드시 풀린다.
          onClose={() => { if (!shareBusy.current) setShareOpen(false); }}
          overlay={<TopToastHost />}
        >
          {/* 재시도 = **미리보기·캡처 캔버스 둘 다** 리마운트(Codex 10R). 캔버스만 다시 올리면
              보이는 카드는 빈 칸인데 저장은 성공해서, 본 것과 저장된 것이 달라진다.
              캡처 대상 = 화면 밖 9:16 캔버스(절대배치 — 시트 높이에 안 들어간다) · 미리보기와 **같은 props**. */}
          <View key={`share-${retry}`} testID="order-share-sheet">
            <OrderShareExportCanvas
              ref={exportRef}
              card={shareCard}
              onReady={() => setPhotosState('ready')}
              onFailed={() => setPhotosState('failed')}
            />
            <OrderShareSection
              card={shareCard}
              caption={t('myFoods.sharePreviewCaption')}
              downloadLabel={t('myFoods.shareDownload')}
              instagramLabel={t('myFoods.shareInstagram')}
              onDownload={onDownload}
              onInstagram={onInstagram}
              storyAvailable={storyShareAvailable()}
              storyHint={t('myFoods.shareStoryHint')}
              busy={photosState !== 'ready'}
              failed={photosState === 'failed'}
              failedLabel={t('myFoods.sharePhotosFailed')}
              onRetryPhotos={() => setRetry((n) => n + 1)}
            />
          </View>
          {/* P-380: 사진첩 권한 거부 안내 — 저장은 시트 안에서만 일어나므로 시트 트리에 둔다
              (시트 모달 위에 떠야 한다 — 바깥에 두면 가려진다). */}
          <ActionSheet
            open={photoDenied}
            title={t('myFoods.sharePhotoDenied')}
            items={[{ key: 'settings', label: t('photo.openSettings'), onPress: () => void openAppSettings() }]}
            onClose={() => setPhotoDenied(false)}
          />
        </SheetShell>
      )}

      {/* 풀스크린 메뉴판 뷰어 — contain(전체 표시) + 명시 닫기 */}
      {/* P-348 ⑥(KB-511): 공용 PhotoViewer — 세로 스와이프 닫기 포함 */}
      {viewer && q.data?.scanImageUrl && (
        <PhotoViewer uris={[q.data.scanImageUrl]} onClose={() => setViewer(false)} />
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
  receipt: { marginHorizontal: 20, paddingVertical: 16, paddingHorizontal: 0, gap: 16 }, // A-OD-01(KB-486: 보더 제거·좌우 0)
  rcptRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  rcptLbl: { fontSize: 12, fontWeight: '600', color: C.inkInfo }, // P-284: 영수증 라벨 대비
  rcptVal: { fontSize: 14, fontWeight: '500', color: '#1C1E21' },
  rcptValWrap: { flex: 1, textAlign: 'right' },
  rcptLine: { height: 1, backgroundColor: C.line2 },
  rcptTotalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 }, // 구분자 문자 대신 gap(P-196)
  rcptTotal: { fontSize: 15, fontWeight: '600', color: '#1C1E21', fontVariant: ['tabular-nums'] },
  rcptTotalConv: { fontSize: 15, fontWeight: '600', color: '#1C1E21', fontVariant: ['tabular-nums'] },

  divider8: { height: 8, backgroundColor: '#F5F5F5' }, // A-OD-02

  dishesHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 20, marginTop: -4 }, // A-OD-03(디바이더 후 12)
  dishesTitle: { fontSize: 16, fontWeight: '500', color: '#1C1E21' },
  dishesCount: { fontSize: 14, fontWeight: '500', color: C.ink3 },

  items: { paddingHorizontal: 20, gap: 12, marginTop: -8 }, // A-OD-03(헤더→리스트 8)·A-OD-04(카드 간 12)
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 86, padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAEBEE', borderRadius: 8 }, // A-OD-04
  itemThumb: { width: 58, height: 58, borderRadius: 4, backgroundColor: C.surface2 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1C1E21' },
  itemPending: { fontSize: 11.5, fontWeight: '500', color: C.ink3 },
  itemRight: { flexDirection: 'row', alignItems: 'baseline', gap: 3 }, // A-OD-05(가로 1행)
  itemQty: { fontSize: 13, fontWeight: '500', color: C.ink3 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: '#1C1E21', fontVariant: ['tabular-nums'] },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: C.line },

  viewerRoot: { flex: 1, backgroundColor: '#16110d' },
  viewerClose: { position: 'absolute', top: 54, right: 18, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});

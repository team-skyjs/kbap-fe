/**
 * FlippedOrderCard (P-136 → P-138 시안 S2 재정합) — 주문 카드 공용 뷰.
 *
 * emo 스샷(IMG_1799) 구조: 뒤집힌 틴트 카드 **크게 중앙**(확대 = IconExpand
 * 좌상단, 내부 타이포 시안 비율) → 정방향 미러 박스(하단 캡션) → Estimated
 * total → Done. 모달풍 X·여백 낭비 제거 — 헤더는 스크린 몫(백+타이틀+서브).
 *
 * 🚫 한국어 문구는 시안 이식 금지(P-136 발주 7 유지) — orderCard.ts 조립만 렌더
 * (P-265: 단일 = orderSentenceKo · 2개 이상 = orderItemLineKo+orderClosingKo,
 * 기피 = avoidNoticeKo 문장+전체 나열). 미러는 같은 데이터의 리더 언어 표현
 * (신규 한국어 0).
 */
import { OrderDoneInterstitial, type InterstitialController } from '@/features/ads/OrderDoneInterstitial';
import * as React from 'react';
import { ScrollView, StyleSheet, View, Platform } from 'react-native';
import { Modal } from '@/lib/engagement/occlusionSurfaces';
import { Pressable } from '@/components/Pressable';
import { EVENTS, track } from '@/lib/analytics';
import { airbridge } from '@/lib/airbridge';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, primaryTint, primaryTintSolid, radius, shadow, type } from '@/lib/theme';
import { Btn, IconCheck, IconClose, IconExpand } from '@/components';
import { ConfettiBurst, CONFETTI_DURATION_MS } from '@/components/ConfettiBurst';
import { buildOrderCard } from '@/lib/order/orderCard';
import { keepWordsKo } from '@/lib/order/keepWords';
import { saveOrderHistory } from '@/lib/data/orders';
import { convertKrw, type ServerFx } from '@/lib/exchange';
import { formatKrw } from '@/lib/scan/segmentMenu';
import { useReviewPrompt } from '@/lib/useReviewPrompt';
import { useOneShotQueue } from '@/lib/oneShotQueue';
import { ReviewPromptSheet } from '@/components/ReviewPromptSheet';

export interface OrderItem {
  nameKo: string;
  /** 리더 언어 표시명 — 미러 줄에 사용 */
  name: string;
  qty: number;
  priceKrw: number | null;
  /** P-192: 리뷰 유도 로컬 알림 컨텍스트 — 미매칭(스캔 unmatched)은 null */
  foodId?: string | null;
}

type TFn = (k: string, o?: Record<string, unknown>) => string;

export function FlippedOrderCard({
  items,
  avoidCodes,
  avoidNames,
  currency,
  fx,
  orderImagePath,
  onDone,
  t,
}: {
  items: OrderItem[];
  avoidCodes: string[];
  /** 리더 언어 재료명(미러 기피 줄) — codes와 같은 순서 */
  avoidNames: string[];
  currency: string;
  fx?: ServerFx; // P-242: 스캔 발 주문 v2 실환율 관통 — 부재 = 환산 배지 생략(KB-418)
  /** P-252: 주문 이력 식별자(스캔 이미지 경로) — KB-419: 스캔 주문이 유일 경로. */
  orderImagePath?: string | null;
  onDone: () => void;
  t: TFn;
}) {
  const [zoomed, setZoomed] = React.useState(false);
  // P-162: Done = 무반응 아님 — 완료 확인 모달 경유 후 onDone(홈 이동)
  const [doneOpen, setDoneOpen] = React.useState(false);
  const reviewPrompt = useReviewPrompt(); // KB-730: 주문 완료 모달 뒤 리뷰 유도
  const modalQueue = useOneShotQueue(); // 완료 모달이 완전히 닫힌 뒤(iOS onDismiss) 유도 시트
  const [leaving, setLeaving] = React.useState(false);
  // KB-739 ④-①: 리뷰 유도 → (전면 광고, 세션 1회·준비됐을 때만) → 홈 복귀. 광고는 큐에 덧붙여 유도 시트가 **완전히 닫힌 뒤** 뜬다(겹침 0);
  // 광고 호스트가 없으면(플래그 off·초기화 전·미수신) 종전처럼 응답 즉시 복귀. 복귀(onDone)는 광고가 닫힌 뒤
  const interstitial = React.useRef<InterstitialController | null>(null);
  const afterPrompt = (answer: 'positive' | 'negative' | 'later' | null) => {
    const adStep = interstitial.current?.step();
    // 별로예요 = 리뷰 유도가 복귀 뒤 문의 작성을 push한다(runAfterInteractions) — 광고 스텝이 복귀를 미루면 그 push가 dismissAll+replace에 지워진다(/review 2) → 종전처럼 즉시 복귀
    // 좋아요 = requestStoreReview() 뒤 iOS 평점 창(StoreKit)/Android 인앱 리뷰 시트가 떠 있을 수 있다 — 전면 광고가 덮거나 끊지 않게 역시 즉시 복귀(공부 2R)
    if (!adStep || answer === 'negative' || answer === 'positive') { onDone(); return; }
    modalQueue.add({
      key: adStep.key,
      present: (done, signal) => {
        const shown = adStep.present(() => { onDone(); done(); }, signal);
        if (!shown) onDone(); // 준비 안 됨·세션 상한 = 바로 복귀
        return shown;
      },
    });
  };
  const runAfterDone = () => { setLeaving(false); modalQueue.add(reviewPrompt.step('order', { after: afterPrompt })); }; // leaving 리셋 — onDismiss 재발화 시 큐 중복 등록 0
  // P-256: 완료 확정 1회 가드 — done 재탭·모달 재경유에도 저장/계측 1회
  const committedRef = React.useRef(false);
  // P-166: 모달 등장과 동시 폭죽 — DURATION 후 자연 소멸(언마운트), 매 완료마다
  const [confetti, setConfetti] = React.useState(false);
  React.useEffect(() => {
    if (!confetti) return;
    const timer = setTimeout(() => setConfetti(false), CONFETTI_DURATION_MS + 200);
    return () => clearTimeout(timer);
  }, [confetti]);
  // P-265: 2개 이상 = 품목 나열(주세요 X) + 맺음 한 줄(총 N개) / 단일 = 종전 한 문장
  // KB-915: 한국어 면·미러 = 같은 모델(항목·순서·회피 집합 동일)
  const { lines, closing, avoid } = buildOrderCard(items, avoidCodes, avoidNames);
  const totalKrw = items.reduce((a, i) => a + (i.priceKrw ?? 0) * i.qty, 0);
  const converted = totalKrw > 0 ? convertKrw(totalKrw, currency, fx) : null; // P-242

  // KB-777 B1-10: 한국어 본문은 어절 단위로만 줄바꿈(확대 카드에서 "메뉴가"가 갈라지던 것) — 문구 불변, 표시만
  const koCard = (big = false) => (
    <View style={{ gap: big ? 18 : 10 }}>
      {lines.map((l, i) => (
        <Text key={i} style={[styles.koLine, big && styles.koLineBig]} testID={big ? undefined : `ko-line-${i}`}>
          {keepWordsKo(l.ko)}
        </Text>
      ))}
      {/* P-265: 맺음 한 줄 — 사장님이 소리내 읽는 본문의 일부라 품목 줄과 같은 타이포 */}
      {!!closing && (
        <Text style={[styles.koLine, big && styles.koLineBig]} testID={big ? undefined : 'ko-closing'}>
          {keepWordsKo(closing)}
        </Text>
      )}
      {!!avoid && (
        <>
          <Text style={[styles.koAvoid, big && styles.koAvoidBig]} testID={big ? undefined : 'ko-avoid'}>{keepWordsKo(avoid.sentence)}</Text>
          {/* P-265: 회피 전체 나열 — 접기 없음(사장님이 전 항목 확인 가능해야 안전) */}
          <Text style={[styles.koAvoidList, big && styles.koAvoidListBig]} testID={big ? undefined : 'ko-avoid-list'}>{keepWordsKo(avoid.list)}</Text>
        </>
      )}
    </View>
  );

  return (
    /* KB-780(QA Android 9개·회피 4개 재현): 합계·Done이 긴 카드에서 스크롤 아래로 밀려 안 보였다(스크롤 표시 꺼짐 — 단서 없음).
       → 본문(카드·미러)만 스크롤, **예상 합계 + Done은 ScrollView 밖 하단 고정 바**(두 플랫폼 — 하단 인셋은 화면 루트 paddingBottom). */
    <View style={styles.root}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} testID="order-scroll">
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
        {lines.map((l, k) => (
          <Text key={k} style={styles.mirrorLine} testID={`mirror-line-${k}`}>
            {l.qty} × {l.name}
          </Text>
        ))}
        {/* KB-915: 요청 문구 = 한국어 면과 같은 뜻(못 먹는 재료 + 들어간 메뉴면 알려 달라) — 구 "빼 주세요"는 다른 요청이었다 */}
        {!!avoid && (
          <>
            <Text style={styles.mirrorAvoid} testID="mirror-avoid">{t('order.mirrorAvoidNotice')}</Text>
            <Text style={styles.mirrorAvoidList} testID="mirror-avoid-list">{avoid.names.join(', ')}</Text>
          </>
        )}
        <Text style={styles.mirrorCaption}>{t('order.mirrorTitle')}</Text>
      </View>
    </ScrollView>

      {/* KB-780: 하단 고정 바 — 예상 합계 + Done(스크롤과 무관하게 항상 보임) */}
      <View style={styles.footBar} testID="order-foot-bar">
      {totalKrw > 0 && (
        <View style={styles.totalRow} testID="est-total">
          <Text style={styles.totalLabel}>{t('order.estimatedTotal')}</Text>
          <Text style={styles.totalVal}>
            {formatKrw(totalKrw)}
            {converted ? ` ${converted}` : ''}
          </Text>
        </View>
      )}

      <View style={styles.foot}>
        <Btn testID="order-done"
          onPress={() => {
            setDoneOpen(true);
            setConfetti(true); // P-166: 모달 등장과 동시 버스트
            // P-256(예진 HAR 판독): 완료 확정 = **이 done 탭** — go home 전 이탈해도
            // 저장·계측이 남도록 전부 여기서 발화. 재탭·모달 경유 이중 발화는
            // 1회 가드(ref)로 봉쇄. (리뷰 리마인더는 KB-500부터 서버 배치 — 로컬 예약 없음)
            if (committedRef.current) return;
            committedRef.current = true;
            const itemCount = items.reduce((n, i) => n + (i.qty > 0 ? 1 : 0), 0);
            track(EVENTS.order_done, { item_count: itemCount });
            // KB-783 ⑪ — 금액 없음(예상 합계는 실결제 아님). totalQuantity = 수량 합(#278 Codex P2), item_count = 메뉴 줄 수
            airbridge.orderComplete({ lines: itemCount, units: items.reduce((n, i) => n + (i.qty > 0 ? i.qty : 0), 0) });
            // P-252→256: 주문 이력 저장 — 실패 무해(내부 흡수·code 로그), UX 무영향
            void saveOrderHistory({ imagePath: orderImagePath, items });
          }}
        >
          {t('order.done')}
        </Btn>
      </View>
      </View>

      <OrderDoneInterstitial controllerRef={interstitial} />
      <ReviewPromptSheet open={reviewPrompt.open} onAnswer={reviewPrompt.respond} onShow={reviewPrompt.onShow} onClosed={reviewPrompt.onClosed} disabled={reviewPrompt.answered} />
      {/* P-162: 주문 완료 확인 모달 — 스캔 재촬영 모달과 같은 카드 문법, 성공 체크 톤 */}
      <Modal visible={doneOpen} transparent animationType="fade" onRequestClose={() => setDoneOpen(false)} onDismiss={Platform.OS === 'ios' ? () => { if (leaving) runAfterDone(); } : undefined}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard} testID="order-done-confirm">
            <View style={styles.doneCheck}>
              <IconCheck size={26} color={C.primary} />
            </View>
            <Text style={styles.confirmTitle}>{t('order.doneTitle')}</Text>
            <Text style={styles.confirmBody}>{t('order.doneBody')}</Text>
            <View style={{ marginTop: 6 }}>
              <Btn testID="order-done-close"
                /* P-256: 저장·계측은 done 탭으로 이동 — 여기는 복귀만. KB-730: 완료 모달을 닫은 뒤 리뷰 유도 시트(겹침 0), 조건 미달이면 바로 복귀 */
                onPress={() => {
                  setLeaving(true);
                  setDoneOpen(false);
                  if (Platform.OS !== 'ios') runAfterDone(); // Android: onDismiss 미지원
                }}
              >
                {t('order.doneHome')}
              </Btn>
            </View>
          </View>
          {/* P-166: 폭죽 = 모달 위 전면 통과 레이어(pointerEvents none — 확인 즉시 탭 가능) */}
          {confetti && <ConfettiBurst />}
        </View>
      </Modal>

      {/* 풀스크린 확대 — 방향 유지. P-149: 긴 내용도 스크롤 가능 + 명시 닫기 버튼 */}
      <Modal visible={zoomed} animationType="fade" onRequestClose={() => setZoomed(false)}>
        <View style={styles.zoomFull}>
          <ScrollView contentContainerStyle={styles.zoomContent} showsVerticalScrollIndicator={false} testID="zoom-scroll">
            <View style={styles.flipInner}>{koCard(true)}</View>
          </ScrollView>
          <Pressable style={styles.zoomClose} hitSlop={10} onPress={() => setZoomed(false)} testID="zoom-close">
            <IconClose size={20} color={C.ink2} />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flexGrow: 1, paddingHorizontal: 18, paddingBottom: 16 },
  // KB-780: 하단 고정 바 — 본문과 같은 좌우 여백, 위 경계 헤어라인(스크롤 본문과 구분)
  footBar: { paddingHorizontal: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair, backgroundColor: '#fff' },
  // P-162 완료 모달 (scan.tsx confirm 문법과 동일 수치)
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  confirmCard: { alignSelf: 'stretch', backgroundColor: C.card, borderRadius: radius.xl, padding: 22, gap: 8, ...shadow.shPop },
  confirmTitle: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  confirmBody: { fontFamily: font.body, fontSize: 14, color: C.ink2, lineHeight: 20, textAlign: 'center' },
  doneCheck: { alignSelf: 'center', width: 52, height: 52, borderRadius: radius.pill, backgroundColor: primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  flipCard: {
    // KB-780: 불투명 합성색 — 반투명(primaryTint) + elevation(sh1)이면 Android가 그림자를 카드 아래 전체에 그려 회색 띠로 비쳤다(iOS는 무관)
    backgroundColor: primaryTintSolid,
    borderWidth: 1.5,
    borderColor: 'rgba(226,88,12,0.22)',
    borderRadius: radius.md,
    paddingVertical: 30,
    paddingHorizontal: 22,
    minHeight: 260,
    justifyContent: 'center',
    ...shadow.sh1,
  },
  // P-226 ⑥: 뒤집기 연출 제거(멘토 "굳이 돌려서 보여주기 ㄴㄴ") — 내 시점 그대로.
  // 카드 한국어 문구는 불변(연출만 변경 — 문구는 Codex 금지 영역).
  flipInner: {},
  // 시안: 확대 버튼은 카드 좌상단 — 뒤집힌 텍스트 기준으론 우하단이라 본문과 안 겹침
  zoomBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
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
  // P-265: 회피 전체 나열 — 고지 문장보다 한 단계 작은 뮤트(항목 多에도 카드 안 정돈)
  koAvoidList: { fontFamily: font.koBold, fontSize: 16, lineHeight: 25, color: C.ink2, textAlign: 'center' },
  koAvoidListBig: { fontSize: 18, lineHeight: 28 },
  mirror: {
    marginTop: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 3,
  },
  mirrorLine: { fontFamily: font.bodySemi, fontSize: 16, color: C.ink },
  // KB-915: 요청 문장 + 재료 줄(한국어 면과 같은 2단) — 토큰 타이포(KB-909)
  mirrorAvoid: { ...type.meta, fontFamily: font.body, color: C.ink2, marginTop: 2 },
  mirrorAvoidList: { ...type.meta, fontFamily: font.bodySemi, color: C.ink2 },
  // 시안(IMG_1799): 캡션은 미러 박스 하단 중앙 뮤트
  mirrorCaption: { fontFamily: font.body, fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair, paddingTop: 8 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  totalLabel: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink2 },
  totalVal: { fontFamily: font.bodyBold, fontSize: 16, color: C.ink, fontVariant: ['tabular-nums'] },
  foot: { paddingTop: 10 },
  zoomContent: { flexGrow: 1, justifyContent: 'center', padding: 28, paddingTop: 64 },
  zoomClose: { position: 'absolute', top: 54, right: 18, width: 40, height: 40, borderRadius: radius.pill, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  zoomFull: { flex: 1, backgroundColor: '#fff' },
});

/**
 * ScanRichList (P-136 → P-138 반려 재작업) — 결과 리치 리스트 (콰이엇 스타일).
 *
 * P-138 판정 기준 = emo 스샷(mockups/refs)의 밀도·정돈:
 * - **행 프레임 절대 불변**: 우측 열 = 고정 폭(썸네일 72) + 그 하단 우측의
 *   고정 풋프린트 슬롯(ADD_SLOT) — [+] ↔ 컴팩트 스테퍼가 같은 자리에서 교체,
 *   담기 탭 시 어떤 요소도 밀리지 않는다(P-103 원칙). 담김 틴트 제거 —
 *   담김 표시 = 스테퍼 존재만.
 * - 카테고리 헤더 미렌더(스캔 API에 카테고리 없음 — 플랫 리스트).
 * - 미매칭 행 = unable 마크+이름+가격만(행 내 안내문 0 — 안내는 탭 시 시트 +
 *   하단 안내문 1회). **미매칭도 [+] 담기 가능**(미등록 실명 주문, P-045).
 *
 * 행 상세(설명·사진·기피 재료)는 useFoodDetail 프리페치 — **매칭 항목만** 조회
 * (react-query 캐시 공유·dedupe로 과호출 방어). 경고 칩 = 개인화 ingredients를
 * 통합 회피 칩으로(1줄 고정·+n 접기 — P-223).
 */
import * as React from 'react';
import { RemoteImage } from '@/components/RemoteImage';
import { Pressable, ScrollView, StyleSheet, View, Linking } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, primaryTint, radius, riskTone, type RiskState } from '@/lib/theme';

/** P-171 ① → P-223: 칩 폭 근사 — 통합 칩 메트릭(패딩 8×2·보더·RiskMark 11) 기반.
 *  CJK ≈ 폰트폭, 라틴/숫자 ≈ 절반. ponytail: 문자폭 근사 휴리스틱 — 오차는 이르게
 *  접히는 쪽(1줄 보장은 nowrap+overflow hidden이 이중 방어), 실측 레이아웃 패스 불요. */
export function estChipW(label: string): number {
  // P-223: 신형 칩 = 패딩 8×2 + 보더 1×2 + RiskMark(11) + gap(4)
  let w = 33;
  for (const ch of label) w += ch.charCodeAt(0) > 0x2e80 ? 12.5 : 7;
  return w;
}

/** P-171 ①: 1줄에 들어가는 칩만(danger 우선 정렬 전제) + 초과분 "+n" 접기.
 *  availW 미측정(0)이면 전부 표시(측정 전 1프레임 — nowrap이 밀림 방지). */
export function fitAvoidChips<T extends { name: string }>(
  warns: T[],
  availW: number,
  gap = 5,
): { shown: T[]; rest: number } {
  if (availW <= 0 || warns.length <= 1) return { shown: warns, rest: 0 };
  for (let n = warns.length; n >= 1; n--) {
    const moreW = n < warns.length ? gap + estChipW(`+${warns.length - n}`) : 0;
    let w = moreW;
    for (let i = 0; i < n; i++) w += (i > 0 ? gap : 0) + estChipW(warns[i].name);
    if (w <= availW) return { shown: warns.slice(0, n), rest: warns.length - n };
  }
  return { shown: warns.slice(0, 1), rest: warns.length - 1 };
}
import { IconMinus, IconPlus, RiskMark } from '@/components';
import { useFoodDetail } from '@/lib/data/useFoods';
import { convertKrw, type ServerFx } from '@/lib/exchange';
import { formatKrw, type ResultDish } from '@/lib/scan/segmentMenu';

type TFn = (k: string, o?: Record<string, unknown>) => string;

/** 우측 열·담기 슬롯 고정 치수 — [+]↔스테퍼 교체 시 프레임 불변(P-138 ①) */
export const RIGHT_COL_W = 72;
export const ADD_SLOT_H = 30;

/** P-160(예진 확정, 목업 B안): 프로필 체크 줄 — surface2 바탕+하단 보더로 리스트와
 *  톤 분리, 캡션 소형 대문자(**✓ 없음** — 전부 통과로 오독 방지), 아래 회피 재료
 *  개별 칩 가로 스트립. 스크롤 시 상단 고정은 배치 몫(scan.tsx — ScrollView 밖 상단).
 *  P-180(회의 결정 6, 8/12): 우측 Edit 소멸 — 스캔 후 주문 플로우에서 회피 수정
 *  진입 차단(앞으로도 미개방). 회피 수정은 프로필 경유만. */
export function ScanProfileBar({ avoidNames, t }: { avoidNames: string[]; t: TFn }) {
  return (
    <View style={styles.bar} testID="profile-bar">
      <View style={styles.barCap}>
        <Text style={styles.barCapText}>{t('scan.checkedAgainst')}</Text>
      </View>
      {avoidNames.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barStrip} testID="profile-strip">
          {avoidNames.map((n) => (
            <View key={n} style={styles.barChip}>
              <Text style={styles.barChipText}>{n}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export function ScanRichList({
  dishes,
  currency,
  fx,
  cart,
  onAdd,
  onRemove,
  onOpen,
  onMarkPress,
  t,
}: {
  dishes: ResultDish[];
  currency: string;
  fx?: ServerFx; // P-242: v2 서버 실환율(undefined = v1 테이블)
  cart: Map<number, number>;
  onAdd: (d: ResultDish) => void;
  onRemove: (d: ResultDish) => void;
  onOpen: (d: ResultDish) => void;
  /** P-149: 행 RiskMark 탭 = 코치마크 재열람(P-134 표면 — 캡슐 철거 후 리스트가 담당) */
  onMarkPress?: () => void;
  /** P-153 v2: 미등록 행 유사 제안 탭 → 해당 음식 상세 */
  t: TFn;
}) {
  return (
    <View style={styles.body}>
      {/* P-138 ④: 카테고리 헤더 없음 — 스캔 API에 카테고리 부재 → 플랫 리스트 */}
      {dishes.map((d) => (
        <RichRow key={d.itemId} dish={d} currency={currency} fx={fx} qty={cart.get(d.itemId) ?? 0} onAdd={() => onAdd(d)} onRemove={() => onRemove(d)} onOpen={() => onOpen(d)} onMarkPress={onMarkPress} t={t} />
      ))}

      <Text style={styles.footNote}>{t('scan.listFootNote')}</Text>
    </View>
  );
}

function RichRow({
  dish,
  currency,
  fx,
  qty,
  onAdd,
  onRemove,
  onOpen,
  onMarkPress,
  t,
}: {
  dish: ResultDish;
  currency: string;
  fx?: ServerFx;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onOpen: () => void;
  onMarkPress?: () => void;
  t: TFn;
}) {
  // 매칭 항목만 상세 프리페치 — 설명·사진·기피 재료(개인화 ingredients)
  const detail = useFoodDetail(dish.matched && dish.foodId ? dish.foodId : '');
  const food = dish.matched ? detail.data : undefined;
  // P-171 → P-223: 회피 칩 줄 **단일화**. 데이터는 서버 겹침(avoidances) 우선.
  //  - dish.avoidances = overlapped만·서버 번역명·성분별 riskLevel
  //    (결측 CAUTION 강등은 어댑터가 이미 처리 — P-219)
  //  - 클라 조인 폴백: KB-418 검수 — v1 전용이 **아니라** v2에서도 도달한다
  //    (avoidances 빈 배열 = 무겹침·게스트·온보딩 미완료, mapAvoidances가 항상
  //    배열 반환). 상세 ingredients의 danger/caution을 보수적으로 표면화하는
  //    안전망(헌법 III — 지우면 경고 표면이 줄어든다)이라 존치.
  // 정렬은 양쪽 동일 — danger 우선(접혀도 위험한 것부터 보인다)
  const warnSource: { code: string; name: string; risk: RiskState }[] = dish.avoidances?.length
    ? dish.avoidances
    : (food?.ingredients ?? [])
        .filter((i) => i.risk === 'danger' || i.risk === 'caution')
        .map((i) => ({ code: i.code, name: i.name, risk: i.risk }));
  const warns = [...warnSource].sort((a, b) => (a.risk === b.risk ? 0 : a.risk === 'danger' ? -1 : 1));
  const [warnW, setWarnW] = React.useState(0);
  const { shown: shownWarns, rest: restWarns } = fitAvoidChips(warns, warnW);
  const converted = dish.priceKrw != null ? convertKrw(dish.priceKrw, currency, fx) : null; // P-242: v2 = 실환율
  const added = qty > 0;

  return (
    <Pressable style={styles.row} onPress={onOpen} testID={`rich-${dish.itemId}`}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={styles.nameLine}>
          {/* P-134→149: 마크 탭 = 코치마크 재열람 */}
          <Pressable hitSlop={8} onPress={onMarkPress} disabled={!onMarkPress} testID={`mark-${dish.itemId}`}>
            <RiskMark state={dish.risk} size={16} />
          </Pressable>
          {/* P-226 ①: 위계 반전(멘토) — 영문(요청 lang 번역명) 타이틀, 한글은 서브 작게 회색.
              번역명 부재(미매칭 등) = 한글이 타이틀 폴백 */}
          <Text style={styles.nameTitle} numberOfLines={1}>
            {dish.displayName || (dish.koreanName ?? dish.rawMenuName)}
          </Text>
        </View>
        {!!dish.displayName && dish.displayName !== (dish.koreanName ?? dish.rawMenuName) && !!(dish.koreanName ?? dish.rawMenuName) && (
          <Text style={styles.nameSubKo} numberOfLines={1}>{dish.koreanName ?? dish.rawMenuName}</Text>
        )}
        {!!food?.description && (
          <Text style={styles.desc} numberOfLines={1}>{food.description}</Text>
        )}
        {/* 기피 경고 — 칩 재사용(flex-wrap, 여러 개여도 안 밀림) */}
        {warns.length > 0 && (
          <View
            style={styles.warnWrap}
            testID={`warn-${dish.itemId}`}
            onLayout={(e) => setWarnW(e.nativeEvent.layout.width)}
          >
            {/* P-160: "May contain" 라벨 제거 — solid 칩 색이 위험도를 말한다.
                P-171: 1줄 고정 — 들어가는 만큼(danger 우선)+"+n" 접기, 탭(행 전체) = 상세
                (What's inside가 전체 재료+사유 담당 — 인라인 펼침 대신 기존 화면 재활용). */}
            {/* P-223: 칩 비주얼 = 색+형태 둘 다(헌법·색맹 접근성) — 1줄 접기에서도
                caution/danger가 구분된다. 구 solid AvoidChip은 사용처 0 확인 후 삭제(P-230). */}
            {shownWarns.map((w) => (
              <View key={w.code} style={[styles.warnChip, { backgroundColor: riskTone[w.risk].bg, borderColor: riskTone[w.risk].line }]}>
                <RiskMark state={w.risk} size={11} />
                <Text style={[styles.warnChipText, { color: riskTone[w.risk].fg }]} numberOfLines={1}>{w.name}</Text>
              </View>
            ))}
            {restWarns > 0 && (
              <View style={styles.moreChip} testID={`warn-more-${dish.itemId}`}>
                <Text style={styles.moreChipText}>+{restWarns}</Text>
              </View>
            )}
          </View>
        )}
        {/* P-226 ⑤: 미등록 행 — 등록 예정 안내 + 외부 검색 딥링크(구글/네이버, 한글 키워드) */}
        {!dish.matched && (
          <View style={styles.missRow} testID={`miss-${dish.itemId}`}>
            <Text style={styles.missText}>{t('scan.missNote')}</Text>
            <View style={styles.missLinks}>
              {([
                ['Google', `https://www.google.com/search?q=${encodeURIComponent(dish.koreanName ?? dish.rawMenuName)}`],
                ['NAVER', `https://search.naver.com/search.naver?query=${encodeURIComponent(dish.koreanName ?? dish.rawMenuName)}`],
              ] as const).map(([label, url]) => (
                <Pressable key={label} style={styles.missLink} hitSlop={6} onPress={() => void Linking.openURL(url)} testID={`miss-${label.toLowerCase()}-${dish.itemId}`}>
                  <Text style={styles.missLinkText}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {/* P-138 ③: 미매칭 행 안내문 삭제 — unable 마크가 상태를 말한다(조용) */}
        {dish.priceKrw != null && (
          <Text style={styles.price}>
            {formatKrw(dish.priceKrw)}
            {converted ? ` ${converted}` : ''}
          </Text>
        )}
      </View>

      {/* 우측 고정 열 — 썸네일(매칭분만) + 담기 슬롯(풋프린트 불변) */}
      <View style={styles.rightCol}>
        {/* P-241: 썸네일 = v2 imageRef 인라인(비매칭 = 서버 디폴트 이미지 — 전 행 표시),
            v1 폴백 = 상세 프리페치 photoUrl(매칭만 — 썸네일 목적 프리페치는 소멸) */}
        {(() => {
          const thumb = dish.imageUrl ?? (dish.matched ? food?.photoUrl ?? null : null);
          return thumb ? <RemoteImage uri={thumb} style={styles.thumb} /> : null;
        })()}
        <View style={styles.addSlot} testID={`slot-${dish.itemId}`}>
          {added ? (
            <View style={styles.stepper} testID={`stepper-${dish.itemId}`}>
              <Pressable hitSlop={10} onPress={onRemove} testID={`dec-${dish.itemId}`}>
                <IconMinus size={12} color={C.ink2} />
              </Pressable>
              <Text style={styles.qty}>{qty}</Text>
              <Pressable hitSlop={10} onPress={onAdd} testID={`inc-${dish.itemId}`}>
                <IconPlus size={12} color={C.ink2} />
              </Pressable>
            </View>
          ) : (
            /* P-226 ⑦(재량 1안): 터치 44pt+(hitSlop 12) + primary 톤(시인성).
               크기 30 유지 — ADD_SLOT 고정 풋프린트 프레임 불변(P-138 ①) */
            <Pressable style={styles.addBtn} hitSlop={12} onPress={onAdd} testID={`add-${dish.itemId}`}>
              <IconPlus size={15} color={C.primary} />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/** 하단 sticky 필 — 리스트·캡슐 뷰 공유(담김 카운트 동기). */
export function OrderPill({ count, onPress, t, bottom }: { count: number; onPress: () => void; t: TFn; bottom: number }) {
  if (count <= 0) return null;
  return (
    <Pressable style={[styles.pill, { bottom }]} onPress={onPress} testID="order-pill">
      <Text style={styles.pillText}>{t('scan.viewOrder', { count })}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // P-226 ⑤: 미등록 안내 + 외부 검색 링크
  missRow: { marginTop: 4, gap: 5 },
  missText: { fontFamily: font.body, fontSize: 12, color: C.ink3, lineHeight: 17 },
  missLinks: { flexDirection: 'row', gap: 8 },
  missLink: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  missLinkText: { fontFamily: font.bodyBold, fontSize: 11.5, color: C.ink2 },
  body: { paddingHorizontal: 16, paddingBottom: 120 },
  // P-160 B안(.bnrB 전사): surface2 바탕 + 하단 보더 + 대문자 캡션 + 칩 스트립
  bar: { backgroundColor: C.surface2, borderBottomWidth: 1, borderBottomColor: C.line, paddingTop: 10, paddingBottom: 11, paddingHorizontal: 16 },
  barCap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barCapText: { flex: 1, fontFamily: font.displayBlack, fontSize: 11.5, color: C.ink3, letterSpacing: 0.5, textTransform: 'uppercase' },
  barStrip: { flexDirection: 'row', gap: 6, marginTop: 7 },
  barChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  barChipText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink },
  editLink: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  nameTitle: { fontFamily: font.bodyBold, fontSize: 15.5, color: C.ink, flexShrink: 1 },
  nameSubKo: { fontFamily: font.ko, fontSize: 12.5, color: C.ink3 },
  desc: { fontFamily: font.body, fontSize: 12, color: C.ink3 },
  // P-171: 1줄 고정 — nowrap+hidden(근사 오차 이중 방어), 행 높이 균일 회복
  warnWrap: { flexDirection: 'row', flexWrap: 'nowrap', overflow: 'hidden', alignItems: 'center', gap: 5, marginTop: 2 },
  moreChip: { backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  moreChipText: { fontFamily: font.displayBlack, fontSize: 12.5, color: C.ink2 },
  // P-223: 통합 칩(색+형태) — 구 avoidRow 섹션 스타일 대체
  warnChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  warnChipText: { fontFamily: font.bodySemi, fontSize: 11.5 },
  price: { fontFamily: font.bodySemi, fontSize: 12.5, color: C.ink2, marginTop: 2, fontVariant: ['tabular-nums'] },
  // 우측 열 = 항상 RIGHT_COL_W — 썸네일 유무와 무관하게 텍스트 열 폭 불변
  rightCol: { width: RIGHT_COL_W, alignItems: 'flex-end', gap: 6 },
  thumb: { width: RIGHT_COL_W, height: RIGHT_COL_W, borderRadius: radius.sm, backgroundColor: C.surface2 },
  // 담기 슬롯 — [+]와 스테퍼가 같은 풋프린트(RIGHT_COL_W × ADD_SLOT_H)를 공유
  addSlot: { width: RIGHT_COL_W, height: ADD_SLOT_H, alignItems: 'flex-end', justifyContent: 'center' },
  addBtn: { width: ADD_SLOT_H, height: ADD_SLOT_H, borderRadius: ADD_SLOT_H / 2, borderWidth: 1.5, borderColor: C.primary, backgroundColor: primaryTint, alignItems: 'center', justifyContent: 'center' },
  stepper: { width: RIGHT_COL_W, height: ADD_SLOT_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: C.line, borderRadius: 999, paddingHorizontal: 8 },
  qty: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink, fontVariant: ['tabular-nums'], textAlign: 'center' },
  footNote: { fontFamily: font.body, fontSize: 11.5, lineHeight: 16, color: C.ink3, paddingVertical: 14 },
  pill: { position: 'absolute', left: 20, right: 20, backgroundColor: C.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  pillText: { fontFamily: font.bodyBold, fontSize: 14.5, color: '#fff' },
});

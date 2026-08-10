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
 * AvoidChip으로(flex-wrap).
 */
import * as React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, radius } from '@/lib/theme';
import { AvoidChip } from '@/components/AvoidChip';
import { IconMinus, IconPlus, RiskMark } from '@/components';
import { useFoodDetail } from '@/lib/data/useFoods';
import { convertKrw } from '@/lib/exchange';
import { formatKrw, type ResultDish } from '@/lib/scan/segmentMenu';

type TFn = (k: string, o?: Record<string, unknown>) => string;

/** 우측 열·담기 슬롯 고정 치수 — [+]↔스테퍼 교체 시 프레임 불변(P-138 ①) */
export const RIGHT_COL_W = 72;
export const ADD_SLOT_H = 30;

export function ScanRichList({
  dishes,
  avoidNames,
  currency,
  cart,
  onAdd,
  onRemove,
  onOpen,
  onMarkPress,
  onEditProfile,
  t,
}: {
  dishes: ResultDish[];
  /** 내 회피 재료 표시명(프로필 체크 줄) */
  avoidNames: string[];
  currency: string;
  cart: Map<number, number>;
  onAdd: (d: ResultDish) => void;
  onRemove: (d: ResultDish) => void;
  onOpen: (d: ResultDish) => void;
  /** P-149: 행 RiskMark 탭 = 코치마크 재열람(P-134 표면 — 캡슐 철거 후 리스트가 담당) */
  onMarkPress?: () => void;
  onEditProfile: () => void;
  t: TFn;
}) {
  return (
    <View style={styles.body}>
      {/* 프로필 체크 줄 */}
      <View style={styles.profileLine}>
        <RiskMark state="safe" size={16} />
        <Text style={styles.profileText} numberOfLines={2}>
          {t('scan.checkedAgainst')}
          {avoidNames.length > 0 && <Text style={styles.profileAvoids}> · {avoidNames.join(', ')}</Text>}
        </Text>
        <Pressable hitSlop={8} onPress={onEditProfile} testID="profile-edit-link">
          <Text style={styles.editLink}>{t('community.edit')}</Text>
        </Pressable>
      </View>

      {/* P-138 ④: 카테고리 헤더 없음 — 스캔 API에 카테고리 부재 → 플랫 리스트 */}
      {dishes.map((d) => (
        <RichRow key={d.itemId} dish={d} currency={currency} qty={cart.get(d.itemId) ?? 0} onAdd={() => onAdd(d)} onRemove={() => onRemove(d)} onOpen={() => onOpen(d)} onMarkPress={onMarkPress} t={t} />
      ))}

      <Text style={styles.footNote}>{t('scan.listFootNote')}</Text>
    </View>
  );
}

function RichRow({
  dish,
  currency,
  qty,
  onAdd,
  onRemove,
  onOpen,
  onMarkPress,
  t,
}: {
  dish: ResultDish;
  currency: string;
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
  const warns = (food?.ingredients ?? []).filter((i) => i.risk === 'danger' || i.risk === 'caution');
  const converted = dish.priceKrw != null ? convertKrw(dish.priceKrw, currency) : null;
  const added = qty > 0;

  return (
    <Pressable style={styles.row} onPress={onOpen} testID={`rich-${dish.itemId}`}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={styles.nameLine}>
          {/* P-134→149: 마크 탭 = 코치마크 재열람 */}
          <Pressable hitSlop={8} onPress={onMarkPress} disabled={!onMarkPress} testID={`mark-${dish.itemId}`}>
            <RiskMark state={dish.risk} size={16} />
          </Pressable>
          <Text style={styles.nameKo} numberOfLines={1}>
            {dish.koreanName ?? dish.rawMenuName}
          </Text>
        </View>
        {!!dish.displayName && dish.displayName !== (dish.koreanName ?? dish.rawMenuName) && (
          <Text style={styles.nameEn} numberOfLines={1}>{dish.displayName}</Text>
        )}
        {!!food?.description && (
          <Text style={styles.desc} numberOfLines={1}>{food.description}</Text>
        )}
        {/* 기피 경고 — 칩 재사용(flex-wrap, 여러 개여도 안 밀림) */}
        {warns.length > 0 && (
          <View style={styles.warnWrap} testID={`warn-${dish.itemId}`}>
            <Text style={styles.warnLead}>{t('scan.mayContain')}</Text>
            {warns.map((w) => (
              <AvoidChip key={w.code} label={w.name} variant={w.risk === 'danger' ? 'danger' : 'caution'} />
            ))}
          </View>
        )}
        {/* P-138 ③: 미매칭 행 안내문 삭제 — unable 마크가 상태를 말한다(조용) */}
        {dish.priceKrw != null && (
          <Text style={styles.price}>
            {formatKrw(dish.priceKrw)}
            {converted ? ` · ${converted}` : ''}
          </Text>
        )}
      </View>

      {/* 우측 고정 열 — 썸네일(매칭분만) + 담기 슬롯(풋프린트 불변) */}
      <View style={styles.rightCol}>
        {dish.matched && !!food?.photoUrl && <Image source={{ uri: food.photoUrl }} style={styles.thumb} />}
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
            <Pressable style={styles.addBtn} hitSlop={8} onPress={onAdd} testID={`add-${dish.itemId}`}>
              <IconPlus size={15} color={C.ink} />
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
  body: { paddingHorizontal: 16, paddingBottom: 120 },
  profileLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  profileText: { flex: 1, fontFamily: font.body, fontSize: 12, color: C.ink2 },
  profileAvoids: { fontFamily: font.bodyBold, color: C.ink },
  editLink: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primaryText },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  nameKo: { fontFamily: font.koBold, fontSize: 15.5, color: C.ink, flexShrink: 1 },
  nameEn: { fontFamily: font.bodySemi, fontSize: 12.5, color: C.ink },
  desc: { fontFamily: font.body, fontSize: 12, color: C.ink3 },
  warnWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 2 },
  warnLead: { fontFamily: font.bodyBold, fontSize: 11.5, color: C.ink2 },
  price: { fontFamily: font.bodySemi, fontSize: 12.5, color: C.ink2, marginTop: 2, fontVariant: ['tabular-nums'] },
  // 우측 열 = 항상 RIGHT_COL_W — 썸네일 유무와 무관하게 텍스트 열 폭 불변
  rightCol: { width: RIGHT_COL_W, alignItems: 'flex-end', gap: 6 },
  thumb: { width: RIGHT_COL_W, height: RIGHT_COL_W, borderRadius: radius.sm, backgroundColor: C.surface2 },
  // 담기 슬롯 — [+]와 스테퍼가 같은 풋프린트(RIGHT_COL_W × ADD_SLOT_H)를 공유
  addSlot: { width: RIGHT_COL_W, height: ADD_SLOT_H, alignItems: 'flex-end', justifyContent: 'center' },
  addBtn: { width: ADD_SLOT_H, height: ADD_SLOT_H, borderRadius: ADD_SLOT_H / 2, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  stepper: { width: RIGHT_COL_W, height: ADD_SLOT_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: C.line, borderRadius: 999, paddingHorizontal: 8 },
  qty: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink, fontVariant: ['tabular-nums'], textAlign: 'center' },
  footNote: { fontFamily: font.body, fontSize: 11.5, lineHeight: 16, color: C.ink3, paddingVertical: 14 },
  pill: { position: 'absolute', left: 20, right: 20, backgroundColor: C.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  pillText: { fontFamily: font.bodyBold, fontSize: 14.5, color: '#fff' },
});

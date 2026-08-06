/**
 * ScanRichList (P-136 시안 S1) — 결과 리치 리스트 (콰이엇 스타일 공식 허용 표면).
 *
 * 헤더 아래: 프로필 체크 줄 → 섹션(스캔 데이터에 카테고리 없음 — 단일 "Menu" 섹션,
 * BE 카테고리 배포 시 확장) → 행(마크16·한글명·번역명·설명·기피 경고 칩·이중 통화
 * 가격 · 우측 사진 72 — DB 매칭분만) → 하단 안내문.
 *
 * 행 상세(설명·사진·기피 재료)는 useFoodDetail 프리페치 — **매칭 항목만** 조회
 * (과호출 방어: react-query 캐시 공유·중복 dedupe, 스캔 1회당 매칭 수 ≤ 목록 길이).
 * 경고 칩 = 상세 API ingredients(개인화 — 포함 기피성분)를 AvoidChip으로(위험도
 * variant), flex-wrap이라 여러 개여도 안 밀림.
 */
import * as React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, radius } from '@/lib/theme';
import { AvoidChip } from '@/components/AvoidChip';
import { IconChevron, IconMinus, IconPlus, RiskMark } from '@/components';
import { useFoodDetail } from '@/lib/data/useFoods';
import { convertKrw } from '@/lib/exchange';
import { formatKrw, type ResultDish } from '@/lib/scan/segmentMenu';

type TFn = (k: string, o?: Record<string, unknown>) => string;

export function ScanRichList({
  dishes,
  avoidNames,
  currency,
  cart,
  onAdd,
  onRemove,
  onOpen,
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

      {/* 단일 섹션 — 스캔 결과엔 메뉴판 카테고리 정보가 없다(보고 명기) */}
      <View style={styles.secHead}>
        <Text style={styles.secTitle}>{t('scan.showList')}</Text>
        <Text style={styles.secCount}>{dishes.length}</Text>
      </View>

      {dishes.map((d) => (
        <RichRow key={d.itemId} dish={d} currency={currency} qty={cart.get(d.itemId) ?? 0} onAdd={() => onAdd(d)} onRemove={() => onRemove(d)} onOpen={() => onOpen(d)} t={t} />
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
  t,
}: {
  dish: ResultDish;
  currency: string;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onOpen: () => void;
  t: TFn;
}) {
  // 매칭 항목만 상세 프리페치 — 설명·사진·기피 재료(개인화 ingredients)
  const detail = useFoodDetail(dish.matched && dish.foodId ? dish.foodId : '');
  const food = dish.matched ? detail.data : undefined;
  const warns = (food?.ingredients ?? []).filter((i) => i.risk === 'danger' || i.risk === 'caution');
  const converted = dish.priceKrw != null ? convertKrw(dish.priceKrw, currency) : null;
  const added = qty > 0;

  return (
    <Pressable style={[styles.row, added && styles.rowAdded]} onPress={onOpen} testID={`rich-${dish.itemId}`}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={styles.nameLine}>
          <RiskMark state={dish.risk} size={16} />
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
        {!dish.matched && <Text style={styles.unableNote}>{t('scan.notInDb')}</Text>}
        {dish.priceKrw != null && (
          <Text style={styles.price}>
            {formatKrw(dish.priceKrw)}
            {converted ? ` · ${converted}` : ''}
          </Text>
        )}
      </View>

      <View style={styles.rightCol}>
        {/* 썸네일 — DB 매칭분만(미매칭은 텍스트 풀폭) */}
        {dish.matched && !!food?.photoUrl && <Image source={{ uri: food.photoUrl }} style={styles.thumb} />}
        {dish.matched ? (
          added ? (
            <View style={styles.stepper} testID={`stepper-${dish.itemId}`}>
              <Pressable hitSlop={8} onPress={onRemove} testID={`dec-${dish.itemId}`}>
                <IconMinus size={14} color={C.ink2} />
              </Pressable>
              <Text style={styles.qty}>{qty}</Text>
              <Pressable hitSlop={8} onPress={onAdd} testID={`inc-${dish.itemId}`}>
                <IconPlus size={14} color={C.ink2} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.addBtn} hitSlop={6} onPress={onAdd} testID={`add-${dish.itemId}`}>
              <IconPlus size={16} color={C.ink} />
            </Pressable>
          )
        ) : (
          <IconChevron size={14} color={C.ink3} style={{ opacity: 0 }} />
        )}
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
  body: { paddingHorizontal: 16, paddingBottom: 120, gap: 0 },
  profileLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  profileText: { flex: 1, fontFamily: font.body, fontSize: 12, color: C.ink2 },
  profileAvoids: { fontFamily: font.bodyBold, color: C.ink },
  editLink: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primaryText },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 14, paddingBottom: 6 },
  secTitle: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: C.ink3 },
  secCount: { fontFamily: font.bodyBold, fontSize: 11, color: C.ink3 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  rowAdded: { backgroundColor: 'rgba(47,143,91,0.05)' }, // 담김 = 초록 틴트(시안)
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  nameKo: { fontFamily: font.koBold, fontSize: 15.5, color: C.ink, flexShrink: 1 },
  nameEn: { fontFamily: font.body, fontSize: 12.5, color: C.ink2 },
  desc: { fontFamily: font.body, fontSize: 12, color: C.ink3 },
  warnWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 3 },
  warnLead: { fontFamily: font.bodyBold, fontSize: 11.5, color: C.ink2 },
  unableNote: { fontFamily: font.body, fontSize: 12, color: C.ink2, marginTop: 2 },
  price: { fontFamily: font.bodySemi, fontSize: 12.5, color: C.ink2, marginTop: 3, fontVariant: ['tabular-nums'] },
  rightCol: { alignItems: 'center', gap: 7 },
  thumb: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: C.surface2 },
  addBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1.5, borderColor: C.line, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  qty: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink, fontVariant: ['tabular-nums'], minWidth: 14, textAlign: 'center' },
  footNote: { fontFamily: font.body, fontSize: 11.5, lineHeight: 16, color: C.ink3, paddingVertical: 14 },
  pill: { position: 'absolute', left: 20, right: 20, backgroundColor: C.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  pillText: { fontFamily: font.bodyBold, fontSize: 14.5, color: '#fff' },
});

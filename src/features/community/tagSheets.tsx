/**
 * community/tagSheets.tsx — 글의 태그 칩 탭 → 바텀시트 미리보기 (P-087 D-04).
 *
 * 음식 시트: 사진·이름·설명·**내 위험도 라인 = 기존 RiskMark 재사용**(시안 자체
 * 도형 불채택 — 앱 일관성) · "View details" → 음식 상세.
 * 장소 시트: 이름·도로명 + **3사 지도 버튼 — 전부 중립 글리프**(네이버 N 유사
 * 마크 금지, §지도 딥링크 로고 조사) · 딥링크 실패(미설치) 시 웹 폴백.
 */
import * as React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { Btn, CardPhoto, IconMapPin, RiskMark } from '@/components';
import { useBottomInset } from '@/lib/useBottomInset';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import type { PlaceTagRef } from '@/lib/community/types';

function SheetShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const bottom = useBottomInset();
  const pad = Platform.OS === 'android' ? { paddingBottom: 18 + bottom } : null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, pad]} onPress={() => {}}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function FoodTagSheet({ target, onClose }: { target: { foodId: string; name: string } | null; onClose: () => void }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: food } = useFoodDetail(target?.foodId ?? '');
  const { data: me } = useMe();
  if (!target) return null;
  const hasR = (me?.restrictions.length ?? 0) > 0;
  const risk = food ? personalRisk(food.risk, hasR) : 'unable';
  return (
    <SheetShell onClose={onClose}>
      <View style={styles.foodTop}>
        <View style={styles.foodThumb}>{!!food?.photoUrl && <CardPhoto uri={food.photoUrl} borderRadius={14} />}</View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={styles.title} numberOfLines={1}>
            {food?.name ?? target.name}
          </Text>
          {!!food?.nameKo && food.nameKo !== food.name && <Text style={styles.sub}>{food.nameKo}</Text>}
        </View>
      </View>
      {!!food?.description && (
        <Text style={styles.desc} numberOfLines={3}>
          {food.description}
        </Text>
      )}
      {/* 내 위험도 라인 — 기존 RiskMark 재사용 (unable 대시 원 등 시안 자체 도형 금지) */}
      <View style={styles.riskLine}>
        <RiskMark state={risk} size={20} />
        <Text style={styles.riskText}>{t(`risk.${risk}`)}</Text>
      </View>
      <Btn onPress={() => { onClose(); router.push(`/food/${target.foodId}?src=tag_sheet` as Href); }}>{t('community.viewDetails')}</Btn>
    </SheetShell>
  );
}

/* ---- 장소 시트: placeMap.tsx로 분리(P-201 — 경량 의존) · 기존 소비처 호환 재수출 ---- */
export { PlaceTagSheet, openMap, _mapUrlsForTest, type MapApp, type MapPlace } from './placeMap';
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 34, gap: 14, ...shadow.sh2 },
  title: { fontFamily: font.display, fontSize: 17, color: C.ink },
  sub: { fontFamily: font.body, fontSize: 12.5, color: C.ink2 },
  desc: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19 },

  foodTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foodThumb: { width: 56, height: 56, borderRadius: 14, backgroundColor: C.surface2, overflow: 'hidden' },
  riskLine: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, paddingHorizontal: 13, paddingVertical: 11 },
  riskText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink },

});

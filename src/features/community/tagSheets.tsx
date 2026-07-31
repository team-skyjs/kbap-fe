/**
 * community/tagSheets.tsx — 글의 태그 칩 탭 → 바텀시트 미리보기 (P-087 D-04).
 *
 * 음식 시트: 사진·이름·설명·**내 위험도 라인 = 기존 RiskMark 재사용**(시안 자체
 * 도형 불채택 — 앱 일관성) · "View details" → 음식 상세.
 * 장소 시트: 이름·도로명 + **3사 지도 버튼 — 전부 중립 글리프**(네이버 N 유사
 * 마크 금지, §지도 딥링크 로고 조사) · 딥링크 실패(미설치) 시 웹 폴백.
 */
import * as React from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
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
      <Btn onPress={() => { onClose(); router.push(`/food/${target.foodId}` as Href); }}>{t('community.viewDetails')}</Btn>
    </SheetShell>
  );
}

/* ---- 장소 시트 — 3사 지도 딥링크 (미설치 시 웹) ---- */

export type MapApp = 'naver' | 'kakao' | 'google';

function mapUrls(place: PlaceTagRef): Record<MapApp, { app: string; web: string }> {
  const q = encodeURIComponent(place.name);
  return {
    naver: { app: `nmap://search?query=${q}`, web: `https://map.naver.com/p/search/${q}` },
    kakao: { app: `kakaomap://search?q=${q}`, web: `https://map.kakao.com/link/search/${q}` },
    google: { app: `https://www.google.com/maps/search/?api=1&query=${q}`, web: `https://www.google.com/maps/search/?api=1&query=${q}` },
  };
}

export async function openMap(kind: MapApp, place: PlaceTagRef): Promise<void> {
  const { app, web } = mapUrls(place)[kind];
  try {
    await Linking.openURL(app);
  } catch {
    await Linking.openURL(web).catch(() => {});
  }
}

export function PlaceTagSheet({ place, onClose }: { place: PlaceTagRef | null; onClose: () => void }) {
  const { t } = useTranslation();
  if (!place) return null;
  return (
    <SheetShell onClose={onClose}>
      <View style={styles.placeTop}>
        <View style={styles.placeIc}>
          <IconMapPin size={20} color={C.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={styles.title} numberOfLines={1}>
            {place.name}
          </Text>
          <Text style={styles.sub} numberOfLines={2}>
            {place.roadAddress}
          </Text>
        </View>
      </View>
      {/* 3사 지도 — 중립 글리프 + 텍스트 통일 (공식/유사 로고 금지) */}
      <View style={styles.mapRow}>
        {(['naver', 'kakao', 'google'] as MapApp[]).map((kind) => (
          <Pressable key={kind} style={styles.mapBtn} onPress={() => void openMap(kind, place)}>
            <IconMapPin size={16} color={C.ink2} />
            <Text style={styles.mapBtnText}>{t(`community.map.${kind}`)}</Text>
          </Pressable>
        ))}
      </View>
    </SheetShell>
  );
}

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

  placeTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeIc: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(14,154,167,0.1)', alignItems: 'center', justifyContent: 'center' },
  mapRow: { flexDirection: 'row', gap: 8 },
  mapBtn: { flex: 1, alignItems: 'center', gap: 5, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 12 },
  mapBtnText: { fontFamily: font.bodyBold, fontSize: 12, color: C.ink },
});

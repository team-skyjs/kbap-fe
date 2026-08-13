/**
 * placeMap.tsx — 장소 → 3사 지도 딥링크 시트 (tagSheets에서 분리, P-201).
 * 분리 이유: 리뷰 셀 공용 파츠가 소비하는데 tagSheets는 FoodTagSheet 경유로
 * useMe/useFoodDetail 등 무거운 그래프를 끌고 온다 — 지도 시트는 경량 의존만.
 * P-201: 좌표 보유 장소 = 좌표 딥링크(이름은 라벨) · 좌표 없음(MANUAL) = 이름 검색 폴백.
 */
import * as React from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font, shadow } from '@/lib/theme';
import { IconMapPin } from '@/components/icons';
import { useBottomInset } from '@/lib/useBottomInset';
import type { PlaceTagRef } from '@/lib/community/types';

export type MapApp = 'naver' | 'kakao' | 'google';

/** 좌표 옵션 확장 — MANUAL(직접 입력) 장소는 좌표 없음. */
export type MapPlace = PlaceTagRef & { latitude?: number | null; longitude?: number | null };

function mapUrls(place: MapPlace): Record<MapApp, { app: string; web: string }> {
  const q = encodeURIComponent(place.name);
  const { latitude: lat, longitude: lng } = place;
  if (lat != null && lng != null) {
    return {
      naver: { app: `nmap://place?lat=${lat}&lng=${lng}&name=${q}`, web: `https://map.naver.com/p/search/${q}` },
      kakao: { app: `kakaomap://look?p=${lat},${lng}`, web: `https://map.kakao.com/link/map/${q},${lat},${lng}` },
      google: { app: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, web: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` },
    };
  }
  return {
    naver: { app: `nmap://search?query=${q}`, web: `https://map.naver.com/p/search/${q}` },
    kakao: { app: `kakaomap://search?q=${q}`, web: `https://map.kakao.com/link/search/${q}` },
    google: { app: `https://www.google.com/maps/search/?api=1&query=${q}`, web: `https://www.google.com/maps/search/?api=1&query=${q}` },
  };
}

/** 유닛용 노출 — 좌표/이름 분기 잠금 (P-201). */
export const _mapUrlsForTest = mapUrls;

export async function openMap(kind: MapApp, place: MapPlace): Promise<void> {
  const { app, web } = mapUrls(place)[kind];
  try {
    await Linking.openURL(app);
  } catch {
    await Linking.openURL(web).catch(() => {});
  }
}

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

export function PlaceTagSheet({ place, onClose }: { place: MapPlace | null; onClose: () => void }) {
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
          {!!place.roadAddress && (
            <Text style={styles.sub} numberOfLines={2}>
              {place.roadAddress}
            </Text>
          )}
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
  placeTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeIc: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(14,154,167,0.1)', alignItems: 'center', justifyContent: 'center' },
  mapRow: { flexDirection: 'row', gap: 8 },
  mapBtn: { flex: 1, alignItems: 'center', gap: 5, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 12 },
  mapBtnText: { fontFamily: font.bodyBold, fontSize: 12, color: C.ink },
});

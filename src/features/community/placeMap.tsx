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
import { color as C, shadow } from '@/lib/theme';
import { IconClose } from '@/components/icons';
import { BrandGoogle, BrandKakao, BrandNaver } from '@/components/design4Assets';
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

/** KB-431 §2-6(4150:16861): 브랜드 색 버튼 3종(세로 스택) — 로고 에셋 없음 = 텍스트만.
 *  딥링크·좌표 폴백 로직은 무변(mapUrls). */
const MAP_BTN: Record<MapApp, { bg: string; border?: string; text: string; Icon: typeof BrandGoogle }> = {
  google: { bg: '#FFFFFF', border: '#DCDEE3', text: '#1C1E21', Icon: BrandGoogle },
  naver: { bg: '#1EC800', text: '#FFFFFF', Icon: BrandNaver },
  kakao: { bg: '#FFE812', text: '#1C1E21', Icon: BrandKakao },
};

export function PlaceTagSheet({ place, onClose }: { place: MapPlace | null; onClose: () => void }) {
  const { t } = useTranslation();
  if (!place) return null;
  return (
    <SheetShell onClose={onClose}>
      <Pressable style={styles.close} onPress={onClose} hitSlop={8} testID="place-sheet-close">
        <IconClose size={24} color={C.ink2} />
      </Pressable>
      <View style={{ gap: 6, paddingRight: 32 }}>
        <Text style={styles.title} numberOfLines={1}>
          {place.name}
        </Text>
        {!!place.roadAddress && (
          <Text style={styles.sub} numberOfLines={2}>
            {place.roadAddress}
          </Text>
        )}
      </View>
      <View style={styles.mapCol}>
        {(['google', 'naver', 'kakao'] as MapApp[]).map((kind) => (
          <Pressable
            key={kind}
            style={[styles.mapBtn, { backgroundColor: MAP_BTN[kind].bg }, MAP_BTN[kind].border ? { borderWidth: 1, borderColor: MAP_BTN[kind].border } : null]}
            onPress={() => void openMap(kind, place)}
            testID={`map-${kind}`}
          >
            {(() => { const I = MAP_BTN[kind].Icon; return <I height={20} />; })()}
            <Text style={[styles.mapBtnText, { color: MAP_BTN[kind].text }]}>{t(`community.map.${kind}`)}</Text>
          </Pressable>
        ))}
      </View>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  // KB-431: 시트 흰 radius 16 상단, pad 20/39, gap 24
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 39, paddingBottom: 39, gap: 24, ...shadow.sh2 },
  close: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: C.ink },
  sub: { fontSize: 14, fontWeight: '400', color: C.ink2 },
  mapCol: { gap: 8 },
  mapBtn: { minHeight: 48, borderRadius: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapBtnText: { fontSize: 16, fontWeight: '500' },
});

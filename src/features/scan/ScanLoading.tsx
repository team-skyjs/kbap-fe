/**
 * 스캔 로딩 C "상태 먼저"(KB-845, D-31 scan refresh 12353:40597 screen-2) — 메뉴·가공식품 앞면·성분표 분석 공통.
 * 흰 바탕 · 닫기 X · 제목 + 본문(기존 키 — 시간 문구는 앱 카피 그대로) · 찍은 사진 = 최대 335×430 안에서 **원본 비율 박스(contain)** r12
 * · 박스 안 글로우 스캔선(KB-853: PR318 이전 메뉴 스캔의 빛 번짐 스윕 복원 — 1.8s, 박스 맨 위~맨 아래 왕복, 박스 밖으로 안 나감) · 캡션. 스피너·퍼센트·가짜 단계 0. 모션 줄이기 = 선 정지(표시는 유지, screen-7).
 * 큰 글씨(screen-6) = 제목 title1-bold · 본문 subtitle1-sbold. 짧은 화면·큰 글씨 = 사진이 줄어든다(겹침·잘림 0).
 */
import * as React from 'react';
import { Image, StyleSheet, View, useWindowDimensions, type ImageLoadEventData, type NativeSyntheticEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Pressable } from '@/components/Pressable';
import { IconClose } from '@/components/icons';
import { color as C, font } from '@/lib/theme';
import { useBottomInset } from '@/lib/useBottomInset';

export const LOADING_PHOTO_H = 430;
export const SCAN_LINE_H = 3;
/** KB-853: 글로우 띠 높이(선 위로 퍼지는 빛 트레일 포함) — PR318 이전 ScanSweepOverlay 값 그대로 */
export const SCAN_GLOW_H = 90;
/** 이전 스윕 색 그대로(KB-853 예진 결정 — D-31 단색 C.primary 선 폐기) */
const SWEEP = '#E2580C';
const SWEEP_TRAIL = ['rgba(226,88,12,0)', 'rgba(226,88,12,0.35)'] as const;
export const SCAN_LINE_MS = 1800;
/** 큰 글씨 변형(screen-6)으로 바꾸는 글꼴 배율 */
export const LARGE_TEXT_SCALE = 1.3;

/** 스캔선 이동 범위(사진 박스 높이 기준) — KB-853: 박스 맨 위(0) ~ 맨 아래(높이 − 선 두께). 박스 밖으로 나가지 않는다 */
export function scanLineRange(photoH: number): { from: number; to: number } {
  return { from: 0, to: Math.max(0, photoH - SCAN_LINE_H) };
}

/** KB-853: 사진 박스 = 원본 비율을 지키며 영역(폭·높이) 안에 맞춘 크기(contain) — 가로 사진은 낮고 넓게, 세로 사진은 높게. 크기 미상 = 영역 그대로 */
export function fitPhotoBox(areaW: number, areaH: number, imgW: number, imgH: number): { width: number; height: number } {
  if (!(areaW > 0 && areaH > 0 && imgW > 0 && imgH > 0)) return { width: areaW, height: areaH };
  const k = Math.min(areaW / imgW, areaH / imgH);
  return { width: Math.round(imgW * k), height: Math.round(imgH * k) };
}

export function ScanLoading({ title, body, photoUri, caption, onClose, testID }: { title: string; body?: string; photoUri: string | null; caption: string; onClose: () => void; testID?: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset(); // Codex #318: 3버튼 Android에서 safe-area 하단 0 보고 — 48 바닥 보정(캡션이 내비바 밑으로 0)
  const large = useWindowDimensions().fontScale >= LARGE_TEXT_SCALE;
  const reduced = useReducedMotion();
  const [area, setArea] = React.useState({ w: 0, h: 0 });
  const [img, setImg] = React.useState({ w: 0, h: 0 });
  const box = fitPhotoBox(area.w, area.h, img.w, img.h);
  const photoH = box.height;
  const p = useSharedValue(0);
  React.useEffect(() => {
    if (!photoH || reduced) return;
    p.set(0);
    p.set(withRepeat(withTiming(1, { duration: SCAN_LINE_MS, easing: Easing.inOut(Easing.quad) }), -1, true)); // 왕복(스마트 애니메이트 동등)
  }, [photoH, reduced, p]);
  const { from, to } = scanLineRange(photoH);
  // 글로우 띠는 선을 바닥에 두고 위로 퍼진다 — 띠 위치 = 선 위치 − (띠 높이 − 선 두께). 박스 overflow hidden이 위로 넘친 빛을 자른다
  const glowStyle = useAnimatedStyle(() => ({ transform: [{ translateY: from + p.get() * (to - from) - (SCAN_GLOW_H - SCAN_LINE_H) }] }));
  const onImgLoad = (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    const { width, height } = e.nativeEvent.source;
    setImg((v) => (v.w === width && v.h === height ? v : { w: width, h: height }));
  };
  return (
    <View style={[st.root, { paddingTop: insets.top + 16, paddingBottom: bottom + 32 }]} testID={testID ?? 'scan-loading'}>
      <Pressable style={st.close} onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')} testID="scan-loading-close">
        <IconClose size={24} color={C.ink} />
      </Pressable>
      <View style={st.status} accessibilityLiveRegion="polite">
        <Text style={large ? st.titleL : st.title} accessibilityRole="header">{title}</Text>
        {!!body && <Text style={large ? st.bodyL : st.body} testID="scan-stay-hint">{body}</Text>}
      </View>
      <View style={st.gap} />
      {/* 영역(최대 335×430, 짧은 화면·큰 글씨면 줄어듦) 안에 원본 비율 박스 — 박스에 r12, 선은 박스 안에서만 */}
      <View
        style={st.photoArea}
        onLayout={(e) => { const { width, height } = e.nativeEvent.layout; setArea((v) => (v.w === Math.round(width) && v.h === Math.round(height) ? v : { w: Math.round(width), h: Math.round(height) })); }}
        testID="scan-loading-area"
      >
        <View style={[st.photo, { width: box.width, height: box.height }]} testID="scan-loading-photo">
          {photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="contain" onLoad={onImgLoad} testID="scanning-preview" /> : null}
          {photoH > 0 && (
            <Animated.View
              style={[st.glow, reduced ? { transform: [{ translateY: from - (SCAN_GLOW_H - SCAN_LINE_H) }] } : glowStyle]}
              pointerEvents="none"
              testID="scan-loading-glow"
            >
              <LinearGradient colors={SWEEP_TRAIL} style={st.trail} testID="scan-loading-trail" />
              <View style={st.line} testID="scan-loading-line" />
            </Animated.View>
          )}
        </View>
      </View>
      <Text style={st.caption}>{caption}</Text>
    </View>
  );
}

// 시안 실측(375×812): X (20,60) 24 · 상태 (20,116) w335 gap 12 · 사진 영역 (20,280) 최대 335×430(박스 = 원본 비율, r12) · 캡션 (20,730) · 하단 = 홈 인디케이터 위 32
// DS Text System(D-29 FE-HANDOFF·D-28 inspection): title2-bold 20/135% · body-l1-regular 16/162% gray-800 · caption1-regular 13/150% gray-700
// · 큰 글씨 = title1-bold 24/135% · subtitle1-sbold 16/135%
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface, paddingHorizontal: 20 },
  close: { width: 24, height: 24 },
  status: { marginTop: 32, gap: 12 },
  title: { fontFamily: font.bodyBold, fontSize: 20, lineHeight: 27, color: C.ink },
  titleL: { fontFamily: font.bodyBold, fontSize: 24, lineHeight: 32, color: C.ink },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 26, color: C.gray800 },
  bodyL: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22, color: C.gray800 },
  gap: { flexGrow: 1, minHeight: 24, maxHeight: 76 },
  photoArea: { height: LOADING_PHOTO_H, flexShrink: 1, minHeight: 160, alignItems: 'center' }, // 박스는 위·가운데 정렬(가로 사진 = 아래 여백)
  photo: { borderRadius: 12, overflow: 'hidden', backgroundColor: C.surface2 },
  // KB-853: PR318 이전 ScanSweepOverlay 스윕 그대로 — 좌우 14 안쪽 · 위로 퍼지는 트레일(투명 → 35%) + 바닥 선 3(빛 번짐 그림자)
  glow: { position: 'absolute', left: 14, right: 14, top: 0, height: SCAN_GLOW_H },
  trail: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 2 },
  line: { position: 'absolute', left: 0, right: 0, bottom: 0, height: SCAN_LINE_H, borderRadius: 2, backgroundColor: SWEEP, shadowColor: SWEEP, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  caption: { marginTop: 20, fontFamily: font.body, fontSize: 13, lineHeight: 19.5, color: C.ink2 },
});

/**
 * 스캔 로딩 C "상태 먼저"(KB-845, D-31 scan refresh 12353:40597 screen-2) — 메뉴·가공식품 앞면·성분표 분석 공통.
 * 흰 바탕 · 닫기 X · 제목 + 본문(기존 키 — 시간 문구는 앱 카피 그대로) · 찍은 사진 335×430 r12(cover) · 사진 안 주황 스캔선 1개
 * (1.8s 왕복, 사진 밖으로 안 나감) · 캡션. 스피너·퍼센트·가짜 단계 0. 모션 줄이기 = 선 정지(표시는 유지, screen-7).
 * 큰 글씨(screen-6) = 제목 title1-bold · 본문 subtitle1-sbold. 짧은 화면·큰 글씨 = 사진이 줄어든다(겹침·잘림 0).
 */
import * as React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Pressable } from '@/components/Pressable';
import { IconClose } from '@/components/icons';
import { color as C, font } from '@/lib/theme';
import { useBottomInset } from '@/lib/useBottomInset';

export const LOADING_PHOTO_H = 430;
/** 스캔선 출발 = 사진 위에서 200(시안 y480 − 사진 y280), 끝 = 사진 바닥 − 선 두께 3 */
export const SCAN_LINE_START = 200 / LOADING_PHOTO_H;
export const SCAN_LINE_H = 3;
export const SCAN_LINE_MS = 1800;
/** 큰 글씨 변형(screen-6)으로 바꾸는 글꼴 배율 */
export const LARGE_TEXT_SCALE = 1.3;

/** 스캔선 이동 범위(사진 높이 기준) — 사진 밖으로 나가지 않는다 */
export function scanLineRange(photoH: number): { from: number; to: number } {
  const to = Math.max(0, photoH - SCAN_LINE_H);
  return { from: Math.min(to, Math.round(photoH * SCAN_LINE_START)), to };
}

export function ScanLoading({ title, body, photoUri, caption, onClose, testID }: { title: string; body?: string; photoUri: string | null; caption: string; onClose: () => void; testID?: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset(); // Codex #318: 3버튼 Android에서 safe-area 하단 0 보고 — 48 바닥 보정(캡션이 내비바 밑으로 0)
  const large = useWindowDimensions().fontScale >= LARGE_TEXT_SCALE;
  const reduced = useReducedMotion();
  const [photoH, setPhotoH] = React.useState(0);
  const p = useSharedValue(0);
  React.useEffect(() => {
    if (!photoH || reduced) return;
    p.set(0);
    p.set(withRepeat(withTiming(1, { duration: SCAN_LINE_MS, easing: Easing.inOut(Easing.quad) }), -1, true)); // 왕복(스마트 애니메이트 동등)
  }, [photoH, reduced, p]);
  const { from, to } = scanLineRange(photoH);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: from + p.get() * (to - from) }] }));
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
      <View style={st.photo} onLayout={(e) => setPhotoH(Math.round(e.nativeEvent.layout.height))} testID="scan-loading-photo">
        {photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" testID="scanning-preview" /> : null}
        {photoH > 0 && (
          <Animated.View style={[st.line, reduced ? { transform: [{ translateY: from }] } : lineStyle]} pointerEvents="none" testID="scan-loading-line" />
        )}
      </View>
      <Text style={st.caption}>{caption}</Text>
    </View>
  );
}

// 시안 실측(375×812): X (20,60) 24 · 상태 (20,116) w335 gap 12 · 사진 (20,280) 335×430 r12 · 캡션 (20,730) · 하단 = 홈 인디케이터 위 32
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
  photo: { height: LOADING_PHOTO_H, flexShrink: 1, minHeight: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: C.surface2 },
  line: { position: 'absolute', top: 0, left: 0, right: 0, height: SCAN_LINE_H, backgroundColor: C.primary },
  caption: { marginTop: 20, fontFamily: font.body, fontSize: 13, lineHeight: 19.5, color: C.ink2 },
});

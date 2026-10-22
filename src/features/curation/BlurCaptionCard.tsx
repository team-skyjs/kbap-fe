/**
 * 흐림 띠 사진 카드(KB-846 → KB-861 공용) — 사진이 카드 전체 + 아래쪽 점진 흐림 띠(8단, blurBandOf) + 스크림 위에 흰 제목·부제 + 박스 없는 흰 chevron.
 * 모음 상세 장소 카드(curations/[key])와 홈 큐레이션 배너(CurationSection)가 같은 부품을 쓴다(KB-861 — 새로 만들지 않고 공유).
 * 흐림 띠: 띠 사진 로딩 자리 투명(회색 스켈레톤 0, #330) · 띠 8장 다 그려진 뒤 150ms 페이드(모션 줄이기 = 즉시) · 호출측이 `blur`로 근접 마운트(#320).
 */
import * as React from 'react';
import { PixelRatio, Platform, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { RemoteImage } from '@/components/RemoteImage';
import { IconChevron } from '@/components/icons';
import { color as C, font } from '@/lib/theme';

// KB-832 v5: 사진이 카드 전체(335 × 기본 300) — 캡션은 사진 안 하단. 큰 글씨면 캡션만큼 카드가 자란다(시안 330)
export const CARD_SPACER = 236; // 300 = 236 + 이름 26 + 4 + 지역 18 + 하단 16

/** 흐림 띠 사진 카드 — testPrefix·key로 testID(`${testPrefix}-${key}`, `-caption-`, `-blur-`, `-arrow-`)를 만든다 */
export function BlurCaptionCard({
  photoUri,
  recyclingKey,
  title,
  subtitle,
  blur,
  radius,
  onPress,
  onLayout,
  accessibilityLabel,
  accessibilityHint,
  testPrefix,
  testKey,
  uiTarget,
  overlay,
  subtitleFirst = false,
}: {
  photoUri: string | null;
  recyclingKey: string;
  title: string;
  subtitle: string;
  /** 근접 마운트 — false면 흐림 띠 없이 원본 + 스크림만(#320) */
  blur: boolean;
  radius: number;
  onPress: () => void;
  onLayout?: (y: number, h: number) => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  testPrefix: string;
  testKey: string | number;
  uiTarget?: string;
  /** 사진 위 추가 표시(예: 홈 배너 출처) — 터치·스크린리더 무관 장식 */
  overlay?: React.ReactNode;
  /** 부제를 제목 위에(홈 배너 — 예진 결정 KB-861: 설명 위·제목 아래). 기본 = 제목 위(상세 장소 카드). 글자 스타일은 역할 그대로(제목 = 이름 · 부제 = 지역) */
  subtitleFirst?: boolean;
}) {
  const large = captionLargeText(useWindowDimensions().fontScale); // KB-846 QA: 큰 글씨 = 고정 줄 높이 없이(아래 잘림 0)
  const [cardH, setCardH] = React.useState<number | null>(null); // 블러 사본을 원본과 같은 높이로 정렬(큰 글씨면 카드가 자란다)
  const [captionTop, setCaptionTop] = React.useState<number | null>(null); // 캡션 블록 위(= 제목 위) — 블러 밴드 시작 = 여기서 16 위
  const band = cardH != null && captionTop != null ? blurBandOf(cardH, captionTop) : null;
  const k = `${testPrefix}-${testKey}`;
  return (
    <Pressable
      style={[styles.card, { borderRadius: radius }]}
      onLayout={(e: LayoutChangeEvent) => { const { y, height } = e.nativeEvent.layout; setCardH(height); onLayout?.(y, height); }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={k}
      uiTarget={uiTarget}
    >
      {photoUri ? (
        <RemoteImage uri={photoUri} style={StyleSheet.absoluteFill} recyclingKey={recyclingKey} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noPhoto]} testID={`${testPrefix}-nophoto-${testKey}`} />
      )}
      {photoUri && band && blur && <BlurBand cover={photoUri} band={band} cardH={cardH as number} itemId={recyclingKey} testID={`${testPrefix}-blur-${testKey}`} />}
      {band && <LinearGradient colors={CARD_SCRIM} style={[styles.shade, { top: band.top }]} pointerEvents="none" />}
      {overlay}
      <View style={{ height: CARD_SPACER }} />
      <View style={styles.caption} onLayout={(e) => setCaptionTop(e.nativeEvent.layout.y)} testID={`${testPrefix}-caption-${testKey}`} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          {subtitleFirst && <Text style={large ? styles.areaLarge : styles.area}>{subtitle}</Text>}
          <Text style={large ? styles.nameLarge : styles.name}>{title}</Text>
          {!subtitleFirst && <Text style={large ? styles.areaLarge : styles.area}>{subtitle}</Text>}
        </View>
        <View style={styles.arrow} testID={`${testPrefix}-arrow-${testKey}`}>
          <IconChevron size={24} color="#FFFFFF" />
        </View>
      </View>
    </Pressable>
  );
}

/** 블러 띠 묶음 — 띠 사진이 전부 그려진 뒤(onLoad·실패도 끝으로 셈) 페이드 시작. 띠 사진 로딩 자리 = 투명(아래 원본이 보인다 — 회색 스켈레톤 0) */
function BlurBand({ cover, band, cardH, itemId, testID }: { cover: string; band: ReturnType<typeof blurBandOf>; cardH: number; itemId: string; testID: string }) {
  const [done, setDone] = React.useState(0);
  const settle = () => setDone((n) => n + 1);
  return (
    <FadeInBand style={[styles.blurBand, { top: band.top }]} ready={done >= band.strips.length} testID={testID}>
      {band.strips.map((s, i) => (
        <View key={i} style={[styles.blurStrip, { top: s.top - band.top, height: s.height, opacity: s.opacity }]} testID={`${testID.replace('-blur-', '-blur-strip-')}-${i}`}>
          <RemoteImage uri={cover} style={[styles.blurImg, { top: -s.top, height: cardH }]} recyclingKey={`${itemId}-blur-${i}`} blurRadius={s.radius} placeholder="none" onLoad={settle} onError={settle} />
        </View>
      ))}
    </FadeInBand>
  );
}

/** 블러 밴드 페이드인 — 마운트 순간 0 → 1(150ms), 모션 줄이기 = 바로 1. 범위에 들어와 블러가 붙을 때 뚝 바뀌지 않게 */
export const BLUR_FADE_MS = 150;
function FadeInBand({ style, testID, ready, children }: { style: object; testID: string; ready: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(0);
  // KB-846 Android QA: 띠 사진이 다 그려지기(onLoad) 전엔 0 — 그 전엔 원본 + 스크림만 보인다(로딩 중 회색 띠 노출 0). 준비되면 150ms 페이드(모션 줄이기 = 즉시)
  React.useEffect(() => {
    if (!ready) return;
    o.set(reduced ? 1 : withTiming(1, { duration: BLUR_FADE_MS }));
  }, [ready, reduced, o]);
  const fade = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View style={[style, fade]} pointerEvents="none" testID={testID}>
      {children}
    </Animated.View>
  );
}

// KB-846 스크림 — 밴드 위(투명) → 카드 바닥(어둡게 0.45). 띠 경계를 숨기고 흰 글자 대비를 맡는다(구 55% 그라데이션 대체 — 밴드 위 사진은 투명 그대로)
const CARD_SCRIM = ['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)'] as const;
/** 블러 밴드 시작 = 이름(캡션 블록) 위 16 */
export const CARD_BLUR_LEAD = 16;
/** KB-846 QA(큰 글씨에서 이름·지역의 g·y 아래 잘림): 글꼴 배율 > 1이면 고정 lineHeight(26·18)를 빼고 글꼴 고유 줄 높이로 —
 *  RN이 lineHeight도 배율만큼 키우므로 앱에서 곱하면 두 번 커진다(Codex #320). 기본 배율 = 시안 26·18 그대로 */
export const captionLargeText = (fontScale: number): boolean => fontScale > 1;
/** KB-846 QA(iOS 확대): 4띠는 3→4 경계(반경 최대·불투명도 0.85→1)에서 선명도 계단이 보였다 → 8띠 균등 */
export const CARD_BLUR_STRIPS = 8;
/** 띠 불투명도(위 → 아래) = 1/8 간격 균등(0.125 … 1) — 아래 원본과 크로스페이드, 마지막 단계도 같은 간격(점프 없음) */
export const CARD_BLUR_OPACITY = Array.from({ length: CARD_BLUR_STRIPS }, (_, i) => (i + 1) / CARD_BLUR_STRIPS);
/** 밴드·띠 계산(KB-846) — 띠 i(0=맨 위)의 blurRadius = 기준값 × (i+1)/4(정수 — Android Glide는 정수 반경). 큰 글씨면 캡션이 높아져 밴드도 늘어난다.
 *  좌표는 **기기 픽셀에 스냅**(PixelRatio.roundToNearestPixel — 2.625배 Android에서 정수 pt도 소수 픽셀이라 경계가 앤티앨리어싱 선으로 보였다).
 *  띠는 **맞닿기만**(겹침 0): 같은 픽셀 경계라 틈이 없고, 반투명 띠를 겹치면 겹친 줄이 더 진해져(0.6 + 0.35×0.4 = 0.74) 그 자체가 가는 선이 된다(Codex #320) */
// 띠 i의 blurRadius = 기준값 × (i+1)/8 (정수) — 반경도 1/8 간격 균등
export function blurBandOf(cardH: number, captionTop: number, radius: number = CARD_BLUR_RADIUS) {
  const px = PixelRatio.roundToNearestPixel;
  const top = px(Math.max(0, captionTop - CARD_BLUR_LEAD));
  const bottom = px(cardH);
  const h = bottom - top;
  const strips = Array.from({ length: CARD_BLUR_STRIPS }, (_, i) => {
    const s = px(top + (h * i) / CARD_BLUR_STRIPS);
    const e = i === CARD_BLUR_STRIPS - 1 ? bottom : px(top + (h * (i + 1)) / CARD_BLUR_STRIPS);
    return { top: s, height: e - s, radius: Math.max(1, Math.round((radius * (i + 1)) / CARD_BLUR_STRIPS)), opacity: CARD_BLUR_OPACITY[i] };
  });
  return { top, strips };
}
// expo-image blurRadius는 플랫폼마다 다르다(node_modules/expo-image 실측):
// - iOS: radius/2를 SDImageBlurTransformer에 — **원본 이미지 픽셀** 단위라 고해상도 사진엔 약하다(16 = 원본 8px)
// - Android: Glide BlurTransformation(min(radius, 25), sampling 4) — 1/4로 줄인 뒤 흐리므로 같은 값이 iOS보다 훨씬 세다
// iOS 45 = QA 대조 2회: 16은 윤곽 남음(pr311 03-before-after-mock), 72는 시안보다 더 흐림(dev-6caa-blur 03-r16-r72-mock) — 시안은 기둥·문 윤곽이 남는 정도.
// Android 9 = iOS와 같은 비율(72→45)로 내린 값 — Android 회귀 캡처로 확인 대상.
export const CARD_BLUR_RADIUS = Platform.OS === 'android' ? 9 : 45;

// v5 실측: 카드 335×300 · 캡션 하단 inset 16 · 이름 18 semibold 흰색 · 4 · 지역 13 흰색 · chevron 24(44 자리, 오른쪽 inset 16)
const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: C.surface2, justifyContent: 'flex-end' },
  noPhoto: { backgroundColor: C.hair },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  blurBand: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  blurStrip: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  blurImg: { position: 'absolute', left: 0, right: 0 },
  caption: { flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 16, paddingRight: 16, paddingBottom: 16, gap: 4 },
  name: { fontFamily: font.bodySemi, fontSize: 18, lineHeight: 26, color: '#FFFFFF' },
  area: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
  nameLarge: { fontFamily: font.bodySemi, fontSize: 18, color: '#FFFFFF' }, // 큰 글씨 = 글꼴 고유 줄 높이(KB-846 QA)
  areaLarge: { fontFamily: font.body, fontSize: 13, color: '#FFFFFF' },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

/**
 * ScanResultOverlay — P-149(예진 확정): Photo 뷰 = **쌩 원본 이미지 + 핀치 줌만**.
 * P-125 캡슐 마커·번호·미니시트 연동은 전면 철거(리스트 뷰가 탐색·주문의 주 뷰,
 * P-138⑤) — 원본 감상 표면만 남긴다. 줌 제스처(핀치+팬+더블탭)는 P-064④ 유지.
 */
import * as React from 'react';
import { Image, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { clampPan, clampScale, DOUBLE_TAP_ZOOM } from './zoom';

type Photo = { uri: string; width: number; height: number } | null;

export function ScanResultOverlay({ photo }: { photo: Photo }) {
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  // P-248: contain 실표시 치수 — 팬 클램프를 레터박스가 아닌 이미지 콘텐츠 기준으로.
  // 사진 비율 미상(0 등)이면 컨테이너 치수 폴백(cover 시절 시맨틱).
  const fit =
    photo && photo.width > 0 && photo.height > 0 && size.w > 0 && size.h > 0
      ? Math.min(size.w / photo.width, size.h / photo.height)
      : 0;
  const contentW = fit > 0 ? photo!.width * fit : size.w;
  const contentH = fit > 0 ? photo!.height * fit : size.h;

  // P-064④: 핀치 줌+팬+더블탭 — 스케일 1~4·경계 팬 클램프 (무변 유지)
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clampScale(savedScale.value * e.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      tx.value = clampPan(tx.value, scale.value, contentW, size.w);
      ty.value = clampPan(ty.value, scale.value, contentH, size.h);
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const pan = Gesture.Pan()
    .maxPointers(2)
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      tx.value = clampPan(savedTx.value + e.translationX, scale.value, contentW, size.w);
      ty.value = clampPan(savedTy.value + e.translationY, scale.value, contentH, size.h);
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1 ? 1 : DOUBLE_TAP_ZOOM;
      scale.value = withTiming(next, { duration: 180 });
      tx.value = withTiming(0, { duration: 180 });
      ty.value = withTiming(0, { duration: 180 });
      savedScale.value = next;
      savedTx.value = 0;
      savedTy.value = 0;
    });

  const gestures = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GestureDetector gesture={gestures}>
        <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
          {photo ? (
            /* P-248: cover → contain — 세로·가로 원본 전체 표시(상하/좌우 레터박스,
               어두운 배경 = P-187 진행 프리뷰와 동일 문법). 잘림 = 결함(예진 실기). */
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.paper]} />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16110d', overflow: 'hidden' },
  paper: { backgroundColor: '#241b14' },
});

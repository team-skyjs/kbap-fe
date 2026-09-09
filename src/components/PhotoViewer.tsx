/**
 * PhotoViewer (P-348 ⑥/KB-511) — 풀스크린 사진 뷰어 공용(리뷰 사진 스트립·주문 스캔
 * 메뉴판). 가로 페이징 + X + 도트(2장↑) 현행 유지, **세로 Pan 스와이프 닫기** 추가:
 * 이미지 translateY 추종·배경 opacity 1→0.4, 놓을 때 이동 > 100 또는 속도 > 800이면
 * onClose, 아니면 스프링 복귀. 가로 페이징과 충돌 방지 = activeOffsetY(±12) +
 * failOffsetX(±12). 콜백은 runOnJS(true)(P-131 문법 — 워클릿 0). reduce-motion =
 * 제스처 유지·애니메이션 즉시. RN Modal = 안드 별도 루트라 자체
 * GestureHandlerRootView(P-337 문법).
 */
import * as React from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ScrollView } from 'react-native';
import { RemoteImage } from './RemoteImage';
import { IconClose } from './icons';
import { spring } from '@/lib/motion';

export const VIEWER_DISMISS_DY = 100;
export const VIEWER_DISMISS_VY = 800; // pt/s

export function PhotoViewer({ uris, index = 0, onClose }: { uris: string[]; index?: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [page, setPage] = React.useState(index);
  const ty = useSharedValue(0);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetY([-12, 12]) // 세로 12 넘어야 활성 — 가로 페이징 우선권 보존
        .failOffsetX([-12, 12])
        .onUpdate((e) => {
          ty.value = e.translationY;
        })
        .onFinalize((e, success) => {
          if (success && (Math.abs(e.translationY) > VIEWER_DISMISS_DY || Math.abs(e.velocityY) > VIEWER_DISMISS_VY)) {
            onClose();
            return;
          }
          ty.value = withSpring(0, spring.sheet);
        }),
    [onClose, ty],
  );

  const imgStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(ty.value), [0, 240], [1, 0.4], Extrapolation.CLAMP),
  }));

  if (!uris.length) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* P-337 문법: 안드에서 Modal은 별도 네이티브 루트 — 자체 RootView 필수 */}
      <GestureHandlerRootView style={{ flex: 1 }} testID="photo-viewer">
        <Animated.View style={[StyleSheet.absoluteFill, styles.bg, bgStyle]} />
        <GestureDetector gesture={pan}>
          <Animated.View style={[{ flex: 1 }, imgStyle]}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: index * width, y: 0 }}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
              testID="photo-viewer-pager"
            >
              {uris.map((uri) => (
                <View key={uri} style={{ width, height, justifyContent: 'center' }}>
                  <RemoteImage uri={uri} style={{ width, height: height * 0.8 }} contentFit="contain" />
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </GestureDetector>
        {/* P-193: X = 아이콘만(배경·보더 소멸) */}
        <Pressable style={styles.close} hitSlop={14} onPress={onClose} testID="viewer-close">
          <IconClose size={22} color="#fff" />
        </Pressable>
        {uris.length > 1 && (
          <View style={styles.dots}>
            {uris.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
            ))}
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: '#000000' },
  close: { position: 'absolute', top: 58, right: 20 },
  dots: { position: 'absolute', bottom: 46, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotOn: { backgroundColor: '#FFFFFF' },
});

export default PhotoViewer;

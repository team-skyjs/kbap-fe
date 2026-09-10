/**
 * PhotoViewer (P-348 ⑥/KB-511 → P-349 ②/KB-512) — 풀스크린 사진 뷰어 공용(리뷰 사진
 * 스트립·주문 스캔 메뉴판). 가로 페이징 + X + 도트(2장↑) + **세로 Pan 스와이프 닫기**
 * (위·아래 대칭 — 이동 > 100 또는 속도 > 800, 배경 opacity 1→0.4) + **핀치 줌**:
 * scale 1~4(focal 기준), 더블탭 1↔2배(탭 위치 중심), 확대 상태 패닝(경계 클램프).
 * scale > 1이면 닫기 pan·가로 페이징 비활성, 페이지 전환 시 줌 리셋.
 * 닫기 pan 임계: activeOffsetY ±16(세로 우선권) · failOffsetX ±40(아래 스와이프의
 * 가로 드리프트 허용 — KB-512 실기). 콜백은 전부 runOnJS(true)(P-131 문법 — 워클릿 0).
 * reduce-motion = 제스처 유지·복귀 애니메이션 즉시. RN Modal = 안드 별도 루트라 자체
 * GestureHandlerRootView(P-337 문법).
 */
import * as React from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { ScrollView } from 'react-native';
import { RemoteImage } from './RemoteImage';
import { IconClose } from './icons';
import { spring } from '@/lib/motion';

export const VIEWER_DISMISS_DY = 100;
export const VIEWER_DISMISS_VY = 800; // pt/s
export const VIEWER_PAN_ACTIVE_Y = 16; // 닫기 pan 세로 활성 임계(KB-512 ②-a)
export const VIEWER_PAN_FAIL_X = 40; // 가로 드리프트 허용 폭 — 이 밖만 페이징 몫
export const VIEWER_MAX_SCALE = 4;
export const VIEWER_DOUBLE_TAP_SCALE = 2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function PhotoViewer({ uris, index = 0, onClose }: { uris: string[]; index?: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [page, setPage] = React.useState(index);
  const [zoomed, setZoomed] = React.useState(false); // scale > 1 — 닫기 pan·페이징 비활성
  const reducedMotion = useReducedMotion();
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  // 제스처 시작 기준값(JS ref — runOnJS(true)라 JS 스레드 단일)
  const saved = React.useRef({ scale: 1, ox: 0, oy: 0 });

  const settle = React.useCallback(
    (sv: { value: number }, v: number) => {
      sv.value = reducedMotion ? v : withSpring(v, spring.sheet);
    },
    [reducedMotion],
  );

  // 패닝 경계 — 이미지(=페이저 전체 스케일)가 뷰포트를 벗어난 만큼만
  const maxOx = React.useCallback((sc: number) => (width * (sc - 1)) / 2, [width]);
  const maxOy = React.useCallback((sc: number) => (height * 0.8 * Math.max(0, sc - 1)) / 2, [height]);

  const resetZoom = React.useCallback(
    (animated = true) => {
      saved.current = { scale: 1, ox: 0, oy: 0 };
      if (animated && !reducedMotion) {
        settle(scale, 1);
        settle(ox, 0);
        settle(oy, 0);
      } else {
        scale.value = 1;
        ox.value = 0;
        oy.value = 0;
      }
      setZoomed(false);
    },
    [settle, reducedMotion, scale, ox, oy],
  );

  const gesture = React.useMemo(() => {
    const closePan = Gesture.Pan()
      .enabled(!zoomed)
      .runOnJS(true)
      .activeOffsetY([-VIEWER_PAN_ACTIVE_Y, VIEWER_PAN_ACTIVE_Y]) // 세로 임계 — 가로 페이징 우선권 보존
      .failOffsetX([-VIEWER_PAN_FAIL_X, VIEWER_PAN_FAIL_X])
      .onUpdate((e) => {
        ty.value = e.translationY;
      })
      .onFinalize((e, success) => {
        if (success && (Math.abs(e.translationY) > VIEWER_DISMISS_DY || Math.abs(e.velocityY) > VIEWER_DISMISS_VY)) {
          onClose();
          return;
        }
        settle(ty, 0);
      });

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onUpdate((e) => {
        const next = clamp(saved.current.scale * e.scale, 0.7, VIEWER_MAX_SCALE); // <1 러버밴드 허용
        // focal 기준: 핀 지점이 화면에서 머물도록 시작 오프셋을 배율 변화만큼 보정
        const k = next / saved.current.scale;
        scale.value = next;
        ox.value = clamp(saved.current.ox * k + (1 - k) * (e.focalX - width / 2), -maxOx(Math.max(1, next)), maxOx(Math.max(1, next)));
        oy.value = clamp(saved.current.oy * k + (1 - k) * (e.focalY - height / 2), -maxOy(next), maxOy(next));
      })
      .onEnd(() => {
        if (scale.value < 1) {
          resetZoom();
          return;
        }
        saved.current = { scale: scale.value, ox: ox.value, oy: oy.value };
        setZoomed(scale.value > 1);
      });

    const zoomPan = Gesture.Pan()
      .enabled(zoomed)
      .maxPointers(1) // #111 2R P2: 재핀치 시 pinch와 포인터 경합 → 점프 방지
      .runOnJS(true)
      .onUpdate((e) => {
        const sc = saved.current.scale;
        ox.value = clamp(saved.current.ox + e.translationX, -maxOx(sc), maxOx(sc));
        oy.value = clamp(saved.current.oy + e.translationY, -maxOy(sc), maxOy(sc));
      })
      .onEnd(() => {
        saved.current = { ...saved.current, ox: ox.value, oy: oy.value };
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .runOnJS(true)
      .onEnd((e) => {
        if (saved.current.scale > 1) {
          resetZoom();
          return;
        }
        const sc = VIEWER_DOUBLE_TAP_SCALE;
        const nx = clamp((1 - sc) * (e.x - width / 2), -maxOx(sc), maxOx(sc));
        const ny = clamp((1 - sc) * (e.y - height / 2), -maxOy(sc), maxOy(sc));
        saved.current = { scale: sc, ox: nx, oy: ny };
        settle(scale, sc);
        settle(ox, nx);
        settle(oy, ny);
        setZoomed(true);
      });

    return Gesture.Exclusive(Gesture.Simultaneous(pinch, zoomPan), doubleTap, closePan);
  }, [zoomed, onClose, settle, resetZoom, ty, scale, ox, oy, width, height, maxOx, maxOy]);

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { translateX: ox.value }, { translateY: oy.value }, { scale: scale.value }],
  }));
  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(ty.value), [0, 240], [1, 0.4], Extrapolation.CLAMP),
  }));

  if (!uris.length) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* P-337 문법: 안드에서 Modal은 별도 네이티브 루트 — 자체 RootView 필수 */}
      <GestureHandlerRootView style={{ flex: 1 }} testID="photo-viewer">
        <Animated.View style={[StyleSheet.absoluteFill, styles.bg, bgStyle]} />
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ flex: 1 }, imgStyle]}>
            <ScrollView
              horizontal
              pagingEnabled
              scrollEnabled={!zoomed} // KB-512 ②: 확대 중 페이징 비활성
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: index * width, y: 0 }}
              onMomentumScrollEnd={(e) => {
                setPage(Math.round(e.nativeEvent.contentOffset.x / width));
                resetZoom(false); // 페이지 전환 = 줌 리셋
              }}
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

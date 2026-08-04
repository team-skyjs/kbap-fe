/**
 * ScanResultOverlay — T072 step4 (handoff §14-4). Draws risk-color MARKERS at each
 * dish-name box over the captured image (not full boxes → robust to layout, low
 * overlap). Tapping a marker opens the dish detail. `showMarkers=false` = Original.
 *
 * Risk color is already personalRisk()-guarded upstream (§14-3). Markers only
 * exist for dish names, but unmatched names still get a marker (unable) — never
 * hidden.
 */
import * as React from 'react';
import { Image, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { type ResultDish } from '@/lib/scan/segmentMenu';
import { CapsuleMarker, capsuleWidth, layoutCapsules, type NumberedDish } from './capsuleMarker';
import { coverDisplayRect, markerVisible } from './coverDisplay';
import { clampPan, clampScale, DOUBLE_TAP_ZOOM } from './zoom';

type Photo = { uri: string; width: number; height: number } | null;

export function ScanResultOverlay({
  photo,
  dishes,
  showMarkers,
  onTapDish,
  peeking = false,
  onPeekChange,
}: {
  photo: Photo;
  /** P-125: 번호 보유(assignScanNumbers) — 캡슐 숫자 = 미니시트 순번 1:1 */
  dishes: NumberedDish[];
  showMarkers: boolean;
  /** P-125: 캡슐 탭 = 상세가 아니라 미니시트 하이라이트(상위 배선) */
  onTapDish: (dish: ResultDish) => void;
  /** P-064③: 원본 피크 — true면 마커 페이드아웃(버튼은 상위가 담당) */
  peeking?: boolean;
  onPeekChange?: (peeking: boolean) => void;
}) {
  const [size, setSize] = React.useState({ w: 0, h: 0 });

  // P-064④: 핀치 줌+팬+더블탭 — 이미지와 마커를 **같은 transform 컨테이너**에
  // 담아 확대해도 마커가 정위치를 추종한다. 스케일 1~4·경계 팬 클램프.
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
      tx.value = clampPan(tx.value, scale.value, size.w);
      ty.value = clampPan(ty.value, scale.value, size.h);
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const pan = Gesture.Pan()
    .maxPointers(2)
    .onUpdate((e) => {
      if (scale.value <= 1) return; // 미확대 시 팬 없음 (피크 롱프레스와 비간섭)
      tx.value = clampPan(savedTx.value + e.translationX, scale.value, size.w);
      ty.value = clampPan(savedTy.value + e.translationY, scale.value, size.h);
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      // 더블탭 = 줌 토글/리셋
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
  const markerFade = useAnimatedStyle(() => ({ opacity: withTiming(peeking ? 0 : 1, { duration: 150 }) }));
  const startPeek = React.useCallback(() => onPeekChange?.(true), [onPeekChange]);
  const endPeek = React.useCallback(() => onPeekChange?.(false), [onPeekChange]);
  void runOnJS; // (worklet 경계는 콜백 프로프 경유 — Pressable JS 스레드)
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  // P-079: 표시 = cover(하단 여백 0) — rect가 컨테이너 밖으로 확장될 수 있고,
  // 마커 투영이 같은 rect를 쓰므로 크롭·스케일 정합. 화면 밖 마커는 숨김.
  const rect = React.useMemo(() => {
    const { w, h } = size;
    if (!w || !h) return { x: 0, y: 0, w: 0, h: 0 };
    if (!photo || !photo.width || !photo.height) return { x: 0, y: 0, w, h };
    return coverDisplayRect(w, h, photo.width, photo.height);
  }, [size, photo]);

  // P-125(KB-240 해소): 이름 필 사다리 폐기 — 캡슐(숫자+글리프)은 작아 겹침이
  // 대부분 자연 해소, 잔여만 미세 오프셋(layoutCapsules 한 단). 이름은 미니시트로.
  const positions = React.useMemo(() => {
    if (!rect.w) return [];
    const anchored = dishes.map((d) => ({
      d,
      lx: rect.x + d.box.x * rect.w,
      ty: rect.y + (d.box.y + d.box.height / 2) * rect.h - 12,
      width: capsuleWidth(d.no),
    }));
    // 오프셋은 전체 마커 기준으로 먼저 — 가시성 필터가 앞이면 크롭 여부에 따라 흔들린다.
    return layoutCapsules(anchored).filter((p) => markerVisible(p.lx, p.ty, size.w, size.h));
  }, [dishes, rect, size]);

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GestureDetector gesture={gestures}>
        <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
          {/* P-064③: 빈 영역 꾹 = 원본 피크 (마커는 위 레이어라 마커 탭과 비간섭) */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onLongPress={showMarkers ? startPeek : undefined}
            delayLongPress={220}
            onPressOut={showMarkers ? endPeek : undefined}
          >
            {photo ? (
              <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.paper]} />
            )}
          </Pressable>

          {showMarkers && (
            <Animated.View style={[StyleSheet.absoluteFill, markerFade]} pointerEvents={peeking ? 'none' : 'box-none'}>
              {positions.map(({ d, lx, ty: markerTy }) => (
                <CapsuleMarker key={d.itemId} dish={d} left={lx} top={markerTy} onPress={() => onTapDish(d)} />
              ))}
            </Animated.View>
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

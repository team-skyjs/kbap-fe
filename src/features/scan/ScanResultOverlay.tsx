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
import { Txt as Text } from '@/components/Txt';
import { font, riskTone } from '@/lib/theme';
import { RiskMark } from '@/components';
import { formatKrw, type ResultDish } from '@/lib/scan/segmentMenu';
import { clampPan, clampScale, DOUBLE_TAP_ZOOM } from './zoom';

/** Cap so a pill can't run across the whole photo. */
const PILL_MAX_W = 220;

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
  dishes: ResultDish[];
  showMarkers: boolean;
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

  // displayed image rect inside the container (contain-fit); full container if no photo
  const rect = React.useMemo(() => {
    const { w, h } = size;
    if (!w || !h) return { x: 0, y: 0, w: 0, h: 0 };
    if (!photo || !photo.width || !photo.height) return { x: 0, y: 0, w, h };
    const imgA = photo.width / photo.height;
    const contA = w / h;
    if (imgA > contA) {
      const dispH = w / imgA;
      return { x: 0, y: (h - dispH) / 2, w, h: dispH };
    }
    const dispW = h * imgA;
    return { x: (w - dispW) / 2, y: 0, w: dispW, h };
  }, [size, photo]);

  // KB-140 마커 겹침 완화 — 같은 x-구역에서 세로로 가까운 pill은 아래로
  // 스태거(간격 = pill 높이 32 + 2). 원 앵커에서 다소 밀릴 수 있는 best-effort
  // 휴리스틱이지만 완전 겹침(뒤 pill이 안 눌리는 것)은 방지한다.
  const positions = React.useMemo(() => {
    if (!rect.w) return [];
    const PILL_H = 34;
    const X_CLUSTER = 150; // 이 이내면 같은 열로 간주
    const placed: { lx: number; ty: number }[] = [];
    return [...dishes]
      .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
      .map((d) => {
        const lx = rect.x + d.box.x * rect.w;
        let ty = rect.y + (d.box.y + d.box.height / 2) * rect.h - 16;
        let guard = 0;
        while (
          guard++ < dishes.length &&
          placed.some((p) => Math.abs(p.ty - ty) < PILL_H && Math.abs(p.lx - lx) < X_CLUSTER)
        ) {
          ty += PILL_H;
        }
        placed.push({ lx, ty });
        return { d, lx, ty };
      });
  }, [dishes, rect]);

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
              <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.paper]} />
            )}
          </Pressable>

          {showMarkers && (
            <Animated.View style={[StyleSheet.absoluteFill, markerFade]} pointerEvents={peeking ? 'none' : 'box-none'}>
              {positions.map(({ d, lx, ty: markerTy }) => {
          const tone = riskTone[d.risk];
          // pill의 LEFT는 요리명 박스 왼쪽(box.x) — 메뉴 텍스트가 좌정렬이라
          // 줄 단위로 자연 정렬. KB-140: unmatched도 탭 가능(안내 UI), 상세 이동은 상위에서 차단.
          return (
            <Pressable
              key={d.itemId}
              onPress={() => onTapDish(d)}
              style={[styles.pill, { left: lx, top: markerTy, borderColor: tone.fg }]}
            >
              <RiskMark state={d.risk} size={18} />
              {/* BE 응답 name(없으면 rawMenuName 폴백) — KB-72 신계약으로 임시 라벨 교체 완료 */}
              <Text style={styles.pillText} numberOfLines={1}>
                {d.displayName}
              </Text>
              {/* 서버 제공 가격 그대로 — null=미표시 (P-002) */}
              {d.priceKrw != null && <Text style={styles.pillPrice}>{formatKrw(d.priceKrw)}</Text>}
            </Pressable>
          );
              })}
            </Animated.View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16110d' },
  paper: { backgroundColor: '#241b14' },
  // icon + name pill (design D3) — replaces the icon-only circle marker
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: PILL_MAX_W,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    // subtle lift so markers read over busy photos
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pillText: { fontFamily: font.ko, fontSize: 12.5, color: '#1c1917', flexShrink: 1 },
  pillPrice: { fontFamily: font.bodyBold, fontSize: 11, color: '#78716c' },
});

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
import { riskTone } from '@/lib/theme';
import { RiskMark } from '@/components';
import type { ResultDish } from '@/lib/scan/segmentMenu';

type Photo = { uri: string; width: number; height: number } | null;

export function ScanResultOverlay({
  photo,
  dishes,
  showMarkers,
  onTapDish,
}: {
  photo: Photo;
  dishes: ResultDish[];
  showMarkers: boolean;
  onTapDish: (dish: ResultDish) => void;
}) {
  const [size, setSize] = React.useState({ w: 0, h: 0 });
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

  return (
    <View style={styles.root} onLayout={onLayout}>
      {photo ? (
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.paper]} />
      )}

      {showMarkers &&
        rect.w > 0 &&
        dishes.map((d) => {
          const tone = riskTone[d.risk];
          // anchor the marker at the dish-name box center
          const cx = rect.x + (d.box.x + d.box.width / 2) * rect.w;
          const cy = rect.y + (d.box.y + d.box.height / 2) * rect.h;
          return (
            <Pressable
              key={d.itemId}
              onPress={() => onTapDish(d)}
              style={[styles.marker, { left: cx - 16, top: cy - 16, borderColor: tone.fg }]}
            >
              <RiskMark state={d.risk} size={22} />
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16110d' },
  paper: { backgroundColor: '#241b14' },
  marker: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    // subtle lift so markers read over busy photos
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});

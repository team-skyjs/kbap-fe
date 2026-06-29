/**
 * ScanResultOverlay — draws risk verdicts over the captured menu image (§13-4 A).
 * Each on-device normalized box is mapped onto the displayed image rect
 * (contain-fit, letterbox-aware) and tinted by risk + a RiskMark + reason.
 *
 * Risk color comes ONLY from the BE verdict (mapped in the adapter); we render
 * what we got — no client-side guessing.
 */
import * as React from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { color as C, font, riskTone } from '@/lib/theme';
import { RiskMark } from '@/components';
import type { ScanOverlayItem } from '@/lib/api/scanAdapter';

type Photo = { uri: string; width: number; height: number } | null;

export function ScanResultOverlay({
  photo,
  items,
  showResult,
}: {
  photo: Photo;
  items: ScanOverlayItem[];
  showResult: boolean;
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

      {showResult &&
        rect.w > 0 &&
        items.map((it) => {
          const tone = riskTone[it.risk];
          const left = rect.x + it.box.x * rect.w;
          const top = rect.y + it.box.y * rect.h;
          const width = Math.max(it.box.width * rect.w, 44);
          const height = Math.max(it.box.height * rect.h, 26);
          return (
            <View key={it.itemId} pointerEvents="none">
              <View
                style={[
                  styles.box,
                  { left, top, width, height, borderColor: tone.fg, backgroundColor: hexA(tone.fg, 0.16) },
                ]}
              />
              <View style={[styles.chip, { left, top: top - 2 }]}>
                <RiskMark state={it.risk} size={16} />
                <View style={{ flexShrink: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {it.rawMenuName}
                  </Text>
                  {!!it.reason && (
                    <Text style={[styles.reason, { color: tone.fg }]} numberOfLines={1}>
                      {it.reason}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}
    </View>
  );
}

/** color + alpha → rgba string (tone.fg are hex). */
function hexA(hex: string, a: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16110d' },
  paper: { backgroundColor: '#241b14' },
  box: { position: 'absolute', borderWidth: 2, borderRadius: 6 },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 240,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    transform: [{ translateY: -26 }],
  },
  name: { fontFamily: font.koBold, fontSize: 12.5, color: C.ink },
  reason: { fontFamily: font.body, fontSize: 10.5 },
});

export default ScanResultOverlay;

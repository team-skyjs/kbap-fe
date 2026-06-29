/**
 * Scan route — opened by the center FAB. Full camera/scan UI (mock OCR overlay)
 * lands in the Camera screen unit; this is the navigable placeholder.
 */
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as C, font } from '@/lib/theme';
import { IconClose, IconScanLines } from '@/components';

export default function Scan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <Pressable style={[styles.close, { top: insets.top + 8 }]} onPress={() => router.back()} hitSlop={8}>
        <IconClose size={22} color="#fff" />
      </Pressable>
      <View style={styles.center}>
        <IconScanLines size={56} color="rgba(255,255,255,0.85)" />
        <Text style={styles.note}>Camera / menu scan — coming in the Camera unit</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16110d', alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', gap: 14, paddingHorizontal: 40 },
  note: { fontFamily: font.body, fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
});

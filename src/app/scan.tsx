/**
 * Scan screen — E2E spike (handoff §13): camera → on-device OCR → live BE
 * menu-scans → risk overlay on the captured image.
 *
 * Two entry paths:
 *  - Camera + OCR (needs a dev build; not Expo Go / web — §13-3).
 *  - "Run sample scan": hardcoded ko names → live BE → overlay. Works anywhere
 *    (no camera/OCR), so the FE↔BE roundtrip is verifiable first (§13 fallback).
 */
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { Btn, IconClose, IconScanLines, IconGallery, IconFlip } from '@/components';
import { useScan, type ScannedItem } from '@/lib/data/useScan';
import type { ScanOverlayItem } from '@/lib/api/scanAdapter';
import { recognizeMenuLines } from '@/lib/scan/ocr';
import { ScanResultOverlay } from '@/features/scan/ScanResultOverlay';

type Photo = { uri: string; width: number; height: number } | null;
type Phase = 'camera' | 'scanning' | 'result' | 'error';

// §13 fallback fixture — includes a non-food ("맥북") to verify UNKNOWN → unable.
const SAMPLE_NAMES = ['된장찌개', '김치찌개', '공기밥', '맥북'];
const SAMPLE_ITEMS: ScannedItem[] = SAMPLE_NAMES.map((rawMenuName, i) => ({
  itemId: i,
  rawMenuName,
  box: { x: 0.12, y: 0.16 + i * 0.17, width: 0.62, height: 0.1 },
}));

export default function Scan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const scan = useScan();

  const [phase, setPhase] = useState<Phase>('camera');
  const [photo, setPhoto] = useState<Photo>(null);
  const [items, setItems] = useState<ScanOverlayItem[]>([]);
  const [showResult, setShowResult] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraType>('back');

  function runScan(scanned: ScannedItem[], capturedPhoto: Photo) {
    setPhoto(capturedPhoto);
    setPhase('scanning');
    scan.mutate(scanned, {
      onSuccess: (res) => {
        setItems(res);
        setShowResult(true);
        setPhase('result');
      },
      onError: () => setPhase('error'),
    });
  }

  /** Shared OCR → scan path for both camera capture and gallery import. */
  async function scanImage(captured: Photo) {
    if (!captured) return;
    let lines;
    try {
      lines = await recognizeMenuLines(captured.uri, captured.width, captured.height);
    } catch {
      // native OCR not linked (Expo Go / web) → guide to dev build / sample
      setNotice(t('scan.failed'));
      return;
    }
    if (!lines.length) {
      setNotice(t('scan.noText'));
      return;
    }
    const scanned: ScannedItem[] = lines.map((l, i) => ({
      itemId: i,
      rawMenuName: l.text,
      box: l.box,
    }));
    runScan(scanned, captured);
  }

  async function capture() {
    setNotice(null);
    const cam = cameraRef.current;
    if (!cam) return;
    try {
      const pic = await cam.takePictureAsync({ quality: 0.7 });
      if (!pic?.uri) return;
      await scanImage({ uri: pic.uri, width: pic.width ?? 0, height: pic.height ?? 0 });
    } catch {
      setNotice(t('scan.failed'));
    }
  }

  /** Import a SINGLE photo from the library (mockup gallery button). */
  async function pickFromGallery() {
    setNotice(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false, // one photo at a time
      selectionLimit: 1,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const a = result.assets[0];
    await scanImage({ uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 });
  }

  const Close = (
    <Pressable style={[styles.close, { top: insets.top + 8 }]} onPress={() => router.back()} hitSlop={8}>
      <IconClose size={22} color="#fff" />
    </Pressable>
  );

  // ---- result ----
  if (phase === 'result') {
    return (
      <View style={styles.root}>
        <ScanResultOverlay photo={photo} items={items} showResult={showResult} />
        {Close}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.spikeNote}>{t('scan.spikeNote')}</Text>
          <Text style={styles.resultTitle}>{t('scan.resultTitle', { count: items.length })}</Text>
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggle, !showResult && styles.toggleOn]}
              onPress={() => setShowResult(false)}
            >
              <Text style={[styles.toggleLbl, !showResult && styles.toggleLblOn]}>{t('scan.showOriginal')}</Text>
            </Pressable>
            <Pressable
              style={[styles.toggle, showResult && styles.toggleOn]}
              onPress={() => setShowResult(true)}
            >
              <Text style={[styles.toggleLbl, showResult && styles.toggleLblOn]}>{t('scan.showResult')}</Text>
            </Pressable>
          </View>
          <Btn variant="ghost" onPress={() => { setItems([]); setPhoto(null); setPhase('camera'); }}>
            {t('scan.retake')}
          </Btn>
        </View>
      </View>
    );
  }

  // ---- scanning ----
  if (phase === 'scanning') {
    return (
      <View style={[styles.root, styles.center]}>
        {Close}
        <ActivityIndicator color="#fff" />
        <Text style={styles.statusText}>{t('scan.reading')}</Text>
      </View>
    );
  }

  // ---- error ----
  if (phase === 'error') {
    return (
      <View style={[styles.root, styles.center]}>
        {Close}
        <IconScanLines size={48} color="rgba(255,255,255,0.85)" />
        <Text style={styles.statusText}>{t('scan.failed')}</Text>
        <View style={styles.errBtns}>
          <Btn onPress={() => runScan(SAMPLE_ITEMS, null)}>{t('scan.sample')}</Btn>
          <Btn variant="ghost" onPress={() => setPhase('camera')}>{t('scan.retake')}</Btn>
        </View>
      </View>
    );
  }

  // ---- camera (default) ----
  const granted = permission?.granted;
  return (
    <View style={styles.root}>
      {granted ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.permission]}>
          <IconScanLines size={48} color="rgba(255,255,255,0.85)" />
          <Text style={styles.permTitle}>{t('scan.permissionTitle')}</Text>
          <Text style={styles.permBody}>{t('scan.permissionBody')}</Text>
          <View style={{ width: '100%', maxWidth: 280 }}>
            <Btn onPress={requestPermission}>{t('scan.grant')}</Btn>
          </View>
        </View>
      )}

      {Close}

      {notice && (
        <View style={[styles.notice, { top: insets.top + 60 }]}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.hint}>{t('scan.hint')}</Text>
        {/* gallery (left) · shutter (center) · flip (right) — mockup D1 */}
        <View style={styles.camRow}>
          <Pressable style={styles.sideBtn} onPress={pickFromGallery} hitSlop={8} accessibilityLabel={t('scan.gallery')}>
            <IconGallery size={22} color="#fff" />
          </Pressable>
          {granted ? (
            <Pressable style={styles.shutter} onPress={capture}>
              <View style={styles.shutterInner} />
            </Pressable>
          ) : (
            <View style={styles.shutterSpacer} />
          )}
          {granted ? (
            <Pressable
              style={styles.sideBtn}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              hitSlop={8}
              accessibilityLabel={t('scan.flip')}
            >
              <IconFlip size={22} color="#fff" />
            </Pressable>
          ) : (
            <View style={styles.sideBtn} />
          )}
        </View>
        {/* Fallback path — verifies FE↔BE roundtrip without camera/OCR */}
        <View style={{ width: '100%', maxWidth: 320 }}>
          <Btn variant="ghost" onPress={() => runScan(SAMPLE_ITEMS, null)}>
            {t('scan.sample')}
          </Btn>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16110d' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  close: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permission: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 36 },
  permTitle: { fontFamily: font.display, fontSize: 20, color: '#fff', textAlign: 'center' },
  permBody: { fontFamily: font.body, fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 14,
  },
  hint: { fontFamily: font.bodyBold, fontSize: 13, color: '#fff', textAlign: 'center' },
  camRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  sideBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  shutterSpacer: { width: 76, height: 76 },
  statusText: { fontFamily: font.bodyBold, fontSize: 14, color: '#fff', textAlign: 'center' },
  errBtns: { width: '100%', maxWidth: 300, gap: 10, marginTop: 6 },
  notice: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  noticeText: { fontFamily: font.bodyBold, fontSize: 13, color: '#fff' },
  spikeNote: { fontFamily: font.body, fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  resultTitle: { fontFamily: font.display, fontSize: 16, color: '#fff' },
  toggleRow: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: 4, gap: 3 },
  toggle: { paddingHorizontal: 22, paddingVertical: 9, borderRadius: 9 },
  toggleOn: { backgroundColor: '#fff' },
  toggleLbl: { fontFamily: font.bodyBold, fontSize: 13.5, color: 'rgba(255,255,255,0.7)' },
  toggleLblOn: { color: C.ink },
});

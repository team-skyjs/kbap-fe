/**
 * Scan screen — camera → on-device OCR → segment (T072, handoff §14) → live BE
 * menu-scans → risk markers + list.
 *
 * §14 principle: risk binds to the DISH NAME only. OCR lines are classified
 * (classifyLine) and segmented (segmentMenu); ONLY dish names are sent to the BE.
 * Prices/romanized names are best-effort side info (safe if wrong). Filtering is
 * structural only — unmatched Korean names still show as "unable", sorted last,
 * never hidden (§14-3, Constitution III). Risk passes through personalRisk()
 * (empty-profile false-safe guard).
 *
 * Fallback "Run sample scan" (no camera/OCR) still verifies the FE↔BE roundtrip.
 */
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { color as C, font, riskTone } from '@/lib/theme';
import { Btn, RiskMark, IconClose, IconScanLines, IconGallery, IconFlip, IconChevron } from '@/components';
import { useScan } from '@/lib/data/useScan';
import type { ScanOverlayItem } from '@/lib/api/scanAdapter';
import { recognizeMenuLines } from '@/lib/scan/ocr';
import { segmentMenu, type MenuDish, type ResultDish } from '@/lib/scan/segmentMenu';
import { personalRisk } from '@/lib/risk';
import { useMe } from '@/lib/data/useMe';
import { useFoods } from '@/lib/data/useFoods';
import { ScanResultOverlay } from '@/features/scan/ScanResultOverlay';

type Photo = { uri: string; width: number; height: number } | null;
type Phase = 'camera' | 'scanning' | 'result' | 'error';
type ResultView = 'original' | 'risk' | 'list';
type ErrorStage = 'capture' | 'ocr' | 'empty' | 'network' | 'be';

const ERROR_MSG: Record<ErrorStage, string> = {
  capture: 'scan.errCapture',
  ocr: 'scan.errOcr',
  empty: 'scan.noText',
  network: 'scan.errNetwork',
  be: 'scan.errBe',
};

// §13 fallback fixture (no camera/OCR) — includes a non-food ("맥북") → UNKNOWN → unable.
const SAMPLE_DISHES: MenuDish[] = [
  { itemId: 0, rawMenuName: '된장찌개', box: { x: 0.12, y: 0.16, width: 0.5, height: 0.08 }, price: 'W8,000', latin: 'Doenjang Jjigae' },
  { itemId: 1, rawMenuName: '김치찌개', box: { x: 0.12, y: 0.33, width: 0.5, height: 0.08 }, price: 'W8,000', latin: 'Kimchi Jjigae' },
  { itemId: 2, rawMenuName: '공기밥', box: { x: 0.12, y: 0.5, width: 0.5, height: 0.08 }, price: 'W1,000', latin: 'Steamed Rice' },
  { itemId: 3, rawMenuName: '맥북', box: { x: 0.12, y: 0.67, width: 0.5, height: 0.08 }, price: null, latin: null },
];

export default function Scan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const scan = useScan();
  const { data: me } = useMe();
  const { data: foods } = useFoods();
  const hasR = (me?.restrictions.length ?? 0) > 0;

  const [phase, setPhase] = useState<Phase>('camera');
  const [photo, setPhoto] = useState<Photo>(null);
  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [items, setItems] = useState<ScanOverlayItem[]>([]);
  const [view, setView] = useState<ResultView>('risk');
  const [facing, setFacing] = useState<CameraType>('back');
  const [error, setError] = useState<{ stage: ErrorStage; detail: string } | null>(null);

  function fail(stage: ErrorStage, detail: string) {
    console.log(`[scan] FAIL stage=${stage} detail=${detail}`);
    setError({ stage, detail });
    setPhase('error');
  }

  function runScan(menuDishes: MenuDish[], capturedPhoto: Photo) {
    setDishes(menuDishes);
    setPhoto(capturedPhoto);
    setPhase('scanning');
    // §14-2.2 — send ONLY dish names (no descriptions/prices/origin/junk)
    const scanned = menuDishes.map((d) => ({ itemId: d.itemId, rawMenuName: d.rawMenuName, box: d.box }));
    console.log('[scan] sending dishNames =', JSON.stringify(scanned.map((s) => s.rawMenuName)));
    scan.mutate(scanned, {
      onSuccess: (res) => {
        setItems(res);
        setView('risk');
        setPhase('result');
      },
      onError: (e) => {
        const msg = (e as Error)?.message ?? String(e);
        fail(msg.startsWith('NETWORK') ? 'network' : 'be', msg);
      },
    });
  }

  async function scanImage(captured: Photo) {
    if (!captured) return;
    console.log('[scan] scanImage ← photo', JSON.stringify(captured));
    setError(null);
    setPhoto(captured);
    setPhase('scanning');

    let lines;
    try {
      lines = await recognizeMenuLines(captured.uri, captured.width, captured.height);
    } catch (e) {
      fail('ocr', (e as Error)?.message ?? String(e));
      return;
    }
    const seg = segmentMenu(lines);
    console.log('[scan] segmented dishes =', seg.dishes.length, '| origins =', seg.origins.length);
    if (!seg.dishes.length) {
      fail('empty', `no dish names among ${lines.length} OCR lines`);
      return;
    }
    runScan(seg.dishes, captured);
  }

  async function capture() {
    const cam = cameraRef.current;
    if (!cam) return;
    setError(null);
    try {
      const pic = await cam.takePictureAsync({ quality: 0.7 });
      console.log('[scan] photo =', JSON.stringify({ uri: pic?.uri, w: pic?.width, h: pic?.height }));
      if (!pic?.uri) return fail('capture', 'takePictureAsync returned no uri');
      await scanImage({ uri: pic.uri, width: pic.width ?? 0, height: pic.height ?? 0 });
    } catch (e) {
      fail('capture', (e as Error)?.message ?? String(e));
    }
  }

  async function pickFromGallery() {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        selectionLimit: 1,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const a = result.assets[0];
      await scanImage({ uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 });
    } catch (e) {
      fail('capture', (e as Error)?.message ?? String(e));
    }
  }

  // resolve a scanned Korean name → catalog foodId (else the raw name → unregistered detail)
  function openDish(dish: ResultDish) {
    const match = (foods ?? []).find((f) => f.nameKo === dish.rawMenuName || f.name === dish.rawMenuName);
    const id = match?.foodId ?? encodeURIComponent(dish.rawMenuName);
    router.push(`/food/${id}` as Href);
  }

  const Close = (
    <Pressable style={[styles.close, { top: insets.top + 8 }]} onPress={() => router.back()} hitSlop={8}>
      <IconClose size={22} color="#fff" />
    </Pressable>
  );

  // ---- result ----
  if (phase === 'result') {
    // join dishes + BE risk by itemId; unmatched → unable; guard false-safe
    const byId = new Map(items.map((i) => [i.itemId, i]));
    const resultDishes: ResultDish[] = dishes.map((d) => {
      const it = byId.get(d.itemId);
      return { ...d, risk: personalRisk(it?.risk ?? 'unable', hasR), reason: it?.reason ?? null };
    });
    // §14-5: unable sorted last, never hidden
    const listDishes = [...resultDishes].sort((a, b) => (a.risk === 'unable' ? 1 : 0) - (b.risk === 'unable' ? 1 : 0));

    return (
      <View style={styles.root}>
        {view === 'list' ? (
          <ScrollView contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: 190, paddingHorizontal: 16, gap: 10 }}>
            {listDishes.map((d) => (
              <DishRow key={d.itemId} dish={d} unmatchedNote={t('scan.unmatchedNote')} riskLabel={t(`risk.${d.risk}`)} onPress={() => openDish(d)} />
            ))}
          </ScrollView>
        ) : (
          <ScanResultOverlay photo={photo} dishes={resultDishes} showMarkers={view === 'risk'} onTapDish={openDish} />
        )}
        {Close}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.spikeNote}>{t('scan.spikeNote')}</Text>
          <Text style={styles.resultTitle}>{t('scan.resultTitle', { count: resultDishes.length })}</Text>
          <View style={styles.toggleRow}>
            <Toggle label={t('scan.showOriginal')} on={view === 'original'} onPress={() => setView('original')} />
            <Toggle label={t('scan.showResult')} on={view === 'risk'} onPress={() => setView('risk')} />
            <Toggle label={t('scan.showList')} on={view === 'list'} onPress={() => setView('list')} />
          </View>
          <Btn variant="ghost" onPress={() => { setItems([]); setDishes([]); setPhoto(null); setPhase('camera'); }}>
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
    const stage = error?.stage ?? 'be';
    return (
      <View style={[styles.root, styles.center]}>
        {Close}
        <IconScanLines size={48} color="rgba(255,255,255,0.85)" />
        <Text style={styles.errStage}>{stage.toUpperCase()}</Text>
        <Text style={styles.statusText}>{t(ERROR_MSG[stage])}</Text>
        {!!error?.detail && <Text style={styles.errDetail} numberOfLines={4}>{error.detail}</Text>}
        <View style={styles.errBtns}>
          <Btn variant="ghost" onPress={() => setPhase('camera')}>{t('scan.retake')}</Btn>
          <Btn onPress={() => runScan(SAMPLE_DISHES, null)}>{t('scan.sample')}</Btn>
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

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.hint}>{t('scan.hint')}</Text>
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
            <Pressable style={styles.sideBtn} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} hitSlop={8} accessibilityLabel={t('scan.flip')}>
              <IconFlip size={22} color="#fff" />
            </Pressable>
          ) : (
            <View style={styles.sideBtn} />
          )}
        </View>
        <View style={{ width: '100%', maxWidth: 320 }}>
          <Btn variant="ghost" onPress={() => runScan(SAMPLE_DISHES, null)}>{t('scan.sample')}</Btn>
        </View>
      </View>
    </View>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.toggle, on && styles.toggleOn]} onPress={onPress}>
      <Text style={[styles.toggleLbl, on && styles.toggleLblOn]}>{label}</Text>
    </Pressable>
  );
}

function DishRow({ dish, unmatchedNote, riskLabel, onPress }: { dish: ResultDish; unmatchedNote: string; riskLabel: string; onPress: () => void }) {
  const tone = riskTone[dish.risk];
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <RiskMark state={dish.risk} size={24} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowName} numberOfLines={1}>{dish.rawMenuName}</Text>
        {!!dish.latin && <Text style={styles.rowLatin} numberOfLines={1}>{dish.latin}</Text>}
        {dish.risk === 'unable' && <Text style={styles.rowUnable} numberOfLines={1}>{unmatchedNote}</Text>}
      </View>
      {!!dish.price && <Text style={styles.rowPrice}>{dish.price}</Text>}
      <View style={[styles.rowBadge, { backgroundColor: tone.bg }]}>
        <Text style={[styles.rowBadgeText, { color: tone.fg }]}>{riskLabel}</Text>
      </View>
      <IconChevron size={16} color={C.ink3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16110d' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  close: { position: 'absolute', left: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  permission: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 36 },
  permTitle: { fontFamily: font.display, fontSize: 20, color: '#fff', textAlign: 'center' },
  permBody: { fontFamily: font.body, fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, alignItems: 'center', gap: 14 },
  hint: { fontFamily: font.bodyBold, fontSize: 13, color: '#fff', textAlign: 'center' },
  camRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  sideBtn: { width: 46, height: 46, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  shutterSpacer: { width: 76, height: 76 },
  statusText: { fontFamily: font.bodyBold, fontSize: 14, color: '#fff', textAlign: 'center' },
  errStage: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 1, color: C.primary },
  errDetail: { fontFamily: font.body, fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingHorizontal: 8 },
  errBtns: { width: '100%', maxWidth: 300, gap: 10, marginTop: 6 },
  spikeNote: { fontFamily: font.body, fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  resultTitle: { fontFamily: font.display, fontSize: 16, color: '#fff' },
  toggleRow: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: 4, gap: 3 },
  toggle: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 9 },
  toggleOn: { backgroundColor: '#fff' },
  toggleLbl: { fontFamily: font.bodyBold, fontSize: 13.5, color: 'rgba(255,255,255,0.7)' },
  toggleLblOn: { color: C.ink },
  // list rows
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12 },
  rowName: { fontFamily: font.koBold, fontSize: 15, color: C.ink },
  rowLatin: { fontFamily: font.body, fontSize: 12, color: C.ink2, marginTop: 1 },
  rowUnable: { fontFamily: font.body, fontSize: 11.5, color: C.riskUnable, marginTop: 1 },
  rowPrice: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  rowBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  rowBadgeText: { fontFamily: font.bodyBold, fontSize: 11.5 },
});

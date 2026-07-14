/**
 * Scan screen — camera → on-device OCR → segment (T072, handoff §14) → live BE
 * POST /scans (KB-72 신계약 2026-07-10) → name-pill markers + list.
 *
 * The SERVER is the food-판정 authority now: it cleans + catalog-matches the
 * raw lines; idx absent from results = non-food → dropped (no marker/row).
 * The FE classifier (classifyLine) remains as a payload reducer only.
 * matched=false = 조사 대기 → 'unable' badge, detail navigation disabled (even
 * with a foodId — Swagger 명시). matched risk still passes personalRisk()
 * (empty-profile false-safe guard). degraded=true shows a light notice.
 *
 * Fallback "Run sample scan" (no camera/OCR) still verifies the FE↔BE roundtrip.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { color as C, font, riskTone } from '@/lib/theme';
import { Btn, RiskMark, IconClose, IconScanLines, IconGallery, IconFlip, IconChevron } from '@/components';
import { useScan } from '@/lib/data/useScan';
import type { ScanOverlayItem } from '@/lib/api/scanAdapter';
import { recognizeMenuLines } from '@/lib/scan/ocr';
import { segmentMenu, formatKrw, type MenuDish, type ResultDish } from '@/lib/scan/segmentMenu';
import { personalRisk } from '@/lib/risk';
import { useMe } from '@/lib/data/useMe';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
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
  { itemId: 0, rawMenuName: '된장찌개', box: { x: 0.12, y: 0.16, width: 0.5, height: 0.08 }, priceKrw: 8000, latin: 'Doenjang Jjigae' },
  { itemId: 1, rawMenuName: '김치찌개', box: { x: 0.12, y: 0.33, width: 0.5, height: 0.08 }, priceKrw: 8000, latin: 'Kimchi Jjigae' },
  { itemId: 2, rawMenuName: '공기밥', box: { x: 0.12, y: 0.5, width: 0.5, height: 0.08 }, priceKrw: 1000, latin: 'Steamed Rice' },
  { itemId: 3, rawMenuName: '맥북', box: { x: 0.12, y: 0.67, width: 0.5, height: 0.08 }, priceKrw: null, latin: null },
];

/** ⑦(KB-137) 촬영/갤러리 캐시 파일 삭제 — 실패해도 스캔 흐름엔 무해(로그만). */
function deletePhotoFile(uri: string | null | undefined): void {
  if (!uri || !uri.startsWith('file:')) return; // 웹 blob/샘플(null)은 대상 아님
  FileSystem.deleteAsync(uri, { idempotent: true })
    .then(() => console.log('[scan] cleaned photo file:', uri))
    .catch((e) => console.log('[scan] photo cleanup failed:', (e as Error)?.message ?? e));
}

export default function Scan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const scan = useScan();
  const { data: me } = useMe();
  const hasR = (me?.restrictions.length ?? 0) > 0;

  const [phase, setPhase] = useState<Phase>('camera');
  const [photo, setPhoto] = useState<Photo>(null);
  // ⑦(KB-137) 촬영/갤러리 파일 캐시 누적 방지 — 결과 오버레이가 photo.uri를
  // 렌더하므로 OCR 직후가 아니라 **표시 수명이 끝날 때** 삭제: 새 사진으로
  // 교체될 때 이전 파일, 화면 언마운트 시 마지막 파일.
  const photoUriRef = useRef<string | null>(null);
  useEffect(() => () => deletePhotoFile(photoUriRef.current), []);
  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [items, setItems] = useState<ScanOverlayItem[]>([]);
  const [degraded, setDegraded] = useState(false); // 정제 실패/부재 (KB-72 신계약)
  const [view, setView] = useState<ResultView>('risk');
  const [facing, setFacing] = useState<CameraType>('back');
  const [error, setError] = useState<{ stage: ErrorStage; detail: string } | null>(null);
  const isGuest = useIsGuest();
  const [gateOpen, setGateOpen] = useState(false); // 게스트 스캔 게이트 (KB-77/78, §3-Q1)

  function fail(stage: ErrorStage, detail: string) {
    console.log(`[scan] FAIL stage=${stage} detail=${detail}`);
    setError({ stage, detail });
    setPhase('error');
  }

  function runScan(menuDishes: MenuDish[], capturedPhoto: Photo) {
    if (isGuest) return setGateOpen(true); // 샘플 스캔 포함
    setDishes(menuDishes);
    setPhoto(capturedPhoto);
    setPhase('scanning');
    // §14-2.2 — send ONLY dish names (no descriptions/prices/origin/junk)
    const scanned = menuDishes.map((d) => ({ itemId: d.itemId, rawMenuName: d.rawMenuName, box: d.box }));
    console.log('[scan] sending dishNames =', JSON.stringify(scanned.map((s) => s.rawMenuName)));
    scan.mutate(scanned, {
      onSuccess: (res) => {
        setItems(res.items);
        setDegraded(res.degraded);
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
    // 이전 촬영/갤러리 파일은 더 이상 표시되지 않음 — 지금 삭제 (⑦ KB-137)
    if (photoUriRef.current && photoUriRef.current !== captured.uri) {
      deletePhotoFile(photoUriRef.current);
    }
    photoUriRef.current = captured.uri;
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
    if (isGuest) return setGateOpen(true); // 스캔=회원 전용 (게이트)
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
    if (isGuest) return setGateOpen(true);
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

  // Detail navigation: matched dishes only (KB-72 신계약). matched=false is
  // 조사 대기 — there is no detail screen even when foodId exists (Swagger 명시).
  function openDish(dish: ResultDish) {
    if (!dish.matched || !dish.foodId) return;
    router.push(`/food/${dish.foodId}` as Href);
  }

  const GateSheet = <AuthGateSheet context="scan" open={gateOpen} onClose={() => setGateOpen(false)} />;

  const Close = (
    <Pressable style={[styles.close, { top: insets.top + 8 }]} onPress={() => router.back()} hitSlop={8}>
      <IconClose size={22} color="#fff" />
    </Pressable>
  );

  // 라우트 자체 가드 (실기기 반려분 #2): 진입로별 가드는 누락이 생긴다 —
  // 게스트는 어떤 경로로 오든 카메라 없이 게이트 시트, 닫으면 뒤로.
  if (isGuest) {
    return (
      <View style={styles.root}>
        {Close}
        <AuthGateSheet context="scan" open onClose={() => router.back()} />
      </View>
    );
  }

  // ---- result ----
  if (phase === 'result') {
    // Join dishes × BE verdicts by itemId. Items the server excluded are
    // NON-FOOD (원산지·가격·UI 문구) → dropped: no marker, no list row (KB-72
    // 신계약 — the server is the food-판정 authority). matched risk still runs
    // through the personalRisk false-safe guard.
    const byId = new Map(items.map((i) => [i.itemId, i]));
    const resultDishes: ResultDish[] = dishes.flatMap((d) => {
      const it = byId.get(d.itemId);
      if (!it) return [];
      return [{
        ...d,
        risk: it.matched ? personalRisk(it.risk, hasR) : 'unable',
        matched: it.matched,
        foodId: it.foodId,
        displayName: it.displayName,
        koreanName: it.koreanName,
      }];
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
        {GateSheet}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
          {/* degraded=true: 서버 정제(LLM) 실패/부재 — 비음식이 섞였을 수 있고 전부 조사 대기 */}
          {degraded && <Text style={styles.degradedNote}>{t('scan.degradedNote')}</Text>}
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
        {GateSheet}
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
        {GateSheet}
        <IconScanLines size={48} color="rgba(255,255,255,0.85)" />
        <Text style={styles.errStage}>{t(`scan.stage.${stage}`)}</Text>
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
        {GateSheet}

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
    <Pressable style={styles.row} onPress={onPress} disabled={!dish.matched}>
      <RiskMark state={dish.risk} size={24} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowName} numberOfLines={1}>{dish.displayName}</Text>
        {/* koreanName 병기 (표시명과 다를 때) · 로마자 라인은 보조 표기 유지 */}
        {!!dish.koreanName && dish.koreanName !== dish.displayName && (
          <Text style={styles.rowLatin} numberOfLines={1}>{dish.koreanName}</Text>
        )}
        {!dish.koreanName && !!dish.latin && <Text style={styles.rowLatin} numberOfLines={1}>{dish.latin}</Text>}
        {!dish.matched && <Text style={styles.rowUnable} numberOfLines={1}>{unmatchedNote}</Text>}
      </View>
      {dish.priceKrw != null && <Text style={styles.rowPrice}>{formatKrw(dish.priceKrw)}</Text>}
      <View style={[styles.rowBadge, { backgroundColor: tone.bg }]}>
        <Text style={[styles.rowBadgeText, { color: tone.fg }]}>{riskLabel}</Text>
      </View>
      {/* 조사 대기(matched=false)는 상세가 없어 이동 화살표도 없음 */}
      {dish.matched && <IconChevron size={16} color={C.ink3} />}
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
  errStage: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 1, color: C.primary, textTransform: 'uppercase' },
  errDetail: { fontFamily: font.body, fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingHorizontal: 8 },
  errBtns: { width: '100%', maxWidth: 300, gap: 10, marginTop: 6 },
  degradedNote: { fontFamily: font.body, fontSize: 12, color: '#fbbf24', textAlign: 'center' },
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

/**
 * Scan screen — camera → on-device OCR → segment (T072, handoff §14) → live BE
 * POST /scans (KB-72 신계약 2026-07-16: imagePath + price) → name-pill markers
 * + list. 가격은 서버 제공값만 표시(null=미표시, OCR 추정가 대체). idx=null
 * 결과(사진에서만 추출)는 리스트에 박스 없이 노출 — 숨김 금지 (P-002 게이트).
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
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '@/lib/useBottomInset';
import { CameraView, useCameraPermissions, type CameraType, type CameraOrientation } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { color as C, font, riskTone } from '@/lib/theme';
import { Btn, RiskMark, QueryErrorBlock, classifyQueryError, IconClose, IconScanLines, IconGallery, IconFlip, IconChevron } from '@/components';
import { useScan } from '@/lib/data/useScan';
import { useInfiniteFoods } from '@/lib/data/useFoods';
import type { PhotoOnlyItem, ScanOverlayItem } from '@/lib/api/scanAdapter';
import { recognizeMenuLines } from '@/lib/scan/ocr';
import { segmentMenu, formatKrw, scanPriceParam, type MenuDish, type ResultDish } from '@/lib/scan/segmentMenu';
import { orientationFromGravity } from '@/lib/scan/deviceOrientation';
import { coverCropRect } from '@/lib/scan/coverCrop';
import { dismissNudge, isNudgeDismissed } from '@/lib/scan/nudgeSession';
import { personalRisk } from '@/lib/risk';
import { spring } from '@/lib/motion';
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
  const bottom = useBottomInset(); // P-055: 안드 내비바 보정
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
  const [photoOnly, setPhotoOnly] = useState<PhotoOnlyItem[]>([]); // idx=null — 리스트 전용

  const [degraded, setDegraded] = useState(false); // 정제 실패/부재 (KB-72 신계약)
  // KB-140: 기본 화면 = 리스트 (오버레이 버튼 겹침 회피 — 2026-07-14 결정)
  const [view, setView] = useState<ResultView>('list');
  const [facing, setFacing] = useState<CameraType>('back');
  const [error, setError] = useState<{ stage: ErrorStage; detail: string } | null>(null);
  const isGuest = useIsGuest();
  const [gateOpen, setGateOpen] = useState(false); // 게스트 스캔 게이트 (KB-77/78, §3-Q1)
  // P-046(KB-216): 진입 시 오프라인 게이트 — 음식탭/검색과 같은 프로브(캐시 공유).
  // 오프라인이면 카메라 미기동 + 전체 J4, Retry 성공 시 카메라 기동.
  const probe = useInfiniteFoods();
  const offline = probe.isError && classifyQueryError(probe.error) === 'offline';
  // KB-141 가로 촬영 차단 — portrait-lock 상태에서도 기기 회전을 알려준다.
  // iOS: expo-camera 내장 콜백(onResponsiveOrientationChanged). Android(KB-198):
  // 그 콜백이 @platform ios라 미발생 → DeviceMotion 중력으로 직접 감지(아래 effect).
  // 두 소스가 같은 camOrientation state를 먹인다 — 오버레이 로직은 무변 재사용.
  const [camOrientation, setCamOrientation] = useState<CameraOrientation>('portrait');
  const [unmatchedOpen, setUnmatchedOpen] = useState(false); // KB-140 unmatched 안내
  // P-038(KB-212): 빈 프로필 넛지 — 세션 억제 플래그를 마운트 시점에 읽는다
  const [nudgeHidden, setNudgeHidden] = useState(isNudgeDismissed());
  const isLandscape = camOrientation === 'landscapeLeft' || camOrientation === 'landscapeRight';

  // KB-198: Android 전용 센서 방향 감지 — 앱은 세로 고정, 힌트만 반응.
  // 임계각+디바운스(같은 값 반복 setState는 React가 무시)로 45° 근처 떨림 방지.
  // ⚠️ expo-sensors는 **지연 require** — 최상단 import는 파일 로드 시점에 네이티브
  // 모듈(ExponentPedometer)을 즉시 불러와, 이 모듈이 없는 빌드(expo-sensors 추가
  // 전 빌드)에선 iOS에서도 앱 전체가 크래시한다. Android 가드 안에서 try-require해
  // iOS는 아예 안 건드리고, 네이티브 미탑재(재빌드 전)면 조용히 힌트만 비활성.
  useEffect(() => {
    if (Platform.OS !== 'android') return; // iOS는 카메라 콜백이 담당
    let sub: { remove: () => void } | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DeviceMotion } = require('expo-sensors') as typeof import('expo-sensors');
      DeviceMotion.setUpdateInterval(200);
      sub = DeviceMotion.addListener(({ accelerationIncludingGravity: g }) => {
        if (!g) return;
        setCamOrientation(orientationFromGravity({ x: g.x, y: g.y }) as CameraOrientation);
      });
    } catch (e) {
      // 네이티브 미탑재(재빌드 전) — 가로 감지만 비활성, 스캔은 정상 (KB-198)
      console.log('[scan] expo-sensors 미탑재 — 가로 힌트 비활성(재빌드 필요):', (e as Error)?.message ?? e);
    }
    return () => sub?.remove();
  }, []);

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
    scan.mutate({ items: scanned, photo: capturedPhoto }, {
      onSuccess: (res) => {
        setItems(res.items);
        setPhotoOnly(res.photoOnly);
        setDegraded(res.degraded);
        setView('list'); // KB-140 기본 리스트
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

  // KB-202/P-025: CameraView 실측 크기 — cover-크롭 역산의 뷰포트 기준.
  const previewSize = useRef<{ width: number; height: number } | null>(null);

  /**
   * KB-202 WYSIWYG: 캡처본(센서 전체)을 미리보기에 보였던 중앙 영역으로 크롭.
   * expo-image-manipulator는 **지연 require** (expo-sensors와 동일 사유 — 네이티브
   * 미탑재 빌드에서 최상단 import는 앱 전체 크래시). 미탑재/실패 시 원본 그대로
   * 반환 — 크롭만 생략되고 스캔은 정상(재빌드 전 동작).
   */
  async function cropToPreview(pic: NonNullable<Photo>): Promise<NonNullable<Photo>> {
    const view = previewSize.current;
    const rect = view ? coverCropRect(view.width, view.height, pic.width, pic.height) : null;
    if (!rect) return pic;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
      const rendered = await ImageManipulator.manipulate(pic.uri).crop(rect).renderAsync();
      const saved = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      console.log('[scan] WYSIWYG crop', JSON.stringify({ from: { w: pic.width, h: pic.height }, rect }));
      deletePhotoFile(pic.uri); // 원본(과다 캡처)은 즉시 삭제 — 이후 수명은 크롭본 몫 (⑦ KB-137)
      return { uri: saved.uri, width: saved.width ?? rect.width, height: saved.height ?? rect.height };
    } catch (e) {
      console.log('[scan] expo-image-manipulator 미탑재/실패 — 크롭 생략(재빌드 필요):', (e as Error)?.message ?? e);
      return pic;
    }
  }

  async function capture() {
    if (isGuest) return setGateOpen(true); // 스캔=회원 전용 (게이트)
    if (isLandscape) return; // KB-141: 어떤 진입 경로로도 가로 촬영 불가 (함수 단 가드)
    const cam = cameraRef.current;
    if (!cam) return;
    setError(null);
    try {
      const pic = await cam.takePictureAsync({ quality: 0.7 });
      console.log('[scan] photo =', JSON.stringify({ uri: pic?.uri, w: pic?.width, h: pic?.height }));
      if (!pic?.uri) return fail('capture', 'takePictureAsync returned no uri');
      // KB-202: 업로드·표시·OCR 전부 크롭본 기준 — 미리보기 밖은 어디에도 안 간다
      const cropped = await cropToPreview({ uri: pic.uri, width: pic.width ?? 0, height: pic.height ?? 0 });
      await scanImage(cropped);
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
  // KB-140: unmatched 탭 = 무반응 대신 "아직 등록 안 된 음식" 안내 (중립 톤, 상세 이동은 계속 불가).
  function openDish(dish: ResultDish) {
    if (!dish.matched || !dish.foodId) return setUnmatchedOpen(true);
    // P-012(KB-179): 가격은 메뉴판 속성 — 스캔 진입에만 param으로 전달 (리스트
    // 행·오버레이 마커·사진 전용 항목 전부 이 함수를 지나므로 첨부 지점은 여기 하나)
    router.push(`/food/${dish.foodId}${scanPriceParam(dish.priceKrw)}` as Href);
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
        priceKrw: it.price, // 서버 제공값 그대로 — OCR 추정가 대체, null=미표시 (P-002)
      }];
    });
    // idx=null(사진에서만 추출) — 좌표 부재로 리스트 전용, 오버레이 마커 없음.
    // 음수 itemId = 합성 키(OCR itemId 0..n 과 불충돌). 위험도 규칙은 동일.
    const photoDishes: ResultDish[] = photoOnly.map((p, k) => ({
      itemId: -1 - k,
      rawMenuName: p.displayName,
      box: { x: 0, y: 0, width: 0, height: 0 },
      latin: null,
      priceKrw: p.price,
      risk: p.matched ? personalRisk(p.risk, hasR) : 'unable',
      matched: p.matched,
      foodId: p.foodId,
      displayName: p.displayName,
      koreanName: p.koreanName,
    }));
    const allDishes = [...resultDishes, ...photoDishes];
    // §14-5: unable sorted last, never hidden
    const listDishes = [...allDishes].sort((a, b) => (a.risk === 'unable' ? 1 : 0) - (b.risk === 'unable' ? 1 : 0));

    return (
      <View style={styles.root}>
        {view === 'list' ? (
          <ScrollView contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: 190, paddingHorizontal: 16, gap: 10 }}>
            {listDishes.map((d, k) => (
              /* P-032: Stagger Entrance — 분석 완료 리워드감, 60ms 간격(상한 8행).
                 reduced-motion 시 전역 config가 entering을 스킵 → 즉시 표시. */
              <Animated.View
                key={d.itemId}
                entering={FadeInDown.delay(Math.min(k, 8) * 60).springify().damping(spring.sheet.damping).stiffness(spring.sheet.stiffness)}
              >
                <DishRow dish={d} unmatchedNote={t('scan.unmatchedNote')} riskLabel={t(`risk.${d.risk}`)} onPress={() => openDish(d)} />
              </Animated.View>
            ))}
          </ScrollView>
        ) : (
          <ScanResultOverlay photo={photo} dishes={resultDishes} showMarkers={view === 'risk'} onTapDish={openDish} />
        )}
        {Close}
        {GateSheet}
        {/* P-038(KB-212): 빈 프로필 넛지 — 회원 && 기피 0 && 세션 내 미닫음.
            가치 증명 순간(스캔 직후)의 비차단 1줄 배너, absolute라 레이아웃 안 밀음.
            게스트는 기존 로그인 게이트 흐름이라 제외. 닫으면 세션 동안만 숨김. */}
        {!isGuest && !!me && me.restrictions.length === 0 && !nudgeHidden && (
          <View style={[styles.nudge, { top: insets.top + 8 }]}>
            <Pressable style={styles.nudgeBody} onPress={() => router.push('/profile/restrictions' as Href)}>
              <Text style={styles.nudgeText} numberOfLines={2}>{t('scan.nudge')}</Text>
              <IconChevron size={13} color="rgba(255,255,255,0.75)" />
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => {
                dismissNudge();
                setNudgeHidden(true);
              }}
            >
              <IconClose size={14} color="rgba(255,255,255,0.75)" />
            </Pressable>
          </View>
        )}
        <UnmatchedNotice open={unmatchedOpen} onClose={() => setUnmatchedOpen(false)} t={t} />
        <View style={[styles.bottom, { paddingBottom: bottom + 20 }]}>
          {/* degraded=true: 서버 정제(LLM) 실패/부재 — 비음식이 섞였을 수 있고 전부 조사 대기 */}
          {degraded && <Text style={styles.degradedNote}>{t('scan.degradedNote')}</Text>}
          <Text style={styles.resultTitle}>{t('scan.resultTitle', { count: allDishes.length })}</Text>
          <ToggleRow
            value={view}
            onChange={setView}
            options={[
              { key: 'list', label: t('scan.showList') },
              { key: 'risk', label: t('scan.showResult') },
              { key: 'original', label: t('scan.showOriginal') },
            ]}
          />
          <Btn variant="ghost" onPress={() => { setItems([]); setPhotoOnly([]); setDishes([]); setPhoto(null); setPhase('camera'); }}>
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
  // P-046: 오프라인 = 전체 J4 (카메라·갤러리·샘플 진입로 전부 이 화면으로 대체 —
  // 촬영 자체가 불가). 밝은 배경으로 다른 탭 J4와 톤 통일.
  if (offline) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: C.surface }]}>
        {Close}
        <QueryErrorBlock error={probe.error} onRetry={() => void probe.refetch()} />
      </View>
    );
  }
  const granted = permission?.granted;
  return (
    <View style={styles.root}>
      {granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          onLayout={(e) => { previewSize.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }; }}
          facing={facing}
          responsiveOrientationWhenOrientationLocked
          onResponsiveOrientationChanged={(e) => setCamOrientation(e.orientation)}
        />
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

      {granted && isLandscape && (
        <View style={styles.rotateOverlay} pointerEvents="none">
          <View style={{ transform: [{ rotate: camOrientation === 'landscapeLeft' ? '90deg' : '-90deg' }], alignItems: 'center', gap: 10 }}>
            <IconFlip size={30} color="#fff" />
            <Text style={styles.rotateText}>{t('scan.rotateToPortrait')}</Text>
          </View>
        </View>
      )}

      {Close}
        {GateSheet}

      <View style={[styles.bottom, { paddingBottom: bottom + 20 }]}>
        <Text style={styles.hint}>{t('scan.hint')}</Text>
        <View style={styles.camRow}>
          <Pressable style={styles.sideBtn} onPress={pickFromGallery} hitSlop={8} accessibilityLabel={t('scan.gallery')}>
            <IconGallery size={22} color="#fff" />
          </Pressable>
          {granted ? (
            <Pressable style={[styles.shutter, isLandscape && styles.shutterOff]} onPress={capture} disabled={isLandscape}>
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

/** KB-140 unmatched 안내 — 중립 톤(unable 마크·ink 텍스트), 안전 인상 금지. */
function UnmatchedNotice({ open, onClose, t }: { open: boolean; onClose: () => void; t: (k: string) => string }) {
  if (!open) return null;
  return (
    <Pressable style={styles.noticeBackdrop} onPress={onClose}>
      <Pressable style={styles.noticeCard} onPress={() => {}}>
        <RiskMark state="unable" size={30} />
        <Text style={styles.noticeTitle}>{t('scan.unmatchedSheetTitle')}</Text>
        <Text style={styles.noticeBody}>{t('scan.unmatchedSheetBody')}</Text>
        <View style={{ alignSelf: 'stretch' }}>
          <Btn variant="ghost" onPress={onClose}>{t('common.gotIt')}</Btn>
        </View>
      </Pressable>
    </Pressable>
  );
}

/**
 * P-032: Tab Pill Glide — 흰 인디케이터 필이 활성 세그먼트로 스프링 글라이드
 * (kinetics 직역). 세그먼트 폭은 i18n 라벨 길이에 따라 다르므로 onLayout 실측.
 * 첫 배치는 무애니메이션(등장 시 글라이드 금지 — 전환에만).
 */
function ToggleRow({
  value,
  onChange,
  options,
}: {
  value: ResultView;
  onChange: (v: ResultView) => void;
  options: { key: ResultView; label: string }[];
}) {
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const ready = useRef(false);
  const layouts = useRef<Partial<Record<ResultView, { x: number; w: number }>>>({});
  const place = (v: ResultView) => {
    const l = layouts.current[v];
    if (!l) return;
    if (ready.current) {
      x.value = withSpring(l.x, spring.move);
      w.value = withSpring(l.w, spring.move);
    } else {
      x.value = l.x;
      w.value = l.w;
      ready.current = true;
    }
  };
  useEffect(() => {
    place(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const ind = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], width: w.value }));
  return (
    <View style={styles.toggleRow}>
      <Animated.View style={[styles.toggleInd, ind]} />
      {options.map((o) => (
        <Pressable
          key={o.key}
          style={styles.toggle}
          onPress={() => onChange(o.key)}
          onLayout={(e) => {
            layouts.current[o.key] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width };
            if (o.key === value) place(o.key); // 초기/리레이아웃 시 현재 위치 반영
          }}
        >
          <Text style={[styles.toggleLbl, o.key === value && styles.toggleLblOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function DishRow({ dish, unmatchedNote, riskLabel, onPress }: { dish: ResultDish; unmatchedNote: string; riskLabel: string; onPress: () => void }) {
  const tone = riskTone[dish.risk];
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <RiskMark state={dish.risk} size={24} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowName} numberOfLines={1}>{dish.displayName}</Text>
        {/* koreanName 병기 (표시명과 다를 때) · 로마자 라인은 보조 표기 유지 */}
        {!!dish.koreanName && dish.koreanName !== dish.displayName && (
          <Text style={styles.rowLatin} numberOfLines={1}>{dish.koreanName}</Text>
        )}
        {!dish.koreanName && !!dish.latin && <Text style={styles.rowLatin} numberOfLines={1}>{dish.latin}</Text>}
        {/* P-031: 안전 행동 지시는 말줄임 금지 — 2줄 허용 */}
        {!dish.matched && <Text style={styles.rowUnable} numberOfLines={2}>{unmatchedNote}</Text>}
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
  shutterOff: { opacity: 0.35 },
  rotateOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  rotateText: { fontFamily: font.bodyBold, fontSize: 16, color: '#fff', textAlign: 'center', maxWidth: 260, lineHeight: 22 },
  // P-038: 빈 프로필 넛지 — Close 버튼(좌 16, 폭 40) 우측에 정렬, 리스트 여백(60) 위 오버레이
  nudge: { position: 'absolute', left: 64, right: 16, zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 12, paddingLeft: 12, paddingRight: 10, paddingVertical: 8 },
  nudgeBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  nudgeText: { flex: 1, fontFamily: font.bodyBold, fontSize: 12, color: '#fff', lineHeight: 16 },
  noticeBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 28 },
  noticeCard: { backgroundColor: '#fff', borderRadius: 20, padding: 22, alignItems: 'center', gap: 10, maxWidth: 340, alignSelf: 'stretch' },
  noticeTitle: { fontFamily: font.display, fontSize: 17, color: C.ink, textAlign: 'center' },
  noticeBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, textAlign: 'center', lineHeight: 20 },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  shutterSpacer: { width: 76, height: 76 },
  statusText: { fontFamily: font.bodyBold, fontSize: 14, color: '#fff', textAlign: 'center' },
  errStage: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 1, color: C.primaryText, textTransform: 'uppercase' },
  errDetail: { fontFamily: font.body, fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingHorizontal: 8 },
  errBtns: { width: '100%', maxWidth: 300, gap: 10, marginTop: 6 },
  degradedNote: { fontFamily: font.body, fontSize: 12, color: '#fbbf24', textAlign: 'center' },
  resultTitle: { fontFamily: font.display, fontSize: 16, color: '#fff' },
  toggleRow: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: 4, gap: 3 },
  toggle: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 9 },
  // P-032: 활성 배경은 개별 toggleOn 대신 글라이드 인디케이터가 담당
  toggleInd: { position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: 9, backgroundColor: '#fff' },
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

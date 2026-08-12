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
import { ActivityIndicator, Alert, AppState, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '@/lib/useBottomInset';
import { EVENTS, track } from '@/lib/analytics';
import { CameraView, useCameraPermissions, type CameraType, type CameraOrientation } from 'expo-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { activePreset, CAM_ZOOM_PRESETS, pinchToZoom, uiRotationDeg, type CamZoomPreset } from '@/features/scan/cameraZoom';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { color as C, font, riskTone, shadow } from '@/lib/theme';
import { Btn, RiskMark, QueryErrorBlock, classifyQueryError, IconBulb, IconClose, IconList, IconRetry, IconScanLines, IconGallery, IconFlip, IconChevron } from '@/components';
import { scanV2Enabled, useScan } from '@/lib/data/useScan';
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
import { markCoachSeen, ScanCoachMark, shouldShowCoachMark } from '@/features/scan/ScanCoachMark';
import { OrderPill, ScanProfileBar, ScanRichList } from '@/features/scan/ScanRichList';
import { resolveCurrency } from '@/lib/exchange';
import { ingredientLabel } from '@/lib/mocks/ingredients';
import { useIngredientCatalog } from '@/lib/data/useIngredientCatalog';
import { FLAGS, SYSTEM_CAMERA_AUTOLAUNCH } from '@/lib/flags';

type Photo = { uri: string; width: number; height: number } | null;
type Phase = 'camera' | 'scanning' | 'result' | 'error';
type ResultView = 'risk' | 'list';
type ErrorStage = 'capture' | 'ocr' | 'empty' | 'network' | 'be';

const ERROR_MSG: Record<ErrorStage, string> = {
  capture: 'scan.errCapture',
  ocr: 'scan.errOcr',
  empty: 'scan.noText',
  network: 'scan.errNetwork',
  be: 'scan.errBe',
};

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
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  // P-122: OS는 권한 프롬프트를 1회만 — 거부 이력이면 requestPermission이 무프롬프트
  // 거부 반환(silent denial). 이 상태 = 설정 딥링크로 분기, 복귀 시 자동 재조회.
  const permDenied = permission != null && !permission.granted && permission.canAskAgain === false;
  useEffect(() => {
    if (!permDenied) return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void getPermission(); // 설정에서 허용 후 복귀 → 게이트 자동 해제
    });
    return () => sub.remove();
  }, [permDenied, getPermission]);
  const scan = useScan();
  const { data: me } = useMe();
  const ingCat = useIngredientCatalog(); // P-174: 요약 칩 서버 번역명 우선
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
  // P-138⑤(예진 8/6, 오너 결정 — 구 P-071 "사진 뷰 기본" 대체): 스캔 직후
  // 기본 = List(리치 리스트가 탐색·주문의 주 뷰). Photo는 세그 전환.
  const [view, setView] = useState<ResultView>('list');
  // P-134: 첫 스캔 결과 1회 코치마크 — 재열람은 리스트 RiskMark 탭
  const [coachOpen, setCoachOpen] = useState(false);
  // P-136(B-4 2단 확정): 담기 카트 — itemId→수량, 리스트·캡슐 뷰 공유
  const [cart, setCart] = useState<Map<number, number>>(new Map());
  const [currency, setCurrency] = useState('USD');
  useEffect(() => {
    void resolveCurrency(me?.nationality, me?.currency).then(setCurrency); // P-165: 서버 통화 정본
  }, [me?.nationality, me?.currency]);
  const cartCount = Array.from(cart.values()).reduce((a, b) => a + b, 0);
  const bumpCart = (itemId: number, delta: number) =>
    setCart((cur) => {
      const next = new Map(cur);
      const q = (next.get(itemId) ?? 0) + delta;
      if (q <= 0) next.delete(itemId);
      else next.set(itemId, q);
      return next;
    });
  const coachChecked = useRef(false);
  const [facing, setFacing] = useState<CameraType>('back');
  // P-131: 줌 — 핀치+프리셋 상호 동기 (0~1 상대값, cameraZoom 순수 로직)
  const [zoom, setZoom] = useState(0);
  const pinchBase = useRef(0);
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
  // P-161: 다시찍기 확인 — 실수 탭 1회에 결과·담은 항목 통째 유실 방지(항상 노출)
  const [retakeConfirm, setRetakeConfirm] = useState(false);
  // P-061①→P-062⓪ 보수: state 가드는 리렌더 전 연타를 못 막음(스테일 클로저) —
  // **ref 동기 가드**(진입 즉시 검사·세트)가 실차단, state는 시각적 disable 전용.
  const capturingRef = useRef(false);
  const [capturing, setCapturing] = useState(false);
  // P-038(KB-212): 빈 프로필 넛지 — 세션 억제 플래그를 마운트 시점에 읽는다
  const [nudgeHidden, setNudgeHidden] = useState(isNudgeDismissed());
  // P-131: 세로 유도 폐기 — 방향 감지는 UI 요소 제자리 회전(90° 스냅)에 재사용
  const uiDeg = uiRotationDeg(camOrientation);
  const uiRotate = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(`${uiDeg}deg`, { duration: 150 }) }] }));

  // KB-198: Android 전용 센서 방향 감지 — 앱은 세로 고정, 힌트만 반응.
  // 임계각+디바운스(같은 값 반복 setState는 React가 무시)로 45° 근처 떨림 방지.
  // ⚠️ expo-sensors는 **지연 require** — 최상단 import는 파일 로드 시점에 네이티브
  // 모듈(ExponentPedometer)을 즉시 불러와, 이 모듈이 없는 빌드(expo-sensors 추가
  // 전 빌드)에선 iOS에서도 앱 전체가 크래시한다. Android 가드 안에서 try-require해
  // iOS는 아예 안 건드리고, 네이티브 미탑재(재빌드 전)면 조용히 힌트만 비활성.
  // P-134: 첫 스캔 결과 진입 1회 코치마크 (AsyncStorage 플래그)
  useEffect(() => {
    if (phase !== 'result' || coachChecked.current) return;
    coachChecked.current = true;
    void shouldShowCoachMark().then((show) => {
      if (show) {
        setCoachOpen(true);
        markCoachSeen();
      }
    });
  }, [phase]);

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
    // P-144: 실패도 scan_complete로 — fail_reason은 CSV enum 3종(ocr|network|server)
    // 매핑: capture·empty(기기 단 실패) → ocr / network → network / be → server
    const reason = stage === 'network' ? 'network' : stage === 'be' ? 'server' : 'ocr';
    track(EVENTS.scan_complete, { success: false, fail_reason: reason, item_count: 0, degraded: false });
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
        // P-083: 스캔 완료 — 성공/정제실패(degraded) 구분 + 인식 항목 수
        track(EVENTS.scan_complete, { success: true, degraded: res.degraded, item_count: res.items.length });
        setItems(res.items);
        setPhotoOnly(res.photoOnly);
        setDegraded(res.degraded);
        setView('list'); // P-138⑤: 기본=List (예진 8/6 오너 결정 — P-071 대체)
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

    // P-153: v2(dev 계열) = 서버 비전 OCR — 온디바이스 ML Kit·세그먼트 스킵
    // (촬영→업로드→요청 단축). 결과는 전부 idx=null → photoOnly로 수확된다.
    if (scanV2Enabled()) {
      console.log('[scan] v2 — on-device OCR skipped (server vision)');
      runScan([], captured);
      return;
    }

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
    if (capturingRef.current) return; // P-062⓪: 동기 가드 — 리렌더 전 연타도 차단
    if (isGuest) return setGateOpen(true); // 스캔=회원 전용 (게이트)
    // P-131: 가로 촬영 허용 (KB-141 가드 폐기 — 캡슐 전환으로 겹침 사유 소멸)
    const cam = cameraRef.current;
    if (!cam) return;
    capturingRef.current = true;
    setCapturing(true);
    setError(null);
    track(EVENTS.scan_start, { source: 'camera' }); // P-144
    try {
      const pic = await cam.takePictureAsync({ quality: 0.7 });
      console.log('[scan] photo =', JSON.stringify({ uri: pic?.uri, w: pic?.width, h: pic?.height }));
      if (!pic?.uri) return fail('capture', 'takePictureAsync returned no uri');
      // KB-202: 업로드·표시·OCR 전부 크롭본 기준 — 미리보기 밖은 어디에도 안 간다
      const cropped = await cropToPreview({ uri: pic.uri, width: pic.width ?? 0, height: pic.height ?? 0 });
      await scanImage(cropped);
    } catch (e) {
      fail('capture', (e as Error)?.message ?? String(e));
    } finally {
      capturingRef.current = false;
      setCapturing(false); // 화면 전환(scanning) 후거나 실패 — 어느 쪽이든 셔터 복구
    }
  }

  async function pickFromGallery() {
    if (capturingRef.current) return; // P-062⓪: 셔터와 동일 동기 가드
    if (isGuest) return setGateOpen(true);
    capturingRef.current = true;
    setCapturing(true);
    setError(null);
    track(EVENTS.scan_start, { source: 'gallery' }); // P-144
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
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
  }

  /**
   * P-137: 시스템 카메라 경로 (FLAGS.systemCamera) — launchCameraAsync 촬영 후
   * 기존 처리(scanImage → OCR → 세그 → BE)로 그대로 합류. 취소 = 런처 복귀.
   * 권한 거부 = P-122 설정 딥링크 분기 재사용(프로필 pickBySource 관례 — Alert).
   * HEIC/EXIF는 P-127 uploadImage 길목이 커버(산출물도 같은 경로).
   */
  async function captureViaSystem() {
    if (capturingRef.current) return; // P-062⓪ 동기 가드 공유
    if (isGuest) return setGateOpen(true);
    capturingRef.current = true;
    setCapturing(true);
    setError(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('scan.permissionTitle'), t('scan.permissionSettingsBody'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('photo.openSettings'), onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
      track(EVENTS.scan_start, { source: 'camera' }); // P-144 (시스템 카메라도 camera)
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (res.canceled || !res.assets?.length) return; // 취소 → 런처 복귀(무동작)
      const a = res.assets[0];
      await scanImage({ uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 });
    } catch (e) {
      fail('capture', (e as Error)?.message ?? String(e));
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
  }

  // P-137 autolaunch 변형 — 탭 진입 즉시 시스템 카메라(1회), 취소 시 런처 표시
  const autoLaunched = useRef(false);
  useEffect(() => {
    if (!FLAGS.systemCamera || !SYSTEM_CAMERA_AUTOLAUNCH) return;
    if (phase !== 'camera' || autoLaunched.current || isGuest || offline) return;
    autoLaunched.current = true;
    void captureViaSystem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isGuest, offline]);

  // Detail navigation: matched dishes only (KB-72 신계약). matched=false is
  // 조사 대기 — there is no detail screen even when foodId exists (Swagger 명시).
  // KB-140: unmatched 탭 = 무반응 대신 "아직 등록 안 된 음식" 안내 (중립 톤, 상세 이동은 계속 불가).
  function openDish(dish: ResultDish) {
    track(EVENTS.scan_result_item_tap, { risk: dish.risk }); // P-144
    if (!dish.matched || !dish.foodId) return setUnmatchedOpen(true);
    // P-012(KB-179): 가격은 메뉴판 속성 — 스캔 진입에만 param으로 전달 (리스트
    // 행·오버레이 마커·사진 전용 항목 전부 이 함수를 지나므로 첨부 지점은 여기 하나)
    {
      const priceQ = scanPriceParam(dish.priceKrw);
      router.push(`/food/${dish.foodId}${priceQ}${priceQ ? '&' : '?'}src=scan` as Href);
    }
  }

  const GateSheet = <AuthGateSheet context="scan" open={gateOpen} onClose={() => setGateOpen(false)} />;

  const Close = (
    <Pressable style={[styles.close, { top: insets.top + 8 }]} onPress={() => router.back()} hitSlop={8}>
      <Animated.View style={uiRotate}>
        <IconClose size={22} color="#fff" />
      </Animated.View>
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
        similar: it.similar, // P-153 v2
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
      similar: p.similar, // P-153 v2: 미등록 유사 제안(링크 전용 — 판정 무관)
    }));
    const allDishes = [...resultDishes, ...photoDishes];
    // §14-5: unable sorted last, never hidden
    const listDishes = [...allDishes].sort((a, b) => (a.risk === 'unable' ? 1 : 0) - (b.risk === 'unable' ? 1 : 0));

    // P-038→P-057(KB-212 후속, A안): 빈 프로필 넛지 — 회원 && 기피 0 && 세션 내
    // 미닫음. 어두운 absolute 오버레이(배경에 묻힘·카드 밀착)를 폐기하고 결과
    // 리스트의 **첫 카드**로 편입(밝은 브랜드 틴트). 목록 뷰 전용 — 위험도/원본은
    // 사진 위라 부적합. 동작(탭→기피 설정, ×→세션 억제)·노출 조건 무변.
    const showNudge = !isGuest && !!me && me.restrictions.length === 0 && !nudgeHidden;

    // P-136: 주문 카드 진입 — 담기분을 param으로 (2단 확정: 카트 화면 없음)
    const goOrder = () => {
      const items = listDishes
        .filter((d) => (cart.get(d.itemId) ?? 0) > 0)
        .map((d) => ({ nameKo: d.koreanName ?? d.rawMenuName, name: d.displayName, qty: cart.get(d.itemId)!, priceKrw: d.priceKrw }));
      router.push(`/scan-order?items=${encodeURIComponent(JSON.stringify(items))}` as Href);
    };

    return (
      <View style={styles.resultRoot}>
        {/* P-136(S1): 콰이엇 헤더 — 백·타이틀+서브·세그(사진/리스트)·다시찍기
            (원본 감상 = 사진 뷰 롱프레스 피크 존치 — 원본 세그 소멸) */}
        <View style={[styles.quietHeader, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.qhBack} testID="result-back">
            <IconChevron size={18} color={C.ink2} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.qhTitle} numberOfLines={1}>{t('scan.cameraTitle')}</Text>
            <Text style={styles.qhSub}>{t('scan.resultsSub', { count: allDishes.length })}</Text>
          </View>
          <View style={styles.seg}>
            {(['risk', 'list'] as ResultView[]).map((v) => (
              <Pressable key={v} style={[styles.segBtn, view === v && styles.segBtnOn]} onPress={() => setView(v)} testID={`seg-${v}`}>
                <Text style={[styles.segText, view === v && styles.segTextOn]}>{t(v === 'risk' ? 'scan.segPhoto' : 'scan.segList')}</Text>
              </Pressable>
            ))}
          </View>
          {/* P-161: 즉시 리셋 → 확인 모달 선노출(결과 유실 경고) */}
          <Pressable hitSlop={8} onPress={() => setRetakeConfirm(true)} testID="retake">
            <IconRetry size={19} color={C.ink2} />
          </Pressable>
        </View>

        {view === 'list' ? (
          <>
          {/* P-160 B안: 프로필 체크 줄 — ScrollView 밖 상단 고정(스크롤 시 스티키, 목업대로) */}
          <ScanProfileBar
            avoidNames={(me?.restrictions ?? []).map((r) => ingCat.name(r.code))}
            t={t}
          />
          <ScrollView contentContainerStyle={{ paddingBottom: bottom + 120 }} showsVerticalScrollIndicator={false}>
            {showNudge && (
              <Animated.View entering={FadeInDown.springify().damping(spring.sheet.damping).stiffness(spring.sheet.stiffness)} style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                <Pressable style={styles.nudgeCard} onPress={() => router.push('/profile/restrictions' as Href)}>
                  <View style={styles.nudgeIc}>
                    <IconBulb size={18} color="#fff" />
                  </View>
                  <Text style={styles.nudgeCardText} numberOfLines={3}>
                    <Text style={styles.nudgeCardStrong}>{t('scan.nudgeAction')}</Text>
                    {t('scan.nudgeRest')}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => { dismissNudge(); setNudgeHidden(true); }}>
                    <IconClose size={14} color={C.ink3} />
                  </Pressable>
                </Pressable>
              </Animated.View>
            )}
            <ScanRichList
              dishes={listDishes}
              currency={currency}
              cart={cart}
              onAdd={(d) => bumpCart(d.itemId, 1)}
              onRemove={(d) => bumpCart(d.itemId, -1)}
              onOpen={openDish}
              onMarkPress={() => setCoachOpen(true)} // P-134 재열람 — 캡슐 철거 후 리스트 표면
              onOpenSimilar={(foodId) => router.push(`/food/${foodId}?src=scan` as Href)} // P-153: 유사 제안 → 상세
              t={t}
            />
          </ScrollView>
          </>
        ) : (
          /* P-149(예진 확정): Photo 뷰 = 쌩 원본 + 핀치 줌만 — 캡슐·미니시트·범례·힌트 철거 */
          <ScanResultOverlay photo={photo} />
        )}

        {degraded && <Text style={[styles.degradedNote, { position: 'absolute', bottom: bottom + 78, alignSelf: 'center' }]}>{t('scan.degradedNote')}</Text>}
        {/* P-136: 하단 주문 필 — 리스트·캡슐 뷰 공유(담김 카운트 동기) */}
        <OrderPill count={cartCount} onPress={goOrder} t={t} bottom={bottom + 16} />

        {GateSheet}
        <ScanCoachMark open={coachOpen} onClose={() => setCoachOpen(false)} t={t} />
        <UnmatchedNotice open={unmatchedOpen} onClose={() => setUnmatchedOpen(false)} t={t} />
        {/* P-161: 다시찍기 확인 — 커뮤니티 이탈 모달 문법(라운드 26 카드) 재사용 */}
        <Modal visible={retakeConfirm} transparent animationType="fade" onRequestClose={() => setRetakeConfirm(false)}>
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirmCard} testID="retake-confirm">
              <Text style={styles.confirmTitle}>{t('scan.retakeTitle')}</Text>
              <Text style={styles.confirmBody}>
                {cartCount > 0 ? t('scan.retakeBodyWithCart', { count: cartCount }) : t('scan.retakeBody')}
              </Text>
              <View style={{ gap: 9, marginTop: 6 }}>
                <Btn variant="ghost" onPress={() => setRetakeConfirm(false)}>
                  {t('profile.delete.cancel')}
                </Btn>
                {/* P-175: destructive도 보더 버튼 프레임 — 텍스트 행이 버튼처럼 안 보이던 지적 */}
                <Btn
                  variant="dangerGhost"
                  onPress={() => {
                    setRetakeConfirm(false);
                    setItems([]); setPhotoOnly([]); setDishes([]); setPhoto(null); setCart(new Map()); setPhase('camera');
                  }}
                  testID="retake-go"
                >
                  {t('scan.retakeConfirm')}
                </Btn>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ---- scanning ---- P-062②: D2 오버레이 — 사진 배경 + 코너 브래킷 + 스캔라인 스윕
  if (phase === 'scanning') {
    return (
      <View style={styles.root}>
        {photo && <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
        <ScanSweepOverlay />
        {Close}
        {GateSheet}
        <View style={[styles.scanCaption, { paddingBottom: bottom + 26 }]}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.statusText}>{t('scan.reading')}</Text>
        </View>
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
  // P-137: 시스템 카메라 on = 커스텀 뷰파인더 대신 콰이엇 런처 — 안내 한 줄 +
  // 촬영(주 CTA) + 갤러리(보조). 권한은 launchCameraAsync가 자체 처리.
  if (FLAGS.systemCamera) {
    return (
      <View style={styles.launcherRoot}>
        <Pressable style={[styles.close, { top: insets.top + 8, backgroundColor: C.surface2 }]} onPress={() => router.back()} hitSlop={8}>
          <IconClose size={22} color={C.ink2} />
        </Pressable>
        <View style={styles.launcherBody}>
          <IconScanLines size={44} color={C.ink3} />
          <Text style={styles.launcherTitle}>{t('scan.cameraTitle')}</Text>
          <Text style={styles.launcherHint}>{t('scan.launcherHint')}</Text>
          <View style={{ alignSelf: 'stretch', marginTop: 10 }} testID="sys-capture-wrap">
            <Btn onPress={() => void captureViaSystem()} disabled={capturing}>
              {t('photo.take')}
            </Btn>
          </View>
          <Pressable onPress={() => void pickFromGallery()} disabled={capturing} hitSlop={8} testID="sys-gallery">
            <Text style={styles.launcherGallery}>{t('scan.gallery')}</Text>
          </Pressable>
        </View>
        {GateSheet}
      </View>
    );
  }

  const granted = permission?.granted;
  return (
    <View style={styles.root}>
      {granted ? (
        /* P-131: 핀치 줌 — runOnJS(true)로 JS 스레드 콜백(워클릿 0, P-065 교훈 준수) */
        <GestureDetector
          gesture={Gesture.Pinch()
            .runOnJS(true)
            .onStart(() => {
              pinchBase.current = zoom;
            })
            .onUpdate((e) => {
              setZoom(pinchToZoom(pinchBase.current, e.scale));
            })}
        >
          <View style={StyleSheet.absoluteFill}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              onLayout={(e) => { previewSize.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }; }}
              facing={facing}
              zoom={zoom}
              responsiveOrientationWhenOrientationLocked
              onResponsiveOrientationChanged={(e) => setCamOrientation(e.orientation)}
            />
          </View>
        </GestureDetector>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.permission]}>
          <IconScanLines size={48} color="rgba(255,255,255,0.85)" />
          <Text style={styles.permTitle}>{t('scan.permissionTitle')}</Text>
          <Text style={styles.permBody}>{t(permDenied ? 'scan.permissionSettingsBody' : 'scan.permissionBody')}</Text>
          <View style={{ width: '100%', maxWidth: 280 }}>
            {/* P-122: 거부 이력 = 설정 열기(photo.openSettings 재사용) / 그 외 = 현행 요청 */}
            <Btn onPress={permDenied ? () => void Linking.openSettings() : requestPermission}>
              {t(permDenied ? 'photo.openSettings' : 'scan.grant')}
            </Btn>
          </View>
        </View>
      )}

      {/* P-131: 세로 유도 오버레이 소멸 — 가로 촬영 허용 (UI는 제자리 회전) */}

      {Close}
        {GateSheet}

      {/* P-136 D: 시안 S3 크롬 — 타이틀 줄 + 가로 배지(기능 무변, P-131 위 미세) */}
      <View style={[styles.camTitleWrap, { top: insets.top + 14 }]} pointerEvents="none">
        <Text style={styles.camTitle}>{t('scan.cameraTitle')}</Text>
        {uiDeg !== 0 && (
          <View style={styles.landscapeBadge} testID="landscape-badge">
            <Text style={styles.landscapeBadgeText}>{t('scan.landscapeBadge')}</Text>
          </View>
        )}
      </View>

      <View style={[styles.bottom, { paddingBottom: bottom + 20 }]}>
        {/* P-131: 배율 프리셋 1x/2x — 핀치와 상호 동기(근사 시 하이라이트) */}
        {granted && (
          <View style={styles.zoomRow}>
            {(['x1', 'x2'] as CamZoomPreset[]).map((pKey) => {
              const on = activePreset(zoom) === pKey;
              return (
                <Pressable key={pKey} style={[styles.zoomPill, on && styles.zoomPillOn]} onPress={() => setZoom(CAM_ZOOM_PRESETS[pKey])} hitSlop={6} testID={`zoom-${pKey}`}>
                  <Animated.View style={uiRotate}>
                    <Text style={[styles.zoomPillText, on && styles.zoomPillTextOn]}>{pKey === 'x1' ? '1x' : '2x'}</Text>
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>
        )}
        {/* P-136 D: 방향별 힌트 — 세로 = 줌·전체 담기 / 가로 = 와이드 메뉴판 */}
        <Text style={styles.hint}>{t(uiDeg === 0 ? 'scan.cameraHintPortrait' : 'scan.cameraHintLandscape')}</Text>
        <View style={styles.camRow}>
          <Pressable style={[styles.sideBtn, capturing && styles.shutterOff]} onPress={pickFromGallery} disabled={capturing} hitSlop={8} accessibilityLabel={t('scan.gallery')}>
            <Animated.View style={uiRotate}>
              <IconGallery size={22} color="#fff" />
            </Animated.View>
          </Pressable>
          {granted ? (
            <Pressable style={[styles.shutter, capturing && styles.shutterOff]} onPress={capture} disabled={capturing}>
              <View style={styles.shutterInner} />
            </Pressable>
          ) : (
            <View style={styles.shutterSpacer} />
          )}
          {granted ? (
            <Pressable style={styles.sideBtn} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} hitSlop={8} accessibilityLabel={t('scan.flip')}>
              <Animated.View style={uiRotate}>
                <IconFlip size={22} color="#fff" />
              </Animated.View>
            </Pressable>
          ) : (
            <View style={styles.sideBtn} />
          )}
        </View>
      </View>
    </View>
  );
}

/** P-062②: D2 스캐닝 오버레이 — 코너 브래킷 4 + 주황 스캔라인 스윕(글로우 트레일) */
function ScanSweepOverlay() {
  const [h, setH] = useState(0);
  const y = useSharedValue(0);
  useEffect(() => {
    if (!h) return;
    y.value = 0;
    y.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true); // P-064①: 왕복(핑퐁) — 리셋 점프 소멸
  }, [h, y]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * Math.max(0, h - 90) }] }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {/* 어둡게 한 겹 — 사진 위 브래킷/라인 대비 */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
      {/* 코너 브래킷 4 */}
      <View style={[styles.bracket, { top: 90, left: 26, borderTopWidth: 3, borderLeftWidth: 3 }]} />
      <View style={[styles.bracket, { top: 90, right: 26, borderTopWidth: 3, borderRightWidth: 3 }]} />
      <View style={[styles.bracket, { bottom: 150, left: 26, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
      <View style={[styles.bracket, { bottom: 150, right: 26, borderBottomWidth: 3, borderRightWidth: 3 }]} />
      {/* 스캔라인 + 글로우 트레일 */}
      {h > 0 && (
        <Animated.View style={[styles.sweepWrap, sweep]}>
          <LinearGradient colors={['rgba(226,88,12,0)', 'rgba(226,88,12,0.35)']} style={styles.sweepTrail} />
          <View style={styles.sweepLine} />
        </Animated.View>
      )}
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

function DishRow({ dish, unmatchedNote, riskLabel, onPress, onMarkPress }: { dish: ResultDish; unmatchedNote: string; riskLabel: string; onPress: () => void; onMarkPress?: () => void }) {
  const tone = riskTone[dish.risk];
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {/* P-134: 마크 탭 = 코치마크 재열람 (마크 데모 대체) */}
      <Pressable onPress={onMarkPress} hitSlop={8} testID="dishrow-mark">
        <RiskMark state={dish.risk} size={24} />
      </Pressable>
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
  // P-161: 확인 모달 — 커뮤니티 이탈 모달 문법(라운드 26 카드) 전사
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  confirmCard: { alignSelf: 'stretch', backgroundColor: C.card, borderRadius: 26, padding: 22, gap: 8, ...shadow.shPop },
  confirmTitle: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  confirmBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19, textAlign: 'center' },
  // P-136 콰이엇 결과 크롬 (scanflow 토큰 — 흰 배경·헤어라인·색은 마크/CTA만)
  resultRoot: { flex: 1, backgroundColor: '#fff' },
  quietHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair, backgroundColor: '#fff' },
  qhBack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  qhTitle: { fontFamily: font.bodyBold, fontSize: 15.5, color: C.ink },
  qhSub: { fontFamily: font.body, fontSize: 11.5, color: C.ink3, marginTop: 1 },
  seg: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 999, padding: 3 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  segBtnOn: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontFamily: font.bodyBold, fontSize: 12, color: C.ink3 },
  segTextOn: { color: C.ink },
  root: { flex: 1, backgroundColor: '#16110d' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  close: { position: 'absolute', left: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  permission: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 36 },
  permTitle: { fontFamily: font.display, fontSize: 20, color: '#fff', textAlign: 'center' },
  permBody: { fontFamily: font.body, fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, alignItems: 'center', gap: 14 },
  hint: { fontFamily: font.bodyBold, fontSize: 13, color: '#fff', textAlign: 'center' },
  camTitleWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 8 },
  launcherRoot: { flex: 1, backgroundColor: '#fff' },
  launcherBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 12 },
  launcherTitle: { fontFamily: font.bodyBold, fontSize: 21, color: C.ink },
  launcherHint: { fontFamily: font.body, fontSize: 13.5, lineHeight: 20, color: C.ink2, textAlign: 'center' },
  launcherGallery: { fontFamily: font.bodyBold, fontSize: 14, color: C.primaryText, paddingVertical: 8 },
  camTitle: { fontFamily: font.bodyBold, fontSize: 15, color: '#fff' },
  landscapeBadge: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  landscapeBadgeText: { fontFamily: font.bodyBold, fontSize: 11, color: '#fff' },
  camRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  zoomRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 10 },
  zoomPill: { minWidth: 40, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  zoomPillOn: { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: '#fff' },
  zoomPillText: { fontFamily: font.bodyBold, fontSize: 12.5, color: '#fff' },
  zoomPillTextOn: { color: '#1c1917' },
  sideBtn: { width: 46, height: 46, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterOff: { opacity: 0.35 },
  // P-038: 빈 프로필 넛지 — Close 버튼(좌 16, 폭 40) 우측에 정렬, 리스트 여백(60) 위 오버레이
  // P-057: 배너 = 리스트 첫 카드 — 밝은 브랜드 틴트, 메뉴 카드와 같은 radius 리듬
  nudgeCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fdf0e6', borderWidth: 1, borderColor: '#f0d9c4', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12 },
  nudgeIc: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  nudgeCardText: { flex: 1, fontFamily: font.body, fontSize: 12.5, color: C.ink2, lineHeight: 17 },
  nudgeCardStrong: { fontFamily: font.bodyBold, color: C.primaryText },
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
  // P-062② D2 스캐닝 오버레이
  scanCaption: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 10 },
  bracket: { position: 'absolute', width: 34, height: 34, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 2 },
  sweepWrap: { position: 'absolute', left: 14, right: 14, top: 0, height: 90 },
  sweepTrail: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 2 },
  sweepLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, borderRadius: 2, backgroundColor: '#E2580C', shadowColor: '#E2580C', shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  // P-064② 파파고식 플로팅 버튼 + 사진 하단 섀도
  resultShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 220 },
  listShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  // list rows
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12 },
  rowName: { fontFamily: font.koBold, fontSize: 15, color: C.ink },
  rowLatin: { fontFamily: font.body, fontSize: 12, color: C.ink2, marginTop: 1 },
  rowUnable: { fontFamily: font.body, fontSize: 11.5, color: C.riskUnable, marginTop: 1 },
  rowPrice: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  rowBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  rowBadgeText: { fontFamily: font.bodyBold, fontSize: 11.5 },
});

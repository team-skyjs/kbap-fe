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
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '@/lib/useBottomInset';
import { CameraView, useCameraPermissions, type CameraType, type CameraOrientation } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { color as C, font, riskTone } from '@/lib/theme';
import { Btn, RiskMark, QueryErrorBlock, classifyQueryError, IconBulb, IconClose, IconList, IconRetry, IconScanLines, IconGallery, IconFlip, IconChevron } from '@/components';
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
  // P-071(7/24 예진 확정): 기본 = 사진+마커(risk) — "찍었으니 사진이 보여야지".
  // KB-140의 리스트 기본(버튼 겹침 회피)은 파파고 개편(P-064~068)으로 근거 소멸.
  const [view, setView] = useState<ResultView>('risk');
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
  // P-061①→P-062⓪ 보수: state 가드는 리렌더 전 연타를 못 막음(스테일 클로저) —
  // **ref 동기 가드**(진입 즉시 검사·세트)가 실차단, state는 시각적 disable 전용.
  const capturingRef = useRef(false);
  const [capturing, setCapturing] = useState(false);
  // P-038(KB-212): 빈 프로필 넛지 — 세션 억제 플래그를 마운트 시점에 읽는다
  const [nudgeHidden, setNudgeHidden] = useState(isNudgeDismissed());
  // P-064③: 원본 피크 — 위험도 뷰에서 빈 영역 꾹 = 오버레이(마커·버튼) 페이드아웃
  const [peeking, setPeeking] = useState(false);
  const peekFade = useAnimatedStyle(() => ({ opacity: withTiming(peeking ? 0 : 1, { duration: 150 }) }));
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
        setView('risk'); // P-071: 기본=사진+마커 — "찍었으니 사진이 보여야지" (KB-140 리스트 기본 폐지)
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
    if (capturingRef.current) return; // P-062⓪: 동기 가드 — 리렌더 전 연타도 차단
    if (isGuest) return setGateOpen(true); // 스캔=회원 전용 (게이트)
    if (isLandscape) return; // KB-141: 어떤 진입 경로로도 가로 촬영 불가 (함수 단 가드)
    const cam = cameraRef.current;
    if (!cam) return;
    capturingRef.current = true;
    setCapturing(true);
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

    // P-038→P-057(KB-212 후속, A안): 빈 프로필 넛지 — 회원 && 기피 0 && 세션 내
    // 미닫음. 어두운 absolute 오버레이(배경에 묻힘·카드 밀착)를 폐기하고 결과
    // 리스트의 **첫 카드**로 편입(밝은 브랜드 틴트). 목록 뷰 전용 — 위험도/원본은
    // 사진 위라 부적합. 동작(탭→기피 설정, ×→세션 억제)·노출 조건 무변.
    const showNudge = !isGuest && !!me && me.restrictions.length === 0 && !nudgeHidden;

    return (
      <View style={styles.root}>
        {view === 'list' ? (
          /* P-068 A안: 바닥 여백 = 버튼 영역+여유 — 끝 스크롤 시 마지막 카드가 버튼 위로 완전 가시 */
          <ScrollView contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: bottom + 140, paddingHorizontal: 16, gap: 10 }}>
            {showNudge && (
              /* 배너도 스태거 대열의 첫 항목으로 (P-032와 간섭 없음 — delay 0) */
              <Animated.View entering={FadeInDown.springify().damping(spring.sheet.damping).stiffness(spring.sheet.stiffness)}>
                <Pressable style={styles.nudgeCard} onPress={() => router.push('/profile/restrictions' as Href)}>
                  <View style={styles.nudgeIc}>
                    <IconBulb size={18} color="#fff" />
                  </View>
                  <Text style={styles.nudgeCardText} numberOfLines={3}>
                    <Text style={styles.nudgeCardStrong}>{t('scan.nudgeAction')}</Text>
                    {t('scan.nudgeRest')}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      dismissNudge();
                      setNudgeHidden(true);
                    }}
                  >
                    <IconClose size={14} color={C.ink3} />
                  </Pressable>
                </Pressable>
              </Animated.View>
            )}
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
          <ScanResultOverlay photo={photo} dishes={resultDishes} showMarkers={view === 'risk'} onTapDish={openDish} peeking={peeking} onPeekChange={setPeeking} />
        )}
        {Close}
        {GateSheet}
        <UnmatchedNotice open={unmatchedOpen} onClose={() => setUnmatchedOpen(false)} t={t} />
        {/* P-064②: 파파고식 — 다크 시트·캡션·범례 삭제, 사진 풀블리드 위에
            원형 버튼 4개만 플로팅. 사진 뷰(위험도·원본)엔 가독용 하단 그라데이션. */}
        {/* P-066: 사진이 contain 레터박스일 땐 배경(#16110d)과 겹쳐 안 보이지만,
            사진·줌이 하단을 채우는 순간 버튼 가독을 보장하는 안전망 — 상시 렌더.
            피크(원본 감상) 중엔 버튼과 함께 페이드. */}
        {view !== 'list' && (
          <Animated.View style={[styles.resultShade, peekFade]} pointerEvents="none">
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
        {/* P-068 A안: 리스트 뷰 — 배경색 페이드로 버튼 뒤 카드가 자연스럽게 잠김 (배경 #16110d 동색) */}
        {view === 'list' && (
          <LinearGradient colors={['rgba(22,17,13,0)', 'rgba(22,17,13,0.96)']} style={styles.listShade} pointerEvents="none" />
        )}
        <Animated.View style={[styles.floatBar, { paddingBottom: bottom + 12 }, peekFade]} pointerEvents={peeking ? 'none' : 'auto'}>
          {degraded && <Text style={styles.degradedNote}>{t('scan.degradedNote')}</Text>}
          <View style={styles.d3Btns}>
            <D3Btn icon={<IconList size={22} color="#fff" />} label={t('scan.showList')} active={view === 'list'} onPress={() => setView('list')} />
            <D3Btn icon={<IconScanLines size={22} color="#fff" />} label={t('scan.showResult')} active={view === 'risk'} onPress={() => setView('risk')} />
            <D3Btn icon={<IconGallery size={22} color="#fff" />} label={t('scan.showOriginal')} active={view === 'original'} onPress={() => setView('original')} />
            <D3Btn
              icon={<IconRetry size={22} color="#fff" />}
              label={t('scan.retake')}
              onPress={() => { setItems([]); setPhotoOnly([]); setDishes([]); setPhoto(null); setPhase('camera'); }}
            />
          </View>
        </Animated.View>
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
          <Pressable style={[styles.sideBtn, capturing && styles.shutterOff]} onPress={pickFromGallery} disabled={capturing} hitSlop={8} accessibilityLabel={t('scan.gallery')}>
            <IconGallery size={22} color="#fff" />
          </Pressable>
          {granted ? (
            <Pressable style={[styles.shutter, (isLandscape || capturing) && styles.shutterOff]} onPress={capture} disabled={isLandscape || capturing}>
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
      </View>
    </View>
  );
}

/** P-062③: D3 원형 뷰 버튼 — 활성 = 주황 원(D3 Ask owner 스타일), 라벨 하단 */
function D3Btn({ icon, label, active, onPress }: { icon: React.ReactNode; label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.d3Btn} onPress={onPress}>
      <View style={[styles.d3Circle, active && styles.d3CircleOn]}>{icon}</View>
      <Text style={styles.d3BtnLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
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
  floatBar: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 8 },
  d3Btns: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-evenly', marginTop: 2 },
  d3Btn: { alignItems: 'center', gap: 6, width: 76 },
  d3Circle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  d3CircleOn: { backgroundColor: C.primary },
  d3BtnLabel: { fontFamily: font.bodyBold, fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  // list rows
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12 },
  rowName: { fontFamily: font.koBold, fontSize: 15, color: C.ink },
  rowLatin: { fontFamily: font.body, fontSize: 12, color: C.ink2, marginTop: 1 },
  rowUnable: { fontFamily: font.body, fontSize: 11.5, color: C.riskUnable, marginTop: 1 },
  rowPrice: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  rowBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  rowBadgeText: { fontFamily: font.bodyBold, fontSize: 11.5 },
});

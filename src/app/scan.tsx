import { armScanExitPrompt, fireScanExitPrompt } from '@/features/scan/ScanExitPrompts';
import { ScanModeTabs, type ScanMode } from '@/features/scan/ScanModeTabs';
import { CameraSlot, PackagedScanFlow, type ScanCamOpts } from '@/features/scan/PackagedScanFlow';
import { ScanLoading } from '@/features/scan/ScanLoading';
import { UnlockCelebration } from '@/features/scan/UnlockCelebration';
import { hasUnlockPending, hasObservedUnlockTransition, setUnlockScanFocused, subscribeUnlock } from '@/features/scan/unlockCelebrationStore';
import { currentGen } from '@/lib/auth/beTokens';
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
import { useCallback, useEffect, useRef, useState, useLayoutEffect, useSyncExternalStore, type ReactElement } from 'react';
import { ActivityIndicator, AppState, BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Alert, Modal } from '@/lib/engagement/occlusionSurfaces';
import { launchCameraAsync, launchImageLibraryAsync } from '@/lib/engagement/occlusionPickers';
import { Pressable } from '@/components/Pressable';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { Txt as Text } from '@/components/Txt';
import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/build/react-navigation/core';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '@/lib/useBottomInset';
import { EVENTS, track } from '@/lib/analytics';
import { airbridge } from '@/lib/airbridge';
import { UnlockActions, useCanWatchAd } from '@/features/ads/RewardedUnlock';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { CameraView, useCameraPermissions, type CameraType, type CameraOrientation } from 'expo-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { activePreset, CAM_ZOOM_PRESETS, pinchToZoom, uiRotationDeg, type CamZoomPreset } from '@/features/scan/cameraZoom';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { color as C, font, primaryTint, riskText, riskTone, shadow } from '@/lib/theme';
import { Btn, RiskMark, QueryErrorBlock, classifyQueryError, IconBulb, IconCheck, IconChevronDown, IconClose, IconScanLines, IconChevron, IconSparkles, IconTabScan, IconArrowLeft } from '@/components';
import { IconChoosePhoto, IconRefreshCcw } from '@/components/icons';
import { FramingCorners } from '@/features/scan/FramingCorners';
import { TopToastHost } from '@/components/TopToast';
import { ActionSheet } from '@/components/ActionSheet';
import { useLeaveConfirm } from '@/components/LeaveConfirmModal';
import { issueScanTicket, scanV2Enabled, useScan } from '@/lib/data/useScan';
import { useInfiniteFoods } from '@/lib/data/useFoods';
import type { PhotoOnlyItem, ScanOverlayItem } from '@/lib/api/scanAdapter';
import { recognizeMenuLines } from '@/lib/scan/ocr';
import { segmentMenu, formatKrw, orderNameKo, scanPriceParam, type MenuDish, type ResultDish } from '@/lib/scan/segmentMenu';
// P-219→P-220: 실패 분류·계측 사유 매핑은 순수 모듈 한 곳(전수 유닛 대상)
import { ERROR_MSG, failReasonForStage, stageForCode, type ErrorStage } from '@/lib/scan/scanErrors';
import { sortResultDishes, type ResultSortMode } from '@/lib/scan/resultSort';

// P-354(KB-516): 정렬 라벨 — 메뉴판 순 → 가격 높은순 → 가격 낮은순(시트 순서 동일)
import { recordScanSuccess } from '@/lib/reviewPrompt';
import { useOneShotQueue } from '@/lib/oneShotQueue';
const SORT_LABEL_KEY: Record<ResultSortMode, string> = {
  menu: 'scan.sortMenu',
  priceDesc: 'scan.sortPriceDesc',
  priceAsc: 'scan.sortPriceAsc',
};
import { orientationFromGravity } from '@/lib/scan/deviceOrientation';
import { wysiwygCropRect } from '@/lib/scan/coverCrop';
import { dismissNudge, isNudgeDismissed } from '@/lib/scan/nudgeSession';
import { personalRisk } from '@/lib/risk';
import { spring } from '@/lib/motion';
import { useMe } from '@/lib/data/useMe';
import { isScanQuotaExhausted } from '@/lib/api/memberAdapter';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { ScanResultOverlay } from '@/features/scan/ScanResultOverlay';
import { markCoachSeen, ScanCoachMark, shouldShowCoachMark } from '@/features/scan/ScanCoachMark';
import { OrderPill, ScanRichList } from '@/features/scan/ScanRichList';
import { D4CameraRestart } from '@/components/design4Assets';
import { EmptyBlock, ScreenCenterFill } from '@/components/StateBlock';
import { TagPickerSheet } from '@/app/community/compose';
import { resolveCurrency } from '@/lib/exchange';
import { ingredientLabel } from '@/lib/mocks/ingredients';
import { useIngredientCatalog } from '@/lib/data/useIngredientCatalog';
import { FLAGS, SYSTEM_CAMERA_AUTOLAUNCH } from '@/lib/flags';
import { openAppSettings } from '@/lib/openExternal';

type Photo = { uri: string; width: number; height: number } | null;
type Phase = 'camera' | 'scanning' | 'result' | 'error';
type ResultView = 'risk' | 'list';
/** ⑦(KB-137) 촬영/갤러리 캐시 파일 삭제 — 실패해도 스캔 흐름엔 무해(로그만). */
function deletePhotoFile(uri: string | null | undefined): void {
  if (!uri || !uri.startsWith('file:')) return; // 웹 blob/샘플(null)은 대상 아님
  FileSystem.deleteAsync(uri, { idempotent: true })
    .then(() => console.log('[scan] cleaned photo file:', uri))
    .catch((e) => console.log('[scan] photo cleanup failed:', (e as Error)?.message ?? e));
}

// KB-777 B1-4: 바탕이 어두운(#16110d) 단계 — 상태바 아이콘 light
const DARK_ROOT_PHASES = new Set<string>(['error']); // KB-845: scanning = 흰 로딩 C(어두운 상태바 글자) — 어두운 바탕 단계에서 뺀다
// KB-854 카메라 v2 B — 위 바 = 상태바 아래 108(헤더 + 탭 40 + 8) · 아래 바 내용 = 22 + 칩 36 + 24 + 컨트롤 88 + 10 + 링크 21
export const CAM_TOP_BAR = 108;
export const CAM_BAR_CONTENT = 201;
/** 아래 단색 바 높이 = 내용 201 + 하단 여백. KB-900(T-004): 시안의 −11은 iOS 홈 인디케이터(얇은 선) 위로 링크가 11 걸쳐도 되는 값 —
 *  안드 3버튼 내비 바는 불투명 버튼이라 링크가 덮여 ~26px만 눌렸다. 안드는 인셋 전부를 비운다(useBottomInset이 48 하한) */
export const camBarHeight = (bottom: number, os: string = Platform.OS) => CAM_BAR_CONTENT + (os === 'android' ? bottom : Math.max(bottom - 11, 8));

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
  // P-214: 권한 게이트 노출 1회 — 스캔 퍼널 최상단 이탈 분모(요청·거절·설정열기는 버튼에서)
  const permViewed = useRef(false);
  useEffect(() => {
    if (permission == null || permission.granted || permViewed.current) return;
    permViewed.current = true;
    track(EVENTS.scan_permission, { state: 'view' });
  }, [permission]);
  const scan = useScan();
  const { data: me } = useMe();
  const ingCat = useIngredientCatalog(); // P-174: 요약 칩 서버 번역명 우선
  const hasR = (me?.restrictions.length ?? 0) > 0;

  const [phase, setPhase] = useState<Phase>('camera');
  const importingRef = useRef(false);
  const [importing, setImporting] = useState(false);
  // 앱 라우트 이탈만 막는다. 별도 네이티브 사진 선택기의 취소는 그대로 허용한다.
  usePreventRemove(importing, () => {});
  useEffect(() => {
    if (!importing) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => importingRef.current);
    return () => sub.remove();
  }, [importing]);
  const closeCamera = () => { if (!importingRef.current) router.back(); };
  // KB-813: 촬영 모드 — 메뉴판(기본·현행 흐름 그대로) / 음식 사진(자리만) / 가공식품(PackagedScanFlow)
  // P-508: 가공식품 상세 "성분표 직접 확인" = /scan?mode=packaged&label=1 — 가공식품 모드 + 성분표 안내부터(새 분석)
  const scanParams = useLocalSearchParams<{ mode?: string; label?: string; t?: string }>();
  const [scanMode, setScanModeState] = useState<ScanMode>(() => (scanParams.mode === 'packaged' && FLAGS.packagedLabelScan ? 'packaged' : 'menu'));
  // KB-877: 잠금 콜백(메모)이 읽는 현재 모드 — phaseRef와 같은 동기화
  const scanModeRef = useRef(scanMode);
  useLayoutEffect(() => { scanModeRef.current = scanMode; });
  // Codex #315 R2: 성분표 진입 토큰 — 이미 열린 /scan으로 돌아와도(navigate 재사용) 토큰이 바뀌면 가공식품 모드 + **새 플로우**(key)로 새 분석부터.
  // 렌더 중 이전값 비교(KB-603 — 값 키 effect는 A→B→A를 놓친다)
  const labelEntry = scanParams.label === '1' && FLAGS.packagedLabelScan ? (scanParams.t ?? 'entry') : null;
  const [seenLabelEntry, setSeenLabelEntry] = useState(labelEntry);
  if (labelEntry !== seenLabelEntry) {
    setSeenLabelEntry(labelEntry);
    if (labelEntry) setScanModeState('packaged');
  }
  // KB-865 ③(시안 21): 가공식품 확정이 한도(SCAN-004)에 걸림 = 기존 소진 화면을 **가공식품 흐름 위에** 띄운다 — 흐름(후보·선택)은 마운트 유지,
  // 해제·나중에 = 같은 후보로 복귀(진입 플로우 문서). 잡고 있는 동안 프로필 잠금이 흐름을 갈아치우지 않게 ref로 막는다
  const [packagedHold, setPackagedHold] = useState(false);
  const packagedHoldRef = useRef(false);
  const setScanMode = (m: ScanMode) => {
    if (importingRef.current) return;
    if (m === scanMode) return;
    track(EVENTS.scan_mode_select, { mode: m });
    // Codex #339: 소진 덮개(packagedHold)는 가공식품 흐름에만 — 떠나면 해제(남으면 메뉴의 프로필 잠금·"나중에"가 가공식품 규칙을 탄다).
    // 가공식품에 머무는 동안은 유지 — "나중에" 뒤 프로필 잠금이 방금 돌아간 흐름을 다시 덮지 않게
    if (scanMode === 'packaged') { packagedHoldRef.current = false; setPackagedHold(false); }
    setScanModeState(m);
  };
  const modalQueue = useOneShotQueue(); // P-267 직렬화의 일반화 — KB-908: 결과 화면엔 코치마크만(알림 넛지·리뷰 유도는 스캔을 닫은 뒤 ScanExitPrompts)
  const coachDoneRef = useRef<(() => void) | null>(null);
  const settle = (ref: React.MutableRefObject<(() => void) | null>) => { const f = ref.current; ref.current = null; f?.(); };
  const scanRecordedRef = useRef<Promise<unknown>>(Promise.resolve()); // 성공 카운트 저장 완료 → 나갈 때 리뷰 유도 판정 순서 보장
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
  // P-242: v2 서버 실환율(null = 조회 실패 — 배지 생략 규약·undefined = v1 테이블)
  const [fx, setFx] = useState<import('@/lib/exchange').ServerFx | undefined>(undefined);
  // P-252: 스캔 이미지 경로 — 주문 이력 식별자로 주문 카드에 동승('' = 업로드 실패)
  const [scanPath, setScanPath] = useState('');
  // P-138⑤(예진 8/6, 오너 결정 — 구 P-071 "사진 뷰 기본" 대체): 스캔 직후
  // 기본 = List(리치 리스트가 탐색·주문의 주 뷰). Photo는 세그 전환.
  const [view, setView] = useState<ResultView>('list');
  // P-226 ②③ → KB-432 §1-1: 소팅 = 정렬 드롭다운(ActionSheet) — 옵션 2종 무변
  const [sortMode, setSortMode] = useState<ResultSortMode>('menu');
  const [sortSheet, setSortSheet] = useState(false);
  const [safeOnly, setSafeOnly] = useState(false); // P-354(KB-516): ON = risk==='safe'만(불확실 포함 전부 숨김)
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
  const pinchBase = useSharedValue(0);
  const importingGestureLock = useSharedValue(false);
  const onPinchStart = useCallback(() => { if (importingGestureLock.get()) return; pinchBase.set(zoom); }, [importingGestureLock, pinchBase, zoom]);
  const onPinchUpdate = useCallback((event: { scale: number }) => { if (importingGestureLock.get()) return; setZoom(pinchToZoom(pinchBase.get(), event.scale)); }, [importingGestureLock, pinchBase]);
  const [error, setError] = useState<{ stage: ErrorStage; detail: string } | null>(null);
  // P-250: SCAN-004(무료 소진) — "리뷰 작성하기" = 리뷰 픽커(P-245 자격 UX) 직결
  const [quotaPicker, setQuotaPicker] = useState(false);
  // P-255: 진입 시 티켓 선발급 — 소진(SCAN-004)이면 사진 고르기 전에 즉시 잠금
  // (게스트 가드가 상위 — 아래 preflight는 회원·v2만). 티켓은 화면 스코프 1회용.
  const preTicket = useRef<string | null>(null);
  const ticketEpoch = useRef(0);
  const isGuest = useIsGuest();
  // KB-426(예진 실기 b21): 진입 즉시 OS 권한 팝업 — 안내 화면은 거부 후 폴백으로
  // 강등. 세션당 1회(ref) — OS도 프롬프트를 1회만 주므로(canAskAgain) 중복 무해하나
  // 계측 오염 방지. 거부 이력(canAskAgain=false)은 설정 CTA 경로 그대로.
  // Codex #21 P1: 게스트는 로그인 시트로 막히는 경로 — 맥락 없는 OS 팝업 금지
  // (기존 isGuest 게이트 재사용). 로그인으로 자격이 바뀌면 그때 1회(ref 가드).
  const autoPrompted = useRef(false);
  useEffect(() => {
    if (autoPrompted.current || isGuest || permission == null || permission.granted || !permission.canAskAgain) return;
    autoPrompted.current = true;
    track(EVENTS.scan_permission, { state: 'auto_prompt' });
    void requestPermission().then((r) => track(EVENTS.scan_permission, { state: r?.granted ? 'grant' : 'deny' }));
  }, [isGuest, permission, requestPermission]);
  // P-255: 최선 노력 사전 확인 — 004만 즉시 잠금(fail() 미경유 = scan_complete 계측
  // 오염 0 — 스캔 시도가 아니다), 그 외 실패는 무시(최종 판정 = 스캔 단계 분기·시나리오 E).
  const quotaLockRef = useRef(false); // 선발급 잠금 판별 — 타 에러 화면 오복원 방지
  // P-384(KB-442): 프로필 쿼터(서버 정본)가 이미 소진이면 티켓 응답을 기다리지 않고 즉시 안내.
  // 티켓 요청은 그대로 보낸다 — 403 SCAN-004 경로 유지 + 프로필이 낡았으면(리뷰로 해금)
  // 발급 성공이 아래 복원 분기로 카메라를 되돌린다.
  // 발급 성공으로 반증된 쿼터 객체는 재조회로 바뀌기 전까지 다시 잠그지 않는다(복귀마다 깜빡임 방지).
  const quotaRef = useRef(me?.scanQuota);
  // KB-657: 최신값 ref는 렌더 중이 아니라 커밋(layout effect)에서 동기화 — 리더는 전부 이벤트·리스너·passive effect(layout 뒤)
  useLayoutEffect(() => {
    quotaRef.current = me?.scanQuota;
  });
  const disprovenQuota = useRef<unknown>(undefined);
  // KB-759 방어 2: 광고 해제 경로의 티켓 재발급 상태 — 'opening'(요청 중) · 'failed'(실패 → 다시 시도 버튼). 조용히 삼키지 않는다.
  // /review 2: 상태는 **그 상태를 띄운 쿼터 에러 객체**에 묶는다 — 화면이 카메라로 가거나 다른 에러(fail·새 쿼터 잠금)로 바뀌면
  // 객체가 달라져 자동으로 'idle'(리셋 호출을 경로마다 흩뿌리지 않는다). 겹친 preflight의 늦은 실패도 지난 객체에 묶여 안 보인다.
  const [unlock, setUnlock] = useState<{ kind: 'ready' | 'opening' | 'failed'; forError: object } | null>(null);
  const unlockState: 'idle' | 'ready' | 'opening' | 'failed' = unlock && error && unlock.forError === error ? unlock.kind : 'idle';
  const errorRef = useRef(error);
  useLayoutEffect(() => {
    errorRef.current = error;
  });
  const { busy: unlockRetrying, run: runUnlockRetry } = useSubmitGuard(); // /review 3: 재시도 = 공용 제출 가드(CLAUDE.md)
  const canWatchAd = useCanWatchAd(); // /review 4: 광고 버튼이 실제로 있을 때만 "광고 보기"를 약속하는 문구
  // Codex #159 P1: 쿼터 잠금은 촬영 전(카메라)·에러 화면에만 — 완료된 스캔 결과·진행 중 스캔을
  // 복귀 포커스로 덮지 않는다(상세 → 뒤로가기). 서버 티켓 확인은 그대로 보낸다.
  const phaseRef = useRef(phase);
  useLayoutEffect(() => {
    phaseRef.current = phase;
  });
  const canLockQuota = () => phaseRef.current === 'camera' || phaseRef.current === 'error';
  const lockFromProfile = useCallback(() => {
    const quota = quotaRef.current;
    // KB-877: 가공식품 모드 = 미리 잠그지 않는다 — 서버 1시간 무료 창이면 남은 0이어도 통과하므로 확정·성분표 응답(SCAN-004 → 덮개)이 정한다
    if (!canLockQuota() || !isScanQuotaExhausted(quota) || quota === disprovenQuota.current || quotaLockRef.current || packagedHoldRef.current || scanModeRef.current === 'packaged') return;
    quotaLockRef.current = true;
    setError({ stage: 'quota', detail: 'profile scanRemaining 0' });
    setPhase('error');
  }, []);
  // Codex #159 P2: 포커스 유지 중 재조회로 소진이 도착해도(3번째 스캔 성공 → 다시 찍기) 촬영 전에 안내.
  // 카메라 단계에서만 — 스캔 중·결과 화면은 끊지 않는다.
  useEffect(() => {
    if (phase === 'camera' && !isGuest && scanV2Enabled()) lockFromProfile();
  }, [phase, me?.scanQuota, isGuest, lockFromProfile, scanMode]); // KB-877: 가공식품 → 메뉴 전환 때 다시 판정
  // KB-759(QA 로그 판독): 해제 응답 뒤 preflight가 쥔 quota는 프로필 재조회 전의 **옛 스냅샷**(소진)일 수 있고, 복원이 티켓 200에만
  // 기대고 있었다(실패는 catch가 조용히 삼킴 → 제한 화면에 광고 버튼만 사라진 채 잔류). `unlocked` = 서버가 scanUnlocked:true를 돌려준 직후:
  // ① 옛 스냅샷은 반증 처리(재잠금 0) — 서버가 정본 ② 티켓 성공이면 잠금 ref와 무관하게 카메라 ③ 티켓 실패(비-004 포함)는 '다시 시도' 상태로 노출.
  const preflight = useCallback(async (opts?: { unlocked?: boolean }) => {
    if (!scanV2Enabled()) return;
    const generation = currentGen();
    // Codex #291 R12 P2: each invocation is its own epoch — a newer preflight (e.g. the unlock retry) supersedes an older
    // in-flight one, so a late SCAN-004 from the focus preflight cannot relock after the unlock reopened the camera.
    const epoch = ++ticketEpoch.current;
    const quota = quotaRef.current;
    const unlocked = opts?.unlocked === true;
    const forError = errorRef.current; // 해제 경로 = 지금 떠 있는 쿼터 에러에 묶는다
    const prevDisproven = disprovenQuota.current;
    if (unlocked) {
      disprovenQuota.current = quota;
      if (forError) setUnlock({ kind: 'opening', forError });
    } else {
      lockFromProfile();
    }
    // KB-759 진단(개발 번들만): 잠금 상태·티켓 결과를 Metro 로그로
    if (__DEV__) console.log('[scan] preflight', JSON.stringify({ phase: phaseRef.current, lock: quotaLockRef.current, unlocked, quota }));
    try {
      const ticket = await issueScanTicket();
      if (generation !== currentGen() || epoch !== ticketEpoch.current) return;
      preTicket.current = ticket;
      if (__DEV__) console.log('[scan] preflight ticket ok', JSON.stringify({ lock: quotaLockRef.current, phase: phaseRef.current, unlocked }));
      if (isScanQuotaExhausted(quota)) disprovenQuota.current = quota;
      if (unlocked && errorRef.current !== forError) return; // 그새 화면이 바뀌었다(늦은 응답) — 덮지 않는다
      if (quotaLockRef.current || unlocked) {
        // 리뷰 작성 후 복귀(시나리오 C)·광고 해제 — 해금 반영해 카메라 복원
        quotaLockRef.current = false;
        setUnlock(null);
        setError(null);
        setPhase('camera');
      }
    } catch (e) {
      if (generation !== currentGen() || epoch !== ticketEpoch.current) return;
      const code = (e as { code?: string })?.code;
      if (__DEV__) console.log('[scan] preflight ticket err', String(code ?? e), JSON.stringify({ unlocked }));
      if (unlocked && code !== 'SCAN-004') {
        // 해제는 됐는데 카메라를 못 열었다(네트워크 등) — 제한 화면을 "해제됨 · 다시 시도"로. 늦은 실패는 지난 에러 객체에 묶여 안 보인다
        if (forError) setUnlock({ kind: 'failed', forError });
        return;
      }
      if (unlocked) {
        // /review 1: 해제 응답을 받았는데 티켓은 아직 004(서버 해제가 티켓 경로에 안 보임) — 'failed'로 묶지 않고 기존 004 처리로:
        // 반증 되돌림(프로필 잠금 정상화 — 무한 403 재시도 방지) + 해제 상태 해제 → 제한 화면·리뷰/광고 CTA 복원
        disprovenQuota.current = prevDisproven;
        setUnlock(null);
      }
      if (code === 'SCAN-004') {
        preTicket.current = null;
        if (!canLockQuota() || scanModeRef.current === 'packaged') return; // KB-877: 가공식품은 서버 응답이 정한다(메뉴로 돌아가면 프로필 잠금이 다시 판정)
        quotaLockRef.current = true;
        setError({ stage: 'quota', detail: 'preflight SCAN-004' });
        setPhase('error'); // 카메라 미표시 — 즉시 쿼터 잠금(P-250 quota UI 재사용)
      } else if (code === 'MEMBER-003') {
        // KB-441 → KB-670: 서버가 모르는 회원(탈퇴·정지 — 서버 KB-669로 전 회원 API 확대)의 남은 토큰.
        // 세션 무효화는 client 훅(beAuth)이 하고, 세션이 만료되면 isGuest가 바뀌어 아래 라우트 가드가 게스트
        // 게이트를 그린다. 여기서 에러 화면(로컬 state)을 세우면 게스트 전환 뒤에도 남아 재로그인 시 카메라
        // 대신 보였다 — 세우지 않는다. 티켓만 버린다(fail 미경유 = scan_complete 계측 오염 0, P-255 원칙).
        preTicket.current = null;
      }
    }
  }, [lockFromProfile]);
  useFocusEffect(
    useCallback(() => {
      if (isGuest) return; // 게스트 가드 상위(순서 유지) — 티켓 로직 미진입
      // 진입·복귀 시: 카메라 대기 중이거나 쿼터 잠금이면 선발급(잠금은 해금 확인 겸)
      if (!hasUnlockPending()) void preflight();
      setUnlockScanFocused(true);
      return () => { ticketEpoch.current++; setUnlockScanFocused(false); };
    }, [isGuest, preflight]),
  );
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
  const [closestMatch, setClosestMatch] = useState<ResultDish | null>(null); // KB-789 대체 항목 설명 카드(열린 행)
  // P-161: 다시찍기 확인 — 실수 탭 1회에 결과·담은 항목 통째 유실 방지(항상 노출)
  const [retakeConfirm, setRetakeConfirm] = useState(false);
  // KB-769: 담은 항목이 있는 결과에서 떠나는 모든 길(헤더 ‹·Android 하드웨어 back·iOS 스와이프)을 다시찍기와 같은 확인 창으로.
  // 포커스일 때만 — 주문 카드(scan-order)의 완료 = dismissAll이 아래에 깔린 이 화면을 지울 때 확인 창이 뜨면 안 된다.
  const isFocused = useIsFocused();
  const unlockPending = useSyncExternalStore(subscribeUnlock, hasUnlockPending, hasUnlockPending);
  const leave = useLeaveConfirm(isFocused && phase === 'result' && cartCount > 0);
  // KB-769: 미등록 안내는 Modal이 아닌 오버레이라 하드웨어 back이 화면째 닫았다 — 열려 있으면 back = 안내만 닫기
  // KB-789: 대체 항목 설명 카드도 같은 오버레이 문법 — back = 카드만 닫기
  const noticeOpen = unmatchedOpen || closestMatch !== null;
  useEffect(() => {
    if (!noticeOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setUnmatchedOpen(false);
      setClosestMatch(null);
      return true;
    });
    return () => sub.remove();
  }, [noticeOpen]);
  // P-061①→P-062⓪ 보수: state 가드는 리렌더 전 연타를 못 막음(스테일 클로저) —
  // **ref 동기 가드**(진입 즉시 검사·세트)가 실차단, state는 시각적 disable 전용.
  const capturingRef = useRef(false);
  const [capturing, setCapturing] = useState(false);
  // P-191: 픽커 닫힘~원본 준비 사이 무표시 구간(예진 실기 — "멈췄나?") — 스피너 오버레이.
  // "Reading the menu..."(scanning 페이즈)와 구분되는 선행 단계 표시.
  const ImportingOverlay = importing ? (
    <View style={styles.importingOverlay} pointerEvents="auto" accessible accessibilityRole="progressbar" accessibilityLabel={t('scan.loadingPhoto')} accessibilityState={{ busy: true }} testID="importing-overlay">
      <View style={styles.importingStatus} testID="importing-status">
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.statusText}>{t('scan.loadingPhoto')}</Text>
      </View>
    </View>
  ) : null;
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
  // P-134: 첫 스캔 결과 진입 1회 코치마크 (AsyncStorage 플래그).
  // P-267(KB-377): 일회성 모달 직렬화 — 결과 도달마다 **한 흐름에서 순차 판정**.
  // 코치마크 우선, 뜨면 프라이머는 보류(코치 onClose에서 재평가). 코치마크가 없으면
  // (이번에 안 뜸·기존자 재도달) 프라이머 단독 판정 = 현행 시맨틱 무변.
  // KB-908(T-010): 결과 도달 = 코치마크(1회)만 큐에. 알림 넛지·리뷰 유도는 나갈 때 하나만(ScanExitPrompts — 판정·빈도 규칙 무변)
  useEffect(() => {
    if (phase !== 'result') { modalQueue.clear(); return; }
    armScanExitPrompt({ isGuest, ready: scanRecordedRef.current });
    modalQueue.add({
      key: 'coach-mark',
      present: async (done) => {
        if (coachChecked.current) return false;
        coachChecked.current = true;
        if (!(await shouldShowCoachMark())) return false;
        coachDoneRef.current = done;
        setCoachOpen(true);
        markCoachSeen();
        return true;
      },
    });
  }, [phase, modalQueue, isGuest]);
  useEffect(() => () => fireScanExitPrompt(), []); // 스캔 화면 닫힘 = 결과가 있었으면 하나 띄우기

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
    // P-144 → P-220: fail_reason = CSV enum **5종**(not_menu·ocr·upload·network·server).
    // 매핑 전수는 scanErrors.failReasonForStage 한 곳 — 차트 축이라 유닛으로 잠근다.
    const reason = failReasonForStage(stage);
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
    // P-219: v2 필수 쿼리 — 프로필 통화 → 국적 → 로케일 → USD 폴백(resolveCurrency)
    const ticket = preTicket.current; // P-255: 선발급분 재사용(1회용 — 소모)
    preTicket.current = null;
    scan.mutate({ items: scanned, photo: capturedPhoto, currency, ticket }, {
      onSuccess: (res) => {
        // P-083: 스캔 완료 — 성공/정제실패(degraded) 구분 + 인식 항목 수
        // P-234: v2는 결과 전부가 photoOnly 경로(res.items 항상 [])라 items.length만
        // 세면 107개 스캔이 0으로 발화(8/18 실측) — 전체 결과 수(매칭+미매칭)로 교정.
        // v1은 items가 본 경로라 현행 합산식으로도 동일(photoOnly는 idx=null 보충분).
        track(EVENTS.scan_complete, { success: true, degraded: res.degraded, item_count: res.items.length + res.photoOnly.length });
        // KB-783 ⑥: 스캔 1회 소모(쿼터 = 스캔 전 서버 스냅샷 그대로 전달) + 결과 목록(인식 메뉴 수)
        airbridge.scanSpend(quotaRef.current);
        airbridge.scanResults(res.items.length + res.photoOnly.length);
        setItems(res.items);
        setPhotoOnly(res.photoOnly);
        setDegraded(res.degraded);
        setFx(res.fx); // P-242: v2 실환율 관통(스캔 1회 = 환율 1스냅샷)
        setScanPath(res.imagePath ?? ''); // P-252: 주문 이력 식별자
        setView('list'); // P-138⑤: 기본=List (예진 8/6 오너 결정 — P-071 대체)
        // KB-730: 기기 로컬 스캔 성공 카운트(판정은 큐의 리뷰 스텝이 상태로 — 2회 이상 + 스캔 경로 미노출). 실패·에러 경로는 여기를 안 지난다
        scanRecordedRef.current = recordScanSuccess().catch(() => {});
        setPhase('result');
      },
      onError: (e) => {
        const msg = (e as Error)?.message ?? String(e);
        // P-219: 래퍼 code로 분기(HTTP 상태 아님) — 미지 코드는 기존 'be'
        fail(stageForCode((e as { code?: string })?.code, msg), msg);
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
  async function cropToPreview(pic: NonNullable<Photo>, exifOrientation?: number): Promise<NonNullable<Photo>> {
    const view = previewSize.current;
    // P-338 → Codex #99 P1: 방향 = **사진 자체**(EXIF 적용 유효 치수 W>H = 가로) —
    // 중력(camOrientation) 판정은 평평히 놓은 촬영(z축)에서 틀린다. camOrientation은
    // UI 회전 전용. rect는 보고 치수 좌표계 안(wysiwygCropRect ② 계약).
    const rect = view ? wysiwygCropRect(view.width, view.height, pic.width, pic.height, exifOrientation) : null;
    if (!rect) return pic;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
      const rendered = await ImageManipulator.manipulate(pic.uri).crop(rect).renderAsync();
      const saved = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      console.log('[scan] WYSIWYG crop', JSON.stringify({ gravity: camOrientation, exifOrientation, from: { w: pic.width, h: pic.height }, rect })); // P-338: 방향·치수 실측 로그(gravity = 진단용)
      deletePhotoFile(pic.uri); // 원본(과다 캡처)은 즉시 삭제 — 이후 수명은 크롭본 몫 (⑦ KB-137)
      return { uri: saved.uri, width: saved.width ?? rect.width, height: saved.height ?? rect.height };
    } catch (e) {
      console.log('[scan] expo-image-manipulator 미탑재/실패 — 크롭 생략(재빌드 필요):', (e as Error)?.message ?? e);
      return pic;
    }
  }

  /** KB-845: onShot = 크롭본을 받을 곳(메뉴 = scanImage, 가공식품·성분표 = PackagedScanFlow) · menu = scan_start 계측(메뉴만 — 가공식품은 자기 이벤트) */
  async function capture(onShot: (p: NonNullable<Photo>) => void | Promise<void> = scanImage, menu = true) {
    if (capturingRef.current) return; // P-062⓪: 동기 가드 — 리렌더 전 연타도 차단
    if (isGuest) return setGateOpen(true); // 스캔=회원 전용 (게이트)
    // P-131: 가로 촬영 허용 (KB-141 가드 폐기 — 캡슐 전환으로 겹침 사유 소멸)
    const cam = cameraRef.current;
    if (!cam) return;
    capturingRef.current = true;
    setCapturing(true);
    setError(null);
    if (menu) track(EVENTS.scan_start, { source: 'camera' }); // P-144
    try {
      const pic = await cam.takePictureAsync({ quality: 0.7, exif: true }); // P-338: Orientation 태그 — raw 치수 정규화용
      console.log('[scan] photo =', JSON.stringify({ uri: pic?.uri, w: pic?.width, h: pic?.height }));
      if (!pic?.uri) return fail('capture', 'takePictureAsync returned no uri');
      // KB-202: 업로드·표시·OCR 전부 크롭본 기준 — 미리보기 밖은 어디에도 안 간다
      const cropped = await cropToPreview({ uri: pic.uri, width: pic.width ?? 0, height: pic.height ?? 0 }, (pic.exif as { Orientation?: number } | undefined)?.Orientation);
      await onShot(cropped);
    } catch (e) {
      if (menu) fail('capture', (e as Error)?.message ?? String(e));
      else console.log('[scan] packaged capture failed:', (e as Error)?.message ?? e); // 가공식품은 카메라에 그대로(메뉴 오류 화면으로 가지 않는다)
    } finally {
      capturingRef.current = false;
      setCapturing(false); // 화면 전환(scanning) 후거나 실패 — 어느 쪽이든 셔터 복구
    }
  }

  async function pickFromGallery(onShot: (p: NonNullable<Photo>) => void | Promise<void> = scanImage, menu = true) {
    if (capturingRef.current) return; // P-062⓪: 셔터와 동일 동기 가드
    if (isGuest) return setGateOpen(true);
    capturingRef.current = true;
    setCapturing(true);
    importingGestureLock.set(true);
    importingRef.current = true; // 리렌더 전 연속 입력도 차단
    setImporting(true); // P-191: 픽커 복귀~원본 준비(iCloud 다운로드 수 초) 구간 표시
    setError(null);
    if (menu) track(EVENTS.scan_start, { source: 'gallery' }); // P-144
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        selectionLimit: 1,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const a = result.assets[0];
      await onShot({ uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 });
    } catch (e) {
      if (menu) fail('capture', (e as Error)?.message ?? String(e));
      else console.log('[scan] packaged library pick failed:', (e as Error)?.message ?? e);
    } finally {
      capturingRef.current = false;
      setCapturing(false);
      importingRef.current = false;
      importingGestureLock.set(false);
      setImporting(false);
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
        track(EVENTS.scan_permission, { state: 'deny' }); // P-214
        Alert.alert(t('scan.permissionTitle'), t('scan.permissionSettingsBody'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('photo.openSettings'), onPress: () => { track(EVENTS.scan_permission, { state: 'settings_open' }); void openAppSettings(); } },
        ]);
        return;
      }
      track(EVENTS.scan_start, { source: 'camera' }); // P-144 (시스템 카메라도 camera)
      const res = await launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
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

  // KB-789: Closest match 칩 탭 = 설명 카드(긍정 프레임). 상세 버튼은 openDish 재사용(가격 param·src=scan 동일).
  function openClosestMatch(dish: ResultDish) {
    track(EVENTS.scan_closest_match_open, { food_id: dish.foodId });
    setClosestMatch(dish);
  }

  const GateSheet = <AuthGateSheet context="scan" open={gateOpen} onClose={() => setGateOpen(false)} />;

  // KB-845: 카메라 = 시안 X(24, 흰색, (20,60) — 배경 원 없음) · 그 밖(오류·오프라인 밝은 바탕) = 기존 어두운 원(흰 X가 보이게)
  const closeBtn = (cam: boolean) => (
    <Pressable style={[cam ? styles.camClose : styles.close, { top: insets.top + (cam ? 16 : 8) }]} onPress={closeCamera} disabled={importing} hitSlop={cam ? 10 : 8} accessibilityLabel={t('common.close')} testID="scan-close">
      <Animated.View style={uiRotate}>
        <IconClose size={cam ? 24 : 22} color="#fff" />
      </Animated.View>
    </Pressable>
  );
  const Close = closeBtn(false);

  /**
   * KB-845 공통 카메라(D-31 scan refresh screen-3/4/5) — 메뉴·가공식품 앞면·성분표 한 화면. 가공식품 흐름은 PackagedScanFlow가
   * renderCamera로 이 함수를 불러 쓴다(카메라·권한·WYSIWYG 크롭·줌·전환은 여기 하나).
   * 레이아웃(375×812): 헤더 0~100 gray-1000(닫기 X (20,60) · "Scan" 가운데) · 프리뷰 100~780 · 탭 y104 h40 ·
   * 아래 기준 스택 = 안내(제목+힌트, gap 8) → 43 → 줌 칩 36 → 16 → 컨트롤 80(Photos · 셔터 64+링 76 · 전환) → 16 → 링크 → 홈 인디케이터.
   */
  // KB-845 QA(Android): 카메라 프리뷰는 **화면 바깥 층 하나**(cameraLayer) — 메뉴·가공식품 두 분기가 같은 자리에 렌더해 탭을 바꿔도 CameraView를 다시
  // 마운트하지 않는다(새 카메라 세션 = 에뮬 검정 화면). 컨트롤만 cameraUi가 위에 그리고, 카메라 화면이 아닐 때(가공식품 로딩·후보·결과)나 라우트가 가려졌을 때는 active=false로 멈춘다
  const [camShown, setCamShown] = useState(false);
  // KB-854 카메라 v2 B: 위 단색 바(헤더+탭) = 상태바 아래 108 · 아래 단색 바(줌 · 갤러리/셔터/전환 · 링크) = 내용 201 + 하단 여백
  // (375×812 시안: 위 바 0~152, 아래 바 588~812 = 224 = 201 + 홈 인디케이터 34 − 11). 프리뷰 = 두 바 사이(크롭 기준 previewSize도 이 영역)
  const camBarH = camBarHeight(bottom);
  const cameraLayer = permission?.granted ? (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="scan-camera-layer">
      <View style={[styles.camPreview, { top: insets.top + CAM_TOP_BAR, bottom: camBarH }]}>
        {/* P-131: 핀치 줌 — runOnJS(true)로 JS 스레드 콜백(워클릿 0, P-065 교훈 준수) */}
        <GestureDetector
          gesture={Gesture.Pinch()
            .enabled(!importing)
            .runOnJS(true)
            .onStart(onPinchStart)
            .onUpdate(onPinchUpdate)}
        >
          <View style={StyleSheet.absoluteFill}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              onLayout={(e) => { previewSize.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }; }}
              facing={facing}
              zoom={zoom}
              active={camShown && isFocused} // Codex #318: 다른 화면이 위로 올라가 스캔이 가려지면 카메라(프라이버시 표시등) 정지
              responsiveOrientationWhenOrientationLocked
              onResponsiveOrientationChanged={(e) => setCamOrientation(e.orientation)}
            />
          </View>
        </GestureDetector>
      </View>
    </View>
  ) : null;

  function cameraUi(o: ScanCamOpts): ReactElement {
    const granted = permission?.granted;
    const menu = o.kind === 'menu';
    // KB-854: 안내 제목·힌트 문구 제거(시안 B) — 흐름이 주는 한 줄(성분표 n/4 · 같은 분석 차감 안내)만 아래 바 위에 남긴다(P-510 규칙)
    const hint = o.hint ?? null;
    const shoot = () => void capture(o.onShot, menu);
    const library = () => void pickFromGallery(o.onShot, menu);
    const off = capturing || !!o.shootDisabled; // Codex #318: 성분표 4면이 차면 더 찍지 못한다
    return (
      <View style={styles.camRoot} pointerEvents="box-none">
        <CamOn onChange={setCamShown} />
        {/* 프리뷰 자리 = 헤더(탭 위) 아래 ~ 홈 인디케이터 위. 허용됨 = 비워 둔다(아래 cameraLayer의 프리뷰가 비치고 핀치가 닿게 터치 통과) */}
        <View style={[styles.camPreview, { top: insets.top + CAM_TOP_BAR, bottom: camBarH }, granted && styles.camPreviewHole]} pointerEvents={granted ? 'none' : 'auto'}>
          {/* KB-854: 프레이밍 코너 4(촬영 안내 — 크롭 경계 아님). 시안 (32,176) 311×396 = 프리뷰 기준 위 24 · 좌우 32 · 아래 16 */}
          {granted ? <FramingCorners style={styles.camCorners} /> : permDenied ? (
            /* P-285(최종본 4003:12656): 권한 거부 = D-1 Alert(320×190·스크림 40%) */
            <View style={[StyleSheet.absoluteFill, styles.permScrim]} testID="perm-denied-alert">
              <View style={styles.permAlert}>
                <Text style={styles.permAlertTitle}>{t('scan.permissionTitle')}</Text>
                <Text style={[styles.permAlertBody, { marginBottom: 13 }]}>{t('scan.permissionSettingsBody')}</Text>
                <Btn testID="scan-perm-settings" disabled={importing} onPress={() => { if (importingRef.current) return; track(EVENTS.scan_permission, { state: 'settings_open' }); void openAppSettings(); }}>
                  {t('photo.openSettings')}
                </Btn>
              </View>
            </View>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.permission]}>
              <IconScanLines size={48} color="rgba(255,255,255,0.85)" />
              <Text style={styles.permTitle}>{t('scan.permissionTitle')}</Text>
              <Text style={styles.permBody}>{t('scan.permissionBody')}</Text>
              <View style={{ width: '100%', maxWidth: 280 }}>
                {/* P-214: 권한 퍼널 — 요청 후 결과(grant|deny) 구분 */}
                <Btn testID="scan-perm-grant" disabled={importing} onPress={() => { if (importingRef.current) return; void requestPermission().then((r) => track(EVENTS.scan_permission, { state: r?.granted ? 'grant' : 'deny' })); }}>
                  {t('scan.grant')}
                </Btn>
              </View>
            </View>
          )}
        </View>

        {/* KB-854: 위 단색 바(헤더 + 탭 한 덩어리, gray-1000 불투명) */}
        <View style={[styles.camTopBar, { height: insets.top + CAM_TOP_BAR }]} pointerEvents="none" testID="scan-cam-topbar" />
        {/* 헤더: 닫기 X + "Scan"(가운데). 가공식품 흐름 안의 한 면 더 찍기 등은 o.onClose = 직전 단계로 */}
        <View style={[styles.camTitleWrap, { top: insets.top + 16 }]} pointerEvents="none">
          <Text style={styles.camTitle}>{t('scanCamera.title')}</Text>
        </View>
        {o.onClose ? (
          <Pressable style={[styles.close, { top: insets.top + 16 }]} onPress={() => { if (!importingRef.current) o.onClose?.(); }} disabled={importing} hitSlop={10} accessibilityLabel={t('common.close')} testID="scan-close-step">
            <IconClose size={24} color={C.surface} />
          </Pressable>
        ) : (
          closeBtn(true)
        )}
        {menu && uiDeg !== 0 && (
          <View style={[styles.landscapeBadge, styles.camBadge, { top: insets.top + 108 }]} testID="landscape-badge" pointerEvents="none">
            <Text style={styles.landscapeBadgeText}>{t('scan.landscapeBadge')}</Text>
          </View>
        )}
        {/* KB-813 → KB-845 탭: Menu / Food photo(비활성) / Packaged food — 성분표도 Packaged food 활성(screen-5) */}
        {/* KB-870: 운영 채널(운영 서버에 가공식품 API 없음) = 모드 탭째 없음 → 메뉴 스캔만(main과 같음) */}
        {FLAGS.processedFoodEnabled && (
          <View style={[styles.camModeTabs, { top: insets.top + 60 }]} pointerEvents="box-none">
            <ScanModeTabs value={menu ? 'menu' : 'packaged'} onChange={setScanMode} disabled={importing} tone="dark" />
          </View>
        )}
        {o.debug ? <View style={[styles.camDebug, { top: insets.top + 116 }]}>{o.debug}</View> : null}
        {ImportingOverlay}
        {GateSheet}

        {/* 흐름 안내 한 줄(성분표 n/4 · 같은 분석) — 아래 바 바로 위 */}
        {hint || o.notice ? (
          <View style={[styles.camHintWrap, { bottom: camBarH + 12 }]} pointerEvents="none">
            {o.notice /* KB-877: 가공식품 무료 남은 분(없으면 null) */}
            {hint ? <Text style={styles.camHint} testID="scan-cam-hint">{hint}</Text> : null}
          </View>
        ) : null}
        {/* KB-854: 아래 단색 바 — 1x·2x 칩 → 갤러리 · 셔터 · 전환(아이콘 터치 52) → 링크(가공식품 "성분표로" / 성분표 "앞면으로" — 메뉴는 자리만) */}
        <View style={[styles.camBottomBar, { height: camBarH }]} testID="scan-cam-bottombar">
          {/* P-131: 배율 프리셋 1x/2x — 핀치와 상호 동기(근사 시 하이라이트). 상태 = 색만(보더 폭 동일 — 프레임 불변) */}
          <View style={[styles.zoomRow, !granted && styles.hidden]}>
            {(['x1', 'x2'] as CamZoomPreset[]).map((pKey) => {
              const on = activePreset(zoom) === pKey;
              return (
                <Pressable key={pKey} style={[styles.zoomPill, on && styles.zoomPillOn]} onPress={() => { if (!importingRef.current) setZoom(CAM_ZOOM_PRESETS[pKey]); }} disabled={!granted || importing} hitSlop={6} testID={`zoom-${pKey}`}>
                  <Animated.View style={uiRotate}>
                    <Text style={[styles.zoomPillText, on && styles.zoomPillTextOn]}>{pKey === 'x1' ? '1x' : '2x'}</Text>
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.camRow}>
            <Pressable testID="scan-gallery" style={[styles.camIconBtn, off && styles.shutterOff]} onPress={library} disabled={off} accessibilityRole="button" accessibilityLabel={t('scanCamera.choosePhoto')}>
              <Animated.View style={uiRotate}>
                <IconChoosePhoto size={28} color={C.surface} />
              </Animated.View>
            </Pressable>
            {granted ? (
              <Pressable testID="scan-shutter" style={[styles.shutter, off && styles.shutterOff]} onPress={shoot} disabled={off} accessibilityRole="button" accessibilityLabel={t('photo.take')}>
                <View style={styles.shutterInner} />
              </Pressable>
            ) : (
              <View style={styles.shutterSpacer} />
            )}
            {granted ? (
              <Pressable testID="scan-flip" style={styles.camIconBtn} onPress={() => { if (!importingRef.current) setFacing((f) => (f === 'back' ? 'front' : 'back')); }} disabled={importing} accessibilityRole="button" accessibilityLabel={t('scanCamera.switchCamera')}>
                <Animated.View style={uiRotate}>
                  <IconRefreshCcw size={28} color={C.surface} />
                </Animated.View>
              </Pressable>
            ) : (
              <View style={styles.camIconBtn} />
            )}
          </View>
          {o.link ? (
            <Pressable onPress={() => { if (!importingRef.current) o.link?.onPress(); }} disabled={importing} hitSlop={8} accessibilityRole="button" testID={o.link.testID} style={styles.camLink}>
              <Text style={styles.camLinkText}>{o.link.label}</Text>
            </Pressable>
          ) : (
            <View style={styles.camLink} />
          )}
        </View>
      </View>
    );
  }

  const [celebrationTurn, setCelebrationTurn] = useState(false);
  if (phase !== 'result' && celebrationTurn) setCelebrationTurn(false);
  const celebrationDone = useRef<(() => void) | null>(null);
  const celebrationQueued = useRef(false);
  const celebrationClosed = useCallback(() => {
    celebrationQueued.current = false;
    setCelebrationTurn(false);
    const done = celebrationDone.current;
    celebrationDone.current = null;
    done?.();
  }, []);
  useEffect(() => {
    if (phase !== 'result') { celebrationQueued.current = false; celebrationDone.current = null; return; } // modalQueue.clear() drops the step
    if (!unlockPending || celebrationQueued.current) return;
    celebrationQueued.current = true;
    modalQueue.add({
      key: 'unlock-celebration',
      present: (done) => {
        if (!hasUnlockPending()) { celebrationQueued.current = false; return false; }
        celebrationDone.current = done;
        setCelebrationTurn(true);
        return true;
      },
    });
  }, [phase, unlockPending, modalQueue]);
  // Safety: an event consumed without a native dismissal (screen blur) must not keep the queue waiting forever.
  useEffect(() => {
    if (!celebrationTurn || unlockPending) return;
    const timer = setTimeout(celebrationClosed, 600);
    return () => clearTimeout(timer);
  }, [celebrationTurn, unlockPending, celebrationClosed]);
  // Codex #291 R10/R11: ONE celebration presenter for every scan phase (root host excludes /scan). Each phase return goes
  // through withPresenter, so the presenter keeps its identity across phase changes and no phase can lose an event.
  // Continuation (reopen camera with a ticket) only in the quota-error context; elsewhere the CTA is Done.
  // ponytail: mounted while an event is pending or holds the result-queue turn, and always in the quota context
  // (its continuation / the queue's onDismissed must survive consume).
  const quotaContext = phase === 'error' && error?.stage === 'quota';
  // Codex #291 R12 P1: the result phase serializes its modals (coach → primer → review prompt) because two native modals
  // presenting from the scan full-screen modal deadlock UIKit. The celebration takes a turn in that same queue there,
  // and also waits while a user-opened sheet/dialog is up. The queue advances only after the celebration fully dismissed.
  const resultSheetOpen = sortSheet || unmatchedOpen || closestMatch != null || retakeConfirm || leave.modal.visible || gateOpen;
  const presenterEligible = isFocused && !isGuest && !(quotaContext && quotaPicker) && (phase !== 'result' || (celebrationTurn && !resultSheetOpen));
  const presenter = quotaContext || unlockPending || celebrationTurn ? (
    <UnlockCelebration
      eligible={presenterEligible}
      onDismissed={celebrationClosed}
      onStartScanning={quotaContext ? () => void runUnlockRetry(() => preflight({ unlocked: true })) : undefined}
      onClosed={quotaContext ? () => { if (errorRef.current) setUnlock({ kind: 'ready', forError: errorRef.current }); } : undefined}
    />
  ) : null;
  // KB-777 B1-4: 어두운 바탕(카메라 뷰파인더·인식 중·오류 — "Not a menu" 등)은 상태바 아이콘을 밝게. 앱 기본(_layout)은 dark —
  // 포커스를 잃거나 밝은 화면(결과·오프라인·시스템 카메라 런처)으로 가면 이 StatusBar가 빠져 기본으로 돌아간다.
  // Codex #310: 가공식품 모드는 밝은 화면(PackagedScanFlow) — 카메라 단계여도 어두운 바탕이 아니다
  const darkRoot = isGuest || DARK_ROOT_PHASES.has(phase) || (phase === 'camera' && !offline && !FLAGS.systemCamera && scanMode !== 'packaged');
  const lightBar = isFocused && darkRoot ? <StatusBar style="light" /> : null;
  const withPresenter = (node: ReactElement) => <>{node}{presenter}{lightBar}</>;

  // 라우트 자체 가드 (실기기 반려분 #2): 진입로별 가드는 누락이 생긴다 —
  // 게스트는 어떤 경로로 오든 카메라 없이 게이트 시트, 닫으면 뒤로.
  if (isGuest) {
    return (
      <View style={styles.root}>
        {lightBar}
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
        imageUrl: it.imageUrl, // P-241 v2: 행 썸네일(비매칭 = 서버 디폴트)
        avoidances: it.avoidances, // P-219 v2: 메뉴별 회피 겹침
        substituted: it.substituted, // KB-789 v3.0
        originalScannedName: it.originalScannedName,
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
      imageUrl: p.imageUrl, // P-241 v2
      avoidances: p.avoidances, // P-219 v2
      substituted: p.substituted, // KB-789 v3.0
      originalScannedName: p.originalScannedName,
    }));
    const allDishes = [...resultDishes, ...photoDishes];
    // unable은 숨기지 않는다(§14-5). 정렬 = resultSort — 기본 메뉴판 순(KB-908: unable도 제자리, 행의 Unable 라벨·회색 리본이 표시), 가격순은 null 맨 아래
    const listDishes = sortResultDishes(allDishes, sortMode);
    // P-354(KB-516): Safe only — 표시만 필터(장바구니 수량은 itemId 키로 보존,
    // goOrder는 listDishes(전체) 기준이라 숨긴 담김분도 합계 불변)
    const safeDishes = listDishes.filter((d) => d.risk === 'safe');
    const visibleDishes = safeOnly ? safeDishes : listDishes;

    // P-038→P-057(KB-212 후속, A안): 빈 프로필 넛지 — 회원 && 기피 0 && 세션 내
    // 미닫음. 어두운 absolute 오버레이(배경에 묻힘·카드 밀착)를 폐기하고 결과
    // 리스트의 **첫 카드**로 편입(밝은 브랜드 틴트). 목록 뷰 전용 — 위험도/원본은
    // 사진 위라 부적합. 동작(탭→기피 설정, ×→세션 억제)·노출 조건 무변.
    const showNudge = !isGuest && !!me && me.restrictions.length === 0 && !nudgeHidden;

    // P-136: 주문 카드 진입 — 담기분을 param으로 (2단 확정: 카트 화면 없음)
    const goOrder = () => {
      const items = listDishes
        .filter((d) => (cart.get(d.itemId) ?? 0) > 0)
        // KB-789: nameKo = 메뉴판 표기(대체 항목은 원문) — 직원에게 보여주는 줄. name·foodId는 대체 음식.
        .map((d) => ({ nameKo: orderNameKo(d), name: d.displayName, qty: cart.get(d.itemId)!, priceKrw: d.priceKrw, foodId: d.foodId ?? null }));
      // P-242: 스캔 세션의 서버 환율을 주문 카드에도 동승(fx 생략 = v1 테이블)
      const fxParam = fx !== undefined ? `&fx=${encodeURIComponent(JSON.stringify(fx))}` : '';
      // P-252: 스캔 경로 동승 — 주문 완료 시 이력 저장(POST /api/orders) 식별자
      const imgParam = scanPath ? `&img=${encodeURIComponent(scanPath)}` : '';
      router.push(`/scan-order?items=${encodeURIComponent(JSON.stringify(items))}${fxParam}${imgParam}` as Href);
    };

    return withPresenter(
      <View style={styles.resultRoot}>
        {/* KB-432 §1-1(4150:16420): AppBar 백+제목 중앙 — 다시찍기(P-161 기능 유지)는 우측 */}
        <View style={[styles.quietHeader, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.qhBack} testID="result-back">
            <IconArrowLeft size={24} color={C.ink} />
          </Pressable>
          <Text style={styles.qhTitle} numberOfLines={1}>{t('scan.cameraTitle')}</Text>
          {/* P-285(최종본 2200:21514): 재촬영 = camera_restart 24 — P-161 확인 모달 경유 복원 */}
          <Pressable hitSlop={8} onPress={() => setRetakeConfirm(true)} style={styles.qhBack} testID="retake" accessibilityLabel={t('scan.retake')} accessibilityRole="button">
            <D4CameraRestart size={24} color={C.ink} />
          </Pressable>
        </View>
        {/* §1-1: 언더라인 탭 2개 responsive 반반(4123:3853) — Photo | List(현 세그 매핑) */}
        <View style={styles.resultTabs}>
          {(['risk', 'list'] as ResultView[]).map((v) => (
            <Pressable key={v} style={styles.resultTab} onPress={() => setView(v)} testID={`seg-${v}`}>
              <Text style={[styles.resultTabLabel, view === v && styles.resultTabLabelOn]}>
                {t(v === 'risk' ? 'scan.segPhoto' : 'scan.segList')}
              </Text>
              <View style={[styles.resultTabBar, view === v && styles.resultTabBarOn]} />
            </Pressable>
          ))}
        </View>
        {/* §1-1: 인식 배너 — h48 primaryTint. A-SC-12(P-330 동승): 0건 = 배너·컨트롤 숨김 */}
        {allDishes.length > 0 && (
          <View style={styles.recogBanner} testID="recog-banner">
            <IconTabScan size={24} color={C.primary} />
            <Text style={styles.recogBannerText}>
              {safeOnly
                ? t('scan.resultsSubSafe', { safe: safeDishes.length, total: allDishes.length })
                : t('scan.resultsSub', { count: allDishes.length })}
            </Text>
          </View>
        )}

        {view === 'list' && allDishes.length === 0 ? (
          /* P-330(4003:7160): 결과 0개 = 화면 세로 중앙(배너·컨트롤 숨김 — A-SC-12) */
          <ScreenCenterFill>
            <EmptyBlock label={t('scan.resultsEmpty')} testID="scan-results-empty" />
          </ScreenCenterFill>
        ) : view === 'list' ? (
          <>
          {/* 9/5 예진 판정: ScanProfileBar(회피 체크 스트립) 제거 — 시안 토글 행만 */}
          {/* §1-1 컨트롤 행: 좌 프로필 필터 토글(시안 렌더 — 현 상태 부재로 무동작,
              D-2 규칙 동일) / 우 정렬 드롭다운(현 menu/safety 옵션 매핑 → ActionSheet) */}
          <View style={styles.controlRow}>
            <Pressable style={styles.toggleRow} onPress={() => setSafeOnly((v) => !v)} testID="scan-safe-toggle">
              <View style={[styles.sw, safeOnly && styles.swOn]}>
                <View style={[styles.knob, safeOnly && styles.knobOn]} />
              </View>
              <Text style={styles.toggleLabel} numberOfLines={1}>{t('scan.safeOnly')}</Text>
            </Pressable>
            <Pressable style={styles.sortBtn} onPress={() => setSortSheet(true)} testID="scan-sort">
              <Text style={styles.sortLabel} numberOfLines={1}>{t(SORT_LABEL_KEY[sortMode])}</Text>
              <IconChevronDown size={16} color="#4B4F58" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: bottom + 120 }} showsVerticalScrollIndicator={false}>
            {showNudge && (
              <Animated.View entering={FadeInDown.springify().damping(spring.sheet.damping).stiffness(spring.sheet.stiffness)} style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                <Pressable testID="scan-nudge-restrictions" style={styles.nudgeCard} onPress={() => router.push('/profile/restrictions' as Href)}>
                  <View style={styles.nudgeIc}>
                    <IconBulb size={18} color="#fff" />
                  </View>
                  <Text style={styles.nudgeCardText} numberOfLines={3}>
                    <Text style={styles.nudgeCardStrong}>{t('scan.nudgeAction')}</Text>
                    {t('scan.nudgeRest')}
                  </Text>
                  <Pressable testID="scan-nudge-dismiss" hitSlop={8} onPress={() => { dismissNudge(); setNudgeHidden(true); }}>
                    <IconClose size={14} color={C.ink3} />
                  </Pressable>
                </Pressable>
              </Animated.View>
            )}
            {safeOnly && visibleDishes.length === 0 ? (
              /* P-354 ④ → P-372(KB-536): 안전 0건 — 컨트롤 행·배너 유지, 목록 자리만 빈 상태.
                 토글 OFF CTA는 바로 위 컨트롤 행 토글과 중복이라 삭제(9/10 예진). */
              <View style={{ paddingTop: 48, alignItems: 'center' }} testID="scan-safe-empty">
                <EmptyBlock label={t('scan.safeEmpty')} />
              </View>
            ) : (
            <ScanRichList
              dishes={visibleDishes}
              currency={currency}
              fx={fx}
              cart={cart}
              onAdd={(d) => { track(EVENTS.scan_item_add, { risk: d.risk }); airbridge.addToCart({ id: d.foodId ?? `menu:${d.itemId}`, name: d.koreanName ?? d.rawMenuName }); bumpCart(d.itemId, 1); }}
              onRemove={(d) => { track(EVENTS.scan_item_remove, { risk: d.risk }); bumpCart(d.itemId, -1); }}
              onOpen={openDish}
              onMarkPress={() => setCoachOpen(true)} // P-134 재열람 — 캡슐 철거 후 리스트 표면
              onClosestMatch={openClosestMatch} // KB-789
              t={t}
            />
            )}
          </ScrollView>
          </>
        ) : (
          /* P-149(예진 확정): Photo 뷰 = 쌩 원본 + 핀치 줌만 — 캡슐·미니시트·범례·힌트 철거 */
          <ScanResultOverlay photo={photo} />
        )}

        {degraded && <Text style={[styles.degradedNote, { position: 'absolute', bottom: bottom + 78, alignSelf: 'center' }]}>{t('scan.degradedNote')}</Text>}
        {/* P-136: 하단 주문 필 — 리스트·캡슐 뷰 공유(담김 카운트 동기) */}
        <OrderPill count={cartCount} onPress={goOrder} t={t} bottom={bottom + 16} />

        {/* §1-1: 정렬 시트 — 공용 ActionSheet(현 2옵션·현재값 체크) */}
        <ActionSheet testID="scan-sort"
          open={sortSheet}
          title={t('reviews.sortTitle')}
          items={(['menu', 'priceDesc', 'priceAsc'] as ResultSortMode[]).map((m) => ({
            key: m,
            label: t(SORT_LABEL_KEY[m]),
            icon: m === sortMode ? <IconCheck size={15} color={C.primary} /> : undefined,
            onPress: () => setSortMode(m),
          }))}
          onClose={() => setSortSheet(false)}
        />
        {GateSheet}
        {/* P-370(KB-533): 모달 컨텍스트 자체 토스트 호스트(스택 top) */}
        <TopToastHost />
        {/* P-267 Codex P1: 프라이머 트리거 = iOS는 onDismiss(네이티브 dismiss 완료
            후 — onClose 직후 present는 잔존 race), 안드는 onClose(onDismiss 미지원
            플랫폼 — 교착 자체가 iOS UIKit 이슈라 무해) */}
        <ScanCoachMark
          open={coachOpen}
          onClose={() => { setCoachOpen(false); if (Platform.OS !== 'ios') settle(coachDoneRef); }}
          onDismiss={Platform.OS === 'ios' ? () => settle(coachDoneRef) : undefined}
          t={t}
        />
        <UnmatchedNotice open={unmatchedOpen} onClose={() => setUnmatchedOpen(false)} t={t} />
        <ClosestMatchNotice
          dish={closestMatch}
          onClose={() => setClosestMatch(null)}
          onSeeDetails={(d) => { setClosestMatch(null); openDish(d); }}
          t={t}
        />
        {/* P-161: 다시찍기 확인 — 커뮤니티 이탈 모달 문법(라운드 26 카드) 재사용 */}
        {/* KB-769: 같은 카드를 이탈 확인에도 — 제목·확인 버튼만 leave 문구, 본문은 담은 개수 문구 재사용 */}
        <Modal visible={retakeConfirm || leave.modal.visible} transparent animationType="fade" onRequestClose={() => (retakeConfirm ? setRetakeConfirm(false) : leave.modal.onKeep())}>
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirmCard} testID={retakeConfirm ? 'retake-confirm' : 'scan-leave-confirm'}>
              <Text style={styles.confirmTitle}>{t(retakeConfirm ? 'scan.retakeTitle' : 'scan.leaveTitle')}</Text>
              <Text style={styles.confirmBody}>
                {cartCount > 0 ? t('scan.retakeBodyWithCart', { count: cartCount }) : t('scan.retakeBody')}
              </Text>
              <View style={{ gap: 9, marginTop: 6 }}>
                <Btn variant="ghost" onPress={() => (retakeConfirm ? setRetakeConfirm(false) : leave.modal.onKeep())} testID="scan-confirm-cancel">
                  {t('profile.delete.cancel')}
                </Btn>
                {/* P-175: destructive도 보더 버튼 프레임 — 텍스트 행이 버튼처럼 안 보이던 지적 */}
                <Btn
                  variant="dangerGhost"
                  onPress={() => {
                    if (!retakeConfirm) { leave.modal.onDiscard(); return; } // KB-769: 막았던 이동(back·스와이프)을 그대로 진행
                    setRetakeConfirm(false);
                    setItems([]); setPhotoOnly([]); setDishes([]); setPhoto(null); setCart(new Map()); setSafeOnly(false); setSortMode('menu'); setPhase('camera'); // P-354: 컨트롤은 스캔 세션 한정
                  }}
                  testID={retakeConfirm ? 'retake-go' : 'scan-leave-go'}
                >
                  {t(retakeConfirm ? 'scan.retakeConfirm' : 'scan.leaveConfirm')}
                </Btn>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    );
  }

  // ---- scanning ---- KB-845 로딩 C(D-31 screen-2): 흰 바탕 · 상태 먼저 · 찍은 사진(cover) 안 스캔선 1개 · 스피너 0
  // P-222: 서버 처리를 HTTP 응답 대기로 버티므로 오래 이탈하면 결과 소실 — 정적 안내 한 줄(scan.stayHint, 시간 문구 그대로)만. AppState 감시·경고 모달 금지(발주 고정)
  if (phase === 'scanning') {
    return withPresenter(
      <View style={{ flex: 1 }}>
        <ScanLoading title={t('scan.reading')} body={t('scan.stayHint')} photoUri={photo?.uri ?? null} caption={t('scanCamera.capturedMenu')} onClose={() => router.back()} testID="scan-loading" />
        {GateSheet}
      </View>
    );
  }

  // ---- error ----
  // 가공식품 소진(packagedHold) = 아래 가공식품 분기가 흐름 위에 덮어 그린다(같은 트리 자리 — 흐름 상태 유지). 나중에 = 흐름으로 복귀
  const quotaLater = packagedHold
    ? () => { quotaLockRef.current = false; setError(null); setPhase('camera'); }
    : () => router.back();
  const renderError = () => {
    const stage = error?.stage ?? 'be';
    return (
      <View style={[styles.root, styles.center]}>
        {Close}
        {GateSheet}
        <IconScanLines size={48} color="rgba(255,255,255,0.85)" />
        {/* P-250: quota(SCAN-004) = 전용 제목(가이드 권장 UI — 스테이지 라벨 대체) */}
        <Text style={styles.errStage}>{stage === 'quota' ? t(unlockState === 'idle' ? 'scan.quotaTitle' : 'scan.unlockedTitle') : t(`scan.stage.${stage}`)}</Text>
        <Text style={styles.statusText}>{t(stage === 'quota' ? (unlockState === 'idle' ? (canWatchAd ? 'scan.quotaBodyUnlock' : ERROR_MSG.quota) : unlockState === 'ready' ? 'scan.unlockedBody' : unlockState === 'opening' ? 'scan.unlockedOpening' : 'scan.unlockedRetry') : ERROR_MSG[stage])}</Text>
        {/* P-247 🔴: error.detail(서버 message 원문) 렌더 삭제 — BE message 사용자
            노출 금지(상시 규칙). 진단은 fail()의 콘솔 로그로만. */}
        <View style={styles.errBtns}>
          {/* P-219: 분기별 행동 — 메뉴판 아님·촬영 실패 = 재촬영(사용자 행동),
              인식 실패(503)·업로드 실패 = 재시도(같은 사진으로 다시) */}
          {/* P-222 재량: network도 재시도 대상 — 사진은 그대로이고 연결만 회복하면 되는
              상황이라 "재촬영"보다 "재시도"가 맞다(대기 중 이탈로 끊긴 경우 포함). */}
          {/* P-250: quota = 리뷰 작성하기(픽커) + 나중에 · outage = 다시 시도(새 티켓
              발급부터 — postScan이 시도마다 신규 발급) + 나중에 · processing = 재촬영만
              (새 티켓 자동 재발급 금지 — 재촬영 = 사용자 주도 새 시도) */}
          {stage === 'quota' && unlockState !== 'idle' ? (
            <>
              {/* KB-759: 해제됐는데 티켓 재발급 중/실패 — 광고·리뷰 CTA 대신 다시 시도(실패일 때만) + 나중에 */}
              {/* /review 3: 여는 중에도 같은 버튼을 busy로 유지(스피너·비활성) — 실패면 탭 가능 */}
              <Btn busy={unlockState === 'opening' || unlockRetrying} onPress={() => void runUnlockRetry(() => preflight({ unlocked: true }))} testID="scan-unlock-retry">{t(unlockState === 'ready' ? 'scan.startScanning' : 'common.retry')}</Btn>
              <Btn variant="ghost" onPress={quotaLater} testID="scan-quota-later">{t('scan.later')}</Btn>
            </>
          ) : stage === 'quota' ? (
            <>
              {/* KB-739 ⑤: 2택 — 리뷰 쓰기 / 광고 보고 풀기(n/3). 서버가 scanUnlocked를 돌려주면 preflight({unlocked}) → 새 티켓 → 카메라 복원(KB-759) */}
              <UnlockActions reviewTestID="scan-quota-review" onWriteReview={() => setQuotaPicker(true)} onUnlocked={() => { if (!hasObservedUnlockTransition()) void preflight({ unlocked: true }); }} onClose={() => router.back()} />
              <Btn variant="ghost" onPress={quotaLater} testID="scan-quota-later">{t('scan.later')}</Btn>
            </>
          ) : stage === 'busy' || stage === 'upload' || stage === 'network' || stage === 'outage' ? (
            <>
              <Btn onPress={() => photo && scanImage(photo)} testID="scan-err-retry">{t('common.retry')}</Btn>
              {stage === 'outage' && (
                <Btn variant="ghost" onPress={() => router.back()} testID="scan-outage-later">{t('scan.later')}</Btn>
              )}
            </>
          ) : (
            <Btn variant="ghost" onPress={() => setPhase('camera')} testID="scan-err-retake">{t('scan.retake')}</Btn>
          )}
        </View>
        {/* P-250: 무료 소진 → 리뷰 픽커(P-245 자격 UX 그대로 — 스캔분만 선택 가능).
            작성 성공 후 스캔 재진입 시 새 티켓 발급부터(해금 즉시 반영 — 가이드 C). */}
        {quotaPicker && (
          <TagPickerSheet
            context="review"
            kind="food"
            foodTags={[]}
            placeTag={null}
            onToggleFood={(f) => { setQuotaPicker(false); router.push(`/food/${f.foodId}/review` as Href); }}
            onTogglePlace={() => {}}
            onClose={() => setQuotaPicker(false)}
            t={t}
          />
        )}
      </View>
    );
  };

  // ---- KB-813 가공식품 모드 — 카메라 단계(결과·오류·쿼터 잠금은 아래에서 먼저) · KB-865 ③: 확정 소진은 흐름 위 덮개 ----
  if (scanMode === 'packaged' && !offline && (phase !== 'error' || packagedHold)) {
    return withPresenter(
      <View style={styles.camHost}>
        {cameraLayer}
        <PackagedScanFlow
          key={labelEntry ?? 'flow'}
          mode={scanMode}
          onMode={setScanMode}
          onClose={() => router.back()}
          startLabel={labelEntry != null}
          renderCamera={cameraUi}
          focused={isFocused}
          onQuota={() => {
            packagedHoldRef.current = true;
            setPackagedHold(true);
            quotaLockRef.current = true;
            setError({ stage: 'quota', detail: 'packaged confirm SCAN-004' });
            setPhase('error');
          }}
        />
        {phase === 'error' && <View style={StyleSheet.absoluteFill} testID="pscan-quota-overlay">{renderError()}</View>}
      </View>,
    );
  }

  if (phase === 'error') return withPresenter(renderError());

  // ---- camera (default) ----
  // P-046: 오프라인 = 전체 J4 (카메라·갤러리·샘플 진입로 전부 이 화면으로 대체 —
  // 촬영 자체가 불가). 밝은 배경으로 다른 탭 J4와 톤 통일.
  if (offline) {
    return withPresenter(
      <View style={[styles.root, styles.center, { backgroundColor: C.surface }]}>
        {Close}
        <QueryErrorBlock error={probe.error} onRetry={() => void probe.refetch()} />
      </View>
    );
  }
  // P-137: 시스템 카메라 on = 커스텀 뷰파인더 대신 콰이엇 런처 — 안내 한 줄 +
  // 촬영(주 CTA) + 갤러리(보조). 권한은 launchCameraAsync가 자체 처리.
  if (FLAGS.systemCamera) {
    return withPresenter(
      <View style={styles.launcherRoot}>
        <Pressable style={[styles.close, { top: insets.top + 8, backgroundColor: C.surface2 }]} onPress={closeCamera} disabled={importing} hitSlop={8} testID="scan-close">
          <IconClose size={22} color={C.ink2} />
        </Pressable>
        {/* KB-813 모드 탭 — 시스템 카메라 런처(밝은 바탕) */}
        {FLAGS.processedFoodEnabled && (
          <View style={[styles.camModeTabs, { top: insets.top + 56 }]}>
            <ScanModeTabs value={scanMode} onChange={setScanMode} disabled={importing} />
          </View>
        )}
        <View style={styles.launcherBody}>
          <IconScanLines size={44} color={C.ink3} />
          <Text style={styles.launcherTitle}>{t('scan.cameraTitle')}</Text>
          <Text style={styles.launcherHint}>{t('scan.launcherHint')}</Text>
          <View style={{ alignSelf: 'stretch', marginTop: 10 }} testID="sys-capture-wrap">
            <Btn testID="scan-system-camera" onPress={() => void captureViaSystem()} disabled={capturing}>
              {t('photo.take')}
            </Btn>
          </View>
          <Pressable onPress={() => void pickFromGallery()} disabled={capturing} hitSlop={8} testID="sys-gallery">
            <Text style={styles.launcherGallery}>{t('scan.gallery')}</Text>
          </Pressable>
        </View>
        {ImportingOverlay}
        {GateSheet}
      </View>
    );
  }

  // 가공식품 분기와 같은 구조(camHost → cameraLayer → 화면) — 탭 전환에도 cameraLayer의 CameraView가 같은 인스턴스로 남는다
  return withPresenter(
    <View style={styles.camHost}>
      {cameraLayer}
      <CameraSlot o={{ kind: 'menu', onShot: (p: NonNullable<Photo>) => scanImage(p) }} render={cameraUi} /* KB-854: 라이브러리 링크 → 아래 바 갤러리 아이콘 */ />
    </View>,
  );

}


/** KB-140 unmatched 안내 — 중립 톤(unable 마크·ink 텍스트), 안전 인상 금지. */
function UnmatchedNotice({ open, onClose, t }: { open: boolean; onClose: () => void; t: (k: string) => string }) {
  if (!open) return null;
  return (
    <Pressable testID="unmatched-backdrop" style={styles.noticeBackdrop} onPress={onClose}>
      <Pressable testID="unmatched-card" style={styles.noticeCard} noTrack onPress={() => {}}>
        <RiskMark state="unable" size={30} />
        <Text style={styles.noticeTitle}>{t('scan.unmatchedSheetTitle')}</Text>
        <Text style={styles.noticeBody}>{t('scan.unmatchedSheetBody')}</Text>
        <View style={{ alignSelf: 'stretch' }}>
          <Btn testID="unmatched-gotit" variant="ghost" onPress={onClose}>{t('common.gotIt')}</Btn>
        </View>
      </Pressable>
    </Pressable>
  );
}

/** KB-789 유사 음식 대체 안내(시안 C4 14297:8300) — UnmatchedNotice 골격·스타일 공유. 글리프 sparkles 30 primary,
 *  버튼은 primary "See {{food}} details" 1개(= 대체 음식 상세), 닫기 = 배경 탭. 긍정 프레임·안전 단정 없음(헌법 III). */
function ClosestMatchNotice({
  dish,
  onClose,
  onSeeDetails,
  t,
}: {
  dish: ResultDish | null;
  onClose: () => void;
  onSeeDetails: (d: ResultDish) => void;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  if (!dish) return null;
  const food = dish.displayName || dish.koreanName || dish.rawMenuName;
  const vars = { scanned: dish.originalScannedName ?? dish.rawMenuName, food, foodKo: dish.koreanName ?? food };
  return (
    <Pressable testID="closest-backdrop" style={styles.noticeBackdrop} onPress={onClose}>
      <Pressable testID="closest-card" style={styles.noticeCard} noTrack onPress={() => {}}>
        <IconSparkles size={30} color={C.primary} />
        <Text style={styles.noticeTitle}>{t('scan.closestMatchSheetTitle')}</Text>
        <Text style={styles.noticeBody}>{t('scan.closestMatchSheetBody', vars)}</Text>
        <View style={{ alignSelf: 'stretch' }}>
          <Btn testID="closest-details" onPress={() => onSeeDetails(dish)}>{t('scan.closestMatchSeeDetails', vars)}</Btn>
        </View>
      </Pressable>
    </Pressable>
  );
}

function DishRow({ dish, unmatchedNote, riskLabel, onPress, onMarkPress }: { dish: ResultDish; unmatchedNote: string; riskLabel: string; onPress: () => void; onMarkPress?: () => void }) {
  const tone = riskTone[dish.risk];
  return (
    <Pressable testID="dishrow" style={styles.row} onPress={onPress}>
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
        <Text style={[styles.rowBadgeText, { color: riskText[dish.risk] }]}>{riskLabel}</Text>
      </View>
      {/* 조사 대기(matched=false)는 상세가 없어 이동 화살표도 없음 */}
      {dish.matched && <IconChevron size={16} color={C.ink3} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // KB-432 §1-1: 언더라인 탭 2개(반반) + 인식 배너 + 컨트롤 행
  resultTabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.line2, backgroundColor: '#fff' },
  resultTab: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  resultTabLabel: { fontSize: 14, fontWeight: '700', color: '#9196A1' }, // A-DS-03(KB-486)
  resultTabLabelOn: { color: '#2F3137' },
  resultTabBar: { alignSelf: 'stretch', height: 2, backgroundColor: 'transparent' },
  resultTabBarOn: { backgroundColor: '#2F3137' },
  recogBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, backgroundColor: primaryTint, paddingVertical: 12, paddingHorizontal: 20 }, // A-SC-02
  recogBannerText: { flex: 1, fontSize: 15, fontWeight: '500', color: C.primaryText }, // P-284: 틴트 위 대비
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10, backgroundColor: C.surface }, // A-SC-03
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1, minWidth: 0 }, // A-SC-04(off 색은 C-04)
  toggleLabel: { flexShrink: 1, fontSize: 14, fontWeight: '500', color: C.ink },
  sw: { width: 44, height: 24, borderRadius: 12, backgroundColor: C.inkDisabled, padding: 2, justifyContent: 'center' },
  swOn: { backgroundColor: C.primary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 2, height: 2 }, elevation: 2 },
  knobOn: { alignSelf: 'flex-end' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F2F3F6', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8 },
  sortLabel: { fontSize: 14, fontWeight: '700', color: '#4B4F58' },
  // P-161: 확인 모달 — 커뮤니티 이탈 모달 문법(라운드 26 카드) 전사
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  confirmCard: { alignSelf: 'stretch', backgroundColor: C.card, borderRadius: 26, padding: 22, gap: 8, ...shadow.shPop },
  confirmTitle: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  confirmBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19, textAlign: 'center' },
  // P-136 콰이엇 결과 크롬 (scanflow 토큰 — 흰 배경·헤어라인·색은 마크/CTA만)
  resultRoot: { flex: 1, backgroundColor: '#fff' },
  quietHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, minHeight: 56, paddingBottom: 10, backgroundColor: '#fff' }, // A-SC-01(SubHeader 규격)
  qhBack: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  qhTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: C.ink, textAlign: 'center' },
  seg: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 999, padding: 3 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  segBtnOn: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontFamily: font.bodyBold, fontSize: 12, color: C.ink3 },
  segTextOn: { color: C.ink },
  root: { flex: 1, backgroundColor: '#16110d' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  close: { position: 'absolute', left: 16, zIndex: 40, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }, // Codex #47 P1: 권한 스크림(z30) 위 — 탈출 경로 보장
  permission: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 36 },
  permTitle: { fontFamily: font.display, fontSize: 20, color: '#fff', textAlign: 'center' },
  // P-285: 권한 거부 Alert(4003:12690)
  permScrim: { backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', zIndex: 30 }, // A-SN-04
  permAlert: { width: 320, minHeight: 190, backgroundColor: '#FFFFFF', borderRadius: 10, paddingTop: 30, paddingHorizontal: 20, paddingBottom: 20, gap: 5 }, // A-SN-04
  permAlertTitle: { fontSize: 18, fontWeight: '600', color: '#262C31', textAlign: 'center' },
  permAlertBody: { fontSize: 15, fontWeight: '500', color: C.inkInfo, textAlign: 'center', lineHeight: 22.3 }, // A-SN-04(lineHeight만 — 색 대비는 Codex #45 위임 유지) // Codex #45 3차: 설정 유도 안내 대비(시안 #ADB4BA 이탈 — 대비 위임 범위, REPORTS)
  permBody: { fontFamily: font.body, fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20 },
  camTitleWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  camModeTabs: { position: 'absolute', left: 0, right: 0 },
  launcherRoot: { flex: 1, backgroundColor: '#fff' },
  launcherBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 12 },
  launcherTitle: { fontFamily: font.bodyBold, fontSize: 21, color: C.ink },
  launcherHint: { fontFamily: font.body, fontSize: 13.5, lineHeight: 20, color: C.ink2, textAlign: 'center' },
  launcherGallery: { fontFamily: font.bodyBold, fontSize: 14, color: C.primaryText, paddingVertical: 8 },
  camTitle: { fontFamily: font.bodySemi, fontSize: 18, lineHeight: 24, color: C.surface }, // title3-sbold gray-00
  camRoot: { flex: 1 }, // 바탕 = camHost(gray-1000) — 프리뷰 자리는 비워 cameraLayer가 비친다
  camHost: { flex: 1, backgroundColor: C.ink }, // 헤더 띠 0~100·홈 인디케이터 줄 = gray-1000
  camPreviewHole: { backgroundColor: 'transparent' },
  camPreview: { position: 'absolute', left: 0, right: 0, backgroundColor: C.gray800, overflow: 'hidden' }, // 라이브 프리뷰 100~780(권한 전 = 시안 gray-800 자리)
  camClose: { position: 'absolute', left: 20, zIndex: 40, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }, // 닫기 X (20,60) — 권한 스크림 위(Codex #47)
  camBadge: { position: 'absolute', alignSelf: 'center' },
  camDebug: { position: 'absolute', left: 20, right: 20 },
  // KB-854 카메라 v2 B(시안 12358:36958 · 375×812): 위 바 0~152 · 아래 바 588~812 gray-1000 불투명 · 코너 = 프리뷰 기준 위 24 · 좌우 32 · 아래 16
  camTopBar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: C.ink },
  camBottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.ink, paddingTop: 22, alignItems: 'center' }, // 칩 y610 = 바 위 22
  camCorners: { top: 24, left: 32, right: 32, bottom: 16 },
  camHintWrap: { position: 'absolute', left: 68, right: 68, alignItems: 'center' }, // KB-900(T-099): 코너(32 + 28) 안쪽 + 8 — 무료 배지가 아래 코너와 겹쳤다(길면 줄바꿈)
  camHint: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: C.surface, textAlign: 'center' }, // body-l3-regular gray-00(바 위 한 줄)
  camIconBtn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }, // 아이콘 28 · 터치 52(시안 hit region)
  camLink: { minHeight: 21, marginTop: 10, alignItems: 'center', justifyContent: 'center' }, // KB-854: 링크 y768 = 컨트롤 아래 10
  camLinkText: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: C.surface, textAlign: 'center' }, // body-l3-regular gray-00
  hidden: { opacity: 0 },
  landscapeBadge: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  landscapeBadgeText: { fontFamily: font.bodyBold, fontSize: 11, color: '#fff' },
  camRow: { width: 335, height: 88, marginTop: 24, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, // KB-854: (20,670) 335×88 — 갤러리 52 @12 · 셔터 링 72 가운데 · 전환 52 @271
  zoomRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  zoomPill: { height: 36, minWidth: 42, paddingHorizontal: 12, borderRadius: 18, backgroundColor: C.gray800, borderWidth: 1, borderColor: C.surface, alignItems: 'center', justifyContent: 'center' }, // DS chips 36:41(비활성 gray-800 + 흰 테두리) — 활성도 같은 폭 테두리(프레임 불변)
  zoomPillOn: { backgroundColor: C.surface },
  zoomPillText: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: C.surface }, // body-l3-regular
  zoomPillTextOn: { color: C.ink },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: C.surface, alignItems: 'center', justifyContent: 'center' }, // KB-854: 링 72 stroke 3 @ (131,6)
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
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.surface }, // KB-854: 셔터 60 @ (137,12)
  shutterSpacer: { width: 72, height: 72 },
  // P-222: 주 문구를 밀어내지 않는 보조 톤(작게·흐리게)
  statusText: { fontFamily: font.bodyBold, fontSize: 14, color: '#fff', textAlign: 'center' },
  // P-529(KB-854): 공용 화면 전체 중앙 — 하단 줌/셔터와 겹치지 않는다.
  importingOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  importingStatus: { maxWidth: '90%', backgroundColor: C.ink, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', gap: 8 },
  errStage: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 1, color: C.primary, textTransform: 'uppercase' }, // Codex #44 2차: 다크 배경 = 원색이 대비 우위(primaryText는 흰 바탕용)
  errBtns: { width: '100%', maxWidth: 300, gap: 10, marginTop: 6 },
  degradedNote: { fontFamily: font.body, fontSize: 12, color: '#fbbf24', textAlign: 'center' },
  // P-062② D2 스캐닝 오버레이
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

/** 공통 카메라 화면이 보이는 동안만 true — cameraLayer의 CameraView active(로딩·결과 화면 아래에서 카메라를 멈춘다) */
function CamOn({ onChange }: { onChange: (on: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

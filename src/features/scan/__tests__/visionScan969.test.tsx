/**
 * KB-969(P-592) 가공식품 사진 스캔(서버 비전) — 어댑터(경로 = 서버 state 정본) · 오류 코드 · 요청 ·
 * 흐름: 카메라 하나 → 업로드 → /scan/vision → 앞면 후보(기존 확정) / 후보 없음 / 성분표 결과(한 면 더 = 같은 분석) / 메뉴판(같은 경로로 메뉴 v2) / 그 밖(reason 안내) ·
 * 재시도 = 같은 키·같은 경로 · 하루 상한 = 닫기만 · KB-988: 플래그·온디바이스 OCR 경로 제거(ML Kit 호출 0).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let mockSim = true;
jest.mock('@/lib/simulator', () => ({ ...jest.requireActual('@/lib/simulator'), useIsSimulator: () => mockSim, isSimulator: async () => mockSim })); // KB-970: 기본 = 시뮬(주입 입력칸 있음)
jest.mock('react-native-reanimated', () => {
  const { View, Pressable, FlatList } = jest.requireActual('react-native');
  return { __esModule: true, default: { View, FlatList, createAnimatedComponent: (c: unknown) => c ?? Pressable }, createAnimatedComponent: (c: unknown) => c, useSharedValue: (v: unknown) => ({ value: v }), useAnimatedStyle: () => ({}), useAnimatedProps: () => ({}), withSpring: (v: unknown) => v, withTiming: (v: unknown) => v, withRepeat: (v: unknown) => v, Easing: { inOut: () => () => 0, out: () => () => 0, quad: 0 }, useReducedMotion: () => false };
});
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/Skeleton', () => { const { View } = jest.requireActual('react-native'); return { Shimmer: (p: object) => <View {...p} /> }; });
jest.mock('@/components/RemoteImage', () => { const { View } = jest.requireActual('react-native'); return { RemoteImage: (p: { uri: string }) => <View testID={`img:${p.uri}`} /> }; });
jest.mock('@/components/SubHeader', () => { const { Text } = jest.requireActual('react-native'); return { SubHeader: (p: { title: string }) => <Text testID="subheader">{p.title}</Text> }; });
jest.mock('@/components/FlameShape', () => { const { View } = jest.requireActual('react-native'); return { FlameShape: (p: { state: string }) => <View testID={`flame-${p.state}`} /> }; });
jest.mock('@/components/Btn', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return { Btn: (p: { testID: string; onPress?: () => void; variant?: string; children?: React.ReactNode }) => <Pressable testID={p.testID} onPress={p.onPress} accessibilityState={{ disabled: p.variant === 'off' }}><Text>{p.children}</Text></Pressable> };
});
jest.mock('@/components/icons', () => ({ ...jest.requireActual('@/components/icons'), IconCamera: () => null, IconTabFood: () => null, IconLock: () => null, IconSearch: () => null, IconClose: () => null }));
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));
jest.mock('@/lib/onboarding/data', () => ({ restrictionLabel: (c: string) => `L(${c})` }));
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
// KB-908(T-050): 후보 화면 이탈 확인(useLeaveConfirm) — 마지막 usePreventRemove 호출의 (막는지, 콜백) 기록
const mockNavDispatch = jest.fn();
const mockPrevent: { on: boolean; cb: ((o: { data: { action: unknown } }) => void) | null } = { on: false, cb: null };
jest.mock('expo-router/build/react-navigation/core', () => ({
  usePreventRemove: (on: boolean, cb: (o: { data: { action: unknown } }) => void) => { mockPrevent.on = on; mockPrevent.cb = cb; },
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), navigate: jest.fn(), canGoBack: () => true }), useLocalSearchParams: () => mockParams, useNavigation: () => ({ dispatch: (a: unknown) => mockNavDispatch(a) }) }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
const mockPost = jest.fn();
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => {
  class MockApiError extends Error { status?: number; code?: string; constructor(m: string, s?: number, c?: string) { super(m); this.status = s; this.code = c; } }
  return { api: { post: (...a: unknown[]) => mockPost(...a), get: (...a: unknown[]) => mockGet(...a) }, apiLang: () => 'en', ApiError: MockApiError };
});
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
let mockRestrictions: { code: string }[] = [{ code: 'SHRIMP' }];
let mockProfileMissing = false;
let mockFreeUntil: string | null = null; // KB-877: 서버 무료 창 끝 // 프로필 대기·실패(data 없음)
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: mockProfileMissing ? undefined : { id: '41', restrictions: mockRestrictions, packagedFreeUntil: mockFreeUntil } }) })); // KB-865: 판정 캐시 키 = 회피 코드 집합 · 0개 = 시안 45
const mockOcr = jest.fn();
const mockUploadPhoto = jest.fn(async (_p: unknown): Promise<string | null> => null);
jest.mock('@/lib/api/scanImage', () => ({ ...jest.requireActual('@/lib/api/scanImage'), uploadNameScanPhoto: (p: unknown) => mockUploadPhoto(p) }));
jest.mock('@/lib/scan/ocr', () => ({ recognizeMenuLines: (...a: unknown[]) => mockOcr(...a) }));
jest.mock('@/lib/openExternal', () => ({ openAppSettings: jest.fn(async () => true) }));
jest.mock('expo-image-picker', () => ({}));
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockUuid}` }));
const mockVisionUpload = jest.fn(async (_p: unknown): Promise<string> => 'images/packaged-scans/v1.jpg');
jest.mock('@/lib/api/scanImage', () => ({ ...jest.requireActual('@/lib/api/scanImage'), uploadNameScanPhoto: (p: unknown) => mockUploadPhoto(p), uploadVisionScanPhoto: (p: unknown) => mockVisionUpload(p) }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { ApiError } from '@/lib/api/client';
import { adaptVisionScan } from '@/lib/api/processedFoodAdapter';
import { scanFailureOf, scanProcessedVision } from '@/lib/data/useProcessedScan';
import { PackagedScanFlow, confidenceBand, visionBodyKey, visionReasonKey, type ScanCamOpts } from '../PackagedScanFlow';
import { FLAGS } from '@/lib/flags';
/* eslint-enable import/first */

const cand = (id: number, rn: string) => ({ id, reportNo: rn, productName: `P${id}`, maker: 'Binggrae', foodType: '우유', imageUrl: null });
const LABEL = { analysisId: 'V1', state: 'LABEL_RESULT', labelSource: 'DECLARED', detections: [], mayContain: [], avoidance: [], rawText: '원재료명: 원유, 바나나농축과즙', charged: false, verdict: 'AVOID', avoidMatches: [{ code: 'MILK', evidence: ['원유'] }], mayContainMatches: [], unclearIngredients: [], majorAllergens: ['MILK'], ingredients: { translated: null, original: '원유, 바나나농축과즙' }, allergenStatement: null };
const V = (over: object) => ({ analysisId: 'uuid-1', confidence: 0.92, reason: null, front: null, label: null, warnings: [], ...over });
const DETAIL = { id: 11, reportNo: 'R1', productName: '바나나맛우유', maker: '빙그레', foodType: '우유', labelSource: 'DECLARED', allergens: '우유', detections: [], avoidance: [], source: { provider: 'HACCP', attributionKey: 'processedFood.source.haccp' }, image: null };

const trees: ReactTestRenderer[] = [];
let qc: QueryClient;
beforeEach(() => { FLAGS.packagedLabelScan = true; mockUuid = 0; qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); mockParams = {}; mockRestrictions = [{ code: 'MILK' }]; });
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); qc.clear(); jest.clearAllMocks(); });
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); }); trees.push(t); return t; };
const ids = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string').map((n) => n.props.testID as string);
const press = async (t: ReactTestRenderer, id: string) => { await act(async () => { await t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress(); }); await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const texts = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children as string);
const mockShot = { uri: 'file:shot.jpg', width: 3000, height: 4000 };
let lastCam: ScanCamOpts | null = null;
function mockCamera(o: ScanCamOpts) {
  lastCam = o;
  const { View, Pressable } = jest.requireActual('react-native');
  return (
    <View testID="cam-vision">
      <Pressable testID="cam-shutter" onPress={() => o.onShot(mockShot)} />
      {o.link && <Pressable testID={o.link.testID} onPress={o.link.onPress} />}
      {o.onClose && <Pressable testID="cam-close" onPress={o.onClose} />}
      {o.debug}
    </View>
  );
}
const mockOnMenu = jest.fn();
const onClose = jest.fn();
const flow = () => render(<PackagedScanFlow mode="packaged" onMode={jest.fn()} onClose={onClose} renderCamera={mockCamera} onMenuPhoto={mockOnMenu} />);
const visionCalls = () => mockPost.mock.calls.filter(([p]) => p === '/api/processed-foods/scan/vision');

describe('KB-969 어댑터·요청·오류', () => {
  it('경로는 서버 state 정본: CANDIDATES인데 후보 0 = 후보 없음 · LABEL_RESULT인데 label 없음 = 다시 찍기 · 모르는 kind = OTHER · CONFIRMED', () => {
    expect(adaptVisionScan(V({ kind: 'PACKAGE_FRONT', state: 'CANDIDATES', front: { candidates: [cand(1, 'R1')] } })).route).toBe('candidates');
    expect(adaptVisionScan(V({ kind: 'PACKAGE_FRONT', state: 'CANDIDATES', front: { candidates: [] } })).route).toBe('none');
    expect(adaptVisionScan(V({ kind: 'PACKAGE_FRONT', state: 'NO_CANDIDATE', front: { candidates: [cand(1, 'R1')] } })).front?.candidates).toEqual([]);
    expect(adaptVisionScan(V({ kind: 'INGREDIENT_LABEL', state: 'LABEL_RESULT', label: null })).route).toBe('other');
    expect(adaptVisionScan(V({ kind: 'INGREDIENT_LABEL', state: 'LABEL_RESULT', label: LABEL })).route).toBe('label');
    expect(adaptVisionScan(V({ kind: 'MENU', state: 'NOT_PACKAGED' })).route).toBe('menu');
    expect(adaptVisionScan(V({ kind: 'SELFIE', state: 'NOT_PACKAGED', reason: 'WEIRD' }))).toMatchObject({ kind: 'OTHER', route: 'other', reason: null });
    expect(adaptVisionScan(V({ kind: 'PACKAGE_FRONT', state: 'CONFIRMED' })).route).toBe('confirmed');
    expect(adaptVisionScan(V({ kind: 'OTHER', state: 'NOT_PACKAGED', confidence: 1.7, reason: 'GLARE' }))).toMatchObject({ confidence: 1, reason: 'GLARE' });
  });
  it('#542 공부 반영: reason UNKNOWN·모르는 값 = null(안내 unknown) · kind와 어긋난·모르는 state = 다시 찍기 · 재전송 REJECTED = 후보 없음 · LABEL_RESULT 재전송 = 결과', () => {
    const unknown = adaptVisionScan(V({ kind: 'OTHER', state: 'OTHER', reason: 'UNKNOWN' }));
    expect(unknown).toMatchObject({ route: 'other', reason: null });
    expect(visionReasonKey(unknown.reason)).toBe('unknown');
    expect(visionReasonKey(adaptVisionScan(V({ kind: 'OTHER', state: 'NOT_PACKAGED', reason: 'SOMETHING_NEW' })).reason)).toBe('unknown');
    expect(adaptVisionScan(V({ kind: 'PACKAGE_FRONT', state: 'OTHER', reason: 'UNKNOWN', front: { candidates: [cand(1, 'R1')] } })).route).toBe('other');
    expect(adaptVisionScan(V({ kind: 'PACKAGE_FRONT', state: 'REJECTED', front: { candidates: [] } })).route).toBe('none');
    expect(adaptVisionScan(V({ kind: 'INGREDIENT_LABEL', state: 'LABEL_RESULT', label: LABEL })).route).toBe('label');
    expect(adaptVisionScan(V({ kind: 'INGREDIENT_LABEL', state: 'OTHER', label: LABEL })).route).toBe('other');
    expect(adaptVisionScan(V({ kind: 'MENU', state: 'OTHER', reason: 'UNKNOWN' })).route).toBe('other');
  });
  it('오류: PFOOD-013 = 하루 상한 · PFOOD-014 = 용량 · SCAN-006·008 = 혼잡 · 코드 없는 503·429는 기존 그대로 network(다른 스캔 문구 무변)', () => {
    expect(scanFailureOf(new ApiError('x', 429, 'PFOOD-013'))).toBe('visionLimit');
    expect(scanFailureOf(new ApiError('x', 400, 'PFOOD-014'))).toBe('tooLarge');
    expect(scanFailureOf(new ApiError('x', 503, 'SCAN-008'))).toBe('busy');
    expect(scanFailureOf(new ApiError('x', 503, 'SCAN-006'))).toBe('busy');
    expect(scanFailureOf(new ApiError('x', 503))).toBe('network');
    expect(scanFailureOf(new ApiError('x', 429))).toBe('network');
  });
  it('요청 = POST /api/processed-foods/scan/vision {imagePath, clientRequestId, lang} + 3.2 + 120초', async () => {
    mockPost.mockResolvedValueOnce(V({ kind: 'MENU', state: 'NOT_PACKAGED' }));
    await scanProcessedVision('images/p.jpg', 'k-1', 'ko');
    expect(mockPost).toHaveBeenCalledWith('/api/processed-foods/scan/vision', { imagePath: 'images/p.jpg', clientRequestId: 'k-1', lang: 'ko' }, { headers: { 'X-API-Version': '3.2' }, timeoutMs: 120_000 });
  });
  it('Q-412 ②: visionBodyKey — 첫 촬영은 reason 그대로 · 한 면 더는 모름·NOT_FOOD = notLabel, 품질 reason 유지', () => {
    expect(visionBodyKey(null, false)).toBe('unknown');
    expect(visionBodyKey('NOT_FOOD', false)).toBe('notFood');
    expect(visionBodyKey(null, true)).toBe('notLabel');
    expect(visionBodyKey('NOT_FOOD', true)).toBe('notLabel');
    for (const r of ['BLURRY', 'TOO_DARK', 'GLARE', 'CROPPED'] as const) expect(visionBodyKey(r, true)).toBe(visionReasonKey(r));
  });
  it('계측 보조: 확신도 구간 · reason 키(모름 = unknown)', () => {
    expect([confidenceBand(0.95), confidenceBand(0.6), confidenceBand(0.2)]).toEqual(['high', 'mid', 'low']);
    expect([visionReasonKey('TOO_DARK'), visionReasonKey('NOT_FOOD'), visionReasonKey(null)]).toEqual(['tooDark', 'notFood', 'unknown']);
  });
});

describe('KB-969 흐름(사진 스캔 — KB-988부터 유일 경로)', () => {
  it('카메라 하나 — kind vision · "성분표로" 링크 없음 · 셔터 = 업로드 → /scan/vision(촬영 1회 키) · 온디바이스 OCR 0', async () => {
    mockPost.mockResolvedValueOnce(V({ kind: 'PACKAGE_FRONT', state: 'CANDIDATES', front: { productName: '바나나맛우유', maker: '빙그레', candidates: [cand(11, 'R1'), cand(12, 'R2')] } }));
    const t = flow();
    expect(ids(t)).toContain('cam-vision');
    expect(lastCam?.link ?? null).toBeNull();
    await press(t, 'cam-shutter');
    expect(mockVisionUpload).toHaveBeenCalledWith(mockShot);
    expect(visionCalls()[0][1]).toEqual({ imagePath: 'images/packaged-scans/v1.jpg', clientRequestId: 'uuid-1', lang: 'en', menuFastPathEligible: true }); // KB-1015: 첫 촬영 신호
    expect(mockOcr).not.toHaveBeenCalled();
    expect(ids(t)).toContain('pscan-candidates');
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_scan_vision', { kind: 'PACKAGE_FRONT', state: 'candidates', confidence: 'high', reason: 'none', side: 'first' });
  });
  it('앞면 후보 탭 = 기존 확정(같은 analysisId) → 상세', async () => {
    mockPost.mockResolvedValueOnce(V({ kind: 'PACKAGE_FRONT', state: 'CANDIDATES', front: { candidates: [cand(11, 'R1')] } }));
    mockPost.mockResolvedValueOnce({ analysisId: 'uuid-1', state: 'CONFIRMED', charged: false, product: DETAIL });
    const t = flow();
    await press(t, 'cam-shutter');
    await press(t, 'pscan-candidate-11');
    expect(mockPost).toHaveBeenLastCalledWith('/api/processed-foods/scan/confirm', { analysisId: 'uuid-1', reportNo: 'R1' }, expect.anything());
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/processed-foods\/11\?scan=1/));
  });
  it('후보 없음 = 기존 "이름으로 찾기·성분표" 화면', async () => {
    mockPost.mockResolvedValueOnce(V({ kind: 'PACKAGE_FRONT', state: 'NO_CANDIDATE', front: { productName: 'b나나', candidates: [] } }));
    const t = flow();
    await press(t, 'cam-shutter');
    expect(ids(t)).toEqual(expect.arrayContaining(['pscan-none', 'pscan-find-by-name', 'pscan-to-label']));
  });
  it('성분표 = 기존 결과 화면(판정 띠) · 한 면 더 = 비전 → 같은 분석에 /scan/label(읽은 원문 두 면)', async () => {
    mockPost.mockResolvedValueOnce(V({ kind: 'INGREDIENT_LABEL', state: 'LABEL_RESULT', label: { ...LABEL, analysisId: 'uuid-1' } }));
    const t = flow();
    await press(t, 'cam-shutter');
    expect(ids(t)).toEqual(expect.arrayContaining(['pscan-label-result', 'pscan-result-band-danger']));
    await press(t, 'pscan-label-more');
    expect(ids(t)).toContain('cam-vision');
    mockPost.mockResolvedValueOnce(V({ analysisId: 'uuid-2', kind: 'INGREDIENT_LABEL', state: 'LABEL_RESULT', label: { ...LABEL, analysisId: 'uuid-2', rawText: '알레르기: 우유 함유' } }));
    mockPost.mockResolvedValueOnce({ ...LABEL, analysisId: 'uuid-1' });
    await press(t, 'cam-shutter');
    const label = mockPost.mock.calls.find(([p]) => p === '/api/processed-foods/scan/label')!;
    expect(label[1]).toMatchObject({ analysisId: 'uuid-1', pages: [{ ocrText: LABEL.rawText }, { ocrText: '알레르기: 우유 함유' }] });
    expect(ids(t)).toContain('pscan-label-result');
  });
  it('한 면 더에 성분표가 아닌 사진 = 다시 찍기(기존 결과에 합치지 않음)', async () => {
    mockPost.mockResolvedValueOnce(V({ kind: 'INGREDIENT_LABEL', state: 'LABEL_RESULT', label: { ...LABEL, analysisId: 'uuid-1' } }));
    const t = flow();
    await press(t, 'cam-shutter');
    await press(t, 'pscan-label-more');
    mockPost.mockResolvedValueOnce(V({ analysisId: 'uuid-2', kind: 'MENU', state: 'NOT_PACKAGED' }));
    await press(t, 'cam-shutter');
    expect(ids(t)).toContain('pscan-vision-other');
    expect(mockPost.mock.calls.some(([p]) => p === '/api/processed-foods/scan/label')).toBe(false);
    expect(mockOnMenu).not.toHaveBeenCalled();
  });
  it('Q-412 ①: 판정 전 로딩 = 중립 문구(사진을 읽고 있어요·찍은 사진) — 메뉴판일 수도 있어 "포장" 문구 금지', async () => {
    mockPost.mockReturnValueOnce(new Promise(() => {})); // 판정 대기
    const t = flow();
    await act(async () => {
      void t.root.findAll((n) => n.props?.testID === 'cam-shutter' && typeof n.props?.onPress === 'function')[0].props.onPress(); // 판정이 안 끝나므로 기다리지 않는다
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(ids(t)).toContain('pscan-reading');
    expect(texts(t)).toEqual(expect.arrayContaining(['packagedScan.vision.reading', 'scanCamera.capturedPhoto']));
    expect(texts(t)).not.toContain('packagedScan.reading');
    expect(texts(t)).not.toContain('scanCamera.capturedPackage');
  });
  it.each([
    ['PACKAGE_FRONT', 'CANDIDATES', null, 'packagedScan.vision.notLabel'],
    ['MENU', 'NOT_PACKAGED', null, 'packagedScan.vision.notLabel'],
    ['OTHER', 'NOT_PACKAGED', 'NOT_FOOD', 'packagedScan.vision.notLabel'],
    ['OTHER', 'NOT_PACKAGED', 'BLURRY', 'packagedScan.vision.blurry'],
  ])('Q-412 ②: 한 면 더에 %s(%s, reason %s) = 성분표 면 안내(품질 reason 우선) — unknown 문구 금지', async (kind, state, reason, key) => {
    mockPost.mockResolvedValueOnce(V({ kind: 'INGREDIENT_LABEL', state: 'LABEL_RESULT', label: { ...LABEL, analysisId: 'uuid-1' } }));
    const t = flow();
    await press(t, 'cam-shutter');
    await press(t, 'pscan-label-more');
    mockPost.mockResolvedValueOnce(V({ analysisId: 'uuid-2', kind, state, reason, confidence: 0.99, front: kind === 'PACKAGE_FRONT' ? { candidates: [cand(11, 'R1')] } : null }));
    await press(t, 'cam-shutter');
    expect(ids(t)).toContain('pscan-vision-other');
    expect(texts(t)).toContain(key);
    expect(texts(t)).not.toContain('packagedScan.vision.unknown');
  });
  it('메뉴판 = 같은 사진·이미 올린 경로로 메뉴 v2(onMenuPhoto) · 흐름은 카메라로', async () => {
    mockPost.mockResolvedValueOnce(V({ kind: 'MENU', state: 'NOT_PACKAGED', confidence: 0.6 }));
    const t = flow();
    await press(t, 'cam-shutter');
    expect(mockOnMenu).toHaveBeenCalledWith(mockShot, 'images/packaged-scans/v1.jpg');
    expect(ids(t)).toContain('cam-vision');
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_scan_vision', expect.objectContaining({ kind: 'MENU', state: 'menu', confidence: 'mid' }));
  });
  it.each([['BLURRY', 'packagedScan.vision.blurry'], ['NOT_FOOD', 'packagedScan.vision.notFood'], [null, 'packagedScan.vision.unknown']])('그 밖(OTHER %s) = reason 안내 + 다시 찍기 → 카메라', async (reason, key) => {
    mockPost.mockResolvedValueOnce(V({ kind: 'OTHER', state: 'NOT_PACKAGED', reason }));
    const t = flow();
    await press(t, 'cam-shutter');
    expect(ids(t)).toContain('pscan-vision-other');
    expect(texts(t)).toEqual(expect.arrayContaining(['packagedScan.vision.retakeTitle', key]));
    await press(t, 'pscan-retake');
    expect(ids(t)).toContain('cam-vision');
  });
  it('UNKNOWN(키 재시도 초과·만료) = unknown 안내 → 다시 찍기 = 새 촬영·새 clientRequestId', async () => {
    mockPost.mockResolvedValueOnce(V({ kind: 'OTHER', state: 'OTHER', reason: 'UNKNOWN' }));
    const t = flow();
    await press(t, 'cam-shutter');
    expect(texts(t)).toContain('packagedScan.vision.unknown');
    await press(t, 'pscan-retake');
    mockPost.mockResolvedValueOnce(V({ analysisId: 'uuid-2', kind: 'MENU', state: 'NOT_PACKAGED' }));
    await press(t, 'cam-shutter');
    expect(visionCalls().map((c) => (c[1] as { clientRequestId: string }).clientRequestId)).toEqual(['uuid-1', 'uuid-2']);
    expect(mockVisionUpload).toHaveBeenCalledTimes(2);
  });
  it('전송 실패 → 다시 시도 = 같은 키·같은 경로(재업로드 0 — 서버 멱등)', async () => {
    mockPost.mockRejectedValueOnce(new Error('NETWORK: x'));
    const t = flow();
    await press(t, 'cam-shutter');
    expect(ids(t)).toContain('pscan-error-network');
    mockPost.mockResolvedValueOnce(V({ kind: 'MENU', state: 'NOT_PACKAGED' }));
    await press(t, 'pscan-retry');
    expect(visionCalls().map((c) => (c[1] as { clientRequestId: string }).clientRequestId)).toEqual(['uuid-1', 'uuid-1']);
    expect(mockVisionUpload).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_scan_fail', { stage: 'vision', result: 'network' });
  });
  it('업로드 실패도 오류 화면(다시 시도 = 업로드부터) · 하루 상한 = 닫기만(다시 찍기 0)', async () => {
    mockVisionUpload.mockRejectedValueOnce(new Error('NETWORK: put'));
    const t = flow();
    await press(t, 'cam-shutter');
    expect(ids(t)).toContain('pscan-error-network');
    expect(visionCalls()).toHaveLength(0);
    mockPost.mockRejectedValueOnce(new ApiError('limit', 429, 'PFOOD-013'));
    await press(t, 'pscan-retry');
    expect(mockVisionUpload).toHaveBeenCalledTimes(2);
    expect(ids(t)).toContain('pscan-error-visionLimit');
    expect(ids(t)).toContain('pscan-close');
    expect(ids(t)).not.toContain('pscan-retake');
  });
  it('Codex #412: 혼잡(SCAN-006) 화면에도 다시 시도 — 같은 키·같은 경로(재업로드 0)', async () => {
    mockPost.mockRejectedValueOnce(new ApiError('busy', 503, 'SCAN-006'));
    const t = flow();
    await press(t, 'cam-shutter');
    expect(ids(t)).toContain('pscan-error-busy');
    mockPost.mockResolvedValueOnce(V({ kind: 'MENU', state: 'NOT_PACKAGED' }));
    await press(t, 'pscan-retry');
    expect(visionCalls().map((c) => (c[1] as { imagePath: string; clientRequestId: string }))).toEqual([
      expect.objectContaining({ imagePath: 'images/packaged-scans/v1.jpg', clientRequestId: 'uuid-1' }),
      expect.objectContaining({ imagePath: 'images/packaged-scans/v1.jpg', clientRequestId: 'uuid-1' }),
    ]);
    expect(mockVisionUpload).toHaveBeenCalledTimes(1);
  });
  it('Codex #412: 업로드 중 로딩을 닫으면 업로드가 끝나도 비전 호출 0(하루 상한 소모 금지)', async () => {
    let finish!: (p: string) => void;
    mockVisionUpload.mockImplementationOnce(() => new Promise<string>((r) => { finish = r; }));
    const t = flow();
    await act(async () => {
      void t.root.findAll((n) => n.props?.testID === 'cam-shutter' && typeof n.props?.onPress === 'function')[0].props.onPress(); // 업로드가 안 끝나므로 기다리지 않는다
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(ids(t)).toContain('pscan-reading');
    await press(t, 'scan-loading-close');
    await act(async () => { finish('images/packaged-scans/v1.jpg'); await new Promise((r) => setTimeout(r, 0)); });
    expect(visionCalls()).toHaveLength(0);
    expect(ids(t)).toContain('cam-vision');
  });
  it('Codex #412: 성분표 4면 결과 → 사진 보기 → 다시 찍기 = 마지막 면 교체(원본에 붙여 잘려 나가지 않음)', async () => {
    const page = (id: string, rawText: string) => V({ analysisId: id, kind: 'INGREDIENT_LABEL', state: 'LABEL_RESULT', label: { ...LABEL, analysisId: id, rawText } });
    mockPost.mockResolvedValueOnce(page('uuid-1', 'A면'));
    const t = flow();
    await press(t, 'cam-shutter');
    for (const [i, txt] of [[2, 'B면'], [3, 'C면'], [4, 'D면']] as const) {
      await press(t, 'pscan-label-more');
      mockPost.mockResolvedValueOnce(page(`uuid-${i}`, txt));
      mockPost.mockResolvedValueOnce({ ...LABEL, analysisId: 'uuid-1' });
      await press(t, 'cam-shutter');
    }
    await press(t, 'pscan-result-review'); // 4면 = 사진 보기
    await press(t, 'pscan-label-retake'); // D면을 다시 찍는다
    mockPost.mockResolvedValueOnce(page('uuid-5', 'E면'));
    mockPost.mockResolvedValueOnce({ ...LABEL, analysisId: 'uuid-1' });
    await press(t, 'cam-shutter');
    const labels = mockPost.mock.calls.filter(([p]) => p === '/api/processed-foods/scan/label');
    expect(labels.at(-1)![1]).toMatchObject({ analysisId: 'uuid-1', pages: ['A면', 'B면', 'C면', 'E면'].map((ocrText) => ({ ocrText })) });
  });

});

describe('KB-1015 첫 사진 메뉴판 바로가기 신호(menuFastPathEligible)', () => {
  const fastOf = () => visionCalls().map((c) => (c[1] as { menuFastPathEligible?: boolean }).menuFastPathEligible ?? 'absent');
  it('어댑터: true = 키 실음 · 기본(false) = 키 자체 없음(현행 body와 같음)', async () => {
    mockPost.mockResolvedValue(V({ kind: 'MENU', state: 'NOT_PACKAGED' }));
    await scanProcessedVision('images/p.jpg', 'k-1', 'ko', true);
    await scanProcessedVision('images/p.jpg', 'k-2', 'ko');
    expect(visionCalls().map((c) => c[1])).toEqual([
      { imagePath: 'images/p.jpg', clientRequestId: 'k-1', lang: 'ko', menuFastPathEligible: true },
      { imagePath: 'images/p.jpg', clientRequestId: 'k-2', lang: 'ko' },
    ]);
  });
  it('첫 촬영 = true · 성분표 한 면 더 = 신호 없음', async () => {
    mockPost.mockResolvedValueOnce(V({ kind: 'INGREDIENT_LABEL', state: 'LABEL_RESULT', label: { ...LABEL, analysisId: 'uuid-1' } }));
    const t = flow();
    await press(t, 'cam-shutter');
    await press(t, 'pscan-label-more');
    mockPost.mockResolvedValueOnce(V({ analysisId: 'uuid-2', kind: 'INGREDIENT_LABEL', state: 'LABEL_RESULT', label: { ...LABEL, analysisId: 'uuid-2', rawText: '알레르기: 우유 함유' } }));
    mockPost.mockResolvedValueOnce({ ...LABEL, analysisId: 'uuid-1' });
    await press(t, 'cam-shutter');
    expect(fastOf()).toEqual([true, 'absent']);
  });
  it('다시 찍기(OTHER·UNKNOWN 뒤) = 같은 첫 사진 단계 → 신호 true · 새 키', async () => {
    mockPost.mockResolvedValueOnce(V({ kind: 'OTHER', state: 'OTHER', reason: 'UNKNOWN' }));
    const t = flow();
    await press(t, 'cam-shutter');
    await press(t, 'pscan-retake');
    mockPost.mockResolvedValueOnce(V({ analysisId: 'uuid-2', kind: 'MENU', state: 'NOT_PACKAGED' }));
    await press(t, 'cam-shutter');
    expect(fastOf()).toEqual([true, true]);
    expect(visionCalls().map((c) => (c[1] as { clientRequestId: string }).clientRequestId)).toEqual(['uuid-1', 'uuid-2']);
  });
  it('전송 실패 → 다시 시도 = 같은 키·같은 경로·같은 신호', async () => {
    mockPost.mockRejectedValueOnce(new Error('NETWORK: x'));
    const t = flow();
    await press(t, 'cam-shutter');
    mockPost.mockResolvedValueOnce(V({ kind: 'MENU', state: 'NOT_PACKAGED' }));
    await press(t, 'pscan-retry');
    expect(visionCalls().map((c) => c[1])).toEqual([
      { imagePath: 'images/packaged-scans/v1.jpg', clientRequestId: 'uuid-1', lang: 'en', menuFastPathEligible: true },
      { imagePath: 'images/packaged-scans/v1.jpg', clientRequestId: 'uuid-1', lang: 'en', menuFastPathEligible: true },
    ]);
    expect(mockVisionUpload).toHaveBeenCalledTimes(1);
  });
  it('다시 찍기 뒤 실패 → 다시 시도도 같은 키·같은 신호(true)', async () => {
    mockPost.mockResolvedValueOnce(V({ kind: 'OTHER', state: 'OTHER', reason: 'UNKNOWN' }));
    const t = flow();
    await press(t, 'cam-shutter');
    await press(t, 'pscan-retake');
    mockPost.mockRejectedValueOnce(new Error('NETWORK: x'));
    await press(t, 'cam-shutter');
    mockPost.mockResolvedValueOnce(V({ kind: 'MENU', state: 'NOT_PACKAGED' }));
    await press(t, 'pscan-retry');
    expect(fastOf()).toEqual([true, true, true]);
    expect(visionCalls().map((c) => (c[1] as { clientRequestId: string }).clientRequestId)).toEqual(['uuid-1', 'uuid-2', 'uuid-2']);
  });
});

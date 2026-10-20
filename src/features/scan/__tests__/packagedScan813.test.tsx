/**
 * KB-813 가공식품 스캔 — 어댑터(NO_CANDIDATE·≤5·charged는 true만) · 오류 분류 · 요청(3.2·2000자 상한) ·
 * 흐름(촬영→OCR→후보→확정→상세 · 해당 없음 → 성분표(같은 분석 문구) · 후보 없음 → 성분표 · 촬영 화면에서 바로 = 같은 분석 문구 0 ·
 * 네트워크 실패 = 차감 0 + 같은 analysisId 재시도 · 만료 · OCR 빈 결과 = 서버 호출 0) · 성분표 촬영 버튼 비활성 · 모드 탭(음식 사진 = 준비 중) ·
 * 상세 "스캔 결과" 띠(charged만 차감 표시).
 */
import * as fs from 'fs';
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), navigate: jest.fn(), canGoBack: () => true }), useLocalSearchParams: () => mockParams }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
const mockPost = jest.fn();
jest.mock('@/lib/api/client', () => {
  class MockApiError extends Error { status?: number; code?: string; constructor(m: string, s?: number, c?: string) { super(m); this.status = s; this.code = c; } }
  return { api: { post: (...a: unknown[]) => mockPost(...a), get: jest.fn() }, apiLang: () => 'en', ApiError: MockApiError };
});
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
const mockOcr = jest.fn();
jest.mock('@/lib/scan/ocr', () => ({ recognizeMenuLines: (...a: unknown[]) => mockOcr(...a) }));
let mockGranted = true;
jest.mock('@/lib/openExternal', () => ({ openAppSettings: jest.fn(async () => true) }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: async () => ({ granted: mockGranted }),
  launchCameraAsync: async () => ({ canceled: false, assets: [{ uri: 'file:front.jpg', width: 900, height: 1200 }] }),
}));

/* eslint-disable import/first -- jest.mock 뒤 */
import { ApiError } from '@/lib/api/client';
import { adaptScanConfirm, adaptScanName } from '@/lib/api/processedFoodAdapter';
import { scanFailureOf, scanProcessedName } from '@/lib/data/useProcessedScan';
import { PackagedScanFlow } from '../PackagedScanFlow';
import { ScanModeTabs } from '../ScanModeTabs';
import Detail from '@/app/processed-foods/[id]';
/* eslint-enable import/first */

const cand = (id: number, rn: string) => ({ id, reportNo: rn, productName: `P${id}`, maker: 'Nongshim', foodType: '과자', imageUrl: 'http://h/x.jpg' });
const DETAIL = { id: 11, reportNo: 'R1', productName: '새우깡', maker: '농심', foodType: '과자', labelSource: 'DECLARED', allergens: '밀', detections: [], avoidance: [], source: { provider: 'HACCP', attributionKey: 'processedFood.source.haccp' }, image: null };

const trees: ReactTestRenderer[] = [];
let qc: QueryClient;
beforeEach(() => { qc = new QueryClient(); mockParams = {}; mockGranted = true; });
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); jest.clearAllMocks(); });
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); }); trees.push(t); return t; };
const ids = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string').map((n) => n.props.testID as string);
const press = async (t: ReactTestRenderer, id: string) => { await act(async () => { await t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress(); }); await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const flow = () => render(<PackagedScanFlow mode="packaged" onMode={jest.fn()} onClose={jest.fn()} />);
const texts = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children as string);

describe('어댑터·요청·오류', () => {
  it('이름 스캔: CANDIDATES만 후보 · 최대 5 · reportNo 문자열 · NO_CANDIDATE = 0(후보가 와도 무시)', () => {
    const many = Array.from({ length: 7 }, (_, i) => cand(i, `R${i}`));
    expect(adaptScanName({ analysisId: 'a', state: 'CANDIDATES', candidates: many }).candidates.map((c) => c.reportNo)).toEqual(['R0', 'R1', 'R2', 'R3', 'R4']);
    expect(adaptScanName({ analysisId: 'a', state: 'NO_CANDIDATE', candidates: many }).candidates).toEqual([]);
    expect(adaptScanName({ analysisId: 'a', state: 'CANDIDATES', candidates: [cand(1, 'R1')] }).candidates[0].imageUrl).toBe('https://h/x.jpg');
  });
  it('확정: charged는 true일 때만 · REJECTED/상품 없음 = rejected', () => {
    expect(adaptScanConfirm({ analysisId: 'a', state: 'CONFIRMED', charged: true, product: DETAIL as never }).charged).toBe(true);
    expect(adaptScanConfirm({ analysisId: 'a', state: 'CONFIRMED', charged: null, product: DETAIL as never }).charged).toBe(false);
    expect(adaptScanConfirm({ analysisId: 'a', state: 'REJECTED', charged: false, product: null })).toMatchObject({ rejected: true, product: null });
  });
  it('오류 분류: 네트워크(ApiError 아님)·5xx = network · PFOOD-003 만료 · PFOOD-004 충돌 · SCAN-004 한도', () => {
    expect(scanFailureOf(new Error('x'))).toBe('network');
    expect(scanFailureOf(new ApiError('x', 503))).toBe('network');
    expect(scanFailureOf(new ApiError('x', 404, 'PFOOD-003'))).toBe('expired');
    expect(scanFailureOf(new ApiError('x', 409, 'PFOOD-004'))).toBe('conflict');
    expect(scanFailureOf(new ApiError('x', 403, 'SCAN-004'))).toBe('quota');
  });
  it('요청 = POST /api/processed-foods/scan/name + 3.2 · OCR 원문 2000자 상한(코드포인트)', async () => {
    mockPost.mockResolvedValueOnce({ analysisId: 'a', state: 'NO_CANDIDATE', candidates: [] });
    await scanProcessedName('가'.repeat(2500), 'ko');
    const [path, body, opts] = mockPost.mock.calls[0];
    expect(path).toBe('/api/processed-foods/scan/name');
    expect(Array.from((body as { ocrText: string }).ocrText)).toHaveLength(2000);
    expect(body).toMatchObject({ lang: 'ko' });
    expect(opts).toEqual({ headers: { 'X-API-Version': '3.2' } });
  });
});

describe('흐름', () => {
  it('촬영 → OCR 전체 텍스트 → 후보(성공 시 1회 안내) → 후보 탭 = 확정 → 상세(charged=1) · 프로필 재조회 · 상세 캐시 선적재', async () => {
    mockOcr.mockResolvedValueOnce([{ text: 'NEW' }, { text: '농심' }, { text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A1', state: 'CANDIDATES', candidates: [cand(11, 'R1'), cand(12, 'R2')] })
      .mockResolvedValueOnce({ analysisId: 'A1', state: 'CONFIRMED', charged: true, product: DETAIL });
    const inv = jest.spyOn(qc, 'invalidateQueries');
    const t = flow();
    await press(t, 'pscan-take-photo');
    expect(mockPost.mock.calls[0][1]).toMatchObject({ ocrText: 'NEW\n농심\n새우깡' });
    expect(ids(t)).toContain('pscan-candidates');
    expect(texts(t)).toContain('packagedScan.usedOnSuccess');
    expect(ids(t)).toEqual(expect.arrayContaining(['packaged-item-11', 'packaged-item-12']));
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_scan_name', { candidate_count: 2 });
    await press(t, 'packaged-item-12');
    expect(mockPost.mock.calls[1]).toEqual(['/api/processed-foods/scan/confirm', { analysisId: 'A1', reportNo: 'R2' }, { headers: { 'X-API-Version': '3.2' } }]);
    expect(mockPush).toHaveBeenCalledWith('/processed-foods/11?scan=1&charged=1');
    expect(inv).toHaveBeenCalledWith({ queryKey: ['me'] });
    expect(qc.getQueryData(['processedFoods', 'detail', '11', 'member'])).toMatchObject({ id: '11', name: '새우깡' });
  });
  it('해당 없음 = 확정(reportNo null) → REJECTED → 성분표 안내(같은 분석 문구 O · 촬영 버튼 비활성 · 곧 지원) · 차감 0', async () => {
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A2', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
      .mockResolvedValueOnce({ analysisId: 'A2', state: 'REJECTED', charged: false, product: null });
    const t = flow();
    await press(t, 'pscan-take-photo');
    await press(t, 'pscan-none-of-these');
    expect(mockPost.mock.calls[1][1]).toEqual({ analysisId: 'A2', reportNo: null });
    expect(ids(t)).toContain('pscan-handoff');
    expect(ids(t)).toContain('pscan-same-analysis');
    expect(ids(t)).toContain('pscan-label-soon');
    const cta = t.root.findAll((n) => n.props?.testID === 'pscan-label-capture' && n.props?.accessibilityState)[0];
    expect(cta.props.accessibilityState).toEqual({ disabled: true });
    expect(mockPush).not.toHaveBeenCalled();
  });
  it('후보 없음 → "스캔이 사용되지 않았어요" → 성분표(같은 분석) · 촬영 화면에서 바로 성분표 = 같은 분석 문구 없음', async () => {
    mockOcr.mockResolvedValueOnce([{ text: 'xyz' }]);
    mockPost.mockResolvedValueOnce({ analysisId: 'A3', state: 'NO_CANDIDATE', candidates: [] });
    const t = flow();
    await press(t, 'pscan-take-photo');
    expect(ids(t)).toContain('pscan-none');
    expect(texts(t)).toContain('packagedScan.noScanUsed');
    await press(t, 'pscan-to-label');
    expect(ids(t)).toContain('pscan-same-analysis');
    const t2 = flow();
    await press(t2, 'pscan-label-instead');
    expect(ids(t2)).toContain('pscan-handoff');
    expect(ids(t2)).not.toContain('pscan-same-analysis');
  });
  it('확정 네트워크 실패 = 오류 화면(차감 여부 확인 중) → 다시 시도 = 같은 analysisId · 만료(PFOOD-003) = 다시 찍기 안내', async () => {
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A4', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockRejectedValueOnce(new ApiError('expired', 404, 'PFOOD-003'));
    const t = flow();
    await press(t, 'pscan-take-photo');
    await press(t, 'packaged-item-11');
    expect(ids(t)).toContain('pscan-error-network');
    // Codex #310: 확정 전송 실패 = 서버가 커밋했을 수 있음 → "사용 안 됨" 단정 금지, "확인 중"
    expect(texts(t)).toContain('packagedScan.chargeChecking');
    expect(texts(t)).not.toContain('packagedScan.noScanUsed');
    await press(t, 'pscan-retry');
    expect(mockPost.mock.calls[2][1]).toEqual({ analysisId: 'A4', reportNo: 'R1' }); // 같은 ID 재시도
    expect(ids(t)).toContain('pscan-error-expired');
    expect(ids(t)).toContain('pscan-retake');
  });
  it('Codex #310: 확정 전송 실패 → 같은 ID 재확정 200 charged=true = 1회 사용 표시 · charged=false = 단정 없음(u) + 프로필 재조회', async () => {
    for (const [charged, expected] of [[true, '1'], [false, 'u']] as const) {
      mockPush.mockClear();
      mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
      mockPost
        .mockResolvedValueOnce({ analysisId: 'A6', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValueOnce({ analysisId: 'A6', state: 'CONFIRMED', charged, product: DETAIL });
      const inv = jest.spyOn(qc, 'invalidateQueries');
      const t = flow();
      await press(t, 'pscan-take-photo');
      await press(t, 'packaged-item-11');
      await press(t, 'pscan-retry');
      expect(mockPost.mock.calls.at(-1)![1]).toEqual({ analysisId: 'A6', reportNo: 'R1' });
      expect(mockPush).toHaveBeenCalledWith(`/processed-foods/11?scan=1&charged=${expected}`);
      expect(inv).toHaveBeenCalledWith({ queryKey: ['me'] });
      inv.mockRestore();
      mockPost.mockReset();
    }
  });
  it('Codex #310: 이름 스캔 대기 중 뒤로 = 늦게 온 응답 무시(후보 화면으로 되돌아가지 않음)', async () => {
    let release!: (v: unknown) => void;
    mockPost.mockReturnValueOnce(new Promise((r) => (release = r)));
    const t = flow();
    act(() => t.root.findAll((n) => n.props?.testID === 'pscan-ocr-debug-input' && typeof n.props?.onChangeText === 'function')[0].props.onChangeText('새우깡'));
    await act(async () => { t.root.findAll((n) => n.props?.testID === 'pscan-ocr-debug-run' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    expect(ids(t)).toContain('pscan-reading');
    // SubHeader 목은 onBack을 노출하지 않으므로 화면의 onBack을 직접 — reading 헤더의 뒤로
    const header = t.root.findAll((n) => typeof n.props?.onBack === 'function')[0];
    act(() => header.props.onBack());
    expect(ids(t)).toContain('pscan-capture');
    await act(async () => { release({ analysisId: 'A7', state: 'CANDIDATES', candidates: [cand(11, 'R1')] }); await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('pscan-capture');
    expect(ids(t)).not.toContain('pscan-candidates');
  });
  it('상세: charged=u(차감 여부 미상) = 단정 없이 "남은 횟수는 홈에서"', () => {
    const { adaptProcessedDetail } = jest.requireActual('@/lib/api/processedFoodAdapter');
    qc.setQueryData(['processedFoods', 'detail', '11', 'member'], adaptProcessedDetail(DETAIL));
    mockParams = { id: '11', scan: '1', charged: 'u' };
    const t = render(<Detail />);
    expect(t.root.findAll((n) => n.props?.testID === 'pf-scan-charge')[0].props.children).toBe('packagedScan.chargeSeeHome');
  });
  it('Codex #310 R2: 카메라 권한 거부 = 설정 유도 알럿(조용히 무시 0) · 서버 호출 0', async () => {
    mockGranted = false;
    const { Alert } = jest.requireActual('react-native');
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const t = flow();
    await press(t, 'pscan-take-photo');
    expect(spy).toHaveBeenCalledWith('scan.permissionTitle', 'scan.permissionSettingsBody', expect.any(Array));
    expect(mockPost).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it('Codex #310 R2: OCR 대기 중 뒤로 = 늦은 OCR 결과 무시(서버 호출 0 · 촬영 화면 유지)', async () => {
    let release!: (v: unknown) => void;
    mockOcr.mockReturnValueOnce(new Promise((r) => (release = r)));
    const t = flow();
    act(() => { void t.root.findAll((n) => n.props?.testID === 'pscan-take-photo' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('pscan-reading');
    act(() => t.root.findAll((n) => typeof n.props?.onBack === 'function')[0].props.onBack());
    await act(async () => { release([{ text: '새우깡' }]); await new Promise((r) => setTimeout(r, 0)); });
    expect(mockPost).not.toHaveBeenCalled();
    expect(ids(t)).toContain('pscan-capture');
  });
  it('Codex #310 R2: 차감된 확정 뒤 같은 후보 재확정(서버 멱등 charged false) = 1회 사용 표시 유지', async () => {
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A8', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
      .mockResolvedValueOnce({ analysisId: 'A8', state: 'CONFIRMED', charged: true, product: DETAIL })
      .mockResolvedValueOnce({ analysisId: 'A8', state: 'CONFIRMED', charged: false, product: DETAIL });
    const t = flow();
    await press(t, 'pscan-take-photo');
    await press(t, 'packaged-item-11');
    expect(mockPush).toHaveBeenLastCalledWith('/processed-foods/11?scan=1&charged=1');
    await press(t, 'packaged-item-11'); // 상세에서 뒤로 와서 다시
    expect(mockPush).toHaveBeenLastCalledWith('/processed-foods/11?scan=1&charged=1');
  });
  it('OCR이 글자를 못 읽음 = 서버 호출 0 · 성분표 안내(새 분석 — 같은 분석 문구 없음)', async () => {
    mockOcr.mockResolvedValueOnce([]);
    const t = flow();
    await press(t, 'pscan-take-photo');
    expect(mockPost).not.toHaveBeenCalled();
    expect(ids(t)).toContain('pscan-handoff');
    expect(ids(t)).not.toContain('pscan-same-analysis');
  });
});

describe('모드 탭·상세 띠·배선', () => {
  it('모드 탭: 메뉴판·가공식품 선택 · 음식 사진 = 비활성(준비 중)', () => {
    const onChange = jest.fn();
    const t = render(<ScanModeTabs value="menu" onChange={onChange} />);
    const tab = (m: string) => t.root.findAll((n) => n.props?.testID === `scan-mode-${m}` && n.props?.accessibilityState)[0];
    expect(tab('menu').props.accessibilityState).toEqual({ selected: true, disabled: false });
    expect(tab('food').props.accessibilityState).toEqual({ selected: false, disabled: true });
    expect(tab('food').props.onPress).toBeUndefined();
    act(() => tab('packaged').props.onPress());
    expect(onChange).toHaveBeenCalledWith('packaged');
  });
  it('상세: 스캔에서 온 경우만 "스캔 결과" 띠 · charged=1 = 1회 사용(불꽃) · charged=0 = 사용 안 됨(꺼진 불꽃)', () => {
    const { adaptProcessedDetail } = jest.requireActual('@/lib/api/processedFoodAdapter');
    qc.setQueryData(['processedFoods', 'detail', '11', 'member'], adaptProcessedDetail(DETAIL));
    mockParams = { id: '11', scan: '1', charged: '1' };
    let t = render(<Detail />);
    expect(ids(t)).toContain('pf-scan-result');
    expect(t.root.findAll((n) => n.props?.testID === 'pf-scan-charge')[0].props.children).toBe('packagedScan.scanUsed');
    expect(ids(t)).toContain('flame-active');
    mockParams = { id: '11', scan: '1', charged: '0' };
    t = render(<Detail />);
    expect(t.root.findAll((n) => n.props?.testID === 'pf-scan-charge')[0].props.children).toBe('packagedScan.noScanUsed');
    expect(ids(t)).toContain('flame-empty');
    mockParams = { id: '11' };
    expect(ids(render(<Detail />))).not.toContain('pf-scan-result');
  });
  it('스캔 화면 배선: 가공식품 모드 = PackagedScanFlow(단일 presenter 경유) · 메뉴판 카메라·런처에 모드 탭 · 기본 메뉴판 · OCR 주입은 개발·진단 채널만', () => {
    const src = fs.readFileSync('src/app/scan.tsx', 'utf8');
    expect(src).toContain("useState<ScanMode>(() => (scanParams.mode === 'packaged' && FLAGS.packagedLabelScan ? 'packaged' : 'menu'))"); // 기본 메뉴판 · P-508: 상세 "성분표 직접 확인"만 가공식품 모드로 진입
    expect(src).toContain("if (scanMode === 'packaged' && !offline) {\n    return withPresenter(<PackagedScanFlow");
    expect(src.match(/<ScanModeTabs /g)).toHaveLength(2);
    const flowSrc = fs.readFileSync('src/features/scan/PackagedScanFlow.tsx', 'utf8');
    expect(flowSrc).toContain('export const showOcrDebug = (): boolean => __DEV__ || isDiagnosticChannel();');
    expect(flowSrc).toContain('{showOcrDebug() && (');
  });
  it('10언어 문구 전부 · 가운데점 0', () => {
    const flat = (o: Record<string, unknown>, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));
    const en = JSON.parse(fs.readFileSync('src/lib/i18n/en.json', 'utf8'));
    const keys = [...flat(en.scanMode, 'scanMode.'), ...flat(en.packagedScan, 'packagedScan.')].sort();
    for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi']) {
      const d = JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8'));
      expect([...flat(d.scanMode, 'scanMode.'), ...flat(d.packagedScan, 'packagedScan.')].sort()).toEqual(keys);
      expect(JSON.stringify([d.scanMode, d.packagedScan])).not.toContain('·');
    }
  });
});

/**
 * P-508(KB-813 후속) 성분표 분석 — 어댑터(함유 가능·charged는 true만·모르는 labelSource = NONE) · 요청(3.2·면 ≤4·면당 4000자) ·
 * 오류(400 PFOOD-006 못 읽음 · 409 PFOOD-007 새 분석) · 흐름: 후보 없음 → 같은 analysisId(같은 분석 문구) · 촬영 화면·상세 = 새 분석(null) ·
 * 면 모으기(한 면 더 ≤4) · 결과 = 판정 섹션 + 함유 가능 칩 + 원문 · 면 추가 재분석 = 같은 ID(이미 쓴 1회 유지) · 새 분석 버튼 · 플래그 off = 비활성.
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
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockUuid}` }));
let mockCanceled = false;
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: async () => ({ granted: mockGranted }),
  launchCameraAsync: async () => (mockCanceled ? { canceled: true, assets: [] } : { canceled: false, assets: [{ uri: 'file:label.jpg', width: 900, height: 1200 }] }),
}));

/* eslint-disable import/first -- jest.mock 뒤 */
import { ApiError } from '@/lib/api/client';
import { adaptLabelScan } from '@/lib/api/processedFoodAdapter';
import { scanFailureOf, scanProcessedLabel } from '@/lib/data/useProcessedScan';
import { FLAGS } from '@/lib/flags';
import { PackagedScanFlow } from '../PackagedScanFlow';
/* eslint-enable import/first */

const V32 = { headers: { 'X-API-Version': '3.2' } };
const LABEL_P1 = '원재료명: 소맥분(밀), 새우 10%, 대두유';
const LABEL_P2 = '알레르기 유발물질: 밀, 새우 함유\n이 제품은 대두를 사용한 제품과 같은 제조시설에서 제조';
const RESULT = (over: object = {}) => ({
  analysisId: 'L1', state: 'LABEL_RESULT', labelSource: 'DECLARED',
  detections: [{ code: 'WHEAT', source: 'ALLERGEN_DECLARATION', evidence: '밀' }, { code: 'SHRIMP', source: 'RAW_MATERIALS', evidence: '새우' }],
  unmapped: ['복합조미식품'], mayContain: [{ code: 'SOY', source: 'MAY_CONTAIN', evidence: '대두' }],
  avoidance: [{ code: 'SHRIMP', match: 'DETECTED', matchedCodes: ['SHRIMP'], evidence: ['새우'] }], rawText: `${LABEL_P1}\n${LABEL_P2}`, charged: true, ...over,
});

const trees: ReactTestRenderer[] = [];
let qc: QueryClient;
const flagLabel = FLAGS.packagedLabelScan;
const setFlag = (v: boolean) => { (FLAGS as { packagedLabelScan: boolean }).packagedLabelScan = v; };
beforeEach(() => { qc = new QueryClient(); mockParams = {}; mockGranted = true; mockCanceled = false; mockUuid = 0; setFlag(true); });
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); jest.clearAllMocks(); setFlag(flagLabel); });
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); }); trees.push(t); return t; };
const ids = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string').map((n) => n.props.testID as string);
const press = async (t: ReactTestRenderer, id: string) => { await act(async () => { await t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress(); }); await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const texts = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children as string);
const flow = (startLabel = false) => render(<PackagedScanFlow mode="packaged" onMode={jest.fn()} onClose={jest.fn()} startLabel={startLabel} />);
const labelCalls = () => mockPost.mock.calls.filter((c) => c[0] === '/api/processed-foods/scan/label');
/** 후보 없음까지(이름 스캔 NO_CANDIDATE A3) → 성분표 안내 */
async function toHandoffFromNone(t: ReactTestRenderer) {
  mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
  mockPost.mockResolvedValueOnce({ analysisId: 'A3', state: 'NO_CANDIDATE', candidates: [] });
  await press(t, 'pscan-take-photo');
  await press(t, 'pscan-to-label');
}

describe('어댑터·요청·오류', () => {
  it('어댑터: 함유 가능 = 코드·근거 · 검출 fromLabel = 표시란 · charged는 true만 · 모르는 labelSource = NONE · avoidance 없음 = []', () => {
    const r = adaptLabelScan(RESULT() as never);
    expect(r.mayContain).toEqual([{ code: 'SOY', evidence: '대두' }]);
    expect(r.detections.map((d) => d.fromLabel)).toEqual([true, false]);
    expect(r.avoidance).toEqual([{ code: 'SHRIMP', detected: true, evidence: ['새우'] }]);
    expect(adaptLabelScan(RESULT({ charged: null, labelSource: 'WHAT', avoidance: undefined }) as never)).toMatchObject({ charged: false, labelSource: 'NONE', avoidance: [] });
  });
  it('요청 = POST /api/processed-foods/scan/label + 3.2 · {analysisId, pages[{ocrText}], lang} · 면 ≤4 · 면당 4000자(코드포인트)', async () => {
    mockPost.mockResolvedValueOnce(RESULT());
    await scanProcessedLabel(null, ['가'.repeat(4500), 'b', 'c', 'd', 'e'], 'ko');
    const [path, body, opts] = mockPost.mock.calls[0] as [string, { analysisId: null; pages: { ocrText: string }[]; lang: string }, object];
    expect(path).toBe('/api/processed-foods/scan/label');
    expect(opts).toEqual(V32);
    expect(body.analysisId).toBeNull();
    expect(body.lang).toBe('ko');
    expect(body.pages).toHaveLength(4);
    expect(Array.from(body.pages[0].ocrText)).toHaveLength(4000);
  });
  it('오류: 400 PFOOD-006 = unreadable · 409 PFOOD-007 = newAnalysis', () => {
    expect(scanFailureOf(new ApiError('x', 400, 'PFOOD-006'))).toBe('unreadable');
    expect(scanFailureOf(new ApiError('x', 409, 'PFOOD-007'))).toBe('newAnalysis');
    expect(scanFailureOf(new ApiError('x', 409, 'SCAN-005'))).toBe('newAnalysis'); // #444 같은 키·다른 원문 = 새 키로 새 분석
  });
});

describe('흐름', () => {
  it('후보 없음 → 성분표 = 같은 analysisId(같은 분석 문구) · 한 면 더(2면) → 분석 → 결과(판정·함유 가능 칩·원문) · charged → 1회 표시 + 프로필 재조회 · 계측', async () => {
    const inv = jest.spyOn(qc, 'invalidateQueries');
    const t = flow();
    await toHandoffFromNone(t);
    expect(ids(t)).toContain('pscan-same-analysis');
    expect(ids(t)).not.toContain('pscan-label-soon');
    mockOcr.mockResolvedValueOnce([{ text: LABEL_P1 }]).mockResolvedValueOnce([{ text: LABEL_P2 }]);
    await press(t, 'pscan-label-capture');
    expect(ids(t)).toContain('pscan-label-pages');
    expect(texts(t)).toContain('packagedScan.labelPagesCount:{"count":1,"max":4}');
    await press(t, 'pscan-label-add');
    expect(texts(t)).toContain('packagedScan.labelPagesCount:{"count":2,"max":4}');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'A3' }));
    await press(t, 'pscan-label-analyze');
    expect(labelCalls()[0][1]).toEqual({ analysisId: 'A3', pages: [{ ocrText: LABEL_P1 }, { ocrText: LABEL_P2 }], lang: 'en' });
    expect(ids(t)).toEqual(expect.arrayContaining(['pscan-label-result', 'pf-det-WHEAT', 'pf-det-SHRIMP', 'pf-unmapped-0', 'pf-may-SOY', 'pf-avoid-SHRIMP', 'pf-raw']));
    expect(ids(t)).not.toContain('pf-login-compare'); // 회원 결과 — 로그인 줄 0
    expect(texts(t)).toContain('packagedScan.scanUsed');
    expect(inv).toHaveBeenCalledWith({ queryKey: ['me'] });
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_label_scan', { pages: 2, charged: true, result: 'ok' });
    expect(mockPush).not.toHaveBeenCalled(); // 제품 미확정 — 상세 연결 없음
  });
  it('촬영 화면에서 바로 성분표 = 새 분석(analysisId null) · 같은 분석 문구 0', async () => {
    const t = flow();
    await press(t, 'pscan-label-instead');
    expect(ids(t)).toContain('pscan-handoff');
    expect(ids(t)).not.toContain('pscan-same-analysis');
    mockOcr.mockResolvedValueOnce([{ text: LABEL_P1 }]);
    await press(t, 'pscan-label-capture');
    expect(ids(t)).not.toContain('pscan-same-analysis');
    mockPost.mockResolvedValueOnce(RESULT());
    await press(t, 'pscan-label-analyze');
    expect(labelCalls()[0][1]).toMatchObject({ analysisId: null });
  });
  it('상세 "성분표 직접 확인"(startLabel) = 성분표 안내부터 · 새 분석 · 경로 /scan?mode=packaged&label=1 배선', async () => {
    const t = flow(true);
    expect(ids(t)).toContain('pscan-handoff');
    expect(ids(t)).not.toContain('pscan-same-analysis');
    // Codex #315 R2: 진입마다 새 토큰 — 아래 깔린 /scan으로 돌아가도(navigate 재사용) 플로우를 새로(key) 띄워 이전 analysisId·후보가 남지 않게
    expect(fs.readFileSync('src/app/processed-foods/[id].tsx', 'utf8')).toContain('router.navigate(`/scan?mode=packaged&label=1&t=${Date.now()}` as Href)');
    const scan = fs.readFileSync('src/app/scan.tsx', 'utf8');
    expect(scan).toContain("const labelEntry = scanParams.label === '1' && FLAGS.packagedLabelScan ? (scanParams.t ?? 'entry') : null;");
    expect(scan).toMatch(/if \(labelEntry !== seenLabelEntry\) \{\s*setSeenLabelEntry\(labelEntry\);\s*if \(labelEntry\) setScanModeState\('packaged'\);/);
    expect(scan).toContain("<PackagedScanFlow key={labelEntry ?? 'flow'} mode={scanMode} onMode={setScanMode} onClose={() => router.back()} startLabel={labelEntry != null} />");
  });
  it('결과에서 한 면 더 = 같은 ID 재분석(면 누적) · charged false여도 이 분석에서 쓴 1회 표시 유지 · 프로필 재조회 추가 0', async () => {
    const t = flow(true);
    mockOcr.mockResolvedValueOnce([{ text: LABEL_P1 }]).mockResolvedValueOnce([{ text: LABEL_P2 }]);
    await press(t, 'pscan-label-capture');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L9' }));
    await press(t, 'pscan-label-analyze');
    expect(texts(t)).toContain('packagedScan.labelFreeRetry');
    const inv = jest.spyOn(qc, 'invalidateQueries');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L9', charged: false }));
    await press(t, 'pscan-label-more');
    expect(labelCalls()[1][1]).toEqual({ analysisId: 'L9', pages: [{ ocrText: LABEL_P1 }, { ocrText: LABEL_P2 }], lang: 'en' });
    expect(texts(t)).toContain('packagedScan.scanUsed');
    expect(inv).not.toHaveBeenCalled();
  });
  it('같은 분석이 charged false(서버가 이미 차감·차감 없음) = "추가 사용 없음" — 차감 단정 0', async () => {
    const t = flow();
    await toHandoffFromNone(t);
    mockOcr.mockResolvedValueOnce([{ text: LABEL_P1 }]);
    await press(t, 'pscan-label-capture');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'A3', charged: false }));
    await press(t, 'pscan-label-analyze');
    expect(texts(t)).toContain('packagedScan.labelNoExtra');
    expect(texts(t)).not.toContain('packagedScan.scanUsed');
  });
  it('400 PFOOD-006 = 못 읽음 · 차감 0 · 다시 찍기 = 성분표 안내 · 계측 result unreadable', async () => {
    const t = flow(true);
    mockOcr.mockResolvedValueOnce([{ text: '바코드 8801043' }]);
    await press(t, 'pscan-label-capture');
    mockPost.mockRejectedValueOnce(new ApiError('x', 400, 'PFOOD-006'));
    await press(t, 'pscan-label-analyze');
    expect(ids(t)).toContain('pscan-error-unreadable');
    expect(texts(t)).toContain('packagedScan.noScanUsed');
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_label_scan', { pages: 1, charged: false, result: 'unreadable' });
    await press(t, 'pscan-retake');
    expect(ids(t)).toContain('pscan-label-pages'); // Codex #315 R2: 보낸 면 화면으로(처음으로 초기화 아님)
  });
  it('409 PFOOD-007(무료 재분석 초과) = 새로 분석 버튼 → analysisId null · 같은 면', async () => {
    const t = flow(true);
    mockOcr.mockResolvedValueOnce([{ text: LABEL_P1 }]).mockResolvedValueOnce([{ text: LABEL_P2 }]);
    await press(t, 'pscan-label-capture');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L5' }));
    await press(t, 'pscan-label-analyze');
    mockPost.mockRejectedValueOnce(new ApiError('x', 409, 'PFOOD-007'));
    await press(t, 'pscan-label-more');
    expect(ids(t)).toContain('pscan-error-newAnalysis');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L6' }));
    await press(t, 'pscan-new-analysis');
    expect(labelCalls()[2][1]).toEqual({ analysisId: null, clientRequestId: expect.any(String), pages: [{ ocrText: LABEL_P1 }, { ocrText: LABEL_P2 }], lang: 'en' });
    expect(ids(t)).toContain('pscan-label-result');
  });
  it('글자 없는 성분표 면 = 서버 호출 0 · 못 읽음 · 촬영 취소 = 단계 그대로', async () => {
    const t = flow(true);
    mockOcr.mockResolvedValueOnce([]);
    await press(t, 'pscan-label-capture');
    expect(labelCalls()).toHaveLength(0);
    expect(ids(t)).toContain('pscan-error-unreadable');
    const t2 = flow(true);
    mockCanceled = true;
    await press(t2, 'pscan-label-capture');
    expect(ids(t2)).toContain('pscan-handoff');
  });
  it('면 4장 = "한 면 더" 사라짐 · OCR 주입 디버그로 면 추가(개발·진단 채널)', async () => {
    const t = flow(true);
    mockOcr.mockResolvedValueOnce([{ text: LABEL_P1 }]);
    await press(t, 'pscan-label-capture');
    for (const p of ['b', 'c', 'd']) {
      act(() => t.root.findAll((n) => n.props?.testID === 'pscan-label-debug-input' && typeof n.props?.onChangeText === 'function')[0].props.onChangeText(p));
      await press(t, 'pscan-label-debug-add');
    }
    expect(texts(t)).toContain('packagedScan.labelPagesCount:{"count":4,"max":4}');
    expect(ids(t)).not.toContain('pscan-label-add');
  });
  it('Codex #315: 전송 실패 뒤 다시 시도가 charged false = "추가 사용 없음" 단정 금지(첫 요청이 차감했을 수 있음 — 홈에서 확인)', async () => {
    const t = flow();
    await toHandoffFromNone(t);
    mockOcr.mockResolvedValueOnce([{ text: LABEL_P1 }]);
    await press(t, 'pscan-label-capture');
    mockPost.mockRejectedValueOnce(new Error('timeout'));
    await press(t, 'pscan-label-analyze');
    expect(texts(t)).toContain('packagedScan.chargeChecking');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'A3', charged: false }));
    await press(t, 'pscan-retry');
    expect(labelCalls()[1][1]).toMatchObject({ analysisId: 'A3' });
    expect(texts(t)).toContain('packagedScan.chargeSeeHome');
    expect(texts(t)).not.toContain('packagedScan.labelNoExtra');
  });
  it('Codex #315: 분석 대기 중 뒤로 = 모은 면 화면(면·분석 ID 유지) · 늦은 응답 무시 · 결과에서 면 추가 중 뒤로 = 그 결과', async () => {
    const t = flow();
    await toHandoffFromNone(t);
    mockOcr.mockResolvedValueOnce([{ text: LABEL_P1 }]);
    await press(t, 'pscan-label-capture');
    let release!: (v: unknown) => void;
    mockPost.mockReturnValueOnce(new Promise((r) => (release = r)));
    act(() => { void t.root.findAll((n) => n.props?.testID === 'pscan-label-analyze' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    expect(ids(t)).toContain('pscan-reading');
    act(() => t.root.findAll((n) => typeof n.props?.onBack === 'function')[0].props.onBack());
    expect(ids(t)).toContain('pscan-label-pages');
    expect(ids(t)).toContain('pscan-same-analysis'); // 분석 ID 유지
    expect(texts(t)).toContain('packagedScan.labelPagesCount:{"count":1,"max":4}');
    await act(async () => { release(RESULT({ analysisId: 'A3' })); await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('pscan-label-pages'); // 늦은 결과로 화면이 바뀌지 않는다
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'A3' }));
    await press(t, 'pscan-label-analyze');
    let ocrRelease!: (v: unknown) => void;
    mockOcr.mockReturnValueOnce(new Promise((r) => (ocrRelease = r)));
    act(() => { void t.root.findAll((n) => n.props?.testID === 'pscan-label-more' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('pscan-reading');
    act(() => t.root.findAll((n) => typeof n.props?.onBack === 'function')[0].props.onBack());
    expect(ids(t)).toContain('pscan-label-result');
    await act(async () => { ocrRelease([{ text: LABEL_P2 }]); await new Promise((r) => setTimeout(r, 0)); });
    expect(labelCalls()).toHaveLength(2); // 늦은 OCR로 재분석 0
  });
  it('Codex #315 R2: 2면째가 안 읽힘 → 다시 찍기 = 모은 면 화면(1면·같은 분석 유지) · 결과에서 한 면 더가 안 읽힘 → 다시 찍기 = 그 결과', async () => {
    const t = flow();
    await toHandoffFromNone(t);
    mockOcr.mockResolvedValueOnce([{ text: LABEL_P1 }]).mockResolvedValueOnce([]);
    await press(t, 'pscan-label-capture');
    await press(t, 'pscan-label-add');
    expect(ids(t)).toContain('pscan-error-unreadable');
    expect(labelCalls()).toHaveLength(0);
    await press(t, 'pscan-retake');
    expect(ids(t)).toContain('pscan-label-pages');
    expect(ids(t)).toContain('pscan-same-analysis');
    expect(texts(t)).toContain('packagedScan.labelPagesCount:{"count":1,"max":4}');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'A3' }));
    await press(t, 'pscan-label-analyze');
    expect(labelCalls()[0][1]).toMatchObject({ analysisId: 'A3', pages: [{ ocrText: LABEL_P1 }] }); // 새 분석으로 바뀌지 않았다
    mockOcr.mockResolvedValueOnce([]);
    await press(t, 'pscan-label-more');
    await press(t, 'pscan-retake');
    expect(ids(t)).toContain('pscan-label-result');
    expect(ids(t)).toContain('pf-det-WHEAT');
  });
  it('Codex #315 R2: 서버 400(PFOOD-006) 뒤 다시 찍기 = 보낸 면 화면 그대로(분석 ID 유지)', async () => {
    const t = flow();
    await toHandoffFromNone(t);
    mockOcr.mockResolvedValueOnce([{ text: '바코드' }]);
    await press(t, 'pscan-label-capture');
    mockPost.mockRejectedValueOnce(new ApiError('x', 400, 'PFOOD-006'));
    await press(t, 'pscan-label-analyze');
    await press(t, 'pscan-retake');
    expect(ids(t)).toContain('pscan-label-pages');
    expect(ids(t)).toContain('pscan-same-analysis');
  });
  it('#444 멱등 키: 새 분석 = clientRequestId · 전송 실패 재시도 = 같은 키 · 재전송 charged false여도 "1회 사용"(새 분석 성공 = 정확히 1회) · 같은 분석 = 키 없음', async () => {
    const inv = jest.spyOn(qc, 'invalidateQueries');
    const t = flow(true);
    mockOcr.mockResolvedValueOnce([{ text: LABEL_P1 }]);
    await press(t, 'pscan-label-capture');
    mockPost.mockRejectedValueOnce(new Error('timeout'));
    await press(t, 'pscan-label-analyze');
    expect(labelCalls()[0][1]).toMatchObject({ analysisId: null, clientRequestId: 'uuid-1' });
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L7', charged: false })); // 첫 요청이 이미 차감 — 서버가 같은 분석을 charged=false로
    await press(t, 'pscan-retry');
    expect(labelCalls()[1][1]).toMatchObject({ analysisId: null, clientRequestId: 'uuid-1' });
    expect(texts(t)).toContain('packagedScan.scanUsed');
    expect(texts(t)).not.toContain('packagedScan.chargeSeeHome');
    expect(inv).toHaveBeenCalledWith({ queryKey: ['me'] });
    mockOcr.mockResolvedValueOnce([{ text: LABEL_P2 }]);
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L7', charged: false }));
    await press(t, 'pscan-label-more');
    expect(labelCalls()[2][1]).toEqual({ analysisId: 'L7', pages: [{ ocrText: LABEL_P1 }, { ocrText: LABEL_P2 }], lang: 'en' }); // 이어 붙이기 = 키 없음
  });
  it('#444 멱등 키: 면을 바꿔 다시 분석(새 분석 버튼·다시 찍은 면) = 새 키', async () => {
    const t = flow(true);
    mockOcr.mockResolvedValueOnce([{ text: '바코드' }]);
    await press(t, 'pscan-label-capture');
    mockPost.mockRejectedValueOnce(new ApiError('x', 400, 'PFOOD-006'));
    await press(t, 'pscan-label-analyze');
    await press(t, 'pscan-retake');
    mockOcr.mockResolvedValueOnce([{ text: LABEL_P1 }]);
    await press(t, 'pscan-label-add');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L8' }));
    await press(t, 'pscan-label-analyze');
    const keys = labelCalls().map((c) => (c[1] as { clientRequestId?: string }).clientRequestId);
    expect(keys).toEqual(['uuid-1', 'uuid-2']);
  });
  it('플래그 off = 성분표 촬영 버튼 비활성 + 곧 지원 안내 · 촬영 호출 0', async () => {
    setFlag(false);
    const t = flow(true);
    expect(ids(t)).toContain('pscan-label-soon');
    const btn = t.root.findAll((n) => n.props?.testID === 'pscan-label-capture' && typeof n.type === 'string')[0];
    expect(btn.props.accessibilityState).toEqual({ disabled: true });
    expect(ids(t)).not.toContain('pscan-label-debug');
  });
});

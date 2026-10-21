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
import { PackagedScanFlow, type ScanCamOpts } from '../PackagedScanFlow';
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
/** KB-845: 공통 카메라 대역 — 모드·힌트를 그리고 셔터 = onShot(고정 사진). testID는 옛 촬영 버튼 이름 그대로(앞면 = pscan-take-photo · 성분표 = pscan-label-capture) */
const mockShot = { uri: 'file:shot.jpg', width: 900, height: 1200 };
function mockCamera(o: ScanCamOpts) {
  const { View, Pressable, Text } = jest.requireActual('react-native');
  return (
    <View testID={`cam-${o.kind}`}>
      <Text testID="cam-hint">{o.hint ?? 'default-hint'}</Text>
      <Pressable testID={o.kind === 'package' ? 'pscan-take-photo' : 'pscan-label-capture'} onPress={() => o.onShot(mockShot)} />
      {o.link && <Pressable testID={o.link.testID} onPress={o.link.onPress} />}
      {o.onClose && <Pressable testID="cam-close" onPress={o.onClose} />}
      {o.debug}
    </View>
  );
}
const flow = (startLabel = false) => render(<PackagedScanFlow mode="packaged" onMode={jest.fn()} onClose={jest.fn()} startLabel={startLabel}  renderCamera={mockCamera} />);
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

describe('흐름(KB-845 — 성분표 단계 = 공통 카메라 ingredient)', () => {
  const hint = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'cam-hint' && typeof n.type === 'string')[0]?.props.children as string | undefined;
  const shoot = async (t: ReactTestRenderer, text: string | null) => {
    mockOcr.mockResolvedValueOnce(text == null ? [] : [{ text }]);
    await press(t, 'pscan-label-capture');
  };
  const close = (t: ReactTestRenderer, id: string) => act(() => t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress());
  const back = (t: ReactTestRenderer) => act(() => t.root.findAll((n) => typeof n.props?.onBack === 'function')[0].props.onBack());

  it('후보 없음 → 성분표 카메라 = 같은 analysisId(힌트 자리 = 같은 분석 문구) · 찍기 → 면 모으기 · 한 면 더 = 카메라(힌트 n/4) → 2면 → 분석 → 결과 · charged → 1회 + 프로필 재조회 · 계측', async () => {
    const inv = jest.spyOn(qc, 'invalidateQueries');
    const t = flow();
    await toHandoffFromNone(t);
    expect(ids(t)).toContain('cam-ingredient');
    expect(hint(t)).toBe('packagedScan.sameAnalysis');
    await shoot(t, LABEL_P1);
    expect(ids(t)).toContain('pscan-label-pages');
    expect(ids(t)).toContain('pscan-same-analysis');
    expect(texts(t)).toContain('packagedScan.labelPagesCount:{"count":1,"max":4}');
    await press(t, 'pscan-label-add');
    expect(ids(t)).toContain('cam-ingredient');
    expect(hint(t)).toBe('packagedScan.labelPagesCount:{"count":1,"max":4}');
    await shoot(t, LABEL_P2);
    expect(texts(t)).toContain('packagedScan.labelPagesCount:{"count":2,"max":4}');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'A3' }));
    await press(t, 'pscan-label-analyze');
    expect(labelCalls()[0][1]).toEqual({ analysisId: 'A3', pages: [{ ocrText: LABEL_P1 }, { ocrText: LABEL_P2 }], lang: 'en' });
    expect(ids(t)).toEqual(expect.arrayContaining(['pscan-label-result', 'pf-det-WHEAT', 'pf-det-SHRIMP', 'pf-unmapped-0', 'pf-may-SOY', 'pf-avoid-SHRIMP', 'pf-raw']));
    expect(ids(t)).not.toContain('pf-login-compare');
    expect(texts(t)).toContain('packagedScan.scanUsed');
    expect(inv).toHaveBeenCalledWith({ queryKey: ['me'] });
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_label_scan', { pages: 2, charged: true, result: 'ok' });
    expect(mockPush).not.toHaveBeenCalled();
  });
  it('앞면 카메라 "성분표로 확인하기" = 새 분석(analysisId null) · 디자인 힌트(같은 분석 문구 0) · 반대 링크 = 앞면으로', async () => {
    const t = flow();
    expect(ids(t)).toContain('cam-package');
    await press(t, 'pscan-label-instead');
    expect(ids(t)).toContain('cam-ingredient');
    expect(hint(t)).toBe('default-hint');
    await shoot(t, LABEL_P1);
    expect(ids(t)).not.toContain('pscan-same-analysis');
    mockPost.mockResolvedValueOnce(RESULT());
    await press(t, 'pscan-label-analyze');
    expect(labelCalls()[0][1]).toMatchObject({ analysisId: null });
    const t2 = flow(true);
    await press(t2, 'pscan-front-instead');
    expect(ids(t2)).toContain('cam-package');
  });
  it('상세 "성분표 직접 확인"(startLabel) = 성분표 카메라부터 · 새 분석 · 경로 /scan?mode=packaged&label=1 배선', async () => {
    const t = flow(true);
    expect(ids(t)).toContain('cam-ingredient');
    expect(hint(t)).toBe('default-hint');
    expect(ids(t)).not.toContain('cam-close'); // 첫 카메라 = 스캔 화면 닫기(scan.tsx X)
    expect(fs.readFileSync('src/app/processed-foods/[id].tsx', 'utf8')).toContain('router.navigate(`/scan?mode=packaged&label=1&t=${Date.now()}` as Href)');
    const scan = fs.readFileSync('src/app/scan.tsx', 'utf8');
    expect(scan).toContain("const labelEntry = scanParams.label === '1' && FLAGS.packagedLabelScan ? (scanParams.t ?? 'entry') : null;");
    expect(scan).toContain('startLabel={labelEntry != null} renderCamera={cameraUi} focused={isFocused} />'); // Codex #318: 흰 상태바 = 보일 때만
  });
  it('결과에서 한 면 더 = 카메라(닫기 = 그 결과) → 찍기 = 같은 ID 재분석(면 누적) · charged false여도 이 분석에서 쓴 1회 유지 · 프로필 재조회 추가 0', async () => {
    const t = flow(true);
    await shoot(t, LABEL_P1);
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L9' }));
    await press(t, 'pscan-label-analyze');
    expect(texts(t)).toContain('packagedScan.labelFreeRetry');
    await press(t, 'pscan-label-more');
    expect(ids(t)).toContain('cam-ingredient');
    close(t, 'cam-close');
    expect(ids(t)).toContain('pscan-label-result');
    await press(t, 'pscan-label-more');
    const inv = jest.spyOn(qc, 'invalidateQueries');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L9', charged: false }));
    await shoot(t, LABEL_P2);
    expect(labelCalls()[1][1]).toEqual({ analysisId: 'L9', pages: [{ ocrText: LABEL_P1 }, { ocrText: LABEL_P2 }], lang: 'en' });
    expect(texts(t)).toContain('packagedScan.scanUsed');
    expect(inv).not.toHaveBeenCalled();
  });
  it('같은 분석이 charged false = "추가 사용 없음" — 차감 단정 0', async () => {
    const t = flow();
    await toHandoffFromNone(t);
    await shoot(t, LABEL_P1);
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'A3', charged: false }));
    await press(t, 'pscan-label-analyze');
    expect(texts(t)).toContain('packagedScan.labelNoExtra');
    expect(texts(t)).not.toContain('packagedScan.scanUsed');
  });
  it('400 PFOOD-006 = 못 읽음 · 차감 0 · 다시 찍기 = 보낸 면 화면(분석 ID 유지 — Codex #315 R2) · 계측 result unreadable', async () => {
    const t = flow();
    await toHandoffFromNone(t);
    await shoot(t, '바코드 8801043');
    mockPost.mockRejectedValueOnce(new ApiError('x', 400, 'PFOOD-006'));
    await press(t, 'pscan-label-analyze');
    expect(ids(t)).toContain('pscan-error-unreadable');
    expect(texts(t)).toContain('packagedScan.noScanUsed');
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_label_scan', { pages: 1, charged: false, result: 'unreadable' });
    await press(t, 'pscan-retake');
    expect(ids(t)).toContain('pscan-label-pages');
    expect(ids(t)).toContain('pscan-same-analysis');
  });
  it('409 PFOOD-007(무료 재분석 초과) = 새로 분석 버튼 → analysisId null · 같은 면', async () => {
    const t = flow(true);
    await shoot(t, LABEL_P1);
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L5' }));
    await press(t, 'pscan-label-analyze');
    await press(t, 'pscan-label-more');
    mockPost.mockRejectedValueOnce(new ApiError('x', 409, 'PFOOD-007'));
    await shoot(t, LABEL_P2);
    expect(ids(t)).toContain('pscan-error-newAnalysis');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L6' }));
    await press(t, 'pscan-new-analysis');
    expect(labelCalls()[2][1]).toEqual({ analysisId: null, clientRequestId: expect.any(String), pages: [{ ocrText: LABEL_P1 }, { ocrText: LABEL_P2 }], lang: 'en' });
    expect(ids(t)).toContain('pscan-label-result');
  });
  it('글자 없는 면 = 서버 호출 0 · 못 읽음 → 다시 찍기 = 그 카메라 · 2면째 못 읽음 = 1면 유지(Codex #315 R2) · 결과에서 한 면 더 못 읽음 = 그 결과로', async () => {
    const t = flow();
    await toHandoffFromNone(t);
    await shoot(t, null);
    expect(labelCalls()).toHaveLength(0);
    expect(ids(t)).toContain('pscan-error-unreadable');
    await press(t, 'pscan-retake');
    expect(ids(t)).toContain('cam-ingredient');
    expect(hint(t)).toBe('packagedScan.sameAnalysis');
    await shoot(t, LABEL_P1);
    await press(t, 'pscan-label-add');
    await shoot(t, null);
    await press(t, 'pscan-retake');
    expect(hint(t)).toBe('packagedScan.labelPagesCount:{"count":1,"max":4}');
    close(t, 'cam-close');
    expect(texts(t)).toContain('packagedScan.labelPagesCount:{"count":1,"max":4}');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'A3' }));
    await press(t, 'pscan-label-analyze');
    expect(labelCalls()[0][1]).toMatchObject({ analysisId: 'A3', pages: [{ ocrText: LABEL_P1 }] });
    await press(t, 'pscan-label-more');
    await shoot(t, null);
    await press(t, 'pscan-retake');
    close(t, 'cam-close');
    expect(ids(t)).toContain('pscan-label-result');
    expect(labelCalls()).toHaveLength(1);
  });
  it('면 4장 = "한 면 더" 사라짐 · OCR 주입 디버그로 면 추가(카메라 위 작은 패널 — 개발·진단 채널)', async () => {
    const t = flow(true);
    const inject = async (text: string) => {
      act(() => t.root.findAll((n) => n.props?.testID === 'pscan-label-debug-input' && typeof n.props?.onChangeText === 'function')[0].props.onChangeText(text));
      await press(t, 'pscan-label-debug-add');
    };
    await inject('a');
    for (const p of ['b', 'c', 'd']) {
      await press(t, 'pscan-label-add');
      await inject(p);
    }
    expect(texts(t)).toContain('packagedScan.labelPagesCount:{"count":4,"max":4}');
    expect(ids(t)).not.toContain('pscan-label-add');
    // Codex #318: 4면이 찼으면 뒤로 = 성분표 카메라가 아니라 앞면 카메라(더 찍을 수 없는 카메라 진입 0)
    back(t);
    expect(ids(t)).toContain('cam-package');
    expect(ids(t)).not.toContain('cam-ingredient');
  });
  it('Codex #318: 4면이 찬 성분표 카메라(방어) = 셔터 비활성 · 상태바 흰 글자는 스캔 화면이 보일 때만', () => {
    const shots: ScanCamOpts[] = [];
    const capture = (o: ScanCamOpts) => { shots.push(o); return mockCamera(o); };
    const { StatusBar } = jest.requireActual('expo-status-bar') as typeof import('expo-status-bar');
    const t = render(<PackagedScanFlow mode="packaged" onMode={jest.fn()} onClose={jest.fn()} startLabel renderCamera={capture} />);
    expect(shots[shots.length - 1].shootDisabled).toBe(false);
    expect(t.root.findAll((n) => n.type === StatusBar)).toHaveLength(1);
    const t2 = render(<PackagedScanFlow mode="packaged" onMode={jest.fn()} onClose={jest.fn()} startLabel renderCamera={capture} focused={false} />);
    expect(t2.root.findAll((n) => n.type === StatusBar)).toHaveLength(0);
  });
  it('Codex #315: 전송 실패 뒤 다시 시도가 charged false = "추가 사용 없음" 단정 금지(첫 요청이 차감했을 수 있음 — 홈에서 확인)', async () => {
    const t = flow();
    await toHandoffFromNone(t);
    await shoot(t, LABEL_P1);
    mockPost.mockRejectedValueOnce(new Error('timeout'));
    await press(t, 'pscan-label-analyze');
    expect(texts(t)).toContain('packagedScan.chargeChecking');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'A3', charged: false }));
    await press(t, 'pscan-retry');
    expect(labelCalls()[1][1]).toMatchObject({ analysisId: 'A3' });
    expect(texts(t)).toContain('packagedScan.chargeSeeHome');
    expect(texts(t)).not.toContain('packagedScan.labelNoExtra');
  });
  it('Codex #315: 분석 대기 중 닫기(로딩 C X) = 모은 면 화면(면·분석 ID 유지) · 늦은 응답 무시 · 결과에서 한 면 더 OCR 중 닫기 = 그 카메라(늦은 OCR 무시)', async () => {
    const t = flow();
    await toHandoffFromNone(t);
    await shoot(t, LABEL_P1);
    let release!: (v: unknown) => void;
    mockPost.mockReturnValueOnce(new Promise((r) => (release = r)));
    act(() => { void t.root.findAll((n) => n.props?.testID === 'pscan-label-analyze' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    expect(ids(t)).toContain('pscan-reading');
    close(t, 'scan-loading-close');
    expect(ids(t)).toContain('pscan-label-pages');
    expect(ids(t)).toContain('pscan-same-analysis');
    expect(texts(t)).toContain('packagedScan.labelPagesCount:{"count":1,"max":4}');
    await act(async () => { release(RESULT({ analysisId: 'A3' })); await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('pscan-label-pages');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'A3' }));
    await press(t, 'pscan-label-analyze');
    await press(t, 'pscan-label-more');
    let ocrRelease!: (v: unknown) => void;
    mockOcr.mockReturnValueOnce(new Promise((r) => (ocrRelease = r)));
    act(() => { void t.root.findAll((n) => n.props?.testID === 'pscan-label-capture' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('pscan-reading');
    close(t, 'scan-loading-close');
    expect(ids(t)).toContain('cam-ingredient');
    await act(async () => { ocrRelease([{ text: LABEL_P2 }]); await new Promise((r) => setTimeout(r, 0)); });
    expect(labelCalls()).toHaveLength(2);
    expect(ids(t)).toContain('cam-ingredient');
  });
  it('#444 멱등 키: 새 분석 = clientRequestId · 전송 실패 재시도 = 같은 키 · 재전송 charged false여도 "1회 사용" · 같은 분석 = 키 없음', async () => {
    const inv = jest.spyOn(qc, 'invalidateQueries');
    const t = flow(true);
    await shoot(t, LABEL_P1);
    mockPost.mockRejectedValueOnce(new Error('timeout'));
    await press(t, 'pscan-label-analyze');
    expect(labelCalls()[0][1]).toMatchObject({ analysisId: null, clientRequestId: 'uuid-1' });
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L7', charged: false }));
    await press(t, 'pscan-retry');
    expect(labelCalls()[1][1]).toMatchObject({ analysisId: null, clientRequestId: 'uuid-1' });
    expect(texts(t)).toContain('packagedScan.scanUsed');
    expect(texts(t)).not.toContain('packagedScan.chargeSeeHome');
    expect(inv).toHaveBeenCalledWith({ queryKey: ['me'] });
    await press(t, 'pscan-label-more');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L7', charged: false }));
    await shoot(t, LABEL_P2);
    expect(labelCalls()[2][1]).toEqual({ analysisId: 'L7', pages: [{ ocrText: LABEL_P1 }, { ocrText: LABEL_P2 }], lang: 'en' });
  });
  it('#444 멱등 키: 면을 바꿔 다시 분석(못 읽음 뒤 면 추가) = 새 키', async () => {
    const t = flow(true);
    await shoot(t, '바코드');
    mockPost.mockRejectedValueOnce(new ApiError('x', 400, 'PFOOD-006'));
    await press(t, 'pscan-label-analyze');
    await press(t, 'pscan-retake');
    await press(t, 'pscan-label-add');
    await shoot(t, LABEL_P1);
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L8' }));
    await press(t, 'pscan-label-analyze');
    expect(labelCalls().map((c) => (c[1] as { clientRequestId?: string }).clientRequestId)).toEqual(['uuid-1', 'uuid-2']);
  });
  it('QA Z5: 면 모으기 → 뒤로 → 카메라(힌트 n/4)에서 찍기·주입 = 이어 붙이기(덮어쓰기 0) · 분석 ID 유지', async () => {
    const t = flow();
    await toHandoffFromNone(t);
    await shoot(t, LABEL_P1);
    back(t);
    expect(ids(t)).toContain('cam-ingredient');
    expect(hint(t)).toBe('packagedScan.labelPagesCount:{"count":1,"max":4}');
    await shoot(t, LABEL_P2);
    expect(texts(t)).toContain('packagedScan.labelPagesCount:{"count":2,"max":4}');
    back(t);
    act(() => t.root.findAll((n) => n.props?.testID === 'pscan-label-debug-input' && typeof n.props?.onChangeText === 'function')[0].props.onChangeText('c'));
    await press(t, 'pscan-label-debug-add');
    expect(texts(t)).toContain('packagedScan.labelPagesCount:{"count":3,"max":4}');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'A3' }));
    await press(t, 'pscan-label-analyze');
    expect(labelCalls()[0][1]).toMatchObject({ analysisId: 'A3', pages: [{ ocrText: LABEL_P1 }, { ocrText: LABEL_P2 }, { ocrText: 'c' }] });
  });
  it('로딩 C: 성분표 읽는 중 = 찍은 사진 + 성분표 캡션 · 본문 없음(가공식품용 시간 문구 키 없음 — 새 추정치 금지)', async () => {
    const t = flow(true);
    mockOcr.mockReturnValueOnce(new Promise(() => {}));
    act(() => { void t.root.findAll((n) => n.props?.testID === 'pscan-label-capture' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('pscan-reading');
    expect(ids(t)).toContain('scanning-preview');
    expect(texts(t)).toEqual(expect.arrayContaining(['packagedScan.labelReading', 'scanCamera.capturedLabel']));
    expect(ids(t)).not.toContain('scan-stay-hint');
  });
  it('플래그 off = 성분표 단계 = 기존 안내 페이지(촬영 버튼 비활성 + 곧 지원) · 카메라·주입 0', async () => {
    setFlag(false);
    const t = flow(true);
    expect(ids(t)).toContain('pscan-label-soon');
    expect(ids(t)).not.toContain('cam-ingredient');
    const btn = t.root.findAll((n) => n.props?.testID === 'pscan-label-capture' && typeof n.type === 'string')[0];
    expect(btn.props.accessibilityState).toEqual({ disabled: true });
    expect(ids(t)).not.toContain('pscan-label-debug');
  });
});

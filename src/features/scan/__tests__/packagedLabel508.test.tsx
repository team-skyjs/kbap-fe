/**
 * P-508(KB-813 후속) 성분표 분석 — 어댑터(함유 가능·charged는 true만·모르는 labelSource = NONE) · 요청(3.2·면 ≤4·면당 4000자) ·
 * 오류(400 PFOOD-006 못 읽음 · 409 PFOOD-007 새 분석) · 흐름(KB-988 — 성분표 사진 = 비전 판별 결과로 바로): 결과 = 판정 섹션 + 함유 가능 칩 + 원문 ·
 * 사진 검토 → 같은 ID 재분석 · 한 면 더 409 = 새 분석 버튼 · 한도·전송 실패 · 플래그 off = 비활성. 비전 분기(한 면 더 합치기 등)는 visionScan969.
 */
import * as fs from 'fs';
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/simulator', () => ({ ...jest.requireActual('@/lib/simulator'), useIsSimulator: () => true, isSimulator: async () => true })); // KB-970: OCR 주입 입력칸 = 시뮬 전용 — 이 파일은 시뮬 기준
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
jest.mock('@/lib/api/client', () => {
  class MockApiError extends Error { status?: number; code?: string; constructor(m: string, s?: number, c?: string) { super(m); this.status = s; this.code = c; } }
  return { api: { post: (...a: unknown[]) => mockPost(...a), get: jest.fn() }, apiLang: () => 'en', ApiError: MockApiError };
});
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
let mockRestrictions: { code: string }[] = [{ code: 'SHRIMP' }];
let mockProfileMissing = false;
let mockFreeUntil: string | null = null; // KB-877: 서버 무료 창 끝 // 프로필 대기·실패(data 없음)
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: mockProfileMissing ? undefined : { id: '41', restrictions: mockRestrictions, packagedFreeUntil: mockFreeUntil } }) })); // KB-865 ③: 결과 = 회피 1개 이상 회원(문장·리본) / 0개(주요 알레르기)
const mockMlKit = jest.fn();
jest.mock('@/lib/scan/ocr', () => ({ recognizeMenuLines: (...a: unknown[]) => mockMlKit(...a) }));
jest.mock('@/lib/api/scanImage', () => ({ ...jest.requireActual('@/lib/api/scanImage'), uploadVisionScanPhoto: async () => 'images/packaged-scans/l.jpg' }));
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
  mayContain: [{ code: 'SOY', source: 'MAY_CONTAIN', evidence: '대두' }],
  avoidance: [{ code: 'SHRIMP', match: 'DETECTED', matchedCodes: ['SHRIMP'], evidence: ['새우'] }], rawText: `${LABEL_P1}\n${LABEL_P2}`, charged: true,
  // KB-865 v4 — 판정 = 서버 verdict·matches
  verdict: 'AVOID', avoidMatches: [{ code: 'SHRIMP', evidence: ['새우'] }], mayContainMatches: [], unclearIngredients: [], majorAllergens: ['WHEAT', 'SHRIMP'],
  ingredients: { translated: 'Wheat flour, shrimp 10%, soybean oil', original: LABEL_P1 }, allergenStatement: { translated: null, original: '밀, 새우 함유' }, ...over,
});

const trees: ReactTestRenderer[] = [];
let qc: QueryClient;
const flagLabel = FLAGS.packagedLabelScan;
const setFlag = (v: boolean) => { (FLAGS as { packagedLabelScan: boolean }).packagedLabelScan = v; };
beforeEach(() => { qc = new QueryClient(); mockParams = {}; mockGranted = true; mockCanceled = false; mockUuid = 0; setFlag(true); mockRestrictions = [{ code: 'SHRIMP' }]; mockProfileMissing = false; mockFreeUntil = null; });
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); jest.clearAllMocks(); setFlag(flagLabel); });
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); }); trees.push(t); return t; };
const ids = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string').map((n) => n.props.testID as string);
const press = async (t: ReactTestRenderer, id: string) => { await act(async () => { await t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress(); }); await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const texts = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children as string);
/** KB-845: 공통 카메라 대역 — 힌트를 그리고 셔터 = onShot(고정 사진) · 성분표 카메라("앞면으로" 링크) = pscan-label-capture */
const mockShot = { uri: 'file:shot.jpg', width: 900, height: 1200 };
function mockCamera(o: ScanCamOpts) {
  const { View, Pressable, Text } = jest.requireActual('react-native');
  return (
    <View testID={o.link ? 'cam-ingredient' : 'cam-package'}>
      <Text testID="cam-hint">{o.hint ?? 'default-hint'}</Text>
      <Pressable testID={o.link ? 'pscan-label-capture' : 'pscan-take-photo'} onPress={() => o.onShot(mockShot)} disabled={o.shootDisabled} />
      {o.link && <Pressable testID={o.link.testID} onPress={o.link.onPress} />}
      {o.onClose && <Pressable testID="cam-close" onPress={o.onClose} />}
      {o.notice}
      {o.debug}
    </View>
  );
}
const mockOnQuota = jest.fn();
const flow = (startLabel = false) => render(<PackagedScanFlow onClose={jest.fn()} startLabel={startLabel} renderCamera={mockCamera} onQuota={mockOnQuota} />);
const labelCalls = () => mockPost.mock.calls.filter((c) => c[0] === '/api/processed-foods/scan/label');
/** 비전 응답(성분표로 판별 — 서버가 읽고 분석까지 끝낸 결과) */
const VISION_LABEL = (label: object) => ({ analysisId: (label as { analysisId: string }).analysisId, kind: 'INGREDIENT_LABEL', state: 'LABEL_RESULT', confidence: 0.9, reason: null, front: null, label, warnings: [] });

describe('흐름(KB-988 — 성분표 사진 = 비전 결과 → 결과 27~ · 사진 검토 25·50)', () => {
  const close = (t: ReactTestRenderer, id: string) => act(() => t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress());
  const count = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'pscan-label-count' && typeof n.type === 'string')[0]?.props.children as string | undefined;
  const joined = (t: ReactTestRenderer) => JSON.stringify(texts(t));
  /** 성분표 카메라에서 한 장 = 비전이 성분표로 판별·분석한 결과 화면 */
  const toResult = async (t: ReactTestRenderer, label: object) => {
    mockPost.mockResolvedValueOnce(VISION_LABEL(label));
    await press(t, 'pscan-label-capture');
  };
  /** 결과 → 사진 검토(면 검토 25·50). 1면 결과의 검토 버튼 = 판정 기준이 바뀐 결과(stale)일 때 — 회피를 바꾸고 돌아온 것으로 연다(R7 경로) */
  const toReview = async (t: ReactTestRenderer, analysisId: string) => {
    await toResult(t, RESULT({ analysisId }));
    mockRestrictions = [{ code: 'MILK' }];
    act(() => { t.update(<QueryClientProvider client={qc}><PackagedScanFlow onClose={jest.fn()} startLabel renderCamera={mockCamera} onQuota={mockOnQuota} /></QueryClientProvider>); });
    await press(t, 'pscan-result-review');
  };

  it('성분표 사진 = 비전 한 번으로 결과(리본·회피 문장·성분·주의) · ML Kit 0 · 계측', async () => {
    const t = flow(true);
    expect(ids(t)).toContain('cam-ingredient');
    expect(ids(t)).not.toContain('pscan-label-debug'); // KB-988: 옛 OCR 주입 0
    await toResult(t, RESULT({ mayContain: [{ code: 'SOY', evidence: '대두' }] }));
    expect(mockPost.mock.calls[0][0]).toBe('/api/processed-foods/scan/vision');
    expect(labelCalls()).toHaveLength(0); // 분석은 비전이 끝냈다
    expect(mockMlKit).not.toHaveBeenCalled();
    // KB-914(R-137): 판정 = 음식 상세와 같은 띠(결과 전용 문장 그대로) + 감지 재료 타일 · 원재료·알레르기 원문 = 접힘 → 펼치면
    expect(ids(t)).toEqual(expect.arrayContaining(['pscan-label-result', 'pscan-result-band-danger', 'pscan-result-detected', 'pscan-result-ingredients-open', 'pscan-label-more']));
    expect(ids(t)).not.toContain('pscan-result-major');
    expect(ids(t)).not.toContain('pscan-result-ingredients'); // 처음엔 접힘
    expect(texts(t)).toContain('packagedScan.resultAvoid:{"names":"L(SHRIMP)"}');
    await press(t, 'pscan-result-ingredients-open');
    expect(ids(t)).toEqual(expect.arrayContaining(['pscan-result-ingredients', 'pscan-result-raw-original', 'pscan-result-allergens', 'pscan-result-may', 'pscan-result-see-less']));
    expect(texts(t)).toContain('Wheat flour, shrimp 10%, soybean oil');
    expect(joined(t)).not.toMatch(/scanUsed|noScanUsed|labelFreeRetry|labelNoExtra/); // 차감 문구 0
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_label_scan', { pages: 1, charged: false, result: 'ok' });
    expect(mockPush).not.toHaveBeenCalled();
  });
  it('결과 문장 = 서버 verdict별(CAUTION 주의 재료 · SAFE_WITH_NOTE 불명확 · SAFE 1면/여러 면 · null 확인 못 함) · 리본 = 서버 verdict만', async () => {
    const cases: [object, string, string | null][] = [
      [{ verdict: 'CAUTION', avoidMatches: [], mayContainMatches: [{ code: 'MILK', evidence: ['우유'] }] }, 'packagedScan.resultCaution:{"names":"L(MILK)"}', 'caution'],
      [{ verdict: 'SAFE_WITH_NOTE', avoidMatches: [], unclearIngredients: ['향료'] }, '향료', 'caution'], // KB-921: 주의 톤 · 부제 = 목록
      [{ verdict: 'SAFE', avoidMatches: [] }, 'packaged.safeBasis:{"count":1}', 'safe'], // KB-959: 부제 = 근거(회피 N개와 대조 — 제목 반복 0)
      [{ verdict: null, avoidMatches: [], avoidance: [] }, 'packaged.notVerifiedBody', null], // 옛 응답 일치도 없음 = 확인 못 함
    ];
    for (const [over, sentence, badge] of cases) {
      const t = flow(true);
      await toResult(t, RESULT(over));
      expect(texts(t)).toContain(sentence);
      // KB-914: 판정 = 띠 하나(상태색) — 판정 없음 = 회색 unable 띠(판정 리본 0)
      const bands = ids(t).filter((i) => i.startsWith('pscan-result-band-'));
      expect(bands).toEqual([`pscan-result-band-${badge ?? 'unable'}`]);
    }
  });
  it('Codex #339: verdict 없는 옛 응답 = 서버 회피 일치(avoidance DETECTED) 숨김 0 — 회피 문장 + 위험 리본 · M0 = 검출 코드로 주요 알레르기', async () => {
    const legacy = { verdict: undefined, avoidMatches: undefined, mayContainMatches: undefined, majorAllergens: undefined, ingredients: undefined };
    const t = flow(true);
    await toResult(t, RESULT(legacy));
    expect(texts(t)).toContain('packagedScan.resultAvoid:{"names":"L(SHRIMP)"}');
    expect(ids(t)).toContain('pscan-result-band-danger');
    expect(texts(t)).not.toContain('packaged.notVerifiedBody');
    mockRestrictions = [];
    const t2 = flow(true);
    await toResult(t2, RESULT(legacy));
    expect(texts(t2).some((x) => x.startsWith('packagedScan.resultMajorSet') && x.includes('L(WHEAT), L(SHRIMP)'))).toBe(true);
    expect(texts(t2)).not.toContain('packaged.majorUnavailable');
  });
  it('Codex #339 R2: 프로필 대기·실패 = 서버 verdict 판정 그대로(리본·회피 문장) · verdict 없음 = 보수적 "확인 못 함"(주요 알레르기·회피 설정 경로 0)', async () => {
    mockProfileMissing = true;
    const t = flow(true);
    await toResult(t, RESULT());
    expect(ids(t)).toContain('pscan-result-band-danger');
    expect(texts(t)).toContain('packagedScan.resultAvoid:{"names":"L(SHRIMP)"}');
    expect(ids(t)).not.toContain('pscan-result-major');
    const t2 = flow(true);
    await toResult(t2, RESULT({ verdict: null, avoidance: [] }));
    expect(texts(t2)).toContain('packaged.notVerifiedBody');
    expect(ids(t2)).not.toContain('pscan-result-set-avoid');
  });
  it('Codex #339 R7: 결과 뒤 회피를 설정하고 돌아옴 = 옛 verdict를 개인 판정으로 안 씀(리본 0 · 확인 못 함) → 사진 검토에서 같은 분석 다시 분석 → 새 판정', async () => {
    mockRestrictions = [];
    const el = () => <PackagedScanFlow onClose={jest.fn()} startLabel renderCamera={mockCamera} onQuota={mockOnQuota} />;
    const t = render(el());
    await toResult(t, RESULT({ analysisId: 'L40', verdict: 'SAFE', avoidMatches: [], avoidance: [] })); // 회피 0개 때 계산
    expect(ids(t)).toContain('pscan-result-major');
    mockRestrictions = [{ code: 'SHRIMP' }]; // 프로필에서 회피 저장 뒤 돌아옴(KB-945: 결과의 설정 버튼은 제거)
    act(() => { t.update(<QueryClientProvider client={qc}>{el()}</QueryClientProvider>); }); // 새 요소 = 실제 재렌더(프로필 갱신)
    expect(ids(t).filter((i) => i.startsWith('pscan-result-band-'))).toEqual(['pscan-result-band-unable']); // KB-914: 옛 판정 = 회색 띠(판정 리본 0)
    expect(texts(t)).toContain('packaged.notVerifiedBody');
    expect(texts(t)).not.toContain('packaged.noAvoidMatches');
    await press(t, 'pscan-result-review');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L40' })); // 새 기준 = AVOID(SHRIMP)
    await press(t, 'pscan-label-analyze');
    expect(labelCalls()[0][1]).toMatchObject({ analysisId: 'L40' }); // 첫 결과는 비전이 분석(라벨 호출 0)
    expect(ids(t)).toContain('pscan-result-band-danger');
    expect(texts(t)).toContain('packagedScan.resultAvoid:{"names":"L(SHRIMP)"}');
  });
  it('KB-877 → KB-959(예진 11/2): 결과 화면 무료 시간 표시 0 — 창을 연 분석(시작 안내)·창 안 분석(남은 분) 둘 다(차감 규칙은 서버 그대로)', async () => {
    const FREE = new Date(Date.now() + 59 * 60_000 + 30_000).toISOString();
    const t = flow(true);
    await toResult(t, RESULT({ charged: true, freeUntil: FREE }));
    expect(ids(t)).toContain('pscan-label-result');
    expect(ids(t)).not.toContain('pscan-free-started');
    expect(ids(t)).not.toContain('pscan-free-line');
    mockFreeUntil = FREE; // 프로필도 창을 안다
    const t2 = flow(true);
    await toResult(t2, RESULT({ analysisId: 'L2', charged: false, freeUntil: FREE }));
    expect(ids(t2)).toContain('pscan-label-result');
    expect(texts(t2).some((x) => x.startsWith('packagedScan.freeFor'))).toBe(false);
  });
  it('회피 0개 회원(M0) = 주요 알레르기 문장(리본·회피 문장 0) · KB-945 회피 설정 버튼 0(Done만) · 주요 알레르기 null = 확인 불가(없음 단정 금지)', async () => {
    mockRestrictions = [];
    const t = flow(true);
    await toResult(t, RESULT());
    expect(ids(t)).toContain('pscan-result-major');
    expect(ids(t)).not.toContain('pscan-result-set-avoid');
    expect(joined(t)).not.toContain('packaged.setAvoidIngredients');
    expect(ids(t).some((i) => i.startsWith('pscan-result-band-'))).toBe(false); // KB-914: 회피 0개 = 판정 띠 0(주요 알레르기 섹션)
    expect(joined(t)).toContain('packagedScan.resultMajorSet');
    const t2 = flow(true);
    await toResult(t2, RESULT({ majorAllergens: null, detections: [] })); // 검출도 없음 = 확인 불가
    expect(texts(t2)).toContain('packaged.majorUnavailable');
  });
  it('목록 "성분표 찍기"(startLabel) = 성분표 카메라부터(반대 링크 = 앞면으로) · 경로 /scan?mode=packaged&label=1 배선', async () => {
    const t = flow(true);
    expect(ids(t)).toContain('cam-ingredient');
    expect(ids(t)).not.toContain('cam-close'); // 첫 카메라 = 스캔 화면 닫기(scan.tsx X)
    expect(fs.readFileSync('src/app/processed-foods/[id].tsx', 'utf8')).not.toContain('pf-label-scan');
    expect(fs.readFileSync('src/features/processedFood/PackagedExplorer.tsx', 'utf8')).toContain('router.navigate(`/scan?mode=packaged&label=1&t=${Date.now()}` as Href)');
    const scan = fs.readFileSync('src/app/scan.tsx', 'utf8');
    expect(scan).toContain("const labelEntry = scanParams.label === '1' && FLAGS.packagedLabelScan ? (scanParams.t ?? 'entry') : null;");
    expect(scan).toContain('startLabel={labelEntry != null}\n          renderCamera={cameraUi}\n          focused={isFocused}');
    await press(t, 'pscan-front-instead');
    expect(ids(t)).toContain('cam-package');
    expect(ids(t)).not.toContain('pscan-label-instead'); // KB-969·KB-988: 앞면 카메라 = 카메라 하나("성분표로" 링크 0)
  });
  it('시안 25·50: 결과 "사진 보기" → 면 검토(다시 분석 안내 · Add) → 분석 = 같은 ID(새 키 0)', async () => {
    const t = flow(true);
    await toReview(t, 'L4');
    expect(ids(t)).toEqual(expect.arrayContaining(['pscan-label-pages', 'pscan-label-reanalyze']));
    expect(count(t)).toBe('packagedScan.labelPhotosCount:{"count":1,"max":4}');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L4', charged: false }));
    await press(t, 'pscan-label-analyze');
    expect(labelCalls()[0][1]).toEqual({ analysisId: 'L4', pages: [{ ocrText: RESULT().rawText }], lang: 'en' });
    expect(ids(t)).toContain('pscan-label-result');
  });
  it('409 PFOOD-007(무료 재분석 초과) = 새로 분석 버튼 → analysisId null(멱등 키) · 같은 면', async () => {
    const t = flow(true);
    await toReview(t, 'L5');
    mockPost.mockRejectedValueOnce(new ApiError('x', 409, 'PFOOD-007'));
    await press(t, 'pscan-label-analyze');
    expect(ids(t)).toContain('pscan-error-newAnalysis');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L6' }));
    await press(t, 'pscan-new-analysis');
    expect(labelCalls()[1][1]).toEqual({ analysisId: null, clientRequestId: expect.any(String), pages: [{ ocrText: RESULT().rawText }], lang: 'en' });
    expect(ids(t)).toContain('pscan-label-result');
  });
  it('Q4: 성분표 분석 한도(SCAN-004) = onQuota(scan.tsx 덮개) · 면 검토 그대로(면·분석 ID 유지) → 다시 분석 = 같은 면', async () => {
    const t = flow(true);
    await toReview(t, 'L3');
    mockPost.mockRejectedValueOnce(new ApiError('quota', 403, 'SCAN-004'));
    await press(t, 'pscan-label-analyze');
    expect(mockOnQuota).toHaveBeenCalledTimes(1);
    expect(ids(t)).toContain('pscan-label-pages');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'L3' }));
    await press(t, 'pscan-label-analyze');
    expect(labelCalls()[1][1]).toMatchObject({ analysisId: 'L3' });
  });
  it('Codex #318: 4면이 찬 성분표 카메라(방어) = 셔터 비활성 · 상태바 흰 글자는 스캔 화면이 보일 때만', () => {
    const shots: ScanCamOpts[] = [];
    const capture = (o: ScanCamOpts) => { shots.push(o); return mockCamera(o); };
    const { StatusBar } = jest.requireActual('expo-status-bar') as typeof import('expo-status-bar');
    const t = render(<PackagedScanFlow onClose={jest.fn()} startLabel renderCamera={capture} />);
    expect(shots[shots.length - 1].shootDisabled).toBe(false);
    expect(t.root.findAll((n) => n.type === StatusBar)).toHaveLength(1);
    const t2 = render(<PackagedScanFlow onClose={jest.fn()} startLabel renderCamera={capture} focused={false} />);
    expect(t2.root.findAll((n) => n.type === StatusBar)).toHaveLength(0);
  });
  it('Codex #315: 재분석 전송 실패 → 다시 시도 = 같은 분석 ID · charged false여도 프로필 재조회(첫 요청이 차감했을 수 있음)', async () => {
    const t = flow(true);
    await toReview(t, 'A3');
    mockPost.mockRejectedValueOnce(new Error('timeout'));
    await press(t, 'pscan-label-analyze');
    expect(ids(t)).toContain('pscan-error-network');
    const inv = jest.spyOn(qc, 'invalidateQueries');
    mockPost.mockResolvedValueOnce(RESULT({ analysisId: 'A3', charged: false }));
    await press(t, 'pscan-retry');
    expect(labelCalls()[1][1]).toMatchObject({ analysisId: 'A3' });
    expect(inv).toHaveBeenCalledWith({ queryKey: ['me'] });
    expect(ids(t)).toContain('pscan-label-result');
  });
  it('Codex #315: 재분석 대기 중 닫기(로딩 C X) = 면 검토(면·분석 ID 유지) · 늦은 응답 무시', async () => {
    const t = flow(true);
    await toReview(t, 'A3');
    let release!: (v: unknown) => void;
    mockPost.mockReturnValueOnce(new Promise((r) => (release = r)));
    act(() => { void t.root.findAll((n) => n.props?.testID === 'pscan-label-analyze' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    expect(ids(t)).toContain('pscan-reading');
    close(t, 'scan-loading-close');
    expect(ids(t)).toContain('pscan-label-pages');
    await act(async () => { release(RESULT({ analysisId: 'A3' })); await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('pscan-label-pages');
  });
  it('로딩 C(Q1 유지): 한 면 더 읽는 중 = 찍은 사진 + 성분표 캡션 · 본문 없음', async () => {
    const t = flow(true);
    await toResult(t, RESULT());
    await press(t, 'pscan-label-more');
    mockPost.mockReturnValueOnce(new Promise(() => {}));
    act(() => { void t.root.findAll((n) => n.props?.testID === 'pscan-label-capture' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('pscan-reading');
    expect(ids(t)).toContain('scanning-preview');
    expect(texts(t)).toEqual(expect.arrayContaining(['packagedScan.labelReading', 'scanCamera.capturedLabel']));
    expect(ids(t)).not.toContain('scan-stay-hint');
  });
  it('플래그 off = 성분표 단계 = 기존 안내 페이지(곧 지원) · 카메라 0 · 후보 없음 화면 = 이름 찾기만', async () => {
    setFlag(false);
    const t = flow(true);
    expect(ids(t)).toContain('pscan-label-soon');
    expect(ids(t)).not.toContain('cam-ingredient');
    const t2 = flow();
    mockPost.mockResolvedValueOnce({ analysisId: 'A3', kind: 'PACKAGE_FRONT', state: 'NO_CANDIDATE', confidence: 0.9, reason: null, front: { productName: '새우깡', candidates: [] }, label: null, warnings: [] });
    await press(t2, 'pscan-take-photo');
    expect(ids(t2)).toContain('pscan-find-by-name');
    expect(ids(t2)).not.toContain('pscan-to-label');
    expect(texts(t2)).toContain('packagedScan.anotherBodyNameOnly');
  });
});

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
import { PackagedScanFlow, type ScanCamOpts } from '../PackagedScanFlow';
import { FLAGS } from '@/lib/flags';
import { ScanModeTabs } from '../ScanModeTabs';
import { ProcessedFoodDetailScreen as Detail } from '@/app/processed-foods/[id]'; // KB-870: 기본 내보내기 = 채널 게이트 — 화면 자체를 직접 렌더
/* eslint-enable import/first */

const cand = (id: number, rn: string) => ({ id, reportNo: rn, productName: `P${id}`, maker: 'Nongshim', foodType: '과자', imageUrl: 'http://h/x.jpg' });
const DETAIL = { id: 11, reportNo: 'R1', productName: '새우깡', maker: '농심', foodType: '과자', labelSource: 'DECLARED', allergens: '밀', detections: [], avoidance: [], source: { provider: 'HACCP', attributionKey: 'processedFood.source.haccp' }, image: null };

const trees: ReactTestRenderer[] = [];
let qc: QueryClient;
beforeEach(() => { mockPrevent.on = false; mockPrevent.cb = null; FLAGS.packagedNameScanPhoto = false; /* KB-892: 기존 흐름 = 플래그 OFF(jest는 dev 채널이라 기본 ON) */ qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } }); mockParams = {}; mockGranted = true; mockRestrictions = [{ code: 'SHRIMP' }]; mockProfileMissing = false; mockFreeUntil = null; });
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); qc.clear(); jest.clearAllMocks(); });
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); }); trees.push(t); return t; };
const ids = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string').map((n) => n.props.testID as string);
const press = async (t: ReactTestRenderer, id: string) => { await act(async () => { await t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress(); }); await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
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
      {o.notice}
      {o.debug}
    </View>
  );
}
const mockOnQuota = jest.fn();
const flow = () => render(<PackagedScanFlow mode="packaged" onMode={jest.fn()} onClose={jest.fn()} renderCamera={mockCamera} onQuota={mockOnQuota} />);
/** 후보 고르기(테두리) → 확정 CTA */
// KB-914(R-138): 줄 탭 = 바로 확정(구 고르고 → 하단 확정 버튼)
const pick = async (t: ReactTestRenderer, id: number) => { await press(t, `pscan-candidate-${id}`); };
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

describe('흐름(KB-865 ③ v4)', () => {
  it('촬영 → OCR 전체 텍스트 → 후보(시안 16: 제목·n개, 차감 문구 0) → 탭 = 선택(테두리) → 확정 CTA = 확정 → 상세(charged=1) · 프로필 재조회 · 상세 캐시 선적재', async () => {
    mockOcr.mockResolvedValueOnce([{ text: 'NEW' }, { text: '농심' }, { text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A1', state: 'CANDIDATES', candidates: [cand(11, 'R1'), cand(12, 'R2')] })
      .mockResolvedValueOnce({ analysisId: 'A1', state: 'CONFIRMED', charged: true, product: DETAIL });
    const inv = jest.spyOn(qc, 'invalidateQueries');
    const t = flow();
    await press(t, 'pscan-take-photo');
    expect(mockPost.mock.calls[0][1]).toMatchObject({ ocrText: 'NEW\n농심\n새우깡' });
    expect(ids(t)).toEqual(expect.arrayContaining(['pscan-candidates', 'pscan-candidate-11', 'pscan-candidate-12']));
    expect(texts(t)).toContain('packagedScan.matchTitle');
    expect(JSON.stringify(texts(t))).not.toMatch(/usedOnSuccess|noScanUsed|scanUsed/); // README: 차감 문구 0
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_scan_name', { candidate_count: 2, photo_attached: false });
    // KB-914(R-138): 확정 버튼 0 — 줄 탭이 곧 확정
    expect(ids(t)).not.toContain('pscan-confirm');
    expect(mockPost).toHaveBeenCalledTimes(1);
    await pick(t, 12);
    expect(mockPost.mock.calls[1]).toEqual(['/api/processed-foods/scan/confirm', { analysisId: 'A1', reportNo: 'R2' }, { headers: { 'X-API-Version': '3.2' } }]);
    expect(mockPush).toHaveBeenCalledWith('/processed-foods/11?scan=1&charged=1');
    expect(inv).toHaveBeenCalledWith({ queryKey: ['me'] });
    expect(qc.getQueryData(['processedFoods', 'detail', '11', 'en|member:SHRIMP'])).toMatchObject({ id: '11', name: '새우깡' });
  });
  it('KB-908(T-050): 후보 화면 = 하드웨어 뒤로·닫기가 확인 없이 스캔 종료하지 않음 — 메뉴 결과와 같은 "Leave scan results?" · 머무르기 = 후보 그대로 · 나가기 = 막았던 이동 진행', async () => {
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost.mockResolvedValueOnce({ analysisId: 'A7', state: 'CANDIDATES', candidates: [cand(11, 'R1')] });
    const t = flow();
    expect(mockPrevent.on).toBe(false); // 앞면 카메라 = 막지 않음(종전)
    await press(t, 'pscan-take-photo');
    expect(ids(t)).toContain('pscan-candidates');
    expect(mockPrevent.on).toBe(true);
    expect(ids(t)).not.toContain('scan-leave-confirm');
    const action = { type: 'GO_BACK' };
    act(() => mockPrevent.cb!({ data: { action } }));
    expect(ids(t)).toContain('scan-leave-confirm');
    expect(texts(t)).toEqual(expect.arrayContaining(['scan.leaveTitle', 'scan.retakeBody', 'scan.leaveConfirm']));
    await press(t, 'scan-confirm-cancel');
    expect(ids(t)).not.toContain('scan-leave-confirm');
    expect(ids(t)).toContain('pscan-candidates');
    expect(mockNavDispatch).not.toHaveBeenCalled();
    act(() => mockPrevent.cb!({ data: { action } }));
    await press(t, 'scan-leave-go');
    expect(mockNavDispatch).toHaveBeenCalledWith(action);
  });
  it('KB-914(R-138): 후보 줄 = 메뉴판 결과 줄 문법 — 선택 상태 0 · 탭 1번 = 확정 요청 1번 · "None of these" = 목록 끝 줄 · 확정 대기 중인 줄에 스피너', async () => {
    let release!: (v: unknown) => void;
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A9', state: 'CANDIDATES', candidates: [cand(11, 'R1'), cand(12, 'R2')] })
      .mockReturnValueOnce(new Promise((r) => (release = r)));
    const t = flow();
    await press(t, 'pscan-take-photo');
    const order = ids(t).filter((i) => /^pscan-(candidate-\d+|none-of-these)$/.test(i));
    expect(order).toEqual(['pscan-candidate-11', 'pscan-candidate-12', 'pscan-none-of-these']); // 끝 줄
    const row = t.root.findAll((n) => n.props?.testID === 'pscan-candidate-11' && n.props?.accessibilityState)[0];
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityState).not.toHaveProperty('selected');
    await press(t, 'pscan-candidate-11');
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost.mock.calls[1][1]).toEqual({ analysisId: 'A9', reportNo: 'R1' });
    expect(ids(t)).toContain('pscan-picking-11');
    expect(ids(t)).not.toContain('pscan-picking-12');
    await act(async () => { release({ analysisId: 'A9', state: 'CONFIRMED', charged: true, product: DETAIL }); });
    expect(mockPush).toHaveBeenCalledWith('/processed-foods/11?scan=1&charged=1');
  });
  it('"None of these" = 서버 호출 없이 시안 17(이름으로 찾기 / 성분표) · 이름으로 찾기 = 읽은 글자로 채운 검색 → 고르고 확정 = 같은 분석 + 그 항목 reportNo(후보 밖)', async () => {
    mockOcr.mockResolvedValueOnce([{ text: '빙그레' }, { text: '바나나맛우유' }, { text: '240ml' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A2', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
      .mockResolvedValueOnce({ analysisId: 'A2', state: 'CONFIRMED', charged: true, product: DETAIL });
    mockGet.mockResolvedValueOnce({ items: [{ id: 77, reportNo: 'R77', productName: '바나나맛우유', name: 'Banana Milk', imageUrl: null }, { id: 78, productName: 'no report', imageUrl: null }], hasNext: false, nextCursor: null });
    const t = flow();
    await press(t, 'pscan-take-photo');
    await press(t, 'pscan-none-of-these');
    expect(mockPost).toHaveBeenCalledTimes(1); // 거절 확정 호출 0
    expect(ids(t)).toEqual(expect.arrayContaining(['pscan-another', 'pscan-find-by-name']));
    await press(t, 'pscan-find-by-name');
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_scan_find_by_name', { from: 'rejected' });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(mockGet.mock.calls[0][0]).toContain(`query=${encodeURIComponent('빙그레 바나나맛우유')}`); // 읽은 글자 앞 두 줄
    const input = t.root.findAll((n) => n.props?.testID === 'pscan-name-search-input' && typeof n.props?.value === 'string')[0];
    expect(input.props.value).toBe('빙그레 바나나맛우유');
    expect(ids(t)).toContain('pscan-candidate-77');
    expect(ids(t)).not.toContain('pscan-candidate-78'); // reportNo 없는 항목 = 확정 불가 → 목록 제외
    await pick(t, 77);
    expect(mockPost.mock.calls[1][1]).toEqual({ analysisId: 'A2', reportNo: 'R77' });
    expect(mockPush).toHaveBeenCalledWith('/processed-foods/11?scan=1&charged=1');
    expect(JSON.stringify(mockTrack.mock.calls)).not.toContain('바나나'); // 검색어 원문 계측 0
  });
  it('Codex #339: "None of these" → 성분표 = 먼저 거절 확정(reportNo null, 차감 0) 뒤 같은 분석으로 · 서버가 이미 REJECTED·NO_CANDIDATE면 거절 호출 0', async () => {
    const flags = jest.requireActual('@/lib/flags') as { FLAGS: { packagedLabelScan: boolean } };
    const prevFlag = flags.FLAGS.packagedLabelScan;
    flags.FLAGS.packagedLabelScan = true;
    try {
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A20', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
      .mockResolvedValueOnce({ analysisId: 'A20', state: 'REJECTED', charged: false, product: null });
    const t = flow();
    await press(t, 'pscan-take-photo');
    await press(t, 'pscan-none-of-these');
    expect(mockPost).toHaveBeenCalledTimes(1);
    await press(t, 'pscan-to-label');
    expect(mockPost.mock.calls[1]).toEqual(['/api/processed-foods/scan/confirm', { analysisId: 'A20', reportNo: null }, { headers: { 'X-API-Version': '3.2' } }]);
    expect(ids(t)).toContain('cam-ingredient');
    // 거절 실패(전송) = 오류 → 다시 시도 = 다시 거절 뒤 성분표
    mockPost.mockReset();
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A21', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce({ analysisId: 'A21', state: 'REJECTED', charged: false, product: null });
    const t2 = flow();
    await press(t2, 'pscan-take-photo');
    await press(t2, 'pscan-none-of-these');
    await press(t2, 'pscan-to-label');
    expect(ids(t2)).toContain('pscan-error-network');
    await press(t2, 'pscan-retry');
    expect(mockPost.mock.calls.map((c) => c[1])).toEqual([expect.anything(), { analysisId: 'A21', reportNo: null }, { analysisId: 'A21', reportNo: null }]);
    expect(ids(t2)).toContain('cam-ingredient');
    // NO_CANDIDATE = 이미 정리된 분석 → 거절 호출 없이 성분표
    mockPost.mockReset();
    mockOcr.mockResolvedValueOnce([{ text: 'xyz' }]);
    mockPost.mockResolvedValueOnce({ analysisId: 'A22', state: 'NO_CANDIDATE', candidates: [] });
    const t3 = flow();
    await press(t3, 'pscan-take-photo');
    await press(t3, 'pscan-to-label');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(ids(t3)).toContain('cam-ingredient');
    } finally {
      flags.FLAGS.packagedLabelScan = prevFlag;
    }
  });
  it('Codex #339: 확정 대기 중 = 후보 카드·"None of these" 잠금(늦은 응답이 다른 선택을 덮지 않음) · 응답 뒤 = 고른 그 제품으로', async () => {
    let release!: (v: unknown) => void;
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    const backRemove = jest.fn();
    const backSpy = jest.spyOn(RN.BackHandler, 'addEventListener').mockImplementation(() => ({ remove: backRemove }));
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A23', state: 'CANDIDATES', candidates: [cand(11, 'R1'), cand(12, 'R2')] })
      .mockReturnValueOnce(new Promise((r) => (release = r)));
    const t = flow();
    await press(t, 'pscan-take-photo');
    act(() => { void t.root.findAll((n) => n.props?.testID === 'pscan-candidate-11' && typeof n.props?.onPress === 'function')[0].props.onPress(); }); // KB-914: 줄 탭 = 확정
    const card12 = t.root.findAll((n) => n.props?.testID === 'pscan-candidate-12' && n.props?.accessibilityState)[0];
    expect(card12.props.accessibilityState).toMatchObject({ disabled: true });
    expect(t.root.findAll((n) => n.props?.testID === 'pscan-candidate-12' && n.props?.accessibilityRole === 'button' && typeof n.props?.onPress === 'function')).toHaveLength(0); // 실제 Pressable
    expect(t.root.findAll((n) => n.props?.testID === 'pscan-none-of-these' && typeof n.props?.onPress === 'function')).toHaveLength(0);
    // 헤더 뒤로·하드웨어 뒤로도 잠금(Codex #339 R5) — 화면 그대로, 하드웨어 back은 삼킴(true)
    act(() => t.root.findAll((n) => n.props?.title === 'packagedScan.chooseTitle' && typeof n.props?.onBack === 'function')[0].props.onBack()); // 헤더(SubHeader)
    expect(ids(t)).toContain('pscan-candidates');
    const hw = backSpy.mock.calls.at(-1)?.[1] as (() => boolean) | undefined;
    expect(hw?.()).toBe(true);
    await act(async () => { release({ analysisId: 'A23', state: 'CONFIRMED', charged: true, product: DETAIL }); await new Promise((r) => setTimeout(r, 0)); });
    expect(backRemove).toHaveBeenCalled(); // 대기 끝 = 하드웨어 back 원래대로
    expect(mockPost.mock.calls[1][1]).toEqual({ analysisId: 'A23', reportNo: 'R1' });
    expect(mockPush).toHaveBeenCalledWith('/processed-foods/11?scan=1&charged=1');
    backSpy.mockRestore();
  });
  it('Codex #339 R6: 성분표 전 거절 확정 대기 중 = 이름으로 찾기·헤더 뒤로 잠금(서버가 REJECTED로 굳히는 사이 다른 길 0) → 응답 뒤 성분표', async () => {
    const flags = jest.requireActual('@/lib/flags') as { FLAGS: { packagedLabelScan: boolean } };
    const prevFlag = flags.FLAGS.packagedLabelScan;
    flags.FLAGS.packagedLabelScan = true;
    try {
      let release!: (v: unknown) => void;
      mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
      mockPost
        .mockResolvedValueOnce({ analysisId: 'A26', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
        .mockReturnValueOnce(new Promise((r) => (release = r)));
      const t = flow();
      await press(t, 'pscan-take-photo');
      await press(t, 'pscan-none-of-these');
      act(() => { t.root.findAll((n) => n.props?.testID === 'pscan-to-label' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
      await press(t, 'pscan-find-by-name');
      // KB-914(R-139): 어두운 안내 화면의 뒤로(구 헤더) — 대기 중엔 눌리지 않는다(핸들러 0)
      expect(t.root.findAll((n) => n.props?.testID === 'pscan-another-back' && typeof n.props?.onPress === 'function')).toHaveLength(0);
      expect(ids(t)).toContain('pscan-another');
      expect(ids(t)).not.toContain('pscan-name-search');
      expect(mockTrack).not.toHaveBeenCalledWith('food_packaged_scan_find_by_name', expect.anything());
      await act(async () => { release({ analysisId: 'A26', state: 'REJECTED', charged: false, product: null }); await new Promise((r) => setTimeout(r, 0)); });
      expect(ids(t)).toContain('cam-ingredient');
    } finally {
      flags.FLAGS.packagedLabelScan = prevFlag;
    }
  });
  it('Codex #339 R5: SAFE_WITH_NOTE 후보 = 스크린리더에 불명확 단서(조건 없는 safe 0) · 리본은 safe', async () => {
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost.mockResolvedValueOnce({ analysisId: 'A25', state: 'CANDIDATES', candidates: [{ ...cand(11, 'R1'), verdict: 'SAFE_WITH_NOTE' }, { ...cand(12, 'R2'), verdict: 'SAFE' }] });
    const t = flow();
    await press(t, 'pscan-take-photo');
    const label = (id: number) => t.root.findAll((n) => n.props?.testID === `pscan-candidate-${id}` && n.props?.accessibilityRole === 'button')[0].props.accessibilityLabel as string;
    expect(label(11)).toContain('risk.caution, packaged.unclearNoteA11y'); // KB-921: SAFE_WITH_NOTE 리본 = 주의
    expect(label(12)).toContain('risk.safe');
    expect(label(12)).not.toContain('packaged.unclearNoteA11y');
  });
  it('Codex #339: 이름 찾기 = 20개 페이지 이어 받기(스크롤 끝 근처 · 화면을 못 채우면 내용 크기로)', async () => {
    mockOcr.mockResolvedValueOnce([{ text: '바나나' }]);
    mockPost.mockResolvedValueOnce({ analysisId: 'A24', state: 'CANDIDATES', candidates: [cand(11, 'R1')] });
    mockGet
      .mockResolvedValueOnce({ items: [{ id: 77, reportNo: 'R77', productName: 'a', imageUrl: null }], hasNext: true, nextCursor: 'C2' })
      .mockResolvedValueOnce({ items: [{ id: 99, reportNo: 'R99', productName: 'b', imageUrl: null }], hasNext: false, nextCursor: null });
    const t = flow();
    await press(t, 'pscan-take-photo');
    await press(t, 'pscan-none-of-these');
    await press(t, 'pscan-find-by-name');
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('pscan-candidate-77');
    const sv = t.root.findAll((n) => n.props?.testID === 'pscan-name-search-scroll' && typeof n.props?.onContentSizeChange === 'function')[0];
    act(() => sv.props.onLayout({ nativeEvent: { layout: { height: 800 } } }));
    await act(async () => { sv.props.onContentSizeChange(390, 600); await new Promise((r) => setTimeout(r, 0)); });
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet.mock.calls[1][0]).toContain('C2');
    expect(ids(t)).toContain('pscan-candidate-99');
    // 다음 페이지 없음 = 더 부르지 않는다
    await act(async () => { sv.props.onScroll({ nativeEvent: { layoutMeasurement: { height: 800 }, contentOffset: { y: 0 }, contentSize: { height: 600 } } }); });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
  it('후보 0개 = 시안 17(차감 문구 0) · 서버 REJECTED = 같은 화면 · 뒤로 = 앞 단계', async () => {
    mockOcr.mockResolvedValueOnce([{ text: 'xyz' }]);
    mockPost.mockResolvedValueOnce({ analysisId: 'A3', state: 'NO_CANDIDATE', candidates: [] });
    const t = flow();
    await press(t, 'pscan-take-photo');
    expect(ids(t)).toContain('pscan-none');
    expect(texts(t)).toContain('packagedScan.anotherTitle');
    expect(JSON.stringify(texts(t))).not.toContain('noScanUsed');
    mockPost.mockReset();
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A3b', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
      .mockResolvedValueOnce({ analysisId: 'A3b', state: 'REJECTED', charged: false, product: null });
    const t2 = flow();
    await press(t2, 'pscan-take-photo');
    await pick(t2, 11);
    expect(ids(t2)).toContain('pscan-another');
    expect(mockPush).not.toHaveBeenCalled();
  });
  it('시안 21: 확정 한도(SCAN-004) = onQuota(scan.tsx가 소진 화면을 위에) · 후보·선택 그대로 유지(해제·나중에 뒤 같은 후보에서 다시 확정)', async () => {
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A10', state: 'CANDIDATES', candidates: [cand(11, 'R1'), cand(12, 'R2')] })
      .mockRejectedValueOnce(new ApiError('quota', 403, 'SCAN-004'))
      .mockResolvedValueOnce({ analysisId: 'A10', state: 'CONFIRMED', charged: true, product: DETAIL });
    const t = flow();
    await press(t, 'pscan-take-photo');
    await pick(t, 12);
    expect(mockOnQuota).toHaveBeenCalledTimes(1);
    expect(ids(t)).toContain('pscan-candidates');
    await pick(t, 12); // 해제 뒤 같은 줄을 다시 탭(KB-914 — 구 같은 선택 유지 + 확정 버튼)
    expect(mockPost.mock.calls[2][1]).toEqual({ analysisId: 'A10', reportNo: 'R2' });
    expect(mockPush).toHaveBeenCalledWith('/processed-foods/11?scan=1&charged=1');
  });
  it('회피 0개 회원(시안 45) = 후보 위 개인화 안내 · 리본 0', async () => {
    mockRestrictions = [];
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost.mockResolvedValueOnce({ analysisId: 'A11', state: 'CANDIDATES', candidates: [{ ...cand(11, 'R1'), verdict: 'SAFE', majorAllergens: ['WHEAT'] }] });
    const t = flow();
    await press(t, 'pscan-take-photo');
    expect(ids(t)).toEqual(expect.arrayContaining(['pscan-personal-note', 'pscan-contains-11']));
    expect(ids(t).some((i) => i.startsWith('pscan-verdict-'))).toBe(false);
  });
  it('Codex #339 R2: 프로필 대기·실패 = 서버 verdict 리본 그대로(주요 알레르기 경로로 강등 0) · 개인화 안내 0', async () => {
    mockProfileMissing = true;
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost.mockResolvedValueOnce({ analysisId: 'A30', state: 'CANDIDATES', candidates: [{ ...cand(11, 'R1'), verdict: 'AVOID', majorAllergens: ['WHEAT'] }] });
    const t = flow();
    await press(t, 'pscan-take-photo');
    expect(ids(t)).toContain('pscan-verdict-11');
    expect(ids(t)).not.toContain('pscan-contains-11');
    expect(ids(t)).not.toContain('pscan-personal-note');
  });
  it('Codex #339 R8: NO_CANDIDATE → 이름으로 찾기 확정 → 돌아와 성분표 = 확정된 분석은 이어 받지 않음 → 새 성분표 분석(analysisId null · 거절 호출 0)', async () => {
    const flags = jest.requireActual('@/lib/flags') as { FLAGS: { packagedLabelScan: boolean } };
    const prevFlag = flags.FLAGS.packagedLabelScan;
    flags.FLAGS.packagedLabelScan = true;
    try {
      mockOcr.mockResolvedValueOnce([{ text: '바나나맛우유' }]);
      mockPost
        .mockResolvedValueOnce({ analysisId: 'A50', state: 'NO_CANDIDATE', candidates: [] })
        .mockResolvedValueOnce({ analysisId: 'A50', state: 'CONFIRMED', charged: true, product: DETAIL })
        .mockResolvedValueOnce({ analysisId: 'L50', state: 'LABEL_RESULT', labelSource: 'DECLARED', detections: [], mayContain: [], avoidance: [], rawText: 'x', charged: true, verdict: 'SAFE', avoidMatches: [], mayContainMatches: [], unclearIngredients: [], majorAllergens: [] });
      mockGet.mockResolvedValueOnce({ items: [{ id: 77, reportNo: 'R77', productName: 'a', imageUrl: null }], hasNext: false, nextCursor: null });
      const t = flow();
      await press(t, 'pscan-take-photo');
      await press(t, 'pscan-find-by-name');
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      await pick(t, 77);
      expect(mockPost.mock.calls[1][1]).toEqual({ analysisId: 'A50', reportNo: 'R77' });
      await press(t, 'pscan-none-of-these'); // 상세에서 돌아와 이름 찾기의 "None of these" = 성분표
      expect(ids(t)).toContain('cam-ingredient');
      act(() => t.root.findAll((n) => n.props?.testID === 'pscan-label-debug-input' && typeof n.props?.onChangeText === 'function')[0].props.onChangeText('원재료명: 밀'));
      await press(t, 'pscan-label-debug-add');
      await press(t, 'pscan-label-analyze');
      expect(mockPost).toHaveBeenCalledTimes(3); // 거절 확정 호출 0
      expect(mockPost.mock.calls[2][0]).toBe('/api/processed-foods/scan/label');
      expect(mockPost.mock.calls[2][1]).toMatchObject({ analysisId: null });
    } finally {
      flags.FLAGS.packagedLabelScan = prevFlag;
    }
  });
  it('Codex #339 R2: 이미 확정된 분석(상세에서 돌아와 None of these → 성분표) = 거절 응답이 확정 제품 → 새 성분표 분석(analysisId null)', async () => {
    const flags = jest.requireActual('@/lib/flags') as { FLAGS: { packagedLabelScan: boolean } };
    const prevFlag = flags.FLAGS.packagedLabelScan;
    flags.FLAGS.packagedLabelScan = true;
    try {
      mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
      mockPost
        .mockResolvedValueOnce({ analysisId: 'A31', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
        .mockResolvedValueOnce({ analysisId: 'A31', state: 'CONFIRMED', charged: true, product: DETAIL })
        .mockResolvedValueOnce({ analysisId: 'L31', state: 'LABEL_RESULT', labelSource: 'DECLARED', detections: [], mayContain: [], avoidance: [], rawText: 'x', charged: true, verdict: 'SAFE', avoidMatches: [], mayContainMatches: [], unclearIngredients: [], majorAllergens: [] });
      const t = flow();
      await press(t, 'pscan-take-photo');
      await pick(t, 11);
      await press(t, 'pscan-none-of-these'); // 상세에서 뒤로 와서
      await press(t, 'pscan-to-label');
      expect(ids(t)).toContain('cam-ingredient');
      act(() => t.root.findAll((n) => n.props?.testID === 'pscan-label-debug-input' && typeof n.props?.onChangeText === 'function')[0].props.onChangeText('원재료명: 밀'));
      await press(t, 'pscan-label-debug-add');
      await press(t, 'pscan-label-analyze');
      // R8: 이 화면에서 확정한 분석은 거절 호출 없이 바로 새 분석(거절 응답이 확정 제품인 경로는 확정 응답을 잃은 경우 대비로 유지)
      expect(mockPost).toHaveBeenCalledTimes(3);
      expect(mockPost.mock.calls[2][0]).toBe('/api/processed-foods/scan/label');
      expect(mockPost.mock.calls[2][1]).toMatchObject({ analysisId: null }); // 새 분석(멱등 키는 packagedLabel508)
    } finally {
      flags.FLAGS.packagedLabelScan = prevFlag;
    }
  });
  it('회원 = 후보 리본(서버 verdict) · 모르는 verdict = 리본 0', async () => {
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost.mockResolvedValueOnce({ analysisId: 'A12', state: 'CANDIDATES', candidates: [{ ...cand(11, 'R1'), verdict: 'AVOID' }, { ...cand(12, 'R2'), verdict: 'WHAT' }] });
    const t = flow();
    await press(t, 'pscan-take-photo');
    expect(ids(t)).toContain('pscan-verdict-11');
    expect(ids(t)).not.toContain('pscan-verdict-12');
  });
  it('확정 네트워크 실패 = 오류 화면 → 다시 시도 = 같은 analysisId · 만료(PFOOD-003) = 다시 찍기 안내', async () => {
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A4', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockRejectedValueOnce(new ApiError('expired', 404, 'PFOOD-003'));
    const t = flow();
    await press(t, 'pscan-take-photo');
    await pick(t, 11);
    expect(ids(t)).toContain('pscan-error-network');
    await press(t, 'pscan-retry');
    expect(mockPost.mock.calls[2][1]).toEqual({ analysisId: 'A4', reportNo: 'R1' }); // 같은 ID 재시도
    expect(ids(t)).toContain('pscan-error-expired');
    expect(ids(t)).toContain('pscan-retake');
  });
  it('Codex #310: 확정 전송 실패 → 같은 ID 재확정 200 charged=true = 1회 사용(상세 파라미터) · charged=false = 단정 없음(u) + 프로필 재조회', async () => {
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
      await pick(t, 11);
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
    act(() => t.root.findAll((n) => n.props?.testID === 'scan-loading-close' && typeof n.props?.onPress === 'function')[0].props.onPress());
    expect(ids(t)).toContain('cam-package');
    await act(async () => { release({ analysisId: 'A7', state: 'CANDIDATES', candidates: [cand(11, 'R1')] }); await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('cam-package');
    expect(ids(t)).not.toContain('pscan-candidates');
  });
  it('KB-845: 앞면 = 공통 카메라(package) — 시스템 카메라·권한 알럿은 흐름에 없다', () => {
    const t = flow();
    expect(ids(t)).toContain('cam-package');
    const flowSrc = fs.readFileSync('src/features/scan/PackagedScanFlow.tsx', 'utf8');
    expect(flowSrc).not.toContain('launchCameraAsync');
    expect(flowSrc).not.toContain('expo-image-picker');
    const scanSrc = fs.readFileSync('src/app/scan.tsx', 'utf8');
    expect(scanSrc).toContain('testID="perm-denied-alert"');
    expect(scanSrc).toContain('renderCamera={cameraUi}');
  });
  it('Codex #310 R2: OCR 대기 중 뒤로 = 늦은 OCR 결과 무시(서버 호출 0 · 촬영 화면 유지)', async () => {
    let release!: (v: unknown) => void;
    mockOcr.mockReturnValueOnce(new Promise((r) => (release = r)));
    const t = flow();
    act(() => { void t.root.findAll((n) => n.props?.testID === 'pscan-take-photo' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('pscan-reading');
    act(() => t.root.findAll((n) => n.props?.testID === 'scan-loading-close' && typeof n.props?.onPress === 'function')[0].props.onPress());
    await act(async () => { release([{ text: '새우깡' }]); await new Promise((r) => setTimeout(r, 0)); });
    expect(mockPost).not.toHaveBeenCalled();
    expect(ids(t)).toContain('cam-package');
  });
  it('Codex #310 R2: 차감된 확정 뒤 같은 후보 재확정(서버 멱등 charged false) = 1회 사용 유지', async () => {
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'A8', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
      .mockResolvedValueOnce({ analysisId: 'A8', state: 'CONFIRMED', charged: true, product: DETAIL })
      .mockResolvedValueOnce({ analysisId: 'A8', state: 'CONFIRMED', charged: false, product: DETAIL });
    const t = flow();
    await press(t, 'pscan-take-photo');
    await pick(t, 11);
    expect(mockPush).toHaveBeenLastCalledWith('/processed-foods/11?scan=1&charged=1');
    await pick(t, 11); // 상세에서 뒤로 와서 같은 줄 다시
    expect(mockPush).toHaveBeenLastCalledWith('/processed-foods/11?scan=1&charged=1');
  });
  it('시안 18: OCR이 글자를 못 읽음 = 서버 호출 0 · "글자를 읽지 못했어요" → 다시 찍기 = 앞면 카메라', async () => {
    mockOcr.mockResolvedValueOnce([]);
    const t = flow();
    await press(t, 'pscan-take-photo');
    expect(mockPost).not.toHaveBeenCalled();
    expect(ids(t)).toContain('pscan-front-unreadable');
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_scan_handoff', { from: 'unreadable' });
    await press(t, 'pscan-retake');
    expect(ids(t)).toContain('cam-package');
  });
});

describe('KB-877 가공식품 1시간 무료 창(서버 freeUntil)', () => {
  const FREE = '2026-10-27T04:00:00.000Z';
  it('확정이 차감하며 창을 엶(charged + freeUntil) = 상세 &free=1 · 응답 창을 프로필 캐시에 즉시 반영 · 창 안 무료 확정(charged false) = free 0', async () => {
    qc.setQueryData(['me', 'en'], { id: '41', restrictions: [], packagedFreeUntil: null });
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'F1', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
      .mockResolvedValueOnce({ analysisId: 'F1', state: 'CONFIRMED', charged: true, product: DETAIL, freeUntil: FREE });
    const t = flow();
    await press(t, 'pscan-take-photo');
    await pick(t, 11);
    expect(mockPush).toHaveBeenLastCalledWith('/processed-foods/11?scan=1&charged=1&free=1');
    expect(qc.getQueryData(['me', 'en'])).toMatchObject({ packagedFreeUntil: FREE });
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost
      .mockResolvedValueOnce({ analysisId: 'F2', state: 'CANDIDATES', candidates: [cand(11, 'R1')] })
      .mockResolvedValueOnce({ analysisId: 'F2', state: 'CONFIRMED', charged: false, product: DETAIL, freeUntil: FREE }); // 창 안 = 무료
    const t2 = flow();
    await press(t2, 'pscan-take-photo');
    await pick(t2, 11);
    expect(mockPush).toHaveBeenLastCalledWith('/processed-foods/11?scan=1&charged=0');
  });
  it('흐름 진입 = 프로필 다시 읽기 · 포그라운드 복귀 = 다시 읽기(창은 서버 값만)', () => {
    const { AppState } = jest.requireActual<typeof import('react-native')>('react-native');
    // spyOn+mockRestore는 RN 목의 반환값을 잃어 다음 테스트 정리(remove)를 깨뜨린다 → 원본을 감싸 그대로 통과시키고 finally에서 되돌림
    const handlers: ((s: string) => void)[] = [];
    const orig = AppState.addEventListener;
    AppState.addEventListener = ((e: 'change', h: (s: string) => void) => { handlers.push(h); return orig.call(AppState, e, h as never); }) as typeof AppState.addEventListener;
    try {
      const inv = jest.spyOn(qc, 'invalidateQueries');
      flow();
      expect(inv).toHaveBeenCalledWith({ queryKey: ['me'] });
      const n = inv.mock.calls.length;
      act(() => handlers.forEach((h) => h('active')));
      expect(inv.mock.calls.length).toBeGreaterThan(n);
    } finally {
      AppState.addEventListener = orig;
    }
  });
  it('KB-914(R-141): 상세 = 무료 창 문장 0(스캔 확정 + free=1이어도) — 무료 배지는 카메라·후보·결과만', () => {
    const { adaptProcessedDetail } = jest.requireActual('@/lib/api/processedFoodAdapter');
    qc.setQueryData(['processedFoods', 'detail', '11', 'en|member:SHRIMP'], adaptProcessedDetail(DETAIL));
    mockParams = { id: '11', scan: '1', charged: '1', free: '1' };
    const t = render(<Detail />);
    expect(ids(t)).not.toContain('pf-free-started');
    expect(texts(t)).not.toContain('packagedScan.freeStarted');
    expect(ids(t)).not.toContain('pscan-free-explain');
    mockParams = { id: '11', scan: '1', charged: '0' };
    expect(ids(render(<Detail />))).not.toContain('pf-free-started');
    mockParams = { id: '11', free: '1' }; // 스캔 밖 진입 = 무시
    expect(ids(render(<Detail />))).not.toContain('pf-free-started');
  });
  it('남은 분 = 앞면 카메라·후보 화면에 한 줄(창 있을 때만)', async () => {
    mockFreeUntil = new Date(Date.now() + 42 * 60_000 + 30_000).toISOString();
    const t = flow();
    expect(texts(t)).toContain('packagedScan.freeFor:{"count":43}');
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost.mockResolvedValueOnce({ analysisId: 'F3', state: 'CANDIDATES', candidates: [cand(11, 'R1')] });
    await press(t, 'pscan-take-photo');
    expect(ids(t)).toEqual(expect.arrayContaining(['pscan-candidates', 'pscan-free-line']));
    mockFreeUntil = null;
    expect(ids(flow())).not.toContain('pscan-free-line');
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
  it('시안 20: 스캔 확정 상세 = 일반 상세와 같은 화면 — "스캔 결과" 띠·불꽃·차감 문구 0(README)', () => {
    const { adaptProcessedDetail } = jest.requireActual('@/lib/api/processedFoodAdapter');
    qc.setQueryData(['processedFoods', 'detail', '11', 'en|member:SHRIMP'], adaptProcessedDetail(DETAIL));
    mockParams = { id: '11', scan: '1', charged: '1' };
    const t = render(<Detail />);
    expect(ids(t)).not.toContain('pf-scan-result');
    expect(ids(t).some((i) => i.startsWith('flame-'))).toBe(false);
  });
  it('스캔 화면 배선: 가공식품 모드 = PackagedScanFlow(단일 presenter 경유) · 메뉴판 카메라·런처에 모드 탭 · 기본 메뉴판 · OCR 주입은 개발·진단 채널만', () => {
    const src = fs.readFileSync('src/app/scan.tsx', 'utf8');
    expect(src).toContain("useState<ScanMode>(() => (scanParams.mode === 'packaged' && FLAGS.packagedLabelScan ? 'packaged' : 'menu'))"); // 기본 메뉴판 · P-508: 상세 "성분표 직접 확인"만 가공식품 모드로 진입
    expect(src).toContain("if (scanMode === 'packaged' && !offline && (phase !== 'error' || packagedHold)) {\n    return withPresenter(\n      <View style={styles.camHost}>\n        {cameraLayer}\n        <PackagedScanFlow"); // KB-845 QA: 메뉴와 같은 camHost → cameraLayer 구조 · KB-865 ③: 확정 소진 = 같은 자리 흐름 위 덮개(흐름 상태 유지)
    expect(src).toContain('{phase === \'error\' && <View style={StyleSheet.absoluteFill} testID="pscan-quota-overlay">{renderError()}</View>}');
    expect(src.match(/<ScanModeTabs /g)).toHaveLength(2);
    const flowSrc = fs.readFileSync('src/features/scan/PackagedScanFlow.tsx', 'utf8');
    expect(flowSrc).toContain('export const showOcrDebug = (): boolean => __DEV__ || isDiagnosticChannel();');
    expect(flowSrc.match(/if \(!showOcrDebug\(\)\) return null;/g)).toHaveLength(2); // KB-845: 앞면·성분표 주입 패널 둘 다(카메라 위 작은 패널)
  });
  it('10언어 문구 전부 · 가운데점 0', () => {
    const flat = (o: Record<string, unknown>, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));
    const en = JSON.parse(fs.readFileSync('src/lib/i18n/en.json', 'utf8'));
    const keys = [...flat(en.scanMode, 'scanMode.'), ...flat(en.packagedScan, 'packagedScan.')].sort();
    for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi']) {
      const d = JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8'));
      // ru 복수형 _few·_many = copy708 규칙(네 형태 같은 문구)이 따로 잠근다 — 키 집합 비교에선 뺀다
      expect([...flat(d.scanMode, 'scanMode.'), ...flat(d.packagedScan, 'packagedScan.')].filter((k) => !/_(few|many)$/.test(k)).sort()).toEqual(keys);
      expect(JSON.stringify([d.scanMode, d.packagedScan])).not.toContain('·');
    }
  });
});

describe('KB-892 이름 스캔 앞면 사진 동봉(dev 플래그, 그림자 모드)', () => {
  const NO_CAND = { analysisId: 'A9', state: 'NO_CANDIDATE', candidates: [] };
  const nameBody = () => mockPost.mock.calls.find((c) => c[0] === '/api/processed-foods/scan/name')![1];
  afterEach(() => { FLAGS.packagedNameScanPhoto = false; });

  it('플래그 OFF = 업로드 0 · body가 현행과 바이트 동일 · photo_attached false', async () => {
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost.mockResolvedValueOnce(NO_CAND);
    await press(flow(), 'pscan-take-photo');
    expect(mockUploadPhoto).not.toHaveBeenCalled();
    expect(JSON.stringify(nameBody())).toBe(JSON.stringify({ ocrText: '새우깡', lang: 'en' }));
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_scan_name', { candidate_count: 0, photo_attached: false });
  });

  it('ON · 업로드가 OCR보다 먼저 끝남 = 촬영 사진으로 업로드 → body에 imagePath · photo_attached true(경로는 이벤트에 없음)', async () => {
    FLAGS.packagedNameScanPhoto = true;
    mockUploadPhoto.mockResolvedValueOnce('scan/41/front.jpg');
    mockOcr.mockImplementationOnce(async () => { await new Promise((r) => setTimeout(r, 0)); return [{ text: '새우깡' }]; });
    mockPost.mockResolvedValueOnce(NO_CAND);
    await press(flow(), 'pscan-take-photo');
    expect(mockUploadPhoto).toHaveBeenCalledWith(mockShot);
    expect(nameBody()).toEqual({ ocrText: '새우깡', lang: 'en', imagePath: 'scan/41/front.jpg' });
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_scan_name', { candidate_count: 0, photo_attached: true });
  });

  it('ON · 업로드가 OCR보다 느림 = 기다리지 않고 imagePath 없이 바로 요청(업로드 대기 중에 이미 나감)', async () => {
    FLAGS.packagedNameScanPhoto = true;
    let finish!: (v: string | null) => void;
    mockUploadPhoto.mockImplementationOnce(() => new Promise((r) => { finish = r; }));
    mockOcr.mockResolvedValueOnce([{ text: '새우깡' }]);
    mockPost.mockResolvedValueOnce(NO_CAND);
    await press(flow(), 'pscan-take-photo');
    expect(nameBody()).toEqual({ ocrText: '새우깡', lang: 'en' }); // 업로드는 아직 안 끝났다
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_scan_name', { candidate_count: 0, photo_attached: false });
    await act(async () => { finish('scan/41/late.jpg'); });
    expect(mockPost.mock.calls.filter((c) => c[0] === '/api/processed-foods/scan/name')).toHaveLength(1); // 늦은 경로로 재요청 없음
  });

  it('ON · 업로드 실패(null) = imagePath 없이 기존대로', async () => {
    FLAGS.packagedNameScanPhoto = true;
    mockUploadPhoto.mockResolvedValueOnce(null);
    mockOcr.mockImplementationOnce(async () => { await new Promise((r) => setTimeout(r, 0)); return [{ text: '새우깡' }]; });
    mockPost.mockResolvedValueOnce(NO_CAND);
    await press(flow(), 'pscan-take-photo');
    expect(nameBody()).toEqual({ ocrText: '새우깡', lang: 'en' });
  });

  it('채널 규칙 = 다른 dev 서버 전용 기능과 같은 축(production OFF)', () => {
    const src = fs.readFileSync('src/lib/flags.ts', 'utf8');
    expect(src).toContain('packagedNameScanPhoto: DEV_SERVER_CHANNEL,');
  });
});

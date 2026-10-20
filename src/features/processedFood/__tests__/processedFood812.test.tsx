/**
 * KB-812 가공식품 1차 — 어댑터(https 승격·유형 매핑·labelSource·비회원 null) · 요청(3.2 헤더·빈 검색어 요청 0) ·
 * 상세 판정(labelSource 3문구 · Safe 배지 0 · 검출 0 = 회색 미확인 · 노란 행은 unmapped 있을 때만 · 회원 대조/비회원 로그인 줄)
 * · 출처 고지 3종 상시 · 404/410(캐시가 있어도 이긴다) · Food 탭 세그먼트(기본 Dishes·전환·유지) · 계측(검색어 원문 0).
 */
import * as fs from 'fs';
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('react-native-reanimated', () => {
  const { View, Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View, FlatList: jest.requireActual('react-native').FlatList, createAnimatedComponent: (c: unknown) => c ?? Pressable },
    createAnimatedComponent: (c: unknown) => c,
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    useAnimatedScrollHandler: () => () => {},
    useAnimatedProps: () => ({}),
    useReducedMotion: () => false,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/Skeleton', () => { const { View } = jest.requireActual('react-native'); return { Shimmer: (p: object) => <View {...p} /> }; });
jest.mock('@/components/RemoteImage', () => { const { View } = jest.requireActual('react-native'); return { RemoteImage: (p: { uri: string }) => <View testID={`img:${p.uri}`} /> }; });
jest.mock('@/components/SubHeader', () => { const { Text } = jest.requireActual('react-native'); return { SubHeader: (p: { title: string }) => <Text testID="subheader">{p.title}</Text> }; });
jest.mock('@/components/AuthGateSheet', () => { const { View } = jest.requireActual('react-native'); return { AuthGateSheet: (p: { open: boolean }) => (p.open ? <View testID="gate-open" /> : null) }; });
jest.mock('@/components/Btn', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return { Btn: (p: { testID: string; onPress?: () => void; children?: React.ReactNode }) => <Pressable testID={p.testID} onPress={p.onPress}><Text>{p.children}</Text></Pressable> };
});
jest.mock('@/components/RiskBadge', () => { const { View } = jest.requireActual('react-native'); return { RiskBadge: (p: { state: string }) => <View testID={`badge-${p.state}`} /> }; });
jest.mock('@/components/icons', () => ({ ...jest.requireActual('@/components/icons'), IconLock: () => null, IconCamera: () => null, IconTabFood: () => null, IconSearch: () => null, IconClose: () => null }));
jest.mock('@/lib/onboarding/data', () => ({ restrictionLabel: (c: string) => `L(${c})` }));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack, navigate: jest.fn(), canGoBack: () => true }), useLocalSearchParams: () => ({ id: '1711' }) }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => {
  class MockApiError extends Error { status?: number; code?: string; constructor(m: string, s?: number, c?: string) { super(m); this.status = s; this.code = c; } }
  return { api: { get: (...a: unknown[]) => mockGet(...a) }, ApiError: MockApiError };
});
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => true }));
type Q = { isPending: boolean; isError: boolean; data?: unknown; error?: unknown; refetch: jest.Mock };
let mockDetail: Q;
jest.mock('@/lib/data/useProcessedFoods', () => ({ ...jest.requireActual('@/lib/data/useProcessedFoods'), useProcessedDetail: () => mockDetail }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { ApiError } from '@/lib/api/client';
import { adaptProcessedDetail, adaptProcessedSummary, packagedTypeOf, toHttps, type DetailWire } from '@/lib/api/processedFoodAdapter';
import { fetchProcessedDetail, fetchProcessedSearch } from '@/lib/data/useProcessedFoods';
import Detail, { LABEL_SOURCE_KEY } from '@/app/processed-foods/[id]';
import { FoodSegmentRow, PackagedExplorer } from '../PackagedExplorer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
/* eslint-enable import/first */

// dev 1711 실응답(10/21 GET) 그대로 — INGREDIENTS_ONLY · 검출 4 · 비회원 avoidance null
const W1711: DetailWire = {
  id: 1711, productName: '우유식빵', maker: '롯데제과', foodType: '빵류', capacity: '420g',
  rawMaterials: '밀가루(밀:수입산),마가린(대두)[식물성유지(팜유:말레이시아산)],우유7.14%(원유:국산),계란,백설탕',
  allergens: '알수없음', labelSource: 'INGREDIENTS_ONLY',
  detections: [
    { code: 'WHEAT', source: 'RAW_MATERIALS', evidence: '밀가루' }, { code: 'SOY', source: 'RAW_MATERIALS', evidence: '대두' },
    { code: 'MILK', source: 'RAW_MATERIALS', evidence: '우유' }, { code: 'EGG', source: 'RAW_MATERIALS', evidence: '계란' },
  ],
  avoidance: null,
  source: { provider: 'HACCP', attributionKey: 'processedFood.source.haccp' },
  image: { url: 'http://www.haccp.or.kr/fresh/prdimg/2007/20070156181583/20070156181583-1.jpg', source: 'HACCP', attributionKey: 'processedFood.image.haccp' },
};

const trees: ReactTestRenderer[] = [];
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); jest.clearAllMocks(); });
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(el); }); trees.push(t); return t; };
const q = (over: Partial<Q>): Q => ({ isPending: false, isError: false, refetch: jest.fn(), ...over });
const ids = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string').map((n) => n.props.testID as string);
const text = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());

describe('어댑터·요청', () => {
  it('http 이미지 → https(iOS ATS·Android cleartext 차단 회피) · 빈 값 null', () => {
    expect(toHttps('http://www.haccp.or.kr/a.jpg')).toBe('https://www.haccp.or.kr/a.jpg');
    expect(toHttps('https://x/b.jpg')).toBe('https://x/b.jpg');
    expect(toHttps('  ')).toBeNull();
    expect(adaptProcessedSummary({ id: 1, productName: 'x', imageUrl: 'http://a/b.jpg' }).imageUrl).toBe('https://a/b.jpg');
    expect(adaptProcessedDetail(W1711).image?.url.startsWith('https://')).toBe(true);
  });
  it('유형 4종 매핑(라면·빵·음료·과자) · 그 외 null(카메라 + 원문)', () => {
    expect(['라면', '유탕면류', '빵류', '떡류', '유음료', '혼합음료', '과자', '캔디류', '김치', null].map((f) => packagedTypeOf(f))).toEqual(['ramen', 'ramen', 'bread', 'bread', 'drinks', 'drinks', 'snacks', 'snacks', null, null]);
  });
  it('상세: 비회원 avoidance null 그대로(빈 배열 아님) · INGREDIENTS_ONLY면 알레르기 원문("알수없음") 숨김 · unmapped 없으면 [] · 모르는 labelSource = NONE', () => {
    const d = adaptProcessedDetail(W1711);
    expect(d.avoidance).toBeNull();
    expect(d.allergens).toBeNull();
    expect(d.unmapped).toEqual([]);
    expect(d.detections.map((x) => x.code)).toEqual(['WHEAT', 'SOY', 'MILK', 'EGG']);
    expect(adaptProcessedDetail({ ...W1711, labelSource: 'WHATEVER' }).labelSource).toBe('NONE');
    expect(adaptProcessedDetail({ ...W1711, labelSource: 'DECLARED', allergens: '밀, 우유 함유' }).allergens).toBe('밀, 우유 함유');
  });
  it('요청 = /api/processed-foods + X-API-Version 3.2 · 검색어 인코딩·커서', async () => {
    mockGet.mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null }).mockResolvedValueOnce(W1711);
    await fetchProcessedSearch('우유', '5');
    await fetchProcessedDetail('1711');
    expect(mockGet.mock.calls[0]).toEqual([`/api/processed-foods?query=${encodeURIComponent('우유')}&cursor=5&size=20`, { headers: { 'X-API-Version': '3.2' } }]);
    expect(mockGet.mock.calls[1]).toEqual(['/api/processed-foods/1711', { headers: { 'X-API-Version': '3.2' } }]);
  });
});

describe('상세 판정', () => {
  it('1711(INGREDIENTS_ONLY): 상단 문구 = 표시란 없음 · 검출 4 빨강 · Safe 배지 0 · 비회원 = 로그인 줄 1 · 사진 https + 출처 캡션', () => {
    mockDetail = q({ data: adaptProcessedDetail(W1711) });
    const t = render(<Detail />);
    expect(t.root.findAll((n) => n.props?.testID === 'pf-label-source')[0].props.children).toBe('packaged.labelIngredientsOnly');
    expect(['WHEAT', 'SOY', 'MILK', 'EGG'].every((c) => ids(t).includes(`pf-det-${c}`))).toBe(true);
    expect(ids(t).filter((i) => i === 'badge-danger')).toHaveLength(4);
    expect(ids(t).some((i) => i === 'badge-safe')).toBe(false);
    expect(text(t)).not.toMatch(/risk\.safe|"Safe"/);
    expect(ids(t)).toContain('pf-login-compare');
    expect(ids(t)).not.toContain('pf-my-avoid');
    expect(ids(t)).toContain('img:https://www.haccp.or.kr/fresh/prdimg/2007/20070156181583/20070156181583-1.jpg');
    expect(ids(t)).toContain('pf-photo-credit');
    expect(ids(t)).not.toContain('pf-allergens'); // "알수없음"을 표시하지 않음
  });
  it('labelSource 3종 = 서로 다른 필수 문구 · NONE·검출 0 = "검출 없음"이 아니라 회색 미확인', () => {
    expect(Object.keys(LABEL_SOURCE_KEY).sort()).toEqual(['DECLARED', 'INGREDIENTS_ONLY', 'NONE']);
    expect(new Set(Object.values(LABEL_SOURCE_KEY)).size).toBe(3);
    mockDetail = q({ data: adaptProcessedDetail({ ...W1711, labelSource: 'NONE', rawMaterials: null, detections: [] }) });
    const t = render(<Detail />);
    expect(t.root.findAll((n) => n.props?.testID === 'pf-label-source')[0].props.children).toBe('packaged.labelNone');
    expect(ids(t)).toContain('pf-none-detected');
    expect(ids(t)).toContain('badge-unable');
    expect(ids(t)).toContain('pf-no-raw');
    expect(text(t)).not.toMatch(/none detected|no allergens|안전/i);
  });
  it('노란 "확인 필요" = 서버 unmapped[]가 있을 때만(3.2엔 없음 → 0)', () => {
    mockDetail = q({ data: adaptProcessedDetail(W1711) });
    expect(ids(render(<Detail />)).filter((i) => i.startsWith('pf-unmapped-'))).toHaveLength(0);
    mockDetail = q({ data: adaptProcessedDetail({ ...W1711, unmapped: ['복합조미식품'] }) });
    const t = render(<Detail />);
    expect(ids(t)).toContain('pf-unmapped-0');
    expect(ids(t)).toContain('badge-caution');
  });
  it('회원: avoidance DETECTED = 빨강 · UNCONFIRMED = 회색 "미확인"(없음 아님) · 로그인 줄 0', () => {
    mockDetail = q({ data: adaptProcessedDetail({ ...W1711, avoidance: [{ code: 'MILK', match: 'DETECTED', matchedCodes: ['MILK'], evidence: ['우유'] }, { code: 'PEANUT', match: 'UNCONFIRMED', matchedCodes: [], evidence: [] }] }) });
    const t = render(<Detail />);
    expect(ids(t)).toContain('pf-my-avoid');
    expect(ids(t)).not.toContain('pf-login-compare');
    expect(text(t)).toContain('packaged.notVerifiedName:{\\"name\\":\\"L(PEANUT)\\"}');
  });
  it('출처 고지 3종은 항상 — 자료 출처 · 사진 출처(이미지 있을 때) · 제조사 무관/상표(이미지 없어도)', () => {
    mockDetail = q({ data: adaptProcessedDetail(W1711) });
    const t = render(<Detail />);
    for (const k of ['packaged.sourceData1', 'packaged.sourceData2', 'packaged.imageHaccp', 'packaged.disclaimer']) expect(text(t)).toContain(k);
    mockDetail = q({ data: adaptProcessedDetail({ ...W1711, image: null, imageUrl: null }) });
    const t2 = render(<Detail />);
    expect(ids(t2)).toContain('pf-source-disclaimer');
    expect(text(t2)).toContain('packaged.sourceData1');
    expect(ids(t2)).toContain('packaged-placeholder');
  });
  it('410 = 생산종료 · 404 = 없음 — 캐시가 있어도 이긴다(옛 판정 노출 0) · 503 = 다시 시도', () => {
    mockDetail = q({ data: adaptProcessedDetail(W1711), isError: true, error: new ApiError('gone', 410, 'PFOOD-002') });
    let t = render(<Detail />);
    expect(ids(t)).toContain('pf-discontinued');
    expect(ids(t)).not.toContain('pf-verdict');
    mockDetail = q({ isError: true, error: new ApiError('nf', 404, 'PFOOD-001') });
    t = render(<Detail />);
    expect(ids(t)).toContain('pf-gone');
    mockDetail = q({ isError: true, error: new ApiError('down', 503) });
    t = render(<Detail />);
    expect(ids(t)).toContain('pf-error');
    act(() => t.root.findAll((n) => n.props?.testID === 'pf-retry' && typeof n.props?.onPress === 'function')[0].props.onPress());
    expect(mockDetail.refetch).toHaveBeenCalled();
  });
  it('성분표 직접 확인 버튼 = F2 전까지 플래그로 숨김 · 상세 진입 계측 1회(id·labelSource)', () => {
    mockDetail = q({ data: adaptProcessedDetail(W1711) });
    const t = render(<Detail />);
    expect(ids(t)).not.toContain('pf-label-scan');
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_detail_view', { product_id: '1711', label_source: 'INGREDIENTS_ONLY' });
  });
});

describe('Food 탭 세그먼트·목록', () => {
  it('세그먼트 = 두 탭(Dishes·Packaged) · 선택 상태 · 탭 = onChange', () => {
    const onChange = jest.fn();
    const t = render(<FoodSegmentRow value="dishes" onChange={onChange} />);
    const tab = (s: string) => t.root.findAll((n) => n.props?.testID === `food-segment-${s}` && typeof n.props?.onPress === 'function')[0];
    expect(tab('dishes').props.accessibilityState).toEqual({ selected: true });
    expect(tab('packaged').props.accessibilityState).toEqual({ selected: false });
    act(() => tab('packaged').props.onPress());
    expect(onChange).toHaveBeenCalledWith('packaged');
  });
  it('Food 탭 배선: 기본 Dishes · 선택 유지(모듈 상태) · Packaged = 가공식품 목록 · Dishes 화면은 그대로(세그먼트만 머리에)', () => {
    const src = fs.readFileSync('src/app/(tabs)/food.tsx', 'utf8');
    expect(src).toContain("let lastSegment: FoodSegment = 'dishes';");
    expect(src).toContain('useState<FoodSegment>(() => lastSegment)');
    expect(src).toContain("foodSegment === 'packaged' ? (");
    expect(src).toContain('headTop={<View style={styles.segGap}>{segRow}</View>}');
  });
  it('Packaged 첫 화면 = 검색 안내(요청 0) · 검색 → 결과 행(https 썸네일·유형 라벨) · 결과 0 = 빈 상태', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const t = render(<QueryClientProvider client={qc}><PackagedExplorer top={null} /></QueryClientProvider>);
    expect(ids(t)).toContain('packaged-guide');
    expect(mockGet).not.toHaveBeenCalled();
    mockGet.mockResolvedValueOnce({ items: [{ id: 1711, productName: '우유식빵', maker: '롯데제과', foodType: '빵류', imageUrl: 'http://h/1.jpg' }], hasNext: false, nextCursor: null });
    const input = t.root.findAll((n) => n.props?.testID === 'packaged-search-input' && typeof n.props?.onChangeText === 'function')[0];
    act(() => input.props.onChangeText('우유'));
    await act(async () => { input.props.onSubmitEditing(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('packaged-item-1711');
    expect(ids(t)).toContain('img:https://h/1.jpg');
    expect(t.root.findAll((n) => typeof n.type === 'string' && n.props.children === 'packaged.type.bread').length).toBeGreaterThan(0);
    expect(mockTrack).toHaveBeenCalledWith('food_packaged_search', { query_length: 2, result_count: 1 });
    mockGet.mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null });
    act(() => input.props.onChangeText('없는제품'));
    await act(async () => { input.props.onSubmitEditing(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('packaged-empty');
  });
  it('Codex #308 P2: 다음 페이지 실패 = 안내 + 다시 시도 · 실패 중 자동 재요청 0', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const t = render(<QueryClientProvider client={qc}><PackagedExplorer top={null} /></QueryClientProvider>);
    mockGet.mockResolvedValueOnce({ items: [{ id: 1, productName: 'a', imageUrl: null }], hasNext: true, nextCursor: '1' });
    const input = t.root.findAll((n) => n.props?.testID === 'packaged-search-input' && typeof n.props?.onChangeText === 'function')[0];
    act(() => input.props.onChangeText('우유'));
    await act(async () => { input.props.onSubmitEditing(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    mockGet.mockRejectedValueOnce(new ApiError('down', 503));
    const list = () => t.root.findAll((n) => n.props?.testID === 'packaged-list' && typeof n.props?.onEndReached === 'function')[0];
    await act(async () => { list().props.onEndReached(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('packaged-more-retry');
    const calls = mockGet.mock.calls.length;
    await act(async () => { list().props.onEndReached(); });
    expect(mockGet.mock.calls.length).toBe(calls); // 자동 재요청 없음
    mockGet.mockResolvedValueOnce({ items: [{ id: 2, productName: 'b', imageUrl: null }], hasNext: false, nextCursor: null });
    await act(async () => { t.root.findAll((n) => n.props?.testID === 'packaged-more-retry' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(ids(t)).toContain('packaged-item-2');
    expect(ids(t)).not.toContain('packaged-more-retry');
  });
  it('검색 중심: 빈 검색어는 요청 0(서버 400) · 유형 칩 0(3.2에 필터 없음 — 클라 필터 금지) · 검색 계측에 검색어 원문 0', () => {
    const src = fs.readFileSync('src/lib/data/useProcessedFoods.ts', 'utf8');
    expect(src).toContain('enabled: term.length > 0');
    const ex = fs.readFileSync('src/features/processedFood/PackagedExplorer.tsx', 'utf8');
    expect(ex).not.toMatch(/packaged\.type\.\w+'\)\}\s*selected|<Chip/);
    expect(ex).toContain('track(EVENTS.food_packaged_search, { query_length: Array.from(term).length, result_count: items.length })');
  });
  it('10언어 문구 전부 · 가운데점 0 · 안전/없음 단정 0(en·ko)', () => {
    const en = JSON.parse(fs.readFileSync('src/lib/i18n/en.json', 'utf8')).packaged;
    const keys = Object.keys(en);
    for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi']) {
      const p = JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')).packaged;
      expect(Object.keys(p).sort()).toEqual([...keys].sort());
      expect(JSON.stringify(p)).not.toContain('·');
    }
    const ko = JSON.parse(fs.readFileSync('src/lib/i18n/ko.json', 'utf8')).packaged;
    expect(JSON.stringify(en)).not.toMatch(/\bsafe\b|no allergens/i);
    expect(JSON.stringify(ko)).not.toMatch(/안전해요|없어요\. 먹어도/);
  });
});

/**
 * KB-796(P-480-R2) 큐레이션 — 응답 어댑트(3장 정확·부분 노출 금지·API 순서·캡션 조건부) · 요청(X-API-Version·lang) ·
 * 홈 섹션 상태(스켈레톤·오류·숨김·공개·캐시 실패) · 슬라이드 카운터 · 카드 이동·계측 · 상세 상태(공개·폴백·404·503·캐시 실패) ·
 * 외부 링크(인앱 브라우저 + 계측) · 홈 배치·키 하드코딩 금지 소스 잠금 · 10언어 문구.
 */
import * as fs from 'fs';
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: { View }, useReducedMotion: () => false, useSharedValue: (v: number) => { let x = v; return { get: () => x, set: (n: number) => { x = n; } }; }, useAnimatedStyle: (f: () => object) => f(), withSpring: (v: number) => v };
});
// KB-846 끌어 닫기 — Pan 설정을 잡아 콜백을 테스트가 직접 부른다
type PanCbs = { onUpdate?: (e: { translationY: number }) => void; onEnd?: (e: { translationY: number; velocityY: number }, ok: boolean) => void; onFinalize?: (e: object, ok: boolean) => void; activeOffsetY?: unknown; failOffsetX?: unknown };
let mockPan: PanCbs = {};
jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  const pan = () => {
    const cbs: PanCbs = {};
    mockPan = cbs;
    const g: Record<string, (...a: unknown[]) => unknown> = {};
    for (const k of ['runOnJS', 'activeOffsetY', 'failOffsetX', 'onUpdate', 'onEnd', 'onFinalize']) g[k] = (v: unknown) => { (cbs as Record<string, unknown>)[k] = v; return g; };
    return g;
  };
  return { Gesture: { Pan: pan }, GestureDetector: ({ children }: { children: React.ReactNode }) => children, GestureHandlerRootView: View };
});
jest.mock('@/components/Skeleton', () => { const { View } = jest.requireActual('react-native'); return { Shimmer: (p: object) => <View {...p} /> }; });
jest.mock('@/components/RemoteImage', () => { const { View } = jest.requireActual('react-native'); return { RemoteImage: (p: { uri: string; blurRadius?: number; style?: unknown }) => <View testID={p.blurRadius ? `blur:${p.uri}` : `img:${p.uri}`} style={p.style} {...({ blurRadius: p.blurRadius } as object)} /> }; });
jest.mock('@/components/icons', () => { const { View } = jest.requireActual('react-native'); return { IconChevron: (p: { color?: string }) => <View testID="chevron-right" style={{ color: p.color }} />, IconArrowLeft: () => null, IconClose: () => null }; });
jest.mock('expo-linear-gradient', () => { const { View } = jest.requireActual('react-native'); return { LinearGradient: (p: object) => <View {...p} testID="card-shade" /> }; });
jest.mock('@/components/SubHeader', () => { const { Text } = jest.requireActual('react-native'); return { SubHeader: (p: { title: string }) => <Text testID="subheader">{p.title}</Text> }; });
jest.mock('@/components/Btn', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return { Btn: (p: { testID: string; onPress?: () => void; children?: React.ReactNode; accessibilityLabel?: string; accessibilityHint?: string }) => (
    <Pressable testID={p.testID} onPress={p.onPress} accessibilityLabel={p.accessibilityLabel} accessibilityHint={p.accessibilityHint}><Text>{p.children}</Text></Pressable>
  ) };
});
const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate, back: jest.fn(), canGoBack: () => true }), useLocalSearchParams: () => mockParams }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
const mockOpen = jest.fn(async () => true);
jest.mock('@/lib/openExternal', () => ({ openWebPage: (u: string) => mockOpen(u) }));
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => {
  class MockApiError extends Error { status?: number; code?: string; constructor(m: string, s?: number, c?: string) { super(m); this.status = s; this.code = c; } }
  return { api: { get: (...a: unknown[]) => mockGet(...a) }, apiLang: () => 'ko', ApiError: MockApiError };
});
jest.mock('@/lib/i18n/useAppLanguage', () => ({ useAppLanguage: () => 'ko' }));
type Q = { isPending: boolean; isError: boolean; data?: unknown; error?: unknown; refetch: jest.Mock };
let mockIndex: Q;
let mockDetail: Q;
jest.mock('@/lib/data/useCurations', () => ({
  ...jest.requireActual('@/lib/data/useCurations'),
  useCurationIndex: () => mockIndex,
  useCurationDetail: () => mockDetail,
}));

/* eslint-disable import/first -- jest.mock 뒤 */
import { ApiError } from '@/lib/api/client';
import { fetchCurationDetail, fetchCurationIndex, type CurationDetail, type CurationIndex } from '@/lib/data/useCurations';
import { adaptCurationDetail, adaptCurationIndex, galleryOf } from '@/lib/api/curationAdapter';
import { CurationSection } from '../CurationSection';
import { HomeImpressionContext, ImpressionTracker } from '@/features/home/homeImpressions';
import CurationDetailScreen from '@/app/curations/[key]';
/* eslint-enable import/first */

const card = (k: string, extra: object = {}) => ({ collectionKey: k, title: `T ${k}`, description: `10 places ${k}`, coverImageUrl: `https://cdn/${k}.jpg`, itemCount: 10, publishedRevision: 1, coverImageAttribution: null, ...extra });
const INDEX_WIRE = { state: 'PUBLISHED', sectionVersion: 2, requestedLang: 'ko', resolvedLang: 'ko', fallbackUsed: false, collections: [card('sights'), card('stations'), card('busan', { coverImageAttribution: 'Photo: Busan Tourism' })] };
const item = (p: number, extra: object = {}) => ({ entryId: `e${p}`, position: p, name: `Place ${p}`, area: `Area ${p}`, introduction: `Intro ${p}`, recommendationReason: `Why ${p}`, imageUrl: `https://cdn/i${p}.jpg`, imageAttribution: null, externalUrl: `https://example.com/${p}`, nearby: [], ...extra });
const DETAIL_WIRE = {
  collectionKey: 'stations', title: 'Explore by subway', description: '10 stations', coverImageUrl: 'https://cdn/cover.jpg', coverImageAttribution: null, itemCount: 10, publishedRevision: 1, publishedAt: '2026-10-20T00:00:00Z',
  requestedLang: 'ko', resolvedLang: 'ko', fallbackUsed: false,
  items: [item(2, { nearby: ['Hongdae streets', '  ', 'Forest Park'] }), item(1, { imageAttribution: 'Photo: KTO' }), ...[3, 4, 5, 6, 7, 8, 9, 10].map((p) => item(p))],
};

const trees: ReactTestRenderer[] = [];
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); jest.clearAllMocks(); });
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(el); }); trees.push(t); return t; };
const q = (over: Partial<Q>): Q => ({ isPending: false, isError: false, refetch: jest.fn(), ...over });
const byId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
const text = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());
const ids = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string').map((n) => n.props.testID as string);
const press = (t: ReactTestRenderer, id: string) => act(() => t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress());

describe('응답 어댑트', () => {
  it('PUBLISHED + 정확히 3장 = 공개 · API 순서·키 그대로(busan 포함) · 출처 캡션은 있을 때만', () => {
    const a = adaptCurationIndex(INDEX_WIRE);
    expect(a.published).toBe(true);
    expect(a.cards.map((c) => c.key)).toEqual(['sights', 'stations', 'busan']);
    expect(a.cards.map((c) => c.coverAttribution)).toEqual([null, null, 'Photo: Busan Tourism']);
  });
  it('UNPUBLISHED·빈 카드·3장 아님 = 숨김(부분 노출 금지) · 공백 캡션 = 없음', () => {
    expect(adaptCurationIndex({ ...INDEX_WIRE, state: 'UNPUBLISHED', collections: [] }).published).toBe(false);
    expect(adaptCurationIndex({ ...INDEX_WIRE, collections: INDEX_WIRE.collections.slice(0, 2) }).published).toBe(false);
    expect(adaptCurationIndex({ ...INDEX_WIRE, collections: [card('a', { coverImageAttribution: '  ' }), card('b'), card('c')] }).cards[0].coverAttribution).toBeNull();
  });
  it('상세 = position 순 · 항목 캡션 조건부 · 빈 주변 이름 제거', () => {
    const d = adaptCurationDetail(DETAIL_WIRE);
    expect(d.items.map((i) => i.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(d.items[0].imageAttribution).toBe('Photo: KTO');
    expect(d.items[1].imageAttribution).toBeNull();
    expect(d.items[1].nearby).toEqual(['Hongdae streets', 'Forest Park']);
  });
  it('요청 = X-API-Version 헤더 + lang · 상세 키는 인코딩', async () => {
    mockGet.mockResolvedValueOnce(INDEX_WIRE).mockResolvedValueOnce(DETAIL_WIRE);
    await fetchCurationIndex();
    await fetchCurationDetail('a/b');
    expect(mockGet.mock.calls[0]).toEqual(['/api/curations/seoul?lang=ko', { headers: { 'X-API-Version': '1.0' } }]);
    expect(mockGet.mock.calls[1]).toEqual(['/api/curations/seoul/a%2Fb?lang=ko', { headers: { 'X-API-Version': '1.0' } }]);
  });
});

describe('홈 섹션', () => {
  const published = adaptCurationIndex(INDEX_WIRE) as CurationIndex;
  it('첫 로딩 = 스켈레톤 · 미게시 = 섹션 없음 · 실패(캐시 없음) = 작은 오류 + 다시 시도', () => {
    mockIndex = q({ isPending: true });
    expect(byId(render(<CurationSection />), 'curation-skeleton')).toHaveLength(1);
    mockIndex = q({ data: adaptCurationIndex({ ...INDEX_WIRE, state: 'UNPUBLISHED', collections: [] }) });
    expect(render(<CurationSection />).toJSON()).toBeNull();
    mockIndex = q({ isError: true, error: new ApiError('x', 503, 'CURATION-006') });
    const t = render(<CurationSection />);
    expect(text(t)).toContain('curation.loadError');
    press(t, 'curation-retry');
    expect(mockIndex.refetch).toHaveBeenCalledTimes(1);
  });
  it('공개 = 제목 + 배너 3장(API 순서) · 카운터 1 / 3 → 다음 2 / 3 · 이전은 첫 장에서 비활성', () => {
    mockIndex = q({ data: published });
    const t = render(<CurationSection />);
    expect(text(t)).toContain('curation.sectionTitle');
    expect([0, 1, 2].map((i) => byId(t, `curation-banner-${i}`)[0].props.accessibilityLabel)).toEqual(['T sights, 10 places sights', 'T stations, 10 places stations', 'T busan, 10 places busan']);
    expect(byId(t, 'curation-counter')[0].props.children).toBe('1 / 3');
    expect(byId(t, 'curation-prev')[0].props.accessibilityState).toMatchObject({ disabled: true });
    press(t, 'curation-next');
    expect(byId(t, 'curation-counter')[0].props.children).toBe('2 / 3');
    expect(byId(t, 'curation-banner-attribution-2')).toHaveLength(1); // 캡션은 있는 카드에만
    expect(byId(t, 'curation-banner-attribution-0')).toHaveLength(0);
  });
  it('배너 탭 = 해당 모음 상세 + home_card_click(section=curation, collection_key — food_id 아님)', () => {
    mockIndex = q({ data: published });
    const t = render(<CurationSection />);
    press(t, 'curation-banner-2');
    expect(mockPush).toHaveBeenCalledWith('/curations/busan');
    expect(mockTrack).toHaveBeenCalledWith('home_card_click', { section: 'curation', position: 2, collection_key: 'busan' });
  });
  it('갱신 실패(캐시 있음) = 3장 유지 + 한 줄 안내(누르면 다시 시도) · 섹션 노출 계측 대상', () => {
    mockIndex = q({ data: published, isError: true });
    const tracker = new ImpressionTracker({ top: 0, bottom: 800, left: 0, right: 400 });
    const reg = jest.spyOn(tracker, 'register');
    const t = render(<HomeImpressionContext.Provider value={tracker}><CurationSection /></HomeImpressionContext.Provider>);
    expect(byId(t, 'curation-banner-0')).toHaveLength(1);
    press(t, 'curation-stale-retry');
    expect(mockIndex.refetch).toHaveBeenCalled();
    expect(reg.mock.calls.some((c) => (c[0] as { section: string }).section === 'curation')).toBe(true);
  });
});

describe('모음 상세', () => {
  const detail = adaptCurationDetail(DETAIL_WIRE) as CurationDetail;
  beforeEach(() => { mockParams = { key: 'stations' }; });
  it('공개 = 제목·설명·항목 10개(position 순) · 출처 캡션·주변은 있는 항목에만 · 폴백 안내는 fallbackUsed일 때만', () => {
    mockDetail = q({ data: detail });
    const t = render(<CurationDetailScreen />);
    expect(byId(t, 'subheader')[0].props.children).toBe('Explore by subway');
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every((p) => byId(t, `curation-item-${p}`).length === 1)).toBe(true);
    // KB-832 v5: 사진 출처 캡션은 카드가 아니라 갤러리 시트 안(현재 사진 기준)
    expect(ids(t).some((i) => i.startsWith('curation-item-attribution-'))).toBe(false);
    // KB-829: 역 모음 = 지역 행에 area + nearby 공백 2칸(빈 이름 제거) · "Explore nearby" 줄 없음
    expect(t.root.findAll((n) => typeof n.type === 'string' && n.props.children === 'Area\u00A02  Hongdae\u00A0streets  Forest\u00A0Park')).toHaveLength(1);
    expect(t.root.findAll((n) => typeof n.type === 'string' && n.props.children === 'Area\u00A01')).toHaveLength(1);
    expect(text(t)).not.toContain('exploreNearby');
    expect(byId(t, 'curation-cover')).toHaveLength(0); // v2: 상세 표지 없음
    expect(byId(t, 'curation-fallback')).toHaveLength(0);
    mockDetail = q({ data: { ...detail, fallbackUsed: true } });
    expect(byId(render(<CurationDetailScreen />), 'curation-fallback')).toHaveLength(1);
  });
  it('KB-832: Guide = 시트 안 Outline → 인앱 브라우저 + home_curation_link_click(키·위치, URL 미전송) · 스크린리더 이름·힌트 · 시트 유지(복귀 시 같은 자리)', () => {
    mockDetail = q({ data: detail });
    const t = render(<CurationDetailScreen />);
    press(t, 'curation-item-3');
    const btn = t.root.findAll((n) => n.props?.testID === 'curation-gallery-guide' && typeof n.props?.onPress === 'function')[0];
    expect(btn.props.accessibilityLabel).toBe('curation.viewGuideA11y:{"name":"Place 3"}');
    expect(btn.props.accessibilityHint).toBe('curation.viewGuideHint');
    press(t, 'curation-gallery-guide');
    expect(mockOpen).toHaveBeenCalledWith('https://example.com/3');
    expect(mockTrack).toHaveBeenCalledWith('home_curation_link_click', { collection_key: 'stations', position: 3 });
    expect(ids(t)).toContain('curation-gallery'); // 시트 닫지 않음
  });
  it('404 CURATION-001 = 더 이상 볼 수 없음 + 홈으로(다시 시도 없음) · 503 = 불러오지 못함 + 다시 시도 + 홈으로', () => {
    mockDetail = q({ isError: true, error: new ApiError('gone', 404, 'CURATION-001') });
    const gone = render(<CurationDetailScreen />);
    expect(byId(gone, 'curation-unavailable')).toHaveLength(1);
    expect(byId(gone, 'curation-detail-retry')).toHaveLength(0);
    press(gone, 'curation-back-home');
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)');
    mockDetail = q({ isError: true, error: new ApiError('down', 503, 'CURATION-006') });
    const down = render(<CurationDetailScreen />);
    expect(byId(down, 'curation-detail-error')).toHaveLength(1);
    press(down, 'curation-detail-retry');
    expect(mockDetail.refetch).toHaveBeenCalledTimes(1);
  });
  it('Codex #303 P2: 캐시가 있어도 재조회가 404 CURATION-001이면 "볼 수 없음"(내린 모음의 목록·외부 링크 노출 0)', () => {
    mockDetail = q({ data: detail, isError: true, error: new ApiError('withdrawn', 404, 'CURATION-001') });
    const t = render(<CurationDetailScreen />);
    expect(byId(t, 'curation-unavailable')).toHaveLength(1);
    expect(byId(t, 'curation-item-1')).toHaveLength(0);
    expect(t.root.findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('curation-item-link-'))).toHaveLength(0);
  });
  it('로딩 = 스켈레톤 · 갱신 실패(캐시 있음) = 목록 유지 + 한 줄 안내', () => {
    mockDetail = q({ isPending: true });
    expect(byId(render(<CurationDetailScreen />), 'curation-detail-skeleton')).toHaveLength(1);
    mockDetail = q({ data: detail, isError: true });
    const t = render(<CurationDetailScreen />);
    expect(byId(t, 'curation-item-1')).toHaveLength(1);
    expect(byId(t, 'curation-detail-stale')).toHaveLength(1);
  });
});

describe('KB-832 v5 카드 + 갤러리 시트', () => {
  const detail = adaptCurationDetail(DETAIL_WIRE) as CurationDetail;
  const withImages = (n: number) => ({ ...detail, items: detail.items.map((it) => (it.position === 1 ? { ...it, images: Array.from({ length: n }, (_, i) => ({ url: `https://cdn/g${i}.jpg`, attribution: i === 1 ? null : `Photo ${i}` })) } : it)) });
  beforeEach(() => { mockParams = { key: 'stations' }; });

  it('어댑터: 서버 images[] 우선(빈 url 제외) · 없으면 대표 사진 1장 폴백 · 사진 없음 = []', () => {
    expect(galleryOf({ imageUrl: 'https://a/1.jpg', imageAttribution: 'P', images: [{ url: 'https://a/x.jpg', attribution: ' ' }, { url: '' }] })).toEqual([{ url: 'https://a/x.jpg', attribution: null }]);
    expect(galleryOf({ imageUrl: 'https://a/1.jpg', imageAttribution: 'Photo: KTO', images: null })).toEqual([{ url: 'https://a/1.jpg', attribution: 'Photo: KTO' }]);
    expect(galleryOf({ imageUrl: 'https://a/1.jpg', imageAttribution: null, images: [] })).toEqual([{ url: 'https://a/1.jpg', attribution: null }]);
    expect(galleryOf({ imageUrl: '', imageAttribution: null })).toEqual([]);
  });

  it('카드 = 첫 사진 전체 + 하단 흐림 + 흰 이름·지역 + 흰 chevron(박스 없음) · 펼침/Guide 행 0 · 카드 전체가 버튼(이름·지역 라벨 + 힌트)', () => {
    mockDetail = q({ data: detail });
    const t = render(<CurationDetailScreen />);
    const card = t.root.findAll((n) => n.props?.testID === 'curation-item-1' && typeof n.props?.onPress === 'function')[0];
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityLabel).toBe('Place 1, Area 1');
    expect(card.props.accessibilityHint).toBe('curation.openGalleryHint');
    expect(ids(t)).toContain('img:https://cdn/i1.jpg');
    expect(ids(t).filter((i) => i === 'card-shade')).toHaveLength(0); // KB-846: 스크림은 밴드(이름 위 16)를 잰 뒤에만
    expect(byId(t, 'curation-item-arrow-1')).toHaveLength(1);
    expect(ids(t).some((i) => /curation-item-(toggle|link|about)-/.test(i))).toBe(false);
    expect(ids(t)).not.toContain('curation-gallery'); // 처음엔 닫힘
  });

  it('KB-846 점진 블러(네이티브 의존 0): 카드·캡션을 잰 뒤 이름 위 16부터 바닥까지 띠 4개 · blurRadius 1/4→1 · 같은 사진 같은 오프셋(이음새 0) · 스크림이 밴드 전체 · 큰 글씨 = 밴드도 늘어남', () => {
    mockDetail = q({ data: detail });
    const t = render(<CurationDetailScreen />);
    expect(ids(t).some((i) => i.startsWith('curation-item-blur-'))).toBe(false); // 높이 모르는 첫 렌더 = 밴드 없음
    const RN = jest.requireActual('react-native');
    const layoutOf = (id: string, layout: object) => act(() => t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onLayout === 'function')[0].props.onLayout({ nativeEvent: { layout } }));
    layoutOf('curation-item-1', { x: 0, y: 0, width: 335, height: 300 });
    expect(ids(t).some((i) => i.startsWith('curation-item-blur-1'))).toBe(false); // 캡션 위치 전 = 없음
    layoutOf('curation-item-caption-1', { x: 0, y: 236, width: 335, height: 64 }); // 이름 위 = 236
    const band = t.root.findAll((n) => n.props?.testID === 'curation-item-blur-1' && typeof n.type === 'string')[0];
    expect(RN.StyleSheet.flatten(band.props.style)).toMatchObject({ position: 'absolute', top: 220, bottom: 0, overflow: 'hidden' }); // 236 − 16
    expect(band.props.pointerEvents).toBe('none');
    const strips = [0, 1, 2, 3].map((i) => t.root.findAll((n) => n.props?.testID === `curation-item-blur-strip-1-${i}` && typeof n.type === 'string')[0]);
    const tops = strips.map((s) => RN.StyleSheet.flatten(s.props.style).top as number);
    const hs = strips.map((s) => RN.StyleSheet.flatten(s.props.style).height as number);
    // 밴드 80 = 띠 20 ×4 · 맞닿기만(겹침 0 — 반투명 띠가 겹친 줄은 더 진해져 선이 된다, Codex #320) · 마지막 띠 바닥 = 카드 바닥
    expect(tops).toEqual([0, 20, 40, 60]);
    expect(hs).toEqual([20, 20, 20, 20]);
    const ops = strips.map((s) => RN.StyleSheet.flatten(s.props.style).opacity as number);
    expect(ops).toEqual([0.35, 0.6, 0.85, 1]); // 위로 갈수록 투명 — 밴드 시작선 크로스페이드
    const imgs = strips.map((s) => s.findAll((n) => n.props?.testID === 'blur:https://cdn/i1.jpg' && typeof n.type === 'string')[0]);
    expect(imgs.map((im) => im.props.blurRadius)).toEqual([11, 23, 34, 45]); // iOS 45 × 1/4…1
    // 각 띠의 사진 = 카드 높이 그대로, 띠의 카드 기준 위치만큼 위로 → 원본과 같은 자리
    expect(imgs.map((im) => RN.StyleSheet.flatten(im.props.style))).toEqual([220, 240, 260, 280].map((y) => expect.objectContaining({ top: -y, height: 300 })));
    const scrim = t.root.findAll((n) => n.props?.testID === 'card-shade' && typeof n.type === 'string');
    expect(scrim).toHaveLength(1);
    expect(RN.StyleSheet.flatten(scrim[0].props.style)).toMatchObject({ top: 220, bottom: 0 });
    expect(scrim[0].props.colors).toEqual(['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']);
    // 큰 글씨 = 캡션이 높아져 위로 — 밴드도 이름 위 16 유지
    layoutOf('curation-item-1', { x: 0, y: 0, width: 335, height: 340 });
    layoutOf('curation-item-caption-1', { x: 0, y: 236, width: 335, height: 104 });
    expect(RN.StyleSheet.flatten(t.root.findAll((n) => n.props?.testID === 'curation-item-blur-1' && typeof n.type === 'string')[0].props.style).top).toBe(220);
    expect(fs.readFileSync('src/app/curations/[key].tsx', 'utf8')).toContain("export const CARD_BLUR_RADIUS = Platform.OS === 'android' ? 9 : 45;");
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    expect(pkg.dependencies['expo-blur']).toBeUndefined();
  });
  it('KB-846 계단 제거: 소수 레이아웃(2.625배)에서도 띠 경계 = 기기 픽셀 정수 · 이웃 띠 정확히 맞닿음(틈 0·겹침 0 — Codex #320) · 불투명도 단조 증가(끝 1) · 마지막 띠 바닥 = 카드 바닥', () => {
    const RNmod = jest.requireActual('react-native');
    const spyGet = jest.spyOn(RNmod.PixelRatio, 'get').mockReturnValue(2.625);
    const spyRound = jest.spyOn(RNmod.PixelRatio, 'roundToNearestPixel').mockImplementation((v: number) => Math.round(v * 2.625) / 2.625);
    try {
      const { blurBandOf } = jest.requireActual('@/app/curations/[key]') as { blurBandOf: (h: number, c: number, r?: number) => { top: number; strips: { top: number; height: number; opacity: number }[] } };
      const b = blurBandOf(300.38, 236.57);
      const onPixel = (v: number) => Math.abs(v * 2.625 - Math.round(v * 2.625)) < 1e-6;
      expect(onPixel(b.top)).toBe(true);
      for (const s of b.strips) { expect(onPixel(s.top)).toBe(true); expect(onPixel(s.top + s.height)).toBe(true); }
      for (let i = 1; i < b.strips.length; i++) {
        const prevBottom = b.strips[i - 1].top + b.strips[i - 1].height;
        expect(Math.abs(prevBottom - b.strips[i].top)).toBeLessThan(1e-9); // 같은 픽셀 경계에서 맞닿음 — 틈(원본 비침)도 겹침(진한 줄)도 0
        expect(b.strips[i].opacity).toBeGreaterThan(b.strips[i - 1].opacity); // 단조 증가
      }
      expect(b.strips[b.strips.length - 1].opacity).toBe(1);
      const last = b.strips[b.strips.length - 1];
      expect(last.top + last.height).toBeCloseTo(Math.round(300.38 * 2.625) / 2.625, 6);
    } finally {
      spyGet.mockRestore();
      spyRound.mockRestore();
    }
  });
  it('KB-846 blurBandOf: Android 9 = 띠 반경 정수 2·5·7·9 · 캡션이 카드 위쪽 16 안이면 밴드 top 0', () => {
    const { blurBandOf } = jest.requireActual('@/app/curations/[key]') as { blurBandOf: (h: number, c: number, r?: number) => { top: number; strips: { radius: number }[] } };
    expect(blurBandOf(300, 236, 9).strips.map((s) => s.radius)).toEqual([2, 5, 7, 9]);
    expect(blurBandOf(300, 10, 9).top).toBe(0);
  });
  it('카드 탭 → 시트(1장 = 카운터 숨김 · 출처 = 그 사진 것) + home_curation_gallery_open · 닫기 → 시트 없음(목록 그대로)', () => {
    mockDetail = q({ data: detail });
    const t = render(<CurationDetailScreen />);
    press(t, 'curation-item-1');
    expect(ids(t)).toContain('curation-gallery');
    expect(mockTrack).toHaveBeenCalledWith('home_curation_gallery_open', { collection_key: 'stations', entry_id: 'e1' });
    expect(ids(t)).not.toContain('curation-gallery-dots'); // 1장 = 점 없음
    expect(byId(t, 'curation-gallery-credit')[0].props.children).toBe('Photo: KTO');
    // Codex #322: 1장 = 페이저가 사진(image)으로 읽힘 — 라벨 "이름, 출처"(오버레이 글자는 무음이라 여기가 유일한 출처 낭독) · 닫기(그래버)는 따로 남는다
    const pager1 = t.root.findAll((n) => n.props?.testID === 'curation-gallery-pager' && typeof n.props?.onMomentumScrollEnd === 'function')[0];
    expect(pager1.props.accessible).toBe(true);
    expect(pager1.props.accessibilityRole).toBe('image');
    expect(pager1.props.accessibilityLabel).toMatch(/, Photo: KTO$/);
    expect(t.root.findAll((n) => n.props?.testID === 'curation-gallery-grabber' && n.props?.accessibilityLabel === 'common.close').length).toBeGreaterThan(0);
    // KB-846: 본문 = 고정(스크롤 0) · 소개 최대 4줄 · X 버튼 없음 · 짧은 화면은 사진 영역이 먼저 줄어든다(Codex #317 — Guide 도달)
    const RN = jest.requireActual('react-native');
    const body = t.root.findAll((n) => n.props?.testID === 'curation-gallery-body')[0];
    // 평소 = 고정(스크롤·바운스 0) · Codex #316: 본문이 시트를 넘는 극단에서만 스크롤로 Guide 도달
    const bodySv = () => t.root.findAll((n) => n.props?.testID === 'curation-gallery-body' && n.type === RN.ScrollView)[0];
    expect(bodySv().props.scrollEnabled).toBe(false);
    expect(bodySv().props.bounces).toBe(false);
    act(() => bodySv().props.onLayout({ nativeEvent: { layout: { height: 300 } } }));
    act(() => bodySv().props.onContentSizeChange(375, 280));
    expect(bodySv().props.scrollEnabled).toBe(false);
    act(() => bodySv().props.onContentSizeChange(375, 420));
    expect(bodySv().props.scrollEnabled).toBe(true);
    // Codex #317: 사진이 먼저 준다 — 본문 고유 높이만큼 사진 영역이 줄고(하한 160), 그 뒤에야 본문이 눌린다
    const { photoBoxHeight } = jest.requireActual('@/features/curation/CurationGallerySheet') as { photoBoxHeight: (p: number, m: number, c: number) => number };
    expect(photoBoxHeight(510, 748, 0)).toBe(510); // 측정 전 = 기본
    expect(photoBoxHeight(510, 748, 200)).toBe(510); // 다 들어감
    expect(photoBoxHeight(510, 748, 400)).toBe(348); // 사진만 줄여 들어감(본문 그대로 → 스크롤 off)
    expect(photoBoxHeight(510, 748, 700)).toBe(160); // 하한 — 이때부터 본문이 넘쳐 스크롤
    const photoView = () => t.root.findAll((n) => n.props?.testID === 'curation-gallery-photo' && typeof n.type === 'string')[0];
    expect(RN.StyleSheet.flatten(photoView().props.style).flexShrink).toBeUndefined(); // 본문과 부족분을 나누지 않는다
    expect(body.findAll((n) => n.props?.testID === 'curation-gallery-guide').length).toBeGreaterThan(0);
    expect(t.root.findAll((n) => n.props?.testID === 'curation-gallery-intro' && typeof n.type === 'string')[0].props.numberOfLines).toBe(4);
    expect(ids(t)).not.toContain('curation-gallery-close');
    press(t, 'curation-gallery-backdrop'); // 배경 탭 = 닫기
    expect(ids(t)).not.toContain('curation-gallery');
    expect(byId(t, 'curation-item-1')).toHaveLength(1);
  });

  it('여러 장: 카운터 1 / 3 → 스와이프(페이징 끝) 3 / 3 + swipe 계측 · 출처는 현재 사진 것(없으면 숨김) · 스크린리더 다음/이전 사진 동작', () => {
    mockDetail = q({ data: withImages(3) });
    const t = render(<CurationDetailScreen />);
    press(t, 'curation-item-1');
    // KB-846: 숫자 → 점 3개(활성 1) · 스크린리더 값 = "n / 3"
    const pagerA11y = () => t.root.findAll((n) => n.props?.testID === 'curation-gallery-pager' && typeof n.props?.onMomentumScrollEnd === 'function')[0].props.accessibilityValue?.text;
    const activeDot = () => {
      const dots = t.root.findAll((n) => n.props?.testID === 'curation-gallery-dots' && typeof n.type === 'string')[0].children as unknown as { props: { testID: string } }[];
      return dots.findIndex((d) => d.props.testID === 'curation-gallery-dot-on');
    };
    const counter = () => `${activeDot() + 1} / ${byId(t, 'curation-gallery-dots').length ? 3 : 0}`;
    expect(ids(t).filter((i) => i === 'curation-gallery-dot' || i === 'curation-gallery-dot-on')).toHaveLength(3);
    expect(counter()).toBe('1 / 3');
    expect(pagerA11y()).toBe('1 / 3');
    expect(byId(t, 'curation-gallery-credit')[0].props.children).toBe('Photo 0');
    const { creditMaxWidth } = jest.requireActual('@/features/curation/CurationGallerySheet') as { creditMaxWidth: (w: number, c: number) => number };
    // KB-852: 출처 = 사진 우하단 오버레이(본문 밖) — 1줄 · 우하단 12 · 점 줄과 안 겹치는 최대 폭 · 스크린리더는 사진 설명으로
    const RNc = jest.requireActual('react-native');
    const sub = (id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string')[0];
    const inside = (root: { findAll: (f: (n: { props?: { testID?: string } }) => boolean) => unknown[] }, id: string) => root.findAll((n) => n.props?.testID === id).length > 0;
    expect(inside(sub('curation-gallery-photo'), 'curation-gallery-credit')).toBe(true);
    const bodyOf = () => t.root.findAll((n) => n.props?.testID === 'curation-gallery-body')[0];
    expect(inside(bodyOf(), 'curation-gallery-credit')).toBe(false);
    const credit = byId(t, 'curation-gallery-credit')[0];
    expect(credit.props.numberOfLines).toBe(1);
    expect(RNc.StyleSheet.flatten(credit.props.style)).toMatchObject({ position: 'absolute', right: 12, bottom: 12, color: '#FFFFFF' });
    const w0 = jest.requireActual('react-native').Dimensions.get('window').width;
    const maxW = RNc.StyleSheet.flatten(credit.props.style).maxWidth as number;
    expect(maxW).toBe(creditMaxWidth(w0, 3));
    expect(w0 - 12 - maxW).toBeGreaterThanOrEqual((w0 + (3 * 6 + 2 * 8)) / 2 + 8); // 출처 왼쪽 끝 ≥ 점 줄 오른쪽 끝 + 8
    expect(creditMaxWidth(w0, 1)).toBe(w0 - 24); // 1장 = 점 없음 → 사진 폭 - 좌우 12
    const pagerLabel = () => t.root.findAll((n) => n.props?.testID === 'curation-gallery-pager' && typeof n.props?.onMomentumScrollEnd === 'function')[0].props.accessibilityLabel;
    expect(pagerLabel()).toMatch(/, Photo 0$/);
    // 본문 = 이름·지역·소개·Guide만 — 출처 유무로 본문 구성(=높이)이 바뀌지 않는다
    const bodyIds = () => bodyOf().findAll((n: { props?: { testID?: string } }) => typeof n.props?.testID === 'string').map((n: { props: { testID: string } }) => n.props.testID).filter((x: string) => x.startsWith('curation-gallery-')).sort();
    const bodyWithCredit = JSON.stringify(bodyIds());
    const pager = () => t.root.findAll((n) => n.props?.testID === 'curation-gallery-pager' && typeof n.props?.onMomentumScrollEnd === 'function')[0];
    const width = jest.requireActual('react-native').Dimensions.get('window').width;
    act(() => pager().props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: width * 2, y: 0 } } }));
    expect(counter()).toBe('3 / 3');
    expect(pagerA11y()).toBe('3 / 3');
    expect(mockTrack).toHaveBeenCalledWith('home_curation_gallery_swipe', { collection_key: 'stations', entry_id: 'e1', index: 2 });
    act(() => pager().props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
    expect(counter()).toBe('2 / 3');
    expect(byId(t, 'curation-gallery-credit')).toHaveLength(0); // 2번째 사진은 출처 없음 = 오버레이 0
    expect(JSON.stringify(bodyIds())).toBe(bodyWithCredit); // KB-852: 출처 없는 사진으로 넘겨도 본문 구성 동일
    expect(pagerLabel()).not.toMatch(/,/);
    expect(pager().props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['increment', 'decrement']);
  });

  it('Codex #309 R2: 갤러리가 열린 채 재조회가 404 CURATION-001이면 갤러리도 사라진다(내린 모음의 사진·Guide 0)', () => {
    mockDetail = q({ data: detail });
    const t = render(<CurationDetailScreen />);
    press(t, 'curation-item-1');
    expect(ids(t)).toContain('curation-gallery');
    mockDetail = q({ data: detail, isError: true, error: new ApiError('withdrawn', 404, 'CURATION-001') });
    act(() => t.update(<CurationDetailScreen />));
    expect(ids(t)).toContain('curation-unavailable');
    expect(ids(t)).not.toContain('curation-gallery');
    expect(ids(t)).not.toContain('curation-gallery-guide');
  });
  it('KB-846 그래버를 아래로 끌어 임계 넘김 = 닫힘 · 못 넘김 = 시트 유지·제자리 · 가로 우선 끌기는 실패(캐러셀 보호) · 스크린리더 = 그래버 "닫기" 동작', () => {
    mockDetail = q({ data: detail });
    const t = render(<CurationDetailScreen />);
    press(t, 'curation-item-1');
    expect(mockPan.failOffsetX).toEqual([-12, 12]);
    act(() => mockPan.onUpdate?.({ translationY: 50 }));
    act(() => mockPan.onEnd?.({ translationY: 50, velocityY: 100 }, true));
    expect(ids(t)).toContain('curation-gallery');
    const grab = t.root.findAll((n) => n.props?.testID === 'curation-gallery-grabber' && typeof n.type === 'string')[0];
    expect(grab.props.accessibilityRole).toBe('button');
    expect(grab.props.accessibilityLabel).toBe('common.close');
    act(() => mockPan.onEnd?.({ translationY: 400, velocityY: 0 }, true));
    expect(ids(t)).not.toContain('curation-gallery');
    press(t, 'curation-item-1');
    act(() => t.root.findAll((n) => n.props?.testID === 'curation-gallery-grabber' && typeof n.props?.onAccessibilityAction === 'function')[0].props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    expect(ids(t)).not.toContain('curation-gallery');
  });
  it('사진 0장 = 카드 회색 자리 · 시트도 플레이스홀더 1장(카운터 0)', () => {
    mockDetail = q({ data: { ...detail, items: detail.items.map((it) => (it.position === 4 ? { ...it, imageUrl: '', images: [] } : it)) } });
    const t = render(<CurationDetailScreen />);
    expect(byId(t, 'curation-item-nophoto-4')).toHaveLength(1);
    press(t, 'curation-item-4');
    expect(byId(t, 'curation-gallery-nophoto')).toHaveLength(1);
    expect(ids(t)).not.toContain('curation-gallery-dots'); // 1장 = 점 없음
  });
});

describe('KB-846 갤러리 시트 끌어 닫기', () => {
  it('shouldDismiss: 시트 높이 25% 이상 또는 아래로 빠르게(1000px/s) = 닫기 · 위로·작은 끌기 = 되돌림', () => {
    const { shouldDismiss } = jest.requireActual('@/features/curation/CurationGallerySheet') as { shouldDismiss: (y: number, v: number, h: number) => boolean };
    expect(shouldDismiss(187, 0, 748)).toBe(true); // 25%
    expect(shouldDismiss(186, 0, 748)).toBe(false);
    expect(shouldDismiss(40, 1200, 748)).toBe(true); // 빠른 튕김
    expect(shouldDismiss(-40, 1200, 748)).toBe(false);
  });
});

describe('KB-829 QA S3 지역 행 줄바꿈', () => {
  it('이름 안 공백 = NBSP(이름 중간 줄바꿈 0) · 이름 사이 = 일반 공백 2칸(여기서만 줄바꿈) · 앞뒤 공백 제거', () => {
    const { areaLine } = jest.requireActual('@/app/curations/[key]') as { areaLine: (a: string, n: string[]) => string };
    const s = areaLine('Hongdae / Yeonnam-dong', [' Hongdae streets ', 'Gyeongui Line  Forest Park']);
    expect(s).toBe('Hongdae\u00A0/\u00A0Yeonnam-dong  Hongdae\u00A0streets  Gyeongui\u00A0Line\u00A0Forest\u00A0Park');
    expect(s.split('  ')).toHaveLength(3); // 줄바꿈 가능한 자리 = 이름 경계뿐
    expect(s.split('  ').every((name) => !name.includes(' '))).toBe(true);
    expect(areaLine('Jongno-gu', [])).toBe('Jongno-gu');
  });
});

describe('배치·문구 잠금', () => {
  it('홈: 음식 레일 뒤·Safe picks 앞 슬롯에 큐레이션 · 모음 키 하드코딩 0', () => {
    const home = fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8');
    expect(home).toContain('afterRail={<><IdolPickBanner /><CurationSection /></>}'); // KB-836 D1: 배너 → 큐레이션
    expect(home).toContain("queryClient.invalidateQueries({ queryKey: ['curations'] })"); // Codex #303 P2: 당겨서 새로고침에 포함
    const fx = fs.readFileSync('src/features/food/FoodExplorer.tsx', 'utf8');
    expect(fx.indexOf("{variant === 'embedded' && afterRail}")).toBeGreaterThan(fx.indexOf('testID="home-rail"'));
    expect(fx.indexOf("{variant === 'embedded' && afterRail}")).toBeLessThan(fx.indexOf('testID="home-safe-rail-head"'));
    for (const f of ['src/features/curation/CurationSection.tsx', 'src/app/curations/[key].tsx', 'src/lib/data/useCurations.ts', 'src/lib/api/curationAdapter.ts']) {
      expect(fs.readFileSync(f, 'utf8')).not.toMatch(/['"](sights|stations|restaurants|busan)['"]/);
    }
  });
  it('Codex #303 P1: 와이어 변환은 lib/api/curationAdapter에만 — 훅·화면에 서버 필드명 0', () => {
    for (const f of ['src/lib/data/useCurations.ts', 'src/features/curation/CurationSection.tsx', 'src/app/curations/[key].tsx']) {
      expect(fs.readFileSync(f, 'utf8')).not.toMatch(/collectionKey|coverImageAttribution|recommendationReason|entryId/);
    }
  });
  it('10언어 앱 문구 전부 · 가운데점 0 · 이름 자리표시자 유지', () => {
    const keys = ['sectionTitle', 'loadError', 'refreshFailed', 'prev', 'next', 'fallbackNotice', 'errorTitle', 'errorBody', 'unavailableTitle', 'unavailableBody', 'backHome', 'guide', 'photoUnavailable', 'viewGuideA11y', 'viewGuideHint', 'openGalleryHint', 'nextPhoto', 'prevPhoto'];
    for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'id', 'ru', 'th', 'vi']) {
      const c = JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')).curation as Record<string, string>;
      for (const k of keys) { expect(c[k]).toBeTruthy(); expect(c[k]).not.toContain('·'); }
      expect(c.viewGuideA11y).toContain('{{name}}');
    }
    const en = JSON.parse(fs.readFileSync('src/lib/i18n/en.json', 'utf8')).curation;
    const ko = JSON.parse(fs.readFileSync('src/lib/i18n/ko.json', 'utf8')).curation;
    expect([en.sectionTitle, ko.sectionTitle]).toEqual(['Explore Korea', '한국 둘러보기']);
  });
});

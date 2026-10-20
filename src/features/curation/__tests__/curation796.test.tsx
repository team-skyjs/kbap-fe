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
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => false }));
jest.mock('@/components/Skeleton', () => { const { View } = jest.requireActual('react-native'); return { Shimmer: (p: object) => <View {...p} /> }; });
jest.mock('@/components/RemoteImage', () => { const { View } = jest.requireActual('react-native'); return { RemoteImage: (p: { uri: string }) => <View testID={`img:${p.uri}`} /> }; });
jest.mock('@/components/icons', () => { const { View } = jest.requireActual('react-native'); return { IconChevron: () => null, IconArrowLeft: () => null, IconChevronDown: (p: { style?: unknown }) => <View testID="chevron-down" style={p.style} /> }; });
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
import { adaptCurationDetail, adaptCurationIndex } from '@/lib/api/curationAdapter';
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
    expect(byId(t, 'curation-item-attribution-1')).toHaveLength(1);
    expect(byId(t, 'curation-item-attribution-2')).toHaveLength(0);
    // KB-829: 역 모음 = 지역 행에 area + nearby 공백 2칸(빈 이름 제거) · "Explore nearby" 줄 없음
    expect(t.root.findAll((n) => typeof n.type === 'string' && n.props.children === 'Area 2  Hongdae streets  Forest Park')).toHaveLength(1);
    expect(t.root.findAll((n) => typeof n.type === 'string' && n.props.children === 'Area 1')).toHaveLength(1);
    expect(text(t)).not.toContain('exploreNearby');
    expect(byId(t, 'curation-cover')).toHaveLength(0); // v2: 상세 표지 없음
    expect(byId(t, 'curation-fallback')).toHaveLength(0);
    mockDetail = q({ data: { ...detail, fallbackUsed: true } });
    expect(byId(render(<CurationDetailScreen />), 'curation-fallback')).toHaveLength(1);
  });
  it('View guide = 인앱 브라우저로 외부 URL + home_curation_link_click(키·위치, URL 미전송) · 스크린리더 이름·힌트', () => {
    mockDetail = q({ data: detail });
    const t = render(<CurationDetailScreen />);
    const btn = t.root.findAll((n) => n.props?.testID === 'curation-item-link-3' && typeof n.props?.onPress === 'function')[0];
    expect(btn.props.accessibilityLabel).toBe('curation.viewGuideA11y:{"name":"Place 3"}');
    expect(btn.props.accessibilityHint).toBe('curation.viewGuideHint');
    press(t, 'curation-item-link-3');
    expect(mockOpen).toHaveBeenCalledWith('https://example.com/3');
    expect(mockTrack).toHaveBeenCalledWith('home_curation_link_click', { collection_key: 'stations', position: 3 });
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

describe('KB-829 사진 중심 카드(D-29 v2)', () => {
  const detail = adaptCurationDetail(DETAIL_WIRE) as CurationDetail;
  beforeEach(() => { mockParams = { key: 'stations' }; });
  const flat = (st: unknown): Record<string, unknown> => Object.assign({}, ...([] as unknown[]).concat(st as never).flat(Infinity).filter(Boolean));
  const toggle = (t: ReactTestRenderer, p: number) => t.root.findAll((n) => n.props?.testID === `curation-item-toggle-${p}` && typeof n.type === 'string')[0];
  const chevron = (t: ReactTestRenderer, p: number) => byId(byIdTree(t, `curation-item-${p}`), 'chevron-down')[0];
  const byIdTree = (t: ReactTestRenderer, id: string) => ({ root: t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string')[0] }) as unknown as ReactTestRenderer;

  it('사진 335×208 비율 · 소개·선정 이유 기본 접힘 · 펼침 버튼 = 장소명 라벨 + expanded false', () => {
    mockDetail = q({ data: detail });
    const t = render(<CurationDetailScreen />);
    expect(t.root.findAll((n) => n.props?.testID === 'img:https://cdn/i1.jpg' && typeof n.type === 'string')).toHaveLength(1); // 표지 없음 = 1번 사진 한 번
    expect(fs.readFileSync('src/app/curations/[key].tsx', 'utf8')).toContain('export const ITEM_PHOTO_RATIO = 208 / 335;');
    expect(byId(t, 'curation-item-about-1')).toHaveLength(0);
    expect(text(t)).not.toContain('Intro 1');
    const tg = toggle(t, 1);
    expect(tg.props.accessibilityRole).toBe('button');
    expect(tg.props.accessibilityLabel).toBe('Place 1');
    expect(tg.props.accessibilityState).toMatchObject({ expanded: false });
    expect(flat(chevron(t, 1).props.style).transform).toBeUndefined();
  });

  it('사진 탭 = 펼침(소개·이유, chevron 위로, expanded true) → 이름 행 탭 = 접힘 · 항목별 독립', () => {
    mockDetail = q({ data: detail });
    const t = render(<CurationDetailScreen />);
    press(t, 'curation-item-photo-3');
    expect(byId(t, 'curation-item-about-3')).toHaveLength(1);
    expect(text(t)).toContain('Intro 3');
    expect(text(t)).toContain('Why 3');
    expect(toggle(t, 3).props.accessibilityState).toMatchObject({ expanded: true });
    expect(flat(chevron(t, 3).props.style).transform).toEqual([{ rotate: '180deg' }]);
    expect(byId(t, 'curation-item-about-2')).toHaveLength(0); // 다른 항목은 그대로
    press(t, 'curation-item-toggle-3');
    expect(byId(t, 'curation-item-about-3')).toHaveLength(0);
  });

  it('Guide 탭 = 외부 링크만 · 펼침 상태 불변', () => {
    mockDetail = q({ data: detail });
    const t = render(<CurationDetailScreen />);
    press(t, 'curation-item-link-5');
    expect(mockOpen).toHaveBeenCalledWith('https://example.com/5');
    expect(byId(t, 'curation-item-about-5')).toHaveLength(0);
    press(t, 'curation-item-toggle-5');
    press(t, 'curation-item-link-5');
    expect(byId(t, 'curation-item-about-5')).toHaveLength(1);
  });

  it('출처 캡션은 지역 행 아래·본문 위 · 사진 없는 항목 = 104 회색 "Photo unavailable"(사진 자리 축소)', () => {
    mockDetail = q({ data: { ...detail, items: detail.items.map((it) => (it.position === 4 ? { ...it, imageUrl: '' } : it)) } });
    const t = render(<CurationDetailScreen />);
    press(t, 'curation-item-toggle-1');
    const card = t.root.findAll((n) => n.props?.testID === 'curation-item-1' && typeof n.type === 'string')[0];
    const ids = card.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string').map((n) => n.props.testID as string);
    const at = (id: string) => ids.indexOf(id);
    expect(at('curation-item-toggle-1')).toBeGreaterThanOrEqual(0);
    expect(at('curation-item-attribution-1')).toBeGreaterThan(at('curation-item-toggle-1'));
    expect(at('curation-item-about-1')).toBeGreaterThan(at('curation-item-attribution-1'));
    const ph = byId(t, 'curation-item-nophoto-4')[0];
    expect(flat(ph.props.style).height).toBe(104);
    expect(text(t)).toContain('curation.photoUnavailable');
    expect(t.root.findAll((n) => n.props?.testID === 'img:')).toHaveLength(0);
  });

  it('목록 재조회(새 dataUpdatedAt) = 펼침 초기화', () => {
    mockDetail = { ...q({ data: detail }), dataUpdatedAt: 1 } as Q;
    const t = render(<CurationDetailScreen />);
    press(t, 'curation-item-toggle-2');
    expect(byId(t, 'curation-item-about-2')).toHaveLength(1);
    mockDetail = { ...q({ data: detail }), dataUpdatedAt: 2 } as Q;
    act(() => t.update(<CurationDetailScreen />));
    expect(byId(t, 'curation-item-about-2')).toHaveLength(0);
  });
});

describe('배치·문구 잠금', () => {
  it('홈: 음식 레일 뒤·Safe picks 앞 슬롯에 큐레이션 · 모음 키 하드코딩 0', () => {
    const home = fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8');
    expect(home).toContain('afterRail={<CurationSection />}');
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
    const keys = ['sectionTitle', 'loadError', 'refreshFailed', 'prev', 'next', 'fallbackNotice', 'errorTitle', 'errorBody', 'unavailableTitle', 'unavailableBody', 'backHome', 'guide', 'photoUnavailable', 'viewGuideA11y', 'viewGuideHint'];
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

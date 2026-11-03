/**
 * KB-955(P-571) 홈 편의점 인기 가공식품 줄 — Packaged 둘러보기 쿼리 재사용 · 10개 · 로딩 스켈레톤 · 실패·0개 = 섹션째 없음 ·
 * See all = 음식 탭 Packaged · 카드 탭 = home_card_click(cvs·position·product_id) · 운영 채널(processedFoodEnabled off) = 마운트 0.
 */
import * as fs from 'fs';
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View, FlatList: jest.requireActual('react-native').FlatList, createAnimatedComponent: (c: unknown) => c },
    createAnimatedComponent: (c: unknown) => c,
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    useReducedMotion: () => false,
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@/components/Skeleton', () => { const { View } = jest.requireActual('react-native'); return { Shimmer: (p: object) => <View {...p} testID="shimmer" /> }; });
jest.mock('@/components/RemoteImage', () => { const { View } = jest.requireActual('react-native'); return { RemoteImage: () => <View /> }; });
jest.mock('@/components/RiskBadge', () => { const { View } = jest.requireActual('react-native'); return { RiskBadge: (p: { state: string }) => <View testID={`badge-${p.state}`} /> }; });
jest.mock('@/components/icons', () => ({ ...jest.requireActual('@/components/icons'), IconCamera: () => null, IconTabFood: () => null, IconChevron: () => null }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn() }) }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, apiLang: () => 'en', ApiError: class extends Error {} }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => true }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: undefined }) }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { CVS_RAIL_N, HomeCvsRail } from '../HomeCvsRail';
/* eslint-enable import/first */

const trees: ReactTestRenderer[] = [];
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); jest.clearAllMocks(); });
const ids = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string').map((n) => n.props.testID as string);
const until = async (cond: () => boolean) => { for (let i = 0; i < 50 && !cond(); i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const page = (n: number) => ({ items: Array.from({ length: n }, (_, i) => ({ id: i + 1, productName: `p${i + 1}`, imageUrl: null, labelKnown: true })), hasNext: false, nextCursor: null });
const mount = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<QueryClientProvider client={qc}><HomeCvsRail /></QueryClientProvider>); });
  trees.push(t);
  return t;
};
const cards = (t: ReactTestRenderer) => ids(t).filter((i) => /^packaged-item-\d+$/.test(i));

describe('KB-955 홈 편의점 인기 줄', () => {
  it('로딩 = 카드 스켈레톤(섹션·헤더 자리 유지) → 도착 = 첫 10개 카드 · Packaged 둘러보기와 같은 요청(검색어 없음)', async () => {
    let release!: (v: unknown) => void;
    mockGet.mockReturnValueOnce(new Promise((r) => (release = r)));
    const t = mount();
    expect(ids(t)).toEqual(expect.arrayContaining(['home-cvs-section', 'home-cvs-head', 'home-cvs-see-all']));
    expect(ids(t).filter((i) => i === 'shimmer').length).toBeGreaterThan(0);
    expect(cards(t)).toEqual([]);
    expect(String(mockGet.mock.calls[0][0])).toMatch(/^\/api\/processed-foods\?/);
    expect(String(mockGet.mock.calls[0][0])).not.toMatch(/query=/);
    await act(async () => { release(page(12)); });
    await until(() => cards(t).length > 0);
    expect(cards(t)).toHaveLength(CVS_RAIL_N);
    expect(CVS_RAIL_N).toBe(10);
    expect(ids(t)).not.toContain('shimmer');
  });
  it('실패 = 섹션째 없음 · 0개 = 섹션째 없음(가짜 빈 상태 0)', async () => {
    mockGet.mockRejectedValueOnce(new Error('down'));
    const e = mount();
    await until(() => !ids(e).includes('home-cvs-section'));
    expect(ids(e)).not.toContain('home-cvs-section');
    mockGet.mockResolvedValueOnce(page(0));
    const z = mount();
    await until(() => !ids(z).includes('home-cvs-section'));
    expect(ids(z)).not.toContain('home-cvs-section');
  });
  it('See all = 음식 탭 Packaged(view=packaged + 새 t) · 카드 탭 = home_card_click(cvs·position·product_id) + 상세', async () => {
    mockGet.mockResolvedValueOnce(page(3));
    const t = mount();
    await until(() => cards(t).length === 3);
    const press = (id: string) => act(() => t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress());
    press('home-cvs-see-all');
    expect(mockPush.mock.calls[0][0]).toMatch(/^\/food\?view=packaged&t=\d+$/);
    press('packaged-item-2');
    expect(mockTrack).toHaveBeenCalledWith('home_card_click', { section: 'cvs', position: 1, product_id: '2' });
    expect(mockPush).toHaveBeenLastCalledWith('/processed-foods/2?src=home_cvs'); // KB-973 상세 진입 출처
  });
});

describe('KB-955 배선(소스)', () => {
  const read = (p: string) => fs.readFileSync(p, 'utf8');
  it('홈 = 운영 채널 플래그 뒤에서만 · 레일 바로 아래(아이돌·큐레이션보다 앞) · 당겨서 새로고침에 목록 키', () => {
    const home = read('src/app/(tabs)/index.tsx');
    expect(home).toContain('afterRail={<>{FLAGS.processedFoodEnabled && <HomeCvsRail />}{FLAGS.idolPicksEnabled && <IdolPickBanner />}');
    expect(home).toContain("queryClient.invalidateQueries({ queryKey: ['processedFoods', 'search'] })");
  });
  it('음식 탭 view=packaged = Packaged 세그먼트(운영 채널 = Dishes)', () => {
    expect(read('src/app/(tabs)/food.tsx')).toContain("const seeAllTarget: FoodSegment = one(raw.view) === 'packaged' && FLAGS.processedFoodEnabled ? 'packaged' : 'dishes';");
  });
  it('제목 = 10로케일(en 폴백 0) · 이모지 0 · 가운데점 0', () => {
    const en = JSON.parse(read('src/lib/i18n/en.json')).home.cvsTitle as string;
    expect(en).toBe('Convenience store best');
    for (const l of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es']) {
      const v = JSON.parse(read(`src/lib/i18n/${l}.json`)).home.cvsTitle as string;
      expect({ l, ok: !!v && (l === 'en' || v !== en) && !/[\u{1F300}-\u{1FAFF}·]/u.test(v) }).toEqual({ l, ok: true });
    }
    expect(JSON.parse(read('src/lib/i18n/ko.json')).home.cvsTitle).toBe('편의점 인기 간식');
  });
});

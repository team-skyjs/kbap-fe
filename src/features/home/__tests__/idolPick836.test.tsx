/**
 * KB-836 K-POP & K-FOOD — 어댑터(idolPickFoods·idolVideo) · 홈 배너(0건 숨김·로딩·콜라주 1~3장·탭 계측 id 없음·눌림 메트릭 불변) ·
 * 목록 화면(로딩·오류·0건·게스트 배지 미렌더·회원 배지·카드 경로·포커스 계측) · 상세 V1 카드(탭 = 계측 + openWebPage·눌림 메트릭 불변) ·
 * 상세 배치·source 잠금 · 15키 × 10로케일 + 플랫폼명·PICK 금지.
 */
import * as fs from 'fs';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }), initReactI18next: { type: '3rdParty', init: () => {} } }));
// FoodCards(padOddGrid) → components 배럴 → Btn 이 reanimated 를 끌어온다 — 그리드 테스트(gridOddBottom486)와 같은 목
jest.mock('react-native-reanimated', () => {
  const { View, Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c ?? Pressable },
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
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/Skeleton', () => { const { View } = jest.requireActual('react-native'); return { Shimmer: (p: object) => <View testID="shimmer" {...p} /> }; });
jest.mock('@/components/RemoteImage', () => { const { View } = jest.requireActual('react-native'); return { RemoteImage: (p: { uri: string; onError?: () => void }) => <View testID={`img:${p.uri}`} {...({ onError: p.onError } as object)} /> }; });
jest.mock('expo-linear-gradient', () => { const { View } = jest.requireActual('react-native'); return { LinearGradient: (p: object) => <View {...p} /> }; });
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/components/StateBlock', () => {
  const { Text } = jest.requireActual('react-native');
  return { EmptyBlock: (p: { label: string; testID: string }) => <Text testID={p.testID}>{p.label}</Text>, QueryErrorBlock: () => <Text testID="query-error-block">err</Text> };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const R = jest.requireActual('react');
  return {
    useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn(), canGoBack: () => true }),
    useIsFocused: () => true,
    useFocusEffect: (cb: () => void) => R.useEffect(cb, [cb]),
  };
});
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
const mockOpen = jest.fn(async () => true);
jest.mock('@/lib/openExternal', () => ({ openWebPage: (u: string) => mockOpen(u) }));
let mockHome: { data?: unknown; isPending: boolean; isError: boolean; error?: unknown; refetch: jest.Mock };
jest.mock('@/lib/data/useHome', () => ({ ...jest.requireActual('@/lib/data/useHome'), useHome: () => mockHome }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { restrictions: [] } }) }));
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, apiLang: () => 'en' }));
jest.mock('@/lib/i18n/useAppLanguage', () => ({ useAppLanguage: () => 'en' }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { fetchHome } from '@/lib/data/useHome';
import { adaptFoodDetail, adaptIdolVideo, adaptMenuSummary } from '@/lib/api/foodAdapter';
import { IdolPickBanner } from '../IdolPickBanner';
import { trackHomeCardClick } from '../homeImpressions';
import { IdolVideoCard } from '@/features/food/IdolVideoCard';
import IdolPicksScreen, { cellWidth } from '@/app/idol-picks';
import type { FoodCard } from '@/lib/api/types';
/* eslint-enable import/first */

// 계약 C-1 예시 모양(가짜 값 — 법무 잠금: 이름·제목 없음)
const wireFood = (id: number, extra: object = {}) => ({
  foodId: id, name: `Dish ${id}`, koreanName: `음식${id}`, imageRef: `https://cdn.example/foods/${id}.webp`, spiciness: 0,
  overallRiskStatus: 'SAFE', publishedAt: '2026-09-02T03:00:00Z', bookmarked: false, review: { averageRating: 4.5, count: 12 }, ...extra,
});
const food = (id: number, extra: Partial<FoodCard> = {}): FoodCard => ({ ...adaptMenuSummary(wireFood(id) as never), ...extra });

const trees: ReactTestRenderer[] = [];
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); jest.clearAllMocks(); });
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(el); }); trees.push(t); return t; };
const hostIds = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string').map((n) => n.props.testID as string);
const press = (t: ReactTestRenderer, id: string) => act(() => t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress());

/** 눌림 전후 — 색·불투명도를 뺀 모든 호스트 스타일 메트릭이 같아야 한다(CLAUDE.md "상태 변화는 색만") */
const COLOR_KEYS = new Set(['backgroundColor', 'opacity', 'color']);
const metricsOf = (t: ReactTestRenderer, id: string, pressed: boolean) => {
  const fn = t.root.find((n) => n.props?.testID === id && typeof n.props?.children === 'function').props.children as (s: { pressed: boolean }) => React.ReactNode;
  const r = render(<>{fn({ pressed })}</>);
  return r.root.findAll((n) => typeof n.type === 'string').map((n) => Object.fromEntries(Object.entries(StyleSheet.flatten(n.props.style) ?? {}).filter(([k]) => !COLOR_KEYS.has(k))));
};
const colorsOf = (t: ReactTestRenderer, id: string, pressed: boolean) => {
  const fn = t.root.find((n) => n.props?.testID === id && typeof n.props?.children === 'function').props.children as (s: { pressed: boolean }) => React.ReactNode;
  const r = render(<>{fn({ pressed })}</>);
  return r.root.findAll((n) => typeof n.type === 'string').map((n) => StyleSheet.flatten(n.props.style) ?? {});
};

describe('어댑터 (계약 C-1·C-2)', () => {
  it('홈 1.4: idolPickFoods 배열 = adaptMenuSummary 와 같은 모양·BE 순서 / 부재·null = 빈 배열', async () => {
    const base = { authenticated: false, avoidedSubstances: [], popularFoods: [], mostReviewedFoods: [], recentScans: [], topRatedFoods: [] };
    mockGet.mockResolvedValueOnce({ ...base, idolPickFoods: [wireFood(491), wireFood(5, { imageRef: null })] });
    const res = await fetchHome();
    expect(mockGet).toHaveBeenCalledWith('/home?lang=en', { headers: { 'X-API-Version': '1.4' } });
    expect(res.idolPicks).toEqual([adaptMenuSummary(wireFood(491) as never), adaptMenuSummary(wireFood(5, { imageRef: null }) as never)]);
    expect(res.idolPicks[1].photoUrl).toBeNull();
    mockGet.mockResolvedValueOnce(base);
    expect((await fetchHome()).idolPicks).toEqual([]);
    mockGet.mockResolvedValueOnce({ ...base, idolPickFoods: null });
    expect((await fetchHome()).idolPicks).toEqual([]);
  });

  it('상세 idolVideo: 대문자 → 소문자 · 알 수 없는 platform·빈 url·null·부재 = null', () => {
    expect(adaptIdolVideo({ url: 'https://example.com/v/1', platform: 'YOUTUBE' })).toEqual({ url: 'https://example.com/v/1', platform: 'youtube' });
    expect(adaptIdolVideo({ url: 'https://example.com/v/2', platform: 'TIKTOK' })).toEqual({ url: 'https://example.com/v/2', platform: 'tiktok' });
    expect(adaptIdolVideo({ url: 'https://example.com/v/3', platform: 'VIMEO' })).toBeNull();
    expect(adaptIdolVideo({ url: '', platform: 'YOUTUBE' })).toBeNull();
    expect(adaptIdolVideo(null)).toBeNull();
    expect(adaptIdolVideo(undefined)).toBeNull();
    const detail = { name: 'Dish', koreanName: '음식', imageRef: null, description: '', spiciness: 0, bookmarked: false, overallRiskStatus: 'SAFE', ingredients: [] };
    expect(adaptFoodDetail({ ...detail, idolVideo: { url: 'https://example.com/v/1', platform: 'YOUTUBE' } } as never, '6').idolVideo).toEqual({ url: 'https://example.com/v/1', platform: 'youtube' });
    expect(adaptFoodDetail(detail as never, '6').idolVideo).toBeNull();
  });
});

describe('홈 배너', () => {
  it('0건·키 부재(로딩 아님) = null — 섹션·여백 없음', () => {
    expect(render(<IdolPickBanner foods={[]} loading={false} />).toJSON()).toBeNull();
    expect(render(<IdolPickBanner foods={undefined} loading={false} />).toJSON()).toBeNull();
  });

  it('데이터 미도착 = Shimmer(폭 = 화면−40, 높이 372, radius 16)', () => {
    const t = render(<IdolPickBanner foods={undefined} loading />);
    expect(hostIds(t)).toContain('idol-pick-skeleton');
    const sh = t.root.find((n) => n.props.testID === 'shimmer' && typeof n.type === 'string');
    expect(StyleSheet.flatten(sh.props.style)).toMatchObject({ height: 372, borderRadius: 16 });
  });

  it('콜라주 = 앞 3장(BE 순서) · 2개면 2장 · 사진 없음 = 물음표 폴백', () => {
    const four = render(<IdolPickBanner foods={[food(1), food(2), food(3), food(4)]} loading={false} />);
    expect(hostIds(four).filter((i) => i.startsWith('img:'))).toEqual(['img:https://cdn.example/foods/1.webp', 'img:https://cdn.example/foods/2.webp', 'img:https://cdn.example/foods/3.webp']);
    const two = render(<IdolPickBanner foods={[food(1), food(2, { photoUrl: null })]} loading={false} />);
    expect(hostIds(two).filter((i) => i.startsWith('idol-pick-photo-'))).toEqual(['idol-pick-photo-0', 'idol-pick-photo-1']);
    expect(hostIds(two)).toContain('idol-photo-fallback-2');
  });

  it('사진 로드 실패 → 그 타일만 물음표 폴백', () => {
    const t = render(<IdolPickBanner foods={[food(1), food(2)]} loading={false} />);
    act(() => t.root.find((n) => n.props.testID === 'img:https://cdn.example/foods/1.webp' && typeof n.type === 'string').props.onError());
    expect(hostIds(t)).toContain('idol-photo-fallback-1');
    expect(hostIds(t)).toContain('img:https://cdn.example/foods/2.webp');
  });

  it('탭 = home_card_click{section:idol_pick, position:0}(food_id·collection_key 없음, D4) → /idol-picks · 라벨 = count', () => {
    const t = render(<IdolPickBanner foods={[food(1), food(2), food(3)]} loading={false} />);
    const banner = t.root.find((n) => n.props.testID === 'idol-pick-banner' && n.props.accessibilityRole === 'button');
    expect(banner.props.accessibilityLabel).toBe('home.idolPick.bannerA11y:{"count":3}');
    press(t, 'idol-pick-banner');
    const click = mockTrack.mock.calls.find((c) => c[0] === 'home_card_click');
    expect(click).toEqual(['home_card_click', { section: 'idol_pick', position: 0 }]);
    expect(mockPush).toHaveBeenCalledWith('/idol-picks');
  });

  it('trackHomeCardClick 기존 호출 무변 — 음식 카드 food_id · 큐레이션 collection_key', () => {
    trackHomeCardClick('popular', 2, '7');
    trackHomeCardClick('curation', 0, 'sights');
    expect(mockTrack.mock.calls).toEqual([
      ['home_card_click', { section: 'popular', position: 2, food_id: '7' }],
      ['home_card_click', { section: 'curation', position: 0, collection_key: 'sights' }],
    ]);
  });

  it('눌림 = 오버레이 불투명도만 — 메트릭 불변', () => {
    const t = render(<IdolPickBanner foods={[food(1)]} loading={false} />);
    expect(metricsOf(t, 'idol-pick-banner', true)).toEqual(metricsOf(t, 'idol-pick-banner', false));
    expect(colorsOf(t, 'idol-pick-banner', false).some((s) => s.opacity === 0)).toBe(true);
    expect(colorsOf(t, 'idol-pick-banner', true).some((s) => s.opacity === 0)).toBe(false);
  });

  it('폭 < 360 = 축소 콜라주(80×100, 높이 120)', () => {
    const dims = jest.spyOn(jest.requireActual('react-native'), 'useWindowDimensions').mockReturnValue({ width: 320, height: 640, scale: 2, fontScale: 1 });
    const t = render(<IdolPickBanner foods={[food(1)]} loading={false} />);
    expect(StyleSheet.flatten(t.root.find((n) => n.props.testID === 'idol-pick-photo-0' && typeof n.type === 'string').props.style)).toMatchObject({ width: 80, height: 100 });
    expect(StyleSheet.flatten(t.root.find((n) => n.props.testID === 'idol-pick-collage' && typeof n.type === 'string').props.style)).toMatchObject({ height: 120 });
    dims.mockRestore();
  });
});

describe('목록 화면 /idol-picks', () => {
  const ok = (data: object) => ({ data, isPending: false, isError: false, refetch: jest.fn() });

  it('로딩 = Shimmer 6칸 · 다크 헤더 즉시', () => {
    mockHome = { isPending: true, isError: false, refetch: jest.fn() };
    const t = render(<IdolPicksScreen />);
    expect(hostIds(t)).toContain('idol-picks-skeleton');
    expect(hostIds(t).filter((i) => i === 'shimmer')).toHaveLength(6);
    expect(hostIds(t)).toContain('idol-picks-back');
    expect(mockTrack.mock.calls.filter((c) => c[0] === 'home_idol_pick_list_view')).toEqual([]); // 데이터 전엔 count 없음
  });

  it('오류·캐시 없음 = QueryErrorBlock · 0건 = EmptyBlock', () => {
    mockHome = { isPending: false, isError: true, error: new Error('x'), refetch: jest.fn() };
    expect(hostIds(render(<IdolPicksScreen />))).toContain('query-error-block');
    mockHome = ok({ authenticated: true, idolPicks: [] });
    expect(hostIds(render(<IdolPicksScreen />))).toContain('idol-picks-empty');
  });

  it('게스트 = RiskBadge 미렌더 · BE 순서 · 홀수 = 빈 셀 · 포커스 계측 count', () => {
    mockHome = ok({ authenticated: false, idolPicks: [food(491), food(5), food(6)] });
    const t = render(<IdolPicksScreen />);
    expect(hostIds(t).filter((i) => i.startsWith('idol-poster-') && i !== 'idol-poster-press')).toEqual(['idol-poster-491', 'idol-poster-5', 'idol-poster-6']);
    expect(hostIds(t).some((i) => i.startsWith('risk-badge-'))).toBe(false);
    expect(mockTrack).toHaveBeenCalledWith('home_idol_pick_list_view', { count: 3 });
  });

  it('회원 = RiskBadge + 라벨에 위험도 · 카드 탭 → /food/{id}?src=idol_pick', () => {
    mockHome = ok({ authenticated: true, idolPicks: [food(491, { risk: 'caution' })] });
    const t = render(<IdolPicksScreen />);
    expect(hostIds(t)).toContain('risk-badge-caution');
    const card = t.root.find((n) => n.props.testID === 'idol-poster-491' && n.props.accessibilityRole === 'button');
    expect(card.props.accessibilityLabel).toBe('idolPicks.cardA11y:{"name":"Dish 491"}, risk.caution');
    press(t, 'idol-poster-491');
    expect(mockPush).toHaveBeenCalledWith('/food/491?src=idol_pick');
  });

  it('포스터 카드 눌림 = 메트릭 불변 · 셀 폭 375 → 161.5 / 320 → 134', () => {
    mockHome = ok({ authenticated: true, idolPicks: [food(1)] });
    const t = render(<IdolPicksScreen />);
    expect(metricsOf(t, 'idol-poster-1', true)).toEqual(metricsOf(t, 'idol-poster-1', false));
    expect(cellWidth(375)).toBe(161.5);
    expect(cellWidth(320)).toBe(134);
  });
});

describe('상세 V1 카드', () => {
  it('탭 = food_idol_video_open{food_id, platform, video_position:0}(URL 없음) → openWebPage(url)', () => {
    const t = render(<IdolVideoCard foodId="6" video={{ url: 'https://example.com/v/1', platform: 'youtube' }} />);
    press(t, 'idol-video-card');
    expect(mockTrack).toHaveBeenCalledWith('food_idol_video_open', { food_id: '6', platform: 'youtube', video_position: 0 });
    expect(JSON.stringify(mockTrack.mock.calls)).not.toContain('example.com');
    expect(mockOpen).toHaveBeenCalledWith('https://example.com/v/1');
  });

  it('role link · 라벨 = detail.idolVideo.a11y(플랫폼 없음) · 눌림 = CTA 색·오버레이만', () => {
    const t = render(<IdolVideoCard foodId="6" video={{ url: 'https://example.com/v/1', platform: 'tiktok' }} />);
    const card = t.root.find((n) => n.props.testID === 'idol-video-card' && n.props.accessibilityRole === 'link');
    expect(card.props.accessibilityLabel).toBe('detail.idolVideo.a11y');
    expect(JSON.stringify(t.toJSON())).not.toMatch(/tiktok|youtube/i);
    expect(metricsOf(t, 'idol-video-card', true)).toEqual(metricsOf(t, 'idol-video-card', false));
    expect(colorsOf(t, 'idol-video-card', true).some((s) => s.backgroundColor === '#BE460F')).toBe(true);
    expect(colorsOf(t, 'idol-video-card', false).some((s) => s.backgroundColor === '#BE460F')).toBe(false);
  });

  it('상세 배치 잠금: profileHint 다음·디바이더 앞, idolVideo 있을 때만 · source 화이트리스트 idol_pick', () => {
    const src = fs.readFileSync('src/app/food/[id]/index.tsx', 'utf8');
    const card = src.indexOf('{food.idolVideo && <IdolVideoCard foodId={id} video={food.idolVideo} />}');
    expect(card).toBeGreaterThan(src.indexOf("t('detail.addProfileHint')"));
    expect(card).toBeLessThan(src.indexOf('<View style={styles.thickDivider} />'));
    expect(src).toMatch(/\[[^\]]*'review_detail', 'idol_pick'\]\.includes\(src\)/);
  });
});

describe('문구 (15키 × 10로케일)', () => {
  const LOCALES = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
  const KEYS = [
    'home.idolPick.label', 'home.idolPick.title', 'home.idolPick.sub', 'home.idolPick.seeAll', 'home.idolPick.bannerA11y',
    'idolPicks.label', 'idolPicks.title', 'idolPicks.sub', 'idolPicks.cardA11y', 'idolPicks.empty',
    'detail.idolVideo.label', 'detail.idolVideo.title', 'detail.idolVideo.sub', 'detail.idolVideo.cta', 'detail.idolVideo.a11y',
  ];
  const get = (o: unknown, k: string) => k.split('.').reduce<unknown>((a, p) => (a as Record<string, unknown>)?.[p], o);
  it('모든 로케일에 15키 · 플랫폼명·PICK·이모지 0 · {{count}}/{{name}} 보간 유지 · opensIn 없음', () => {
    for (const l of LOCALES) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- 로케일 JSON 순회
      const j = require(`@/lib/i18n/${l}.json`);
      for (const k of KEYS) {
        const v = get(j, k);
        expect({ l, k, ok: typeof v === 'string' && v.trim().length > 0 }).toEqual({ l, k, ok: true });
        expect({ l, k, banned: /youtube|tiktok/i.test(v as string) || /PICK|\p{Extended_Pictographic}/u.test(v as string) }).toEqual({ l, k, banned: false });
      }
      for (const k of ['home.idolPick.sub', 'home.idolPick.seeAll', 'home.idolPick.bannerA11y']) expect({ l, k, c: (get(j, k) as string).includes('{{count}}') }).toEqual({ l, k, c: true });
      expect({ l, n: (get(j, 'idolPicks.cardA11y') as string).includes('{{name}}') }).toEqual({ l, n: true });
      expect(get(j, 'detail.idolVideo.opensIn')).toBeUndefined();
    }
  });
  it('ko·en = 01_copy_list 확정본', () => {
    const ko = require('@/lib/i18n/ko.json');
    const en = require('@/lib/i18n/en.json');
    expect(ko.home.idolPick.title).toBe('아이돌이 먹던 그 음식, 나도 한 입?');
    expect(en.home.idolPick.title).toBe('K-pop idols tried these. Want a taste?');
    expect(ko.detail.idolVideo.title).toBe('이 음식, 어떤 아이돌이 먹었을까?');
    expect(en.detail.idolVideo.cta).toBe('Watch to find out');
    expect(en.idolPicks.sub).toBe('Pick a dish to check the ingredients and find the video link.');
  });
});

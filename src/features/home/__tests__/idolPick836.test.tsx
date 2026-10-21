/**
 * KB-836 K-POP & K-FOOD (전용 API 설계, 2026-10-21) — 어댑터(GET /api/foods/idol-picks) · 요청(경로·기본 헤더) ·
 * 정적 홈 배너(KB-856 v2: 네트워크 0·번들 배경 1장·텍스트 시작 카드폭×182/320·탭 계측 id 없음·눌림 메트릭 불변) · 목록 화면(로딩·오류·0건·게스트 배지 미렌더·카드 경로·포커스 계측) ·
 * 상세 V1 카드(캐시만 구독 — 없으면 null·목록 API 미호출, 탭 = 계측 + openWebPage) · 무효화(기피 성분 변경 = 전면 invalidate) ·
 * 홈·상세 데이터 계층 무변경 · 14키 × 10로케일(KB-856 home.idolPick.sub 삭제).
 */
import * as fs from 'fs';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 0, left: 0, right: 0 }) }));
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
let mockGuest = false;
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockGuest }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { restrictions: [] } }) }));
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, apiLang: () => 'en' }));
jest.mock('@/lib/i18n/useAppLanguage', () => ({ useAppLanguage: () => 'en' }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { adaptIdolPicks, type IdolPick } from '@/lib/api/idolPickAdapter';
import { adaptMenuSummary } from '@/lib/api/foodAdapter';
import { fetchIdolPicks, idolPicksKey, useIdolPickVideo } from '@/lib/data/useIdolPicks';
import { BG_ASPECT, IdolPickBanner, textTop } from '../IdolPickBanner';
import { trackHomeCardClick } from '../homeImpressions';
import { IdolVideoCard } from '@/features/food/IdolVideoCard';
import IdolPicksScreen, { cellWidth } from '@/app/idol-picks';
import { IdolPhoto } from '../IdolPosterCard';
/* eslint-enable import/first */

// 계약 C-1 항목 모양(가짜 값 — 법무 잠금: 이름·제목 없음)
const wireItem = (id: number, extra: object = {}) => ({
  foodId: id, name: `Dish ${id}`, koreanName: `음식${id}`, imageRef: `https://cdn.example/foods/${id}.webp`, spiciness: 0,
  overallRiskStatus: 'CAUTION', publishedAt: '2026-09-02T03:00:00Z', bookmarked: false, review: { averageRating: 4.5, count: 12 },
  video: { url: `https://example.com/v/${id}`, platform: 'YOUTUBE' }, ...extra,
});
const pick = (id: number, extra: object = {}): IdolPick => adaptIdolPicks({ items: [wireItem(id, extra) as never] })[0];

let qc: QueryClient;
const trees: ReactTestRenderer[] = [];
beforeEach(() => { qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); mockGuest = false; });
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); qc.clear(); jest.clearAllMocks(); });
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); }); trees.push(t); return t; };
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
/** react-query 알림은 setTimeout 배치 — 전체 실행 부하에서도 고정 1틱에 기대지 않게 조건까지 기다린다(최대 ~1s) */
const until = async (cond: () => boolean) => { for (let i = 0; i < 100 && !cond(); i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)); }); };
const hostIds = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string').map((n) => n.props.testID as string);
const press = (t: ReactTestRenderer, id: string) => act(() => t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress());

/** 눌림 전후 — 색·불투명도를 뺀 모든 호스트 스타일 메트릭이 같아야 한다(CLAUDE.md "상태 변화는 색만") */
const COLOR_KEYS = new Set(['backgroundColor', 'opacity', 'color']);
const stylesWhen = (t: ReactTestRenderer, id: string, pressed: boolean) => {
  const fn = t.root.find((n) => n.props?.testID === id && typeof n.props?.children === 'function').props.children as (s: { pressed: boolean }) => React.ReactNode;
  const r = render(<>{fn({ pressed })}</>);
  return r.root.findAll((n) => typeof n.type === 'string').map((n) => (StyleSheet.flatten(n.props.style) ?? {}) as Record<string, unknown>);
};
const metrics = (s: Record<string, unknown>[]) => s.map((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !COLOR_KEYS.has(k))));

describe('어댑터·요청 (계약 C-1)', () => {
  it('평탄 항목 → 음식 요약(adaptMenuSummary 동일) + video · 대문자 → 소문자 · 순서 그대로', () => {
    const [a, b] = adaptIdolPicks({ items: [wireItem(491), wireItem(5, { imageRef: null, video: { url: 'https://example.com/v/5', platform: 'TIKTOK' } })] as never });
    expect(a).toEqual({ ...adaptMenuSummary(wireItem(491) as never), video: { url: 'https://example.com/v/491', platform: 'youtube' } });
    expect(b.foodId).toBe('5');
    expect(b.photoUrl).toBeNull();
    expect(b.video).toEqual({ url: 'https://example.com/v/5', platform: 'tiktok' });
  });

  it('알 수 없는 platform·빈 url·video 부재 항목은 버린다 · items 부재/null = []', () => {
    const items = [wireItem(1, { video: { url: 'https://example.com/v/1', platform: 'VIMEO' } }), wireItem(2, { video: { url: '', platform: 'YOUTUBE' } }), wireItem(3, { video: null }), wireItem(4)];
    expect(adaptIdolPicks({ items } as never).map((p) => p.foodId)).toEqual(['4']);
    expect(adaptIdolPicks({})).toEqual([]);
    expect(adaptIdolPicks({ items: null })).toEqual([]);
  });

  it('GET /foods/idol-picks?lang= — 전용 헤더 없음(기본 X-API-Version, D5)', async () => {
    mockGet.mockResolvedValueOnce({ items: [wireItem(491)] });
    const res = await fetchIdolPicks();
    expect(mockGet).toHaveBeenCalledWith('/foods/idol-picks?lang=en');
    expect(mockGet.mock.calls[0]).toHaveLength(1);
    expect(res.map((p) => p.foodId)).toEqual(['491']);
  });

  it('홈·상세 데이터 계층 무변경 — HOME_API_VERSION 1.3, idolPickFoods·idolVideo 키 없음', () => {
    expect(fs.readFileSync('src/lib/data/useHome.ts', 'utf8')).toContain("export const HOME_API_VERSION = '1.3';");
    for (const f of ['src/lib/data/useHome.ts', 'src/lib/api/foodAdapter.ts', 'src/lib/api/foodDetailTypes.ts', 'src/lib/api/types.ts']) {
      expect({ f, hit: /idolPick|idolVideo/.test(fs.readFileSync(f, 'utf8')) }).toEqual({ f, hit: false });
    }
  });
});

describe('홈 배너 (정적)', () => {
  it('네트워크 0 · 번들 배경 1장(KB-856 v2) · 콜라주·물음표·서브 없음 · count 없는 문구', () => {
    const t = render(<IdolPickBanner />);
    expect(mockGet).not.toHaveBeenCalled();
    expect(hostIds(t).some((i) => i.startsWith('idol-pick-photo-') || i === 'idol-pick-collage')).toBe(false);
    const json = JSON.stringify(t.toJSON());
    expect(json).not.toContain('home.idolPick.sub');
    expect(json).not.toContain('count');
    const src = fs.readFileSync('src/features/home/IdolPickBanner.tsx', 'utf8');
    expect(src).not.toMatch(/RemoteImage|useHome|useIdolPicks|uri:|IconQuestion|dishes\/|LinearGradient|COLLAGE/);
    expect([...src.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1])).toEqual(['../../../assets/images/idol_pick_banner_bg.jpg']);
    expect(fs.existsSync('assets/images/idol_pick_banner_bg.jpg')).toBe(true);
  });

  it('배경 Image = absolute · top/left 0 · width 100% · aspectRatio 1170/695 · cover · 장식(a11y 숨김)', () => {
    const t = render(<IdolPickBanner />);
    const bg = t.root.find((n) => n.props.testID === 'idol-pick-bg' && typeof n.type === 'string');
    expect(BG_ASPECT).toBe(1170 / 695);
    expect(StyleSheet.flatten(bg.props.style)).toMatchObject({ position: 'absolute', top: 0, left: 0, width: '100%', aspectRatio: 1170 / 695 });
    expect(bg.props.resizeMode).toBe('cover');
    expect(bg.props.accessibilityElementsHidden).toBe(true);
  });

  it.each([[360, 182], [320, 159.25]])('텍스트 블록 paddingTop = (화면폭 %d − 40) × 182/320 = %d · 좌우·아래 20 · gap 16 · 높이 고정 없음', (w, top) => {
    expect(textTop(w)).toBe(top);
    const dims = jest.spyOn(jest.requireActual('react-native'), 'useWindowDimensions').mockReturnValue({ width: w, height: 640, scale: 2, fontScale: 1 });
    const t = render(<IdolPickBanner />);
    const inner = StyleSheet.flatten(t.root.find((n) => n.props.testID === 'idol-pick-inner' && typeof n.type === 'string').props.style);
    expect(inner).toMatchObject({ paddingTop: top, paddingHorizontal: 20, paddingBottom: 20, gap: 16 });
    const banner = StyleSheet.flatten(t.root.find((n) => n.props.testID === 'idol-pick-banner' && typeof n.type === 'string').props.style);
    expect(banner.height).toBeUndefined();
    dims.mockRestore();
  });

  it('제목 = 최대 2줄 · 네이티브 축소(adjustsFontSizeToFit, minimumFontScale 0.9 → 24pt 최소 21.6) · lineHeight 34(th 기호 잘림 방지) — 로케일별 fontSize 분기 없음', () => {
    const t = render(<IdolPickBanner />);
    const title = t.root.find((n) => typeof n.type === 'string' && n.props.children === 'home.idolPick.title');
    expect(title.props).toMatchObject({ numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.9 });
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({ fontSize: 24, lineHeight: 34 });
    expect(fs.readFileSync('src/features/home/IdolPickBanner.tsx', 'utf8')).not.toMatch(/language|locale|i18n\.lang/i);
  });

  it('탭 = home_card_click{section:idol_pick, position:0}(food_id·collection_key 없음, D4) → /idol-picks · 라벨', () => {
    const t = render(<IdolPickBanner />);
    expect(t.root.find((n) => n.props.testID === 'idol-pick-banner' && n.props.accessibilityRole === 'button').props.accessibilityLabel).toBe('home.idolPick.bannerA11y');
    press(t, 'idol-pick-banner');
    expect(mockTrack.mock.calls.find((c) => c[0] === 'home_card_click')).toEqual(['home_card_click', { section: 'idol_pick', position: 0 }]);
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
    const t = render(<IdolPickBanner />);
    expect(metrics(stylesWhen(t, 'idol-pick-banner', true))).toEqual(metrics(stylesWhen(t, 'idol-pick-banner', false)));
    expect(stylesWhen(t, 'idol-pick-banner', false).some((s) => s.opacity === 0)).toBe(true);
    expect(stylesWhen(t, 'idol-pick-banner', true).some((s) => s.opacity === 0)).toBe(false);
  });
});

describe('목록 화면 /idol-picks', () => {
  it('로딩 = Shimmer 6칸 · 다크 헤더 즉시 · 데이터 전 계측 없음', () => {
    mockGet.mockReturnValueOnce(new Promise(() => {}));
    const t = render(<IdolPicksScreen />);
    expect(hostIds(t)).toContain('idol-picks-skeleton');
    expect(hostIds(t).filter((i) => i === 'shimmer')).toHaveLength(6);
    expect(hostIds(t)).toContain('idol-picks-back');
    expect(mockTrack.mock.calls.filter((c) => c[0] === 'home_idol_pick_list_view')).toEqual([]);
  });

  it('오류·캐시 없음 = QueryErrorBlock · 0건 = EmptyBlock', async () => {
    mockGet.mockRejectedValueOnce(new Error('x'));
    const a = render(<IdolPicksScreen />);
    await until(() => hostIds(a).includes('query-error-block'));
    expect(hostIds(a)).toContain('query-error-block');
    qc.setQueryData(idolPicksKey('en'), []);
    expect(hostIds(render(<IdolPicksScreen />))).toContain('idol-picks-empty');
  });

  it('게스트 = RiskBadge 미렌더 · API 순서 · 포커스 계측 count', async () => {
    mockGuest = true;
    mockGet.mockResolvedValueOnce({ items: [wireItem(491), wireItem(5), wireItem(6)] });
    const t = render(<IdolPicksScreen />);
    await until(() => hostIds(t).includes('idol-poster-6') && mockTrack.mock.calls.some((c) => c[0] === 'home_idol_pick_list_view'));
    expect(mockGet).toHaveBeenCalledWith('/foods/idol-picks?lang=en');
    expect(hostIds(t).filter((i) => /^idol-poster-\d+$/.test(i))).toEqual(['idol-poster-491', 'idol-poster-5', 'idol-poster-6']);
    expect(hostIds(t).some((i) => i.startsWith('risk-badge-'))).toBe(false);
    expect(mockTrack).toHaveBeenCalledWith('home_idol_pick_list_view', { count: 3 });
  });

  it('회원 = RiskBadge + 라벨에 위험도 · 카드 탭 → /food/{id}?src=idol_pick', () => {
    qc.setQueryData(idolPicksKey('en'), [pick(491)]);
    const t = render(<IdolPicksScreen />);
    expect(hostIds(t)).toContain('risk-badge-caution');
    const card = t.root.find((n) => n.props.testID === 'idol-poster-491' && n.props.accessibilityRole === 'button');
    expect(card.props.accessibilityLabel).toBe('idolPicks.cardA11y:{"name":"Dish 491"}, risk.caution');
    const visible = t.root.findAll((n) => typeof n.type === 'string').flatMap((n) => [n.props.accessibilityLabel, ...([] as unknown[]).concat(n.props.children)].filter((x) => typeof x === 'string'));
    expect(visible.join(' ')).not.toMatch(/example\.com|youtube/i); // 영상 URL·플랫폼은 목록에 안 보인다
    press(t, 'idol-poster-491');
    expect(mockPush).toHaveBeenCalledWith('/food/491?src=idol_pick');
  });

  it('포스터 사진 실패·없음 = 물음표 폴백 · 눌림 메트릭 불변 · 셀 폭 375 → 161.5 / 320 → 134', () => {
    qc.setQueryData(idolPicksKey('en'), [pick(1), pick(2, { imageRef: null })]);
    const t = render(<IdolPicksScreen />);
    expect(hostIds(t)).toContain('idol-photo-fallback-2');
    act(() => t.root.find((n) => n.props.testID === 'img:https://cdn.example/foods/1.webp' && typeof n.type === 'string').props.onError());
    expect(hostIds(t)).toContain('idol-photo-fallback-1');
    expect(metrics(stylesWhen(t, 'idol-poster-1', true))).toEqual(metrics(stylesWhen(t, 'idol-poster-1', false)));
    expect(cellWidth(375)).toBe(161.5);
    expect(cellWidth(320)).toBe(134);
  });
});

describe('Codex #313 P2', () => {
  it('상태바 뒤 ink 고정 면 — 스크롤과 무관하게 light 아이콘 대비 유지(높이 = insets.top, 터치 통과)', () => {
    qc.setQueryData(idolPicksKey('en'), [pick(1)]);
    const t = render(<IdolPicksScreen />);
    const scrim = t.root.find((n) => n.props.testID === 'idol-picks-status-scrim' && typeof n.type === 'string');
    expect(StyleSheet.flatten(scrim.props.style)).toMatchObject({ position: 'absolute', top: 0, height: 44, backgroundColor: '#1C1E21' });
    expect(scrim.props.pointerEvents).toBe('none');
  });

  it('목록 노출 계측 = 포커스당 1회 — 같은 포커스에서 refetch 로 count 가 바뀌어도 추가 전송 없음, 재진입이면 다시', async () => {
    qc.setQueryData(idolPicksKey('en'), [pick(1), pick(2)]);
    const t = render(<IdolPicksScreen />);
    act(() => { qc.setQueryData(idolPicksKey('en'), [pick(1), pick(2), pick(3)]); });
    await until(() => hostIds(t).includes('idol-poster-3')); // 새 count 로 리렌더된 뒤 단언
    const views = () => mockTrack.mock.calls.filter((c) => c[0] === 'home_idol_pick_list_view');
    expect(views()).toEqual([['home_idol_pick_list_view', { count: 2 }]]);
    act(() => t.unmount());
    render(<IdolPicksScreen />);
    expect(views()).toEqual([['home_idol_pick_list_view', { count: 2 }], ['home_idol_pick_list_view', { count: 3 }]]);
  });

  it('IdolPhoto: 실패 후 다른 uri 로 바뀌면 다시 시도(실패 상태가 새 사진을 가리지 않는다)', () => {
    const el = (uri: string) => <IdolPhoto uri={uri} recyclingKey="1" fallbackBg="#000" iconSize={40} style={{}} />;
    const t = render(el('https://cdn.example/a.webp'));
    act(() => t.root.find((n) => n.props.testID === 'img:https://cdn.example/a.webp' && typeof n.type === 'string').props.onError());
    expect(hostIds(t)).toContain('idol-photo-fallback-1');
    act(() => t.update(<QueryClientProvider client={qc}>{el('https://cdn.example/b.webp')}</QueryClientProvider>));
    expect(hostIds(t)).toContain('img:https://cdn.example/b.webp');
    expect(hostIds(t)).not.toContain('idol-photo-fallback-1');
  });
});

describe('상세 V1 카드', () => {
  const Probe = ({ id }: { id: string }) => {
    const v = useIdolPickVideo(id);
    return v ? <IdolVideoCard foodId={id} video={v} /> : null;
  };

  it('목록 캐시 없음 = 카드 없음 + 목록 API 미호출(D3)', async () => {
    const t = render(<Probe id="491" />);
    await flush();
    expect(t.toJSON()).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('캐시에 그 foodId 있음 = 카드 · 다른 음식 = 없음', () => {
    qc.setQueryData(idolPicksKey('en'), [pick(491)]);
    expect(hostIds(render(<Probe id="491" />))).toContain('idol-video-card');
    expect(render(<Probe id="5" />).toJSON()).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('탭 = food_idol_video_open{food_id, platform, video_position:0}(URL 없음) → openWebPage(url)', () => {
    const t = render(<IdolVideoCard foodId="6" video={{ url: 'https://example.com/v/1', platform: 'youtube' }} />);
    press(t, 'idol-video-card');
    expect(mockTrack).toHaveBeenCalledWith('food_idol_video_open', { food_id: '6', platform: 'youtube', video_position: 0 });
    expect(JSON.stringify(mockTrack.mock.calls)).not.toContain('example.com');
    expect(mockOpen).toHaveBeenCalledWith('https://example.com/v/1');
  });

  it('role link · 라벨 = detail.idolVideo.a11y(플랫폼 없음) · 눌림 = CTA 색·오버레이만', () => {
    const t = render(<IdolVideoCard foodId="6" video={{ url: 'https://example.com/v/1', platform: 'tiktok' }} />);
    expect(t.root.find((n) => n.props.testID === 'idol-video-card' && n.props.accessibilityRole === 'link').props.accessibilityLabel).toBe('detail.idolVideo.a11y');
    expect(JSON.stringify(t.toJSON())).not.toMatch(/tiktok|youtube/i);
    expect(metrics(stylesWhen(t, 'idol-video-card', true))).toEqual(metrics(stylesWhen(t, 'idol-video-card', false)));
    expect(stylesWhen(t, 'idol-video-card', true).some((s) => s.backgroundColor === '#BE460F')).toBe(true);
    expect(stylesWhen(t, 'idol-video-card', false).some((s) => s.backgroundColor === '#BE460F')).toBe(false);
  });

  it('상세 배치 잠금: profileHint 다음·디바이더 앞, 캐시 훅 값이 있을 때만 · source 화이트리스트 idol_pick', () => {
    const src = fs.readFileSync('src/app/food/[id]/index.tsx', 'utf8');
    expect(src).toContain('const idolVideo = useIdolPickVideo(id);');
    const card = src.indexOf('{idolVideo && <IdolVideoCard foodId={id} video={idolVideo} />}');
    expect(card).toBeGreaterThan(src.indexOf("t('detail.addProfileHint')"));
    expect(card).toBeLessThan(src.indexOf('<View style={styles.thickDivider} />'));
    expect(src).toMatch(/\[[^\]]*'review_detail', 'idol_pick'\]\.includes\(src\)/);
  });
});

describe('무효화', () => {
  it('기피 성분 변경 = useMe 의 전면 invalidateQueries() → [idolPicks, lang] 도 무효화(추가 코드 없음)', async () => {
    expect(fs.readFileSync('src/lib/data/useMe.ts', 'utf8')).toMatch(/patch\.restrictions !== undefined[\s\S]{0,80}void qc\.invalidateQueries\(\);/);
    qc.setQueryData(idolPicksKey('en'), [pick(491)]);
    await qc.invalidateQueries();
    expect(qc.getQueryState(idolPicksKey('en'))?.isInvalidated).toBe(true);
  });
});

describe('문구 (14키 × 10로케일)', () => {
  const LOCALES = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
  const KEYS = [
    'home.idolPick.label', 'home.idolPick.title', 'home.idolPick.seeAll', 'home.idolPick.bannerA11y',
    'idolPicks.label', 'idolPicks.title', 'idolPicks.sub', 'idolPicks.cardA11y', 'idolPicks.empty',
    'detail.idolVideo.label', 'detail.idolVideo.title', 'detail.idolVideo.sub', 'detail.idolVideo.cta', 'detail.idolVideo.a11y',
  ];
  const get = (o: unknown, k: string) => k.split('.').reduce<unknown>((a, p) => (a as Record<string, unknown>)?.[p], o);
  it('모든 로케일에 14키 · 플랫폼명·PICK·이모지·{{count}} 0 · cardA11y {{name}} 유지 · opensIn 없음', () => {
    for (const l of LOCALES) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- 로케일 JSON 순회
      const j = require(`@/lib/i18n/${l}.json`);
      for (const k of KEYS) {
        const v = get(j, k);
        expect({ l, k, ok: typeof v === 'string' && v.trim().length > 0 }).toEqual({ l, k, ok: true });
        expect({ l, k, banned: /youtube|tiktok/i.test(v as string) || /PICK|\{\{count\}\}|\p{Extended_Pictographic}/u.test(v as string) }).toEqual({ l, k, banned: false });
      }
      expect({ l, n: (get(j, 'idolPicks.cardA11y') as string).includes('{{name}}') }).toEqual({ l, n: true });
      expect(get(j, 'detail.idolVideo.opensIn')).toBeUndefined();
    }
  });
  it('ko·en = 01_copy_list 갱신본', () => {
    const ko = require('@/lib/i18n/ko.json');
    const en = require('@/lib/i18n/en.json');
    // KB-856 v2: 제목·버튼 교체, sub 삭제, ko 제목 "먹은" 뒤 \n(단어 중간 끊김 방지)
    expect(ko.home.idolPick).toEqual({ label: 'K-POP & K-FOOD', title: 'K-POP 아이돌이 먹은\n그 음식, 따라 먹어볼까?', seeAll: '둘러보기', bannerA11y: 'K-POP 아이돌이 먹은 음식 목록 보기' });
    expect(en.home.idolPick).toEqual({ label: 'K-POP & K-FOOD', title: 'That dish K-pop idols ate. Wanna try it?', seeAll: 'Explore', bannerA11y: 'View the dishes tried by K-pop idols' });
    expect(ko.detail.idolVideo.title).toBe('이 음식, 어떤 아이돌이 먹었을까?');
    expect(en.detail.idolVideo.cta).toBe('Watch to find out');
    expect(en.idolPicks.sub).toBe('Pick a dish to check the ingredients and find the video link.');
  });
});

describe('KB-856 배너 v2 문구', () => {
  const LOCALES = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- 로케일 JSON 순회
  const load = (l: string) => require(`@/lib/i18n/${l}.json`).home.idolPick as Record<string, string>;
  it('home.idolPick.sub 키 = 10로케일 어디에도 없음', () => {
    for (const l of LOCALES) expect({ l, sub: 'sub' in load(l) }).toEqual({ l, sub: false });
  });
  it('10로케일 title 금칙어 0 — 최애·좋아하·PICK·플랫폼명·이모지 · 줄바꿈 최대 1개', () => {
    const BANNED = /최애|좋아하|推し|本命|PICK|bias|favou?rite|youtube|tiktok|instagram|\p{Extended_Pictographic}/iu;
    for (const l of LOCALES) {
      const title = load(l).title;
      expect({ l, banned: BANNED.test(title) }).toEqual({ l, banned: false });
      expect({ l, breaks: (title.match(/\n/g) ?? []).length <= 1 }).toEqual({ l, breaks: true });
    }
  });
});

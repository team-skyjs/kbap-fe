/**
 * KB-1014 P-623(서버 #601·#602): 검색·둘러보기·스캔 음식 목록·홈 4섹션 카드 = FoodSummaryResponse.linkedProcessedFood 누끼 우선.
 * 바뀌는 건 사진뿐 — 이름·위험도·평점·탭 무변. 연결 없음(필드 생략) = 기존 음식 사진 그대로.
 * 북마크·아이돌 픽·선택 음식은 서버 범위 밖 = FE도 제외.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// 공식 mock(react-native-reanimated/mock)은 worklets 네이티브 초기화를 끌고 와
// jest에서 죽는다 — 카드는 reanimated를 안 쓰므로 표면만 흉내낸 인라인 mock.
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = jest.requireActual('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['springify', 'damping', 'stiffness', 'mass', 'duration', 'delay', 'easing']) b[k] = () => b;
    return b;
  };
  return {
    __esModule: true,
    useReducedMotion: () => false, // KB-772: Shimmer·Spinner
    withSpring: (v: unknown) => v,
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeIn: chain(),
    FadeOut: chain(),
    SlideInDown: chain(),
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    ZoomIn: chain(),
    ZoomOut: chain(),
    FadeInDown: chain(),
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: View };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return { LinearGradient: View };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* eslint-disable import/first -- jest.mock 뒤 */
import { FoodGridCard, RecentRow, TopRatedRow } from '@/features/food/FoodCards';
import { adaptMenuSummary, adaptTopRatedFood } from '@/lib/api/foodAdapter';
import type { FoodCard, TopRatedFood } from '@/lib/api/types';
import { readFileSync } from 'fs';
/* eslint-enable import/first */

const LINK_WIRE = { id: 2866, name: 'Coca-Cola Zero 1.5L', nameKo: '코카-콜라 제로 1.5L', imageUrl: 'https://cdn/pf/2866-cut.webp' };
const WIRE = { foodId: 930, name: 'Cola', koreanName: '콜라', imageRef: 'cola.jpg', spiciness: 0, overallRiskStatus: 'SAFE' as const, review: { averageRating: 4.5, count: 2 } };

describe('어댑터: FoodSummaryResponse.linkedProcessedFood → FoodCard.linked', () => {
  it('연결 있음 → linked(id 문자열·imageUrl) · 나머지 필드 무변', () => {
    const plain = adaptMenuSummary(WIRE);
    const c = adaptMenuSummary({ ...WIRE, linkedProcessedFood: LINK_WIRE });
    expect(c.linked).toEqual({ id: '2866', name: LINK_WIRE.name, nameKo: LINK_WIRE.nameKo, imageUrl: LINK_WIRE.imageUrl });
    expect({ ...c, linked: null }).toEqual(plain);
  });
  it('필드 생략(연결 없음) → linked null', () => {
    expect(adaptMenuSummary(WIRE).linked).toBeNull();
  });
  it('평점 높은 음식(홈 topRated)도 같은 어댑터 경유', () => {
    const w = { ...WIRE, linkedProcessedFood: LINK_WIRE, taste: 4, servingSpeed: null, staffKindness: null, overallRating: 4.5 };
    expect(adaptTopRatedFood(w).linked?.imageUrl).toBe(LINK_WIRE.imageUrl);
  });
});

type J = { children?: (J | string)[] | null } | string | null;
const leaves = (n: J | J[]): string[] => (Array.isArray(n) ? n.flatMap(leaves) : n == null ? [] : typeof n === 'string' ? [n] : leaves((n.children ?? []) as J[]));
const texts = (tr: ReactTestRenderer) => leaves(tr.toJSON() as J | J[]);
const photos = (tr: ReactTestRenderer) => tr.root.findAll((n) => typeof n.type !== 'string' && 'recyclingKey' in (n.props ?? {}) && 'uri' in (n.props ?? {})).map((n) => ({ uri: n.props.uri, cutout: n.props.cutoutUri ?? null }));
function mount(el: React.ReactElement): ReactTestRenderer {
  let tr!: ReactTestRenderer;
  act(() => {
    tr = renderer.create(el);
  });
  return tr;
}

const plainCard: FoodCard = adaptMenuSummary(WIRE);
const linkedCard: FoodCard = adaptMenuSummary({ ...WIRE, linkedProcessedFood: LINK_WIRE });
const tr = (c: FoodCard): TopRatedFood => ({ ...c, taste: 4, servingSpeed: null, staffKindness: null, overallRating: 4.5 });
const CARDS: [string, (c: FoodCard) => React.ReactElement][] = [
  ['FoodGridCard(검색 Dishes·둘러보기·홈 인기·리뷰 많은)', (c) => <FoodGridCard food={c} risk="safe" guest={false} riskLabel="risk.safe" onPress={() => {}} />],
  ['RecentRow(홈 최근 스캔·스캔 음식 목록)', (c) => <RecentRow food={c} risk="safe" reviewLabel="Review" onPress={() => {}} onReview={() => {}} />],
  ['TopRatedRow(홈 평점 높은)', (c) => <TopRatedRow food={tr(c)} risk="safe" onPress={() => {}} />],
];

describe.each(CARDS)('%s', (_name, make) => {
  it('연결 = 누끼(cutoutUri) + 음식 사진 폴백 그대로 · 연결 없음 = 누끼 0', () => {
    expect(photos(mount(make(plainCard)))).toEqual([{ uri: plainCard.photoUrl, cutout: null }]);
    expect(photos(mount(make(linkedCard)))).toEqual([{ uri: plainCard.photoUrl, cutout: LINK_WIRE.imageUrl }]);
  });
  it('카드 글자(이름·위험도·평점) = 연결 유무로 불변, 상품 이름 0', () => {
    const linked = texts(mount(make(linkedCard)));
    expect(linked).toEqual(texts(mount(make(plainCard))));
    expect(linked.join('\n')).not.toMatch(/Coca-Cola|코카-콜라/);
  });
});

describe('검색 인기 레일 · 제외 범위(소스)', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  it('인기 레일: 음식 사진이 없어도 누끼가 있으면 CardPhoto(아이콘 박스 아님)', () => {
    expect(read('src/app/search.tsx')).toContain('{f.photoUrl || f.linked?.imageUrl ? <CardPhoto uri={f.photoUrl} cutoutUri={f.linked?.imageUrl} recyclingKey={f.foodId} borderRadius={radius.md} /> : <IconFood size={22} color={C.ink3} />}');
  });
  it('아이돌 픽 포스터는 누끼 미사용(서버 범위 밖)', () => {
    expect(read('src/features/home/IdolPosterCard.tsx')).not.toContain('cutoutUri');
  });
});

/* eslint-disable import/first, @typescript-eslint/no-require-imports -- jest.mock 팩토리 안 require · 목 등록 뒤 import(레포 테스트 관례) */
/**
 * KB-802 ReviewPhotoCarousel(스냅 산식·장수별 분기·배지·실패 폴백) + ReviewTabCard(높이 메트릭 481/236 불변·본문 미렌더·탭 위임).
 */
import * as React from 'react';
import { StyleSheet } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, FlatList: require('react-native').FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedScrollHandler: () => () => {},
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    useReducedMotion: () => true,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
// 사진 탭 = PhotoViewer(RNGH) — 열림만 확인, 네이티브 없음
jest.mock('@/components/PhotoViewer', () => ({ PhotoViewer: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-router', () => ({ useSegments: () => [], useRouter: () => ({ push: jest.fn() }), usePathname: () => '/' }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o && 'index' in o ? `${o.index}/${o.total}` : k), i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('@/lib/data/useContentTranslation', () => ({ useContentTranslation: () => ({ translatedText: null, showingTranslated: false, loading: false, toggle: jest.fn() }) }));
jest.mock('@/lib/data/useReviewMutations', () => ({ useToggleReviewLike: () => ({ mutate: jest.fn() }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));

import { carouselMetrics, ReviewPhotoCarousel, snapIndex, snapOffset, PHOTO_H } from '../ReviewPhotoCarousel';
import { ReviewTabCard } from '../ReviewTabCard';
import { PEEK_REVEAL, ReviewAuthorLine } from '../ReviewCellParts';
import { FeedCard } from '../FeedCard';
import type { Review } from '@/lib/api/types';

const t = (k: string) => k;
const P3 = ['https://cdn/a.jpg', 'https://cdn/b.jpg', 'https://cdn/c.jpg'];
const REVIEW = {
  id: 'r1', foodId: '7', rating: 4, servingSpeed: 0, staffKindness: 3, body: 'Great dish', photos: P3,
  foodName: 'Seolleongtang', foodKoreanName: '설렁탕', foodImageUrl: 'https://cdn/f.jpg',
  author: { memberId: '9', nickname: 'Amy', nationality: 'US', tier: 'taster', level: 2 },
  authorNationality: 'US', authorRankTier: 'taster', anonymized: false, createdAt: '2026-10-16T00:00:00Z', likes: 34, myLike: false,
} as Review;

const mounted: ReactTestRenderer[] = [];
afterEach(() => act(() => mounted.splice(0).forEach((m) => m.unmount()))); // useReviewTime 타이머 정리
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  mounted.push(tree);
  return tree;
}
const byId = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.type !== 'string');
const texts = (tree: ReactTestRenderer) => tree.root.findAll((n) => typeof n.type === 'string' && typeof n.props?.children === 'string').map((n) => n.props.children as string);

describe('스냅 산식 (사진 311 · 간격 8 · 인셋 20 · peek 36)', () => {
  it('375 이상 = 디자인 수치 311/319, 더 넓어도 311 · 좁은 화면(320) = 가용 폭으로 축소', () => {
    expect(carouselMetrics(375)).toEqual({ photoW: 311, snap: 319 });
    expect(carouselMetrics(430)).toEqual({ photoW: 311, snap: 319 });
    expect(carouselMetrics(320)).toEqual({ photoW: 256, snap: 264 });
    // 320: 인셋 20 + 사진 256 + 간격 8 + peek 36 = 320 → 잘림 없이 다음 사진 36 노출
    expect(20 + 256 + 8 + 36).toBe(320);
  });
  it('375: 첫 장 0 · 둘째 319 · 마지막 장은 오른쪽 여백 20 에 붙게 클램프', () => {
    // 3장 콘텐츠 = 20+311·3+8·2+20 = 989 → 최대 오프셋 614(< 638) — 이전 사진 36pt peek
    expect([0, 1, 2].map((i) => snapOffset(i, 3, 375, 311))).toEqual([0, 319, 614]);
    expect(375 - 20 - 311 - 8).toBe(36); // 첫 장의 다음 사진 peek = 마지막 장의 이전 사진 peek
    // 2장 = 670 → 최대 295
    expect([0, 1].map((i) => snapOffset(i, 2, 375, 311))).toEqual([0, 295]);
  });
  it('320: 오프셋도 축소 폭으로 — 마지막 장 왼쪽 peek 36 · 오른쪽 여백 20', () => {
    // 3장 콘텐츠 = 40+256·3+16 = 824 → 최대 504
    expect([0, 1, 2].map((i) => snapOffset(i, 3, 320, 256))).toEqual([0, 264, 504]);
    expect(824 - 504 - 320).toBe(0);
    expect(snapIndex(504, 3, 264)).toBe(2);
  });
  it('오프셋 → 현재 장(클램프된 마지막 오프셋도 마지막 장)', () => {
    expect(snapIndex(0, 3, 319)).toBe(0);
    expect(snapIndex(319, 3, 319)).toBe(1);
    expect(snapIndex(614, 3, 319)).toBe(2);
    expect(snapIndex(295, 2, 319)).toBe(1);
    expect(snapIndex(-30, 3, 319)).toBe(0); // 바운스
    expect(snapIndex(9999, 3, 319)).toBe(2);
  });
});

describe('ReviewPhotoCarousel', () => {
  it('0장 = 렌더 없음', () => {
    expect(render(<ReviewPhotoCarousel photos={[]} onPressPhoto={jest.fn()} />).toJSON()).toBeNull();
  });

  it('1장 = 부모 폭 × 233 단일 사진 · 스크롤·배지 없음', () => {
    const onPress = jest.fn();
    const tree = render(<ReviewPhotoCarousel photos={['https://cdn/a.jpg']} onPressPhoto={onPress} testID="c" />);
    expect(byId(tree, 'c-list')).toHaveLength(0);
    expect(byId(tree, 'review-photo-badge')).toHaveLength(0);
    act(() => byId(tree, 'c-0')[0].props.onPress());
    expect(onPress).toHaveBeenCalledWith(0);
  });

  it('3장 = snap 319 · fast · 한 번에 한 장 · pagingEnabled·자동 넘김·점 없음, 배지는 현재 장에만', () => {
    const onIndex = jest.fn();
    const onPress = jest.fn();
    const tree = render(<ReviewPhotoCarousel photos={P3} onIndexChange={onIndex} onPressPhoto={onPress} testID="c" />);
    const list = byId(tree, 'c-list')[0];
    expect(list.props).toMatchObject({ horizontal: true, snapToInterval: 319, decelerationRate: 'fast', disableIntervalMomentum: true });
    expect(list.props.pagingEnabled).toBeUndefined();
    expect(StyleSheet.flatten(list.props.style)).toMatchObject({ marginHorizontal: -20, height: PHOTO_H });
    expect(StyleSheet.flatten(list.props.contentContainerStyle)).toMatchObject({ paddingHorizontal: 20, gap: 8 });
    expect(byId(tree, 'review-photo-badge')).toHaveLength(1);
    expect(texts(tree)).toContain('1/3');
    act(() => list.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 614 } } }));
    expect(onIndex).toHaveBeenCalledWith(2);
    expect(byId(tree, 'review-photo-badge')).toHaveLength(1); // 즉시 이동(복수 렌더 없음)
    expect(texts(tree)).toContain('3/3');
    act(() => byId(tree, 'c-1')[0].props.onPress());
    expect(onPress).toHaveBeenCalledWith(1);
  });

  it('initialIndex = 그 장에서 시작(상세 이어받기)', () => {
    const tree = render(<ReviewPhotoCarousel photos={P3} initialIndex={2} onPressPhoto={jest.fn()} testID="c" />);
    expect(byId(tree, 'c-list')[0].props.initialScrollIndex).toBe(2);
    expect(texts(tree)).toContain('3/3');
  });

  it('사진 실패 = surface2 + IconGallery 폴백(음식 기본 이미지 아님), 같은 칸 크기', () => {
    const tree = render(<ReviewPhotoCarousel photos={['https://cdn/a.jpg']} onPressPhoto={jest.fn()} />);
    const img = tree.root.findAll((n) => typeof n.props?.onError === 'function')[0];
    act(() => img.props.onError());
    const fb = byId(tree, 'review-photo-fallback')[0] ?? tree.root.findAll((n) => n.props?.testID === 'review-photo-fallback')[0];
    expect(StyleSheet.flatten(fb.props.style)).toMatchObject({ height: 233, backgroundColor: '#F7F8FA' });
    expect(tree.root.findAll((n) => n.props?.source != null)).toHaveLength(0);
  });
});

describe('ReviewPhotoCarousel — Codex #288 반영', () => {
  it('1장 실패 뒤 URI 가 바뀌면 새 사진을 다시 로드(실패 상태 리셋)', () => {
    const tree = render(<ReviewPhotoCarousel photos={['https://cdn/a.jpg']} onPressPhoto={jest.fn()} />);
    act(() => tree.root.findAll((n) => typeof n.props?.onError === 'function')[0].props.onError());
    expect(tree.root.findAll((n) => n.props?.testID === 'review-photo-fallback')).not.toHaveLength(0);
    act(() => tree.update(<ReviewPhotoCarousel photos={['https://cdn/b.jpg']} onPressPhoto={jest.fn()} />));
    expect(tree.root.findAll((n) => n.props?.testID === 'review-photo-fallback')).toHaveLength(0);
    expect(tree.root.findAll((n) => n.props?.source?.uri === 'https://cdn/b.jpg')).not.toHaveLength(0);
  });

  it('사진이 줄면(3→2) 현재 장 클램프 — 배지·접근성 값·activate 가 없는 장을 가리키지 않음', () => {
    const onPress = jest.fn();
    const el = (photos: string[]) => <ReviewPhotoCarousel photos={photos} initialIndex={2} onPressPhoto={onPress} a11yLabel="A" testID="c" />;
    const tree = render(el(P3));
    act(() => tree.update(el(P3.slice(0, 2))));
    const adj = tree.root.findAll((n) => n.props?.testID === 'c' && n.props?.accessibilityRole === 'adjustable')[0];
    expect(adj.props.accessibilityValue).toEqual({ text: '2/2' });
    expect(byId(tree, 'review-photo-badge')).toHaveLength(1);
    act(() => adj.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    expect(onPress).toHaveBeenCalledWith(1);
  });

  it('initialIndex 가 바뀌면 그 장으로', () => {
    const el = (i: number) => <ReviewPhotoCarousel photos={P3} initialIndex={i} onPressPhoto={jest.fn()} a11yLabel="A" testID="c" />;
    const tree = render(el(0));
    act(() => tree.update(el(1)));
    const adj = tree.root.findAll((n) => n.props?.testID === 'c' && n.props?.accessibilityRole === 'adjustable')[0];
    expect(adj.props.accessibilityValue).toEqual({ text: '2/3' });
  });

  it('접근성 — 1장 = button + activate 만 · 2장 이상 = adjustable + increment/decrement/activate', () => {
    const one = render(<ReviewPhotoCarousel photos={['https://cdn/a.jpg']} onPressPhoto={jest.fn()} a11yLabel="A" testID="c" />);
    const btn = one.root.findAll((n) => n.props?.testID === 'c' && n.props?.accessibilityRole != null)[0];
    expect(btn.props.accessibilityRole).toBe('button');
    expect(btn.props.accessibilityActions).toEqual([{ name: 'activate' }]);
    const many = render(<ReviewPhotoCarousel photos={P3} onPressPhoto={jest.fn()} a11yLabel="A" testID="c" />);
    const adj = many.root.findAll((n) => n.props?.testID === 'c' && n.props?.accessibilityRole != null)[0];
    expect(adj.props.accessibilityRole).toBe('adjustable');
    expect(adj.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['increment', 'decrement', 'activate']);
  });
});

describe('ReviewTabCard', () => {
  const card = (r: Partial<Review> = {}) => {
    const onOpen = jest.fn();
    const onOpenFood = jest.fn();
    const tree = render(<ReviewTabCard review={{ ...REVIEW, ...r } as Review} t={t} onOpen={onOpen} onOpenFood={onOpenFood} />);
    return { tree, onOpen, onOpenFood };
  };
  const root = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props?.testID === 'review-card-r1' && typeof n.props?.style === 'function')[0];

  it('높이 메트릭 = 사진 없음 236 + 사진(peek 타일 폭×3/4 + gap) (구분선은 절대 위치 — 높이 밖)', () => {
    const { tree } = card();
    act(() => byId(tree, 'photo-peek')[0].props.onLayout({ nativeEvent: { layout: { width: 335 } } }));
    const st = StyleSheet.flatten(root(tree).props.style({ pressed: false }));
    const gap = st.gap as number;
    const chip = StyleSheet.flatten(byId(tree, 'feed-food-r1')[0].props.style);
    const rows = tree.root.findAll((n) => n.props?.testID === 'review-rating-line' && typeof n.type === 'string').map((n) => StyleSheet.flatten(n.props.style).height as number);
    const footer = StyleSheet.flatten(byId(tree, 'review-card-read-r1')[0].props.style);
    const ratingH = rows.reduce((a, b) => a + b, 0) + 4 * (rows.length - 1);
    const AUTHOR = 24;
    const base = (st.paddingTop as number) + AUTHOR + gap + (chip.height as number) + gap + ratingH + gap + (footer.marginTop as number) + (footer.height as number) + (st.paddingBottom as number);
    expect(ratingH).toBe(68);
    expect(base).toBe(236);
    const tileW = 335 - PEEK_REVEAL;
    const photo = StyleSheet.flatten(byId(tree, 'photo-0')[0].findAll((n) => n.props?.uri)[0].props.style);
    expect(photo).toMatchObject({ width: tileW, height: (tileW * 3) / 4 });
    expect(base + photo.height + gap).toBe(236 + 221.25 + 12);
    const divider = tree.root.findAll((n) => n.props?.pointerEvents === 'none' && StyleSheet.flatten(n.props.style)?.height === 1)[0];
    expect(StyleSheet.flatten(divider.props.style)).toMatchObject({ position: 'absolute', bottom: 0 });
  });

  it('상태가 바뀌어도 메트릭 불변 — 눌림(배경만)·부제 없음(칩 48)·평점 0(빈 별 + —)', () => {
    const a = card();
    const b = card({ foodKoreanName: null, rating: 0, servingSpeed: 0, staffKindness: 0, photos: [] });
    const strip = (s: Record<string, unknown>) => {
      const { backgroundColor: _bg, ...rest } = s;
      return rest;
    };
    const s0 = StyleSheet.flatten(root(a.tree).props.style({ pressed: false }));
    const s1 = StyleSheet.flatten(root(a.tree).props.style({ pressed: true }));
    expect(strip(s1)).toEqual(strip(s0));
    expect(s1.backgroundColor).not.toBe(s0.backgroundColor);
    expect(StyleSheet.flatten(byId(b.tree, 'feed-food-r1')[0].props.style)).toEqual(StyleSheet.flatten(byId(a.tree, 'feed-food-r1')[0].props.style));
    const rowH = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props?.testID === 'review-rating-line' && typeof n.type === 'string').map((n) => StyleSheet.flatten(n.props.style).height);
    expect(rowH(b.tree)).toEqual(rowH(a.tree));
    expect(texts(b.tree).filter((x) => x === '—')).toHaveLength(3); // 3축 항상 — 미입력 숨기지 않음
    expect(texts(a.tree).filter((x) => x === '—')).toHaveLength(1); // 속도 0 만
    expect(texts(a.tree)).toContain('설렁탕');
    expect(texts(b.tree)).not.toContain('설렁탕');
  });

  it('본문·⋯·Helpful 버튼·장소 없음 — 도움돼요 수는 표시만', () => {
    const { tree } = card();
    expect(texts(tree)).not.toContain('Great dish');
    expect(tree.root.findAll((n) => n.props?.testID === 'helpful-r1')).toHaveLength(0);
    expect(tree.root.findAll((n) => n.props?.testID === 'feed-more-r1')).toHaveLength(0);
    expect(texts(tree)).toContain('reviews.helpful');
  });

  it('탭 위임 — 카드·리뷰 읽기 = onOpen · 사진 = 뷰어(상세 이동 아님, KB-817 스트립 그대로) · 음식 칩 = onOpenFood', () => {
    const { tree, onOpen, onOpenFood } = card();
    act(() => root(tree).props.onPress());
    expect(onOpen).toHaveBeenLastCalledWith('card');
    act(() => byId(tree, 'review-card-read-r1')[0].props.onPress());
    expect(onOpen).toHaveBeenLastCalledWith('read');
    expect(byId(tree, 'photo-peek').length).toBeGreaterThan(0);
    act(() => byId(tree, 'photo-2')[0].props.onPress());
    expect(onOpen).toHaveBeenCalledTimes(2);
    act(() => byId(tree, 'feed-food-r1')[0].props.onPress());
    expect(onOpenFood).toHaveBeenCalled();
  });

  it('접근성 — 카드는 한 요소로 묶지 않음 · 리뷰 읽기 = 대표 버튼 · 사진·평점 숨김', () => {
    const { tree } = card();
    expect(root(tree).props.accessible).toBe(false);
    const read = byId(tree, 'review-card-read-r1')[0];
    expect(read.props.accessibilityRole).toBe('button');
    expect(read.props.accessibilityLabel).toContain('reviews.cardA11y');
    expect(read.props.accessibilityLabel).toContain('reviews.cardA11yDetail');
    const hidden = tree.root.findAll((n) => n.props?.importantForAccessibility === 'no-hide-descendants' && n.props?.accessibilityElementsHidden === true && typeof n.type === 'string');
    expect(hidden.some((h) => h.findAll((n) => n.props?.testID === 'review-card-photo-r1').length > 0)).toBe(true);
    expect(hidden.some((h) => h.findAll((n) => n.props?.testID === 'review-rating-line').length > 0)).toBe(true);
  });
});

describe('Codex #288: 작성자 줄 flex — 세로 컬럼에서 늘거나 접히지 않음', () => {
  it('ReviewAuthorLine 루트엔 flex 없음 · FeedCard 는 행 래퍼(flex 1)로 가로 몫만 준다', () => {
    const line = render(<ReviewAuthorLine review={REVIEW} t={t} />);
    const root = line.root.findAll((n) => typeof n.type === 'string')[0];
    expect(StyleSheet.flatten(root.props.style).flex).toBeUndefined();
    const fc = render(<FeedCard review={REVIEW} t={t} mine={false} onOpenFood={() => {}} onGuestHelpful={() => {}} onMore={() => {}} />);
    const host = fc.root.findAll((n) => typeof n.type === 'string');
    const wrapper = host.find((n) => n.findAll((c) => c.props?.testID === 'feed-flag-r1').length > 0 && StyleSheet.flatten(n.props.style)?.flex === 1);
    expect(StyleSheet.flatten(wrapper!.props.style)).toEqual({ flex: 1, minWidth: 0 });
  });
});

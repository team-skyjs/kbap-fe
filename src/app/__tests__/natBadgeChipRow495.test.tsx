/**
 * P-340(KB-495) — ① 리뷰 작성자 국기 배지(1-B) ② 음식 탭 칩 한 줄 고정(2-A) 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// KB-679: 리뷰 본문 = 공용 ReviewBody → 번역 훅(react-query). 이 스위트는 Provider 없이 렌더하므로 훅만 목(원문 표시 상태)
jest.mock('@/lib/data/useContentTranslation', () => ({ useContentTranslation: () => ({ translatedText: null, showingTranslated: false, loading: false, toggle: jest.fn() }) }));
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: (p: Record<string, unknown>) => <View {...p} testID="chip-fade" /> };
});
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  useFocusEffect: () => {},
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '9', restrictions: [] } }) }));
jest.mock('@/lib/data/useFoods', () => ({ useInfiniteFoods: () => ({ data: [], isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() }) }));
jest.mock('@/lib/data/bookmarks', () => ({ useSavedIds: () => ({ ids: new Set<string>(), ready: true }),
  useBookmarks: () => ({ data: [], hasNextPage: false, isFetchingNextPage: false, isFetching: false, fetchNextPage: jest.fn() }),
  useToggleBookmark: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/data/useReviewMutations', () => ({ useToggleReviewLike: () => ({ mutate: jest.fn() }) }));
jest.mock('@/lib/analytics', () => ({ EVENTS: new Proxy({}, { get: (_t, k) => String(k) }), track: jest.fn() }));

import { FeedCard } from '@/features/review/FeedCard';
// eslint-disable-next-line import/first -- jest.mock 선언 뒤(팩토리 호이스팅) — 레포 관례
import { CHIP_FADE_W, FoodExplorer, chipRowHeight } from '@/features/food/FoodExplorer';
// eslint-disable-next-line import/first -- 위와 같음
import { FEEDBACK_FAB_GAP, FEEDBACK_FAB_H, feedbackListBottomPad } from '@/app/profile/feedback/index';
// eslint-disable-next-line import/first -- 위와 같음
import * as fs from 'fs';
// eslint-disable-next-line import/first -- 위와 같음
import { ScrollView, StyleSheet } from 'react-native';
// eslint-disable-next-line import/first -- 위와 같음
import { AuthGateSheet } from '@/components/AuthGateSheet';
import type { Review } from '@/lib/api/types';

const REVIEW = {
  id: 'r1', foodId: '7', rating: 4, body: 'Great', photos: [], memberId: '5',
  foodName: 'Kimbap', foodImageUrl: null,
  author: { memberId: '5', nickname: 'Amy', nationality: 'US', tier: 'taster', level: 2 },
  authorNationality: 'US', authorRankTier: 'taster', anonymized: false,
  createdAt: '2026-08-11T00:00:00Z', likes: 3, myLike: false,
} as unknown as Review;

const t = (k: string) => k;

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  return tree;
}

it('1-B 국기 배지 — 국적 있으면 아바타 우하단 렌더(장식 — 무음) · 탈퇴/국적 null = 없음', () => {
  const on = render(<FeedCard review={REVIEW} t={t} mine={false} onOpenFood={() => {}} onMore={() => {}} />);
  const badge = on.root.findAll((n) => n.props?.testID === 'feed-flag-r1')[0];
  expect(badge).toBeTruthy();
  // Codex #101 P2: 배지 = 장식(스크린리더 무음) — 국가명 라벨 없음(10로케일 미도입)
  expect(badge.props.accessibilityElementsHidden).toBe(true);
  expect(JSON.stringify(on.toJSON())).not.toContain('United States');

  const anon = render(<FeedCard review={{ ...REVIEW, anonymized: true } as Review} t={t} mine={false} onOpenFood={() => {}} onMore={() => {}} />);
  expect(anon.root.findAll((n) => n.props?.testID === 'feed-flag-r1')).toHaveLength(0);
  const noNat = render(<FeedCard review={{ ...REVIEW, authorNationality: null } as unknown as Review} t={t} mine={false} onOpenFood={() => {}} onMore={() => {}} />);
  expect(noNat.root.findAll((n) => n.props?.testID === 'feed-flag-r1')).toHaveLength(0);
});

it('1-B 소스 잠금 — FlagEmoji = 국기 한정 이모지 예외 주석 + 흰 링 배지 스타일', () => {
  const fc = require('fs').readFileSync('src/features/review/FeedCard.tsx', 'utf8') as string;
  expect(fc).toContain('국기 한정 헌법 이모지 예외');
  expect(fc).toMatch(/flagBadge: \{ position: 'absolute', right: -2, bottom: -2, width: 14, height: 14/);
});

it('2-A 음식 탭 칩 = 한 줄 가로 스크롤 + 우측 페이드 + 정렬 버튼 스크롤 밖 · 홈은 무변', () => {
  const tree = render(<FoodExplorer variant="screen" guest={false} srcTag="list" />);
  const scroll = tree.root.findAll((n) => n.props?.testID === 'food-chip-scroll')[0];
  expect(scroll).toBeTruthy();
  expect(scroll.props.horizontal).toBe(true);
  // KB-707: 끝 페이드는 오른쪽에 숨은 칩이 있을 때만(아래 KB-707 테스트) — 넘칠 때 나타난다
  act(() => scroll.props.onLayout({ nativeEvent: { layout: { width: 200, height: 34 } } }));
  act(() => scroll.props.onContentSizeChange(420, 34));
  expect(tree.root.findAll((n) => n.props?.testID === 'chip-fade').length).toBeGreaterThanOrEqual(1);
  // 정렬 버튼은 스크롤 밖(형제) — 스크롤 서브트리에 미포함
  expect(scroll.findAll((n: { props?: { testID?: string } }) => n.props?.testID === 'food-sort')).toHaveLength(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'food-sort').length).toBeGreaterThanOrEqual(1);
  // 홈 embedded = 구 chipRow 유지(스크롤 없음)
  const home = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  expect(home.root.findAll((n) => n.props?.testID === 'food-chip-scroll')).toHaveLength(0);
  // 행 높이 고정 소스 잠금(칩 34 + pad 14/12 + 헤어라인)
  const fx = require('fs').readFileSync('src/features/food/FoodExplorer.tsx', 'utf8') as string;
  expect(fx).toMatch(/chipRowScreen: \{[^}]*paddingTop: 14, paddingBottom: 12[^}]*borderBottomColor: '#EAEBEE'/);
  expect(fx).toContain('export const CHIP_ROW_H = 34'); // KB-708: 기본 크기 줄 높이 34 그대로(큰 글자에서만 늘어남 — chipRowHeight)
});

it('2-A 파라미터 진입 — 선택 칩이 뒤쪽이면 마운트 시 scrollTo', () => {
  const scrollToSpy = jest.fn();
  const { ScrollView } = require('react-native');
  const orig = ScrollView.prototype.scrollTo;
  ScrollView.prototype.scrollTo = scrollToSpy;
  try {
    const tree = render(<FoodExplorer variant="screen" guest={false} initialSaved srcTag="list" />);
    expect(scrollToSpy).toHaveBeenCalledWith({ x: expect.any(Number), animated: false });
    // Codex #101 P2 ③: 마운트 유지 중 파라미터 재동기화에도 재실행
    scrollToSpy.mockClear();
    act(() => { tree.update(<FoodExplorer variant="screen" guest={false} initialRisk="caution" paramsKey="t2" srcTag="list" />); });
    expect(scrollToSpy).toHaveBeenCalled();
  } finally {
    ScrollView.prototype.scrollTo = orig;
  }
});

// ── KB-707(P-446) 작은 화면·긴 언어 — 가려지거나 잘리는 요소
describe('KB-707', () => {
  const fade = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'chip-fade').length > 0;
  it('(1) Food 탭 칩 줄 — 스크롤 영역은 정렬 버튼 왼쪽에서 끝 · 끝 여백 = 페이드 폭 · 페이드는 오른쪽에 숨은 칩이 있을 때만(끝까지 밀면 사라져 마지막 칩을 안 덮음)', () => {
    const tree = render(<FoodExplorer variant="screen" guest={false} srcTag="list" />);
    const scroll = tree.root.findAll((n) => n.props?.testID === 'food-chip-scroll')[0];
    expect(scroll.findAll((n: { props?: { testID?: string } }) => n.props?.testID === 'food-sort')).toHaveLength(0); // 버튼 아래로 안 깔림
    const pad = (StyleSheet.flatten(scroll.props.contentContainerStyle) as { paddingRight?: number }).paddingRight;
    expect(pad).toBe(CHIP_FADE_W); // 옛 8 < 페이드 24 → 끝까지 밀어도 마지막 칩 끝이 페이드에 덮였다
    // SE(375) en: 뷰포트 ~230 · 칩 줄 ~430 → 넘침 = 페이드(더 있다)
    act(() => scroll.props.onLayout({ nativeEvent: { layout: { width: 230, height: 34 } } }));
    act(() => scroll.props.onContentSizeChange(430, 34));
    expect(fade(tree)).toBe(true);
    // 끝까지 밀면(마지막 칩 = Saved·Caution 도달) 페이드가 사라진다
    act(() => scroll.props.onScroll({ nativeEvent: { contentOffset: { x: 200, y: 0 } } }));
    expect(fade(tree)).toBe(false);
    // 중간 = 다시 표시
    act(() => scroll.props.onScroll({ nativeEvent: { contentOffset: { x: 100, y: 0 } } }));
    expect(fade(tree)).toBe(true);
    // 다 들어가는 넓은 화면·짧은 언어 = 페이드 없음
    act(() => scroll.props.onContentSizeChange(220, 34));
    act(() => scroll.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 0 } } }));
    expect(fade(tree)).toBe(false);
  });

  it('(2) 홈 세그먼트 세 탭 = 가로 스크롤 안(줄이지 않고 도달 가능 — ru·id에서 셋째 탭이 화면 밖으로 잘렸다)', () => {
    const tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
    const tabs = tree.root.findAll((n) => n.props?.testID === 'home-tabs-scroll')[0];
    expect(tabs).toBeTruthy();
    expect(tabs.props.horizontal).toBe(true);
    for (const k of ['popular', 'saved', 'food']) expect(tabs.findAll((n: { props?: { testID?: string } }) => n.props?.testID === `home-tab-${k}`).length).toBeGreaterThan(0);
  });

  it('(2) #235 공부: 잘린 탭을 누르면 화면 안으로(셋째 = 끝까지 · 그 밖 = 보이게) · 오른쪽에 숨은 탭이 있을 때만 끝 페이드(칩 줄과 같은 판정)', () => {
    const toEnd = jest.spyOn(ScrollView.prototype as unknown as { scrollToEnd: () => void }, 'scrollToEnd').mockImplementation(() => {});
    const to = jest.spyOn(ScrollView.prototype as unknown as { scrollTo: (o: unknown) => void }, 'scrollTo').mockImplementation(() => {});
    try {
      const tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
      const tabs = tree.root.findAll((n) => n.props?.testID === 'home-tabs-scroll')[0];
      const tab = (k: string) => tree.root.findAll((n) => n.props?.testID === `home-tab-${k}` && typeof n.props?.onPress === 'function')[0];
      // ru: 뷰포트 300 · 줄 420 → 넘침 = 페이드
      act(() => tabs.props.onLayout({ nativeEvent: { layout: { width: 300, height: 40 } } }));
      act(() => tabs.props.onContentSizeChange(420, 40));
      expect(tree.root.findAll((n) => n.props?.testID === 'home-tabs-fade').length).toBeGreaterThan(0);
      act(() => tab('popular').props.onLayout({ nativeEvent: { layout: { x: 16, y: 0, width: 150, height: 40 } } }));
      act(() => tab('saved').props.onLayout({ nativeEvent: { layout: { x: 170, y: 0, width: 110, height: 40 } } }));
      act(() => tab('food').props.onLayout({ nativeEvent: { layout: { x: 284, y: 0, width: 120, height: 40 } } }));
      act(() => tab('food').props.onPress());
      expect(toEnd).toHaveBeenCalledTimes(1); // 셋째 = 끝까지
      // 끝까지 민 상태에서 첫 탭 = 왼쪽이 잘림 → 보이게
      act(() => tabs.props.onScroll({ nativeEvent: { contentOffset: { x: 120, y: 0 } } }));
      expect(tree.root.findAll((n) => n.props?.testID === 'home-tabs-fade')).toHaveLength(0); // 끝 = 페이드 없음
      act(() => tab('popular').props.onPress());
      expect(to).toHaveBeenLastCalledWith({ x: 0, animated: true });
      // 이미 다 보이는 탭 = 스크롤 0
      to.mockClear();
      act(() => tabs.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 0 } } }));
      act(() => tab('saved').props.onPress());
      expect(to).not.toHaveBeenCalled();
    } finally {
      toEnd.mockRestore();
      to.mockRestore();
    }
  });

  it('(1)(2) #235 공부: 가로 줄은 다 들어가도 튕기지 않는다 — iOS 바운스 끔 · Android 오버스크롤 끔(칩 줄·홈 탭 둘 다)', () => {
    const screen = render(<FoodExplorer variant="screen" guest={false} srcTag="list" />);
    const home = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
    for (const sv of [screen.root.findAll((n) => n.props?.testID === 'food-chip-scroll')[0], home.root.findAll((n) => n.props?.testID === 'home-tabs-scroll')[0]]) {
      expect(sv.props.alwaysBounceHorizontal).toBe(false);
      expect(sv.props.overScrollMode).toBe('never');
    }
  });

  it('(3) 떠 있는 버튼 + 스크롤 목록 — 목록 끝 여백 ≥ 버튼 윗변 + 16(마지막 항목이 버튼 위로 올라온다)', () => {
    // 문의 목록: 알약 바닥 = 인셋 + 24, 높이 52 → 끝 여백이 인셋을 따라간다(옛 고정 96 < 34 + 24 + 52 = 110)
    for (const inset of [0, 21, 34]) expect(feedbackListBottomPad(inset)).toBeGreaterThanOrEqual(inset + FEEDBACK_FAB_GAP + FEEDBACK_FAB_H + 16);
    // 리뷰 피드: 버튼 bottom 18 · 높이 8+20+8 = 36 → 윗변 54, 끝 여백 96
    const rf = fs.readFileSync('src/features/community/ReviewFeed.tsx', 'utf8');
    expect(rf).toMatch(/paddingBottom: 96, flexGrow: 1/);
    expect(rf).toMatch(/fab: \{\s*position: 'absolute',\s*right: 14,\s*bottom: 18,[\s\S]*?paddingVertical: 8,/);
    expect(96).toBeGreaterThanOrEqual(18 + 8 * 2 + 20 + 16);
    // 커뮤니티: 버튼 bottom 18 · 높이 54 → 윗변 72, 끝 여백 96
    const cm = fs.readFileSync('src/app/(tabs)/community.tsx', 'utf8');
    expect(cm).toMatch(/fab: \{ position: 'absolute', right: 18, bottom: 18, width: 54, height: 54/);
    expect(cm).toMatch(/paddingBottom: 96, flexGrow: 1/);
    expect(96).toBeGreaterThanOrEqual(18 + 54 + 16);
  });

  it('(4) 프로필 게스트 로그인·Edit 버튼 = 최소 68 + 좌우 여백 12(고정 폭 아님 — vi·th·ja 글자가 테두리에 닿았다)', () => {
    const pf = fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8');
    expect(pf).toMatch(/editBtn: \{ minWidth: 68, paddingHorizontal: 12,/);
    expect(pf).not.toMatch(/editBtn: \{[^}]*\bwidth: 68/);
  });

  it('(5) 잘림 — 국적 영문명(온보딩 타일·프로필)·랭킹 이름 = 두 줄까지', () => {
    expect(fs.readFileSync('src/app/onboarding/index.tsx', 'utf8')).toContain('<Text style={styles.natSub} numberOfLines={2}>{c.name}</Text>');
    expect(fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8')).toMatch(/<Text style=\{styles\.natText\} numberOfLines=\{2\} testID="nation-pill">/);
    const rk = fs.readFileSync('src/app/profile/ranking.tsx', 'utf8');
    expect(rk).toMatch(/<Text style=\{styles\.rankName\} numberOfLines=\{2\}>/);
    expect(rk).toMatch(/rankName: \{[^}]*textAlign: 'center'/);
  });

  it('(5) #235 Codex: 두 줄 이름에서 랭킹 카드가 넘치지 않게 — 고정 높이 0(최소 높이 = 시안 145·129 한 줄 기준) · 줄 안 stretch', () => {
    const rk = fs.readFileSync('src/app/profile/ranking.tsx', 'utf8');
    const styleBlock = rk.slice(rk.indexOf('rankGrid:'), rk.indexOf('rankCardNow:'));
    expect(styleBlock).not.toMatch(/(^|[^a-zA-Z])height: \d/); // 고정 높이 없음
    expect(styleBlock).toMatch(/rankCard: \{[^}]*minHeight: 145/);
    expect(styleBlock).toMatch(/rankCardRow2: \{ minHeight: 129 \}/);
    expect(styleBlock).toMatch(/rankCardFull: \{[^}]*minHeight: 129/);
    expect(styleBlock).toMatch(/rankGrid: \{[^}]*alignItems: 'stretch'/);
  });
});

// ── KB-708 (1) 게스트 위험도 칩 게이트 = 판정 문구(risk) · 북마크·Saved 칩 = 저장 문구(save)
describe('KB-708 (1)', () => {
  it('게스트: 위험도 칩(홈·Food 탭) → 게이트 context risk · Saved 칩 → save · 닫으면 닫힘', () => {
    for (const variant of ['embedded', 'screen'] as const) {
      const tree = render(<FoodExplorer variant={variant} guest srcTag={variant === 'embedded' ? 'home' : 'list'} />);
      const gate = () => tree.root.findAllByType(AuthGateSheet)[0].props as { context: string; open: boolean; onClose: () => void };
      expect(gate().open).toBe(false);
      act(() => tree.root.findAll((n) => n.props?.testID === 'home-chip-safe' && typeof n.props?.onPress === 'function')[0].props.onPress());
      expect({ variant, context: gate().context, open: gate().open }).toEqual({ variant, context: 'risk', open: true });
      act(() => gate().onClose());
      expect(gate().open).toBe(false);
      if (variant === 'screen') {
        act(() => tree.root.findAll((n) => n.props?.testID === 'food-chip-saved' && typeof n.props?.onPress === 'function')[0].props.onPress());
        expect({ context: gate().context, open: gate().open }).toEqual({ context: 'save', open: true });
      }
    }
  });
});

// ── KB-708 (7) 보강 — Food 탭 칩 줄 높이: 기본 34 그대로 · 큰 글자(상한 ×1.3)에서 칩 라벨 줄 높이 늘어난 만큼 같이 늘어남
describe('KB-708 (7) 칩 줄 높이', () => {
  it('chipRowHeight: 1 = 34 · 1.3 = 34 + 24×0.3 · 상한 넘는 배율도 ×1.3까지 · 작은 글자 = 34(시안 아래로 안 줄어듦)', () => {
    expect(chipRowHeight(1)).toBe(34);
    expect(chipRowHeight(1.3)).toBeCloseTo(41.2, 5);
    expect(chipRowHeight(3.1)).toBeCloseTo(41.2, 5);
    expect(chipRowHeight(0.85)).toBe(34);
  });
  it('렌더: 칩 스크롤 내용 높이 = chipRowHeight(창 fontScale) — 기본 34 · XXXL(3.1) 41.2', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- spyOn은 실제 모듈 객체여야 함(import * = 인터롭 사본이라 컴포넌트가 안 봄)
    const spy = jest.spyOn(require('react-native') as typeof import('react-native'), 'useWindowDimensions');
    for (const [fs, h] of [[1, 34], [3.1, 41.2]] as const) {
      spy.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: fs });
      const tree = render(<FoodExplorer variant="screen" guest={false} srcTag="list" />);
      const sv = tree.root.findAll((n) => n.props?.testID === 'food-chip-scroll' && n.props?.contentContainerStyle != null)[0];
      expect((StyleSheet.flatten(sv.props.contentContainerStyle) as { height: number }).height).toBeCloseTo(h, 5);
      tree.unmount();
    }
    spy.mockRestore();
  });
});

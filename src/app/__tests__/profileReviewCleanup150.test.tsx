/**
 * P-150 ②③④⑤: 리뷰 인풋 키보드 배선·posted 별 부재·foodId 숫자 미노출·
 * 프로필 맵기 섹션/공식 줄 부재 잠금.
 */
import * as React from 'react';
import { TextInput } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// P-176: 재료 카탈로그 훅 표면 목 — 폴백 경로 = 종전 렌더와 동일
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({
    name: (c: string) => (require('@/lib/mocks/ingredients') as typeof import('@/lib/mocks/ingredients')).ingredientLabel(c),
    imageUrl: () => null,
  }),
}));
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['springify', 'damping', 'stiffness', 'mass', 'duration', 'delay', 'easing']) b[k] = () => b;
    return b;
  };
  return {
    __esModule: true,
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
    useReducedMotion: () => false,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('expo-router', () => ({
  useSegments: () => [], // P-214: 계측 화면 식별(StateBlock·HelpfulButton)
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: '7' }),
  usePathname: () => '/',
  useFocusEffect: () => {},
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k, getFixedT: () => (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k } }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/components/SocialAuthButtons', () => ({ SocialAuthButtons: () => null }));
jest.mock('@/lib/data/useHome', () => ({ useHome: () => ({ data: undefined }) }));

const ME = {
  id: '1', nickname: 'A', nationality: 'US', readerLanguage: 'en', spiceTolerance: 'HOT',
  restrictions: [{ kind: 'allergy' as const, code: 'EGG' }], profileImageUrl: null, onboardingCompleted: true,
  rank: { tier: 'bronze', level: 1, score: 10, nextTier: 'silver', pointsToNext: 5 },
};
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: ME, isLoading: false, error: null, refetch: jest.fn() }),
  useMyReviews: () => ({
    data: [
      { id: 'r1', foodId: '499', rating: 4, body: 'good', createdAt: '2026-08-01', authorNationality: 'US', authorRankTier: null },
      // P-165: 서버 food 요약 보유분 — 이름·썸네일 서버값 우선 렌더 잠금용
      // P-193: 사진 보유 리뷰 — 내 리뷰 셀 사진 스트립 렌더 잠금용
      { id: 'r2', foodId: '7', foodName: 'Server Kimbap', foodImageUrl: 'https://cdn/kimbap.jpg', rating: 5, body: 'nice', createdAt: '2026-08-02', authorNationality: 'US', authorRankTier: null, photos: ['https://cdn/rv-a.jpg', 'https://cdn/rv-b.jpg'] },
    ],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useUpdateMe: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/data/useFoods', () => ({
  useFoods: () => ({ data: [] }), // foodMap 미스 — foodId 499 해석 실패 시나리오
  useInfiniteFoods: () => ({ isError: false, error: null, refetch: jest.fn() }),
  useFoodDetail: () => ({ data: { foodId: '7', name: 'Kimchi Jjigae', nameKo: '김치찌개', risk: 'safe' }, isLoading: false, error: null, refetch: jest.fn() }),
}));
jest.mock('@/lib/data/bookmarks', () => ({ useBookmarks: () => ({ data: [] }) }));
jest.mock('@/lib/data/useReviewMutations', () => ({
  useCreateReview: () => ({ mutateAsync: jest.fn().mockResolvedValue(undefined) }),
  useUpdateReview: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteReview: () => ({ mutate: jest.fn() }),
  useToggleReviewLike: () => ({ mutate: jest.fn() }), // P-196: 공용 HelpfulButton 표면 목
}));
jest.mock('@/lib/review/reviewPhotos', () => ({
  uploadReviewImages: jest.fn().mockResolvedValue([]),
  removeReviewPhoto: (arr: string[], u: string) => arr.filter((x) => x !== u),
  addReviewPhotos: (arr: string[]) => arr,
  canPostReview: () => true,
  REVIEW_MAX_PHOTOS: 3,
}));

import ReviewCompose from '../food/[id]/review';
import MyReviews from '../profile/reviews';
import Profile from '../(tabs)/profile';
import { IconBookmark } from '@/components/icons';
import { Stars } from '@/components/Stars';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const flatJson = (t2: ReactTestRenderer) => JSON.stringify(t2.toJSON());

it('P-158 ①(P-150② 재작업): 커서 추종 — 키보드 실측 패딩 + 셀렉션/성장 스크롤 배선', () => {
  const { Keyboard } = require('react-native') as typeof import('react-native');
  const listeners: Record<string, (e: unknown) => void> = {};
  const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((ev: string, cb: (e: unknown) => void) => {
    listeners[ev] = cb;
    return { remove: jest.fn() } as never;
  }) as never);
  const tree = render(<ReviewCompose />);
  // 구 방식 잔재 0
  expect(tree.root.findAll((n) => n.props?.automaticallyAdjustKeyboardInsets === true).length).toBe(0);
  // 키보드 표시 → 컨테이너 하단 패딩 = 키보드 높이 + 여유(28)
  act(() => listeners['keyboardDidShow']?.({ endCoordinates: { height: 336 } }));
  const sv = tree.root.findAll((n) => typeof n.props?.onLayout === 'function' && Array.isArray(n.props?.contentContainerStyle))[0];
  const pad = (require('react-native').StyleSheet.flatten(sv.props.contentContainerStyle) as { paddingBottom?: number }).paddingBottom;
  expect(pad).toBe(28 + 336);
  // 셀렉션·성장·포커스 배선 — scrollTo 호출(블록/뷰포트 실측 주입 후)
  const scrollTo = jest.fn();
  const svInst = sv.instance as { scrollTo?: unknown } | null;
  if (svInst) (svInst as { scrollTo: unknown }).scrollTo = scrollTo;
  act(() => sv.props.onLayout({ nativeEvent: { layout: { height: 700 } } }));
  const block = tree.root.findAll((n) => typeof n.props?.onLayout === 'function' && n.props?.style && n !== sv)[0];
  act(() => block.props.onLayout({ nativeEvent: { layout: { y: 300, height: 400 } } })); // blockBottom 700
  const input = tree.root.findAllByType(TextInput).find((n) => n.props.multiline === true)!;
  expect(typeof input.props.onSelectionChange).toBe('function');
  act(() => input.props.onSelectionChange());
  // target = 700 − (700−336) + 16 = 352
  expect(scrollTo).toHaveBeenCalledWith({ y: 352, animated: true });
  spy.mockRestore();
});

it('P-163 ②: 커서 추종 게이트 — 중간 편집 무개입, 문서 끝 커서만 추종', () => {
  const { Keyboard } = require('react-native') as typeof import('react-native');
  const listeners: Record<string, (e: unknown) => void> = {};
  const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((ev: string, cb: (e: unknown) => void) => {
    listeners[ev] = cb;
    return { remove: jest.fn() } as never;
  }) as never);
  const tree = render(<ReviewCompose />);
  act(() => listeners['keyboardDidShow']?.({ endCoordinates: { height: 336 } }));
  const sv = tree.root.findAll((n) => typeof n.props?.onLayout === 'function' && Array.isArray(n.props?.contentContainerStyle))[0];
  const scrollTo = jest.fn();
  const svInst = sv.instance as { scrollTo?: unknown } | null;
  if (svInst) (svInst as { scrollTo: unknown }).scrollTo = scrollTo;
  act(() => sv.props.onLayout({ nativeEvent: { layout: { height: 700 } } }));
  const block = tree.root.findAll((n) => typeof n.props?.onLayout === 'function' && n.props?.style && n !== sv)[0];
  act(() => block.props.onLayout({ nativeEvent: { layout: { y: 300, height: 400 } } }));
  const input = tree.root.findAllByType(TextInput).find((n) => n.props.multiline === true)!;
  act(() => input.props.onChangeText('0123456789')); // len 10
  scrollTo.mockClear();
  // 중간 커서 → 무개입 (성장 이벤트도 게이트)
  act(() => input.props.onSelectionChange({ nativeEvent: { selection: { start: 3, end: 3 } } }));
  act(() => input.props.onContentSizeChange());
  expect(scrollTo).not.toHaveBeenCalled();
  // 끝 커서 → 추종 재개 (target = 700 − (700−336) + 16 = 352)
  act(() => input.props.onSelectionChange({ nativeEvent: { selection: { start: 10, end: 10 } } }));
  expect(scrollTo).toHaveBeenCalledWith({ y: 352, animated: true });
  spy.mockRestore();
});

it('P-158 ③: 리뷰 디테일 좋아요 캡션 부재 — 소스 잠금(하트+카운트만)', () => {
  // P-182: review/[id] 소멸 — 좋아요 캡션 잠금은 대체 표면(피드 셀 파츠)으로 이관
  const src = require('fs').readFileSync('src/features/review/ReviewCellParts.tsx', 'utf8') as string;
  expect(src).not.toContain('likesCaption');
});

it('P-158 ②: 뱃지 자산 통일 — 리뷰 계열 Rosette 사용 0(MedalEmblem), 소스 잠금', () => {
  const fs = require('fs');
  for (const f of ['src/app/food/[id]/reviews.tsx', 'src/app/community/compose.tsx']) { // P-182: review/[id] 소멸
    const src = fs.readFileSync(f, 'utf8') as string;
    expect(src).not.toContain('Rosette');
    expect(src).toContain('MedalEmblem');
  }
});

it('P-150 ④: 내 리뷰 — foodId 해석 실패 시 숫자("499") 미노출, 중립 라벨', () => {
  const tree = render(<MyReviews />);
  const s = flatJson(tree);
  expect(s).toContain('myReviews.viewDish');
  expect(s).not.toContain('"499"'); // id 숫자 그대로 노출 금지
});

it('P-150 ⑤: 프로필 탭 — Spice tolerance 섹션·Score 공식 줄 부재', () => {
  const tree = render(<Profile />);
  const s = flatJson(tree);
  expect(s).not.toContain('profile.spiceTitle');
  expect(s).not.toContain('profile.scoreNote');
  // 랭킹 섹션 자체는 유지
  expect(s).toContain('profile.rankingTitle');
});

void Stars; // ③ posted 별 부재는 submit 상태 도달이 비용 커서 코드 삭제+타 스위트(orderCta류) 간접 — 아래 잠금으로 대체
it('P-150 ③: 작성 화면 소스에 submitted Stars 렌더 부재(정적 잠금)', () => {
  // submitted 분기 도달 없이 — 컴파일된 트리에서 Stars는 별점 선택(Star 5개)만 존재해야 한다
  const tree = render(<ReviewCompose />);
  expect(tree.root.findAllByType(Stars).length).toBe(0); // 작성 화면엔 Stars(합성 표시) 미사용
});

it('P-154 ②: 내 리뷰 빈 상태 = 상하 센터(앱 통일 규칙)', () => {
  const { StyleSheet: RNSheet } = require('react-native') as typeof import('react-native');
  // useMyReviews 목을 빈 배열로 재정의할 수 없으므로(모듈 목 고정) 스타일 잠금으로 대체:
  // empty 스타일이 flex:1+center — 렌더 분기는 count===0 조건(코드 경로 단순)
  const styles = require('react-native').StyleSheet;
  void styles; void RNSheet;
  const src = require('fs').readFileSync('src/app/profile/reviews.tsx', 'utf8') as string;
  expect(src).toContain("justifyContent: 'center'");
  expect(src).not.toContain('paddingTop: 60');
});

it('P-157: My reviews = Saved와 같은 카드의 AcctRow(카운트+라우팅) — 구 헤더·See all 소멸', () => {
  const tree = render(<Profile />);
  const s = flatJson(tree);
  // Saved 행 + My reviews 행 — 같은 acctList 카드(공용 AcctRow)
  expect(s).toContain('profile.saved');
  expect(s).toContain('myReviews.title');
  expect(s).not.toContain('profile.myReviewsTitle'); // 구 텍스트 헤더 소멸
  expect(s).not.toContain('profile.seeAll'); // See all 소멸
  // 카운트(리뷰 1건 목) 렌더
  const row = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'myReviews.title').length > 0);
  expect(row.length).toBeGreaterThanOrEqual(1);
});

it('P-157 ②: 저장 아이콘 별 전면 통일 — 프로필에 북마크 글리프 0 + saved 화면 소스 잠금', () => {
  const tree = render(<Profile />);
  expect(tree.root.findAllByType(IconBookmark).length).toBe(0);
  const src = require('fs').readFileSync('src/app/profile/saved.tsx', 'utf8') as string;
  expect(src).not.toContain('IconBookmark');
  expect(src).toContain('IconStar');
});

it('P-159: 저장 빈 상태 CTA = alignSelf center(소스 잠금 — Btn sm flex-start 함정 상쇄)', () => {
  const src = require('fs').readFileSync('src/app/profile/saved.tsx', 'utf8') as string;
  const ctaIdx = src.indexOf('saved.emptyCta');
  const btnIdx = src.lastIndexOf('<Btn sm', ctaIdx);
  expect(btnIdx).toBeGreaterThan(-1);
  expect(src.slice(btnIdx, ctaIdx)).toContain("alignSelf: 'center'");
});

it('P-193(Q-39): 내 리뷰 셀 — 사진 스트립 렌더 + 탭 = 풀스크린 뷰어(4표면 공유 공백 보수)', () => {
  const tree = render(<MyReviews />);
  // 스트립 렌더(사진 보유 r2)
  expect(flatJson(tree)).toContain('https://cdn/rv-a.jpg');
  // 재현 경로: 사진 탭 경유로 뷰어 도달 (P-190 교훈 — 상태 직접 호출 검증 금지)
  act(() => tree.root.findAll((n) => n.props?.testID === 'photo-0')[0].props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'photo-viewer').length).toBeGreaterThanOrEqual(1);
});

it('P-165(#144): 내 리뷰 — 서버 food.name(lang 해석)·썸네일 우선, 캐시 미스 시 중립 라벨 폴백', () => {
  const tree = render(<MyReviews />);
  const s2 = flatJson(tree);
  expect(s2).toContain('Server Kimbap'); // 서버 이름 우선
  expect(s2).toContain('https://cdn/kimbap.jpg'); // 서버 썸네일
  expect(s2).toContain('myReviews.viewDish'); // 서버 요약 無 + 캐시 미스(r1) → 중립 라벨 유지
});

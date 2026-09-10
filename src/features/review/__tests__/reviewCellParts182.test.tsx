/**
 * P-182: 리뷰 2depth 셀 파츠 — 펼침/접기·사진 뷰어·수정 시트 + 디테일 라우트 소멸 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// P-305: TabBar가 배럴 경유로 useMe(i18n→AsyncStorage)·RemoteImage(expo-image) 체인을
// 물게 됨 — 이 스위트는 해당 표면 무관이라 목으로 차단
// P-348 ⑥: PhotoViewer(RNGH·reanimated) — jest 네이티브 부재 통짜 목
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const chain = () => {
    const g: Record<string, unknown> = {};
    for (const k of ['runOnJS', 'enabled', 'numberOfTaps', 'maxPointers', 'onStart', 'onUpdate', 'onEnd', 'onFinalize', 'activeOffsetY', 'failOffsetX']) g[k] = () => g;
    return g;
  };
  return {
    GestureDetector: ({ children }: { children: unknown }) => children,
    GestureHandlerRootView: View,
    Gesture: { Pan: chain, Pinch: chain, Tap: chain, Simultaneous: (...g: unknown[]) => g, Exclusive: (...g: unknown[]) => g },
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-image', () => ({ Image: () => null }));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    useReducedMotion: () => false,
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
const mockLikeToggle = jest.fn();
jest.mock('@/lib/data/useReviewMutations', () => ({ useToggleReviewLike: () => ({ mutate: mockLikeToggle }) }));
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a) }));
const mockGuest = jest.fn(() => false);
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockGuest() }));

import { ExpandableBody, HelpfulButton, ReviewPhotoStrip } from '../ReviewCellParts';
import type { Review } from '@/lib/api/types';

const t = (k: string) => k;

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const flat = (t2: ReactTestRenderer) => JSON.stringify(t2.toJSON());

it('디테일 라우트 소멸 — review/[id] 파일 부재(2depth 전환)', () => {
  expect(require('fs').existsSync('src/app/review/[id].tsx')).toBe(false);
});

it('ExpandableBody — 3줄 도달 시 See more, 탭 = 전문 펼침(See less), 재탭 = 접기', () => {
  const tree = render(<ExpandableBody body="long text" t={t} />);
  expect(flat(tree)).not.toContain('reviews.seeMore'); // 클램프 감지 전 토글 없음
  const text = tree.root.findAll((n) => typeof n.props?.onTextLayout === 'function')[0];
  act(() => text.props.onTextLayout({ nativeEvent: { lines: [{}, {}, {}] } })); // 3줄
  expect(flat(tree)).toContain('reviews.seeMore');
  const toggle = tree.root.findAll((n) => n.props?.testID === 'body-toggle')[0];
  act(() => toggle.props.onPress());
  expect(flat(tree)).toContain('reviews.seeLess'); // 펼침 상태
  act(() => tree.root.findAll((n) => n.props?.testID === 'body-toggle')[0].props.onPress());
  expect(flat(tree)).toContain('reviews.seeMore'); // 다시 접힘
});

it('ReviewPhotoStrip — 사진 탭 = 풀스크린 뷰어, X = 닫기, 0장 = 미렌더', () => {
  const none = render(<ReviewPhotoStrip photos={[]} />);
  expect(none.toJSON()).toBeNull();
  const tree = render(<ReviewPhotoStrip photos={['https://cdn/a.jpg', 'https://cdn/b.jpg']} />);
  expect(tree.root.findAll((n) => n.props?.testID === 'photo-viewer').length).toBe(0);
  act(() => tree.root.findAll((n) => n.props?.testID === 'photo-1')[0].props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'photo-viewer').length).toBeGreaterThanOrEqual(1);
  act(() => tree.root.findAll((n) => n.props?.testID === 'viewer-close')[0].props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'photo-viewer').length).toBe(0);
});

it('P-193: 뷰어 X = 아이콘만 — 배경·보더·고정 박스 소멸(스타일 메트릭 잠금)', () => {
  const { StyleSheet } = require('react-native') as typeof import('react-native');
  const tree = render(<ReviewPhotoStrip photos={['https://cdn/a.jpg']} />);
  act(() => tree.root.findAll((n) => n.props?.testID === 'photo-0')[0].props.onPress());
  const close = tree.root.findAll((n) => n.props?.testID === 'viewer-close')[0];
  const st = StyleSheet.flatten(close.props.style) as Record<string, unknown>;
  expect(st.backgroundColor).toBeUndefined();
  expect(st.borderWidth).toBeUndefined();
  expect(st.width).toBeUndefined(); // 고정 원형 박스 소멸 — 터치는 hitSlop
  expect(close.props.hitSlop).toBeGreaterThanOrEqual(10);
});

describe('P-196: HelpfulButton — 4표면 유일 경유 + 본인 비활성', () => {
  const RV = { id: 'r1', foodId: '7', rating: 4, likes: 3, myLike: false, anonymized: false, authorNationality: 'US', authorRankTier: null, createdAt: '2026-08-13' } as never;
  const tapHelpful = (tree: ReactTestRenderer) =>
    act(() => tree.root.findAll((n) => n.props?.testID === 'helpful-r1' && typeof n.props?.onPress === 'function')[0].props.onPress());

  beforeEach(() => {
    jest.clearAllMocks();
    mockGuest.mockReturnValue(false);
  });

  it('타인 = 탭 → 공용 뮤테이션 토글(reviewId·foodId)', () => {
    const tree = render(<HelpfulButton review={RV} mine={false} t={t} />);
    tapHelpful(tree);
    expect(mockLikeToggle).toHaveBeenCalledWith({ reviewId: 'r1', foodId: '7' });
  });

  it('본인(mine) = 카운트 표시 유지 + 탭 = 안내 토스트 1·토글 0 (P-357/KB-520 — 자기 투표 차단 유지)', () => {
    const tree = render(<HelpfulButton review={RV} mine t={t} />);
    expect(flat(tree)).toContain('reviews.helpful'); // 숨김 아님 — 카운트 표시
    // P-364(KB-527): disabled={mine}이 실기 탭을 막던 회귀 — Pressable disabled 부재 잠금
    // (직접 onPress 호출은 disabled를 우회해 유닛이 못 잡았던 함정)
    const btn = tree.root.findAll((n) => n.props?.testID === 'helpful-r1' && typeof n.props?.onPress === 'function')[0];
    expect(btn.props.disabled).toBeFalsy();
    tapHelpful(tree);
    expect(mockLikeToggle).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith('reviews.helpfulOwnToast', { icon: 'alert' }); // P-366 ③: 느낌표 변형(에러 아님)
  });

  it('게스트 = onGuest 게이트(미전달이면 무반응 — 401 송신 0)', () => {
    mockGuest.mockReturnValue(true);
    const onGuest = jest.fn();
    const tree = render(<HelpfulButton review={RV} mine={false} t={t} onGuest={onGuest} />);
    tapHelpful(tree);
    expect(onGuest).toHaveBeenCalled();
    expect(mockLikeToggle).not.toHaveBeenCalled();
    const bare = render(<HelpfulButton review={RV} mine={false} t={t} />);
    tapHelpful(bare);
    expect(mockLikeToggle).not.toHaveBeenCalled();
  });

  it('4표면 동일 경유 소스 잠금 — 개별 배선(직접 toggle/인라인 Helpful 텍스트) 0', () => {
    const fs = require('fs');
    // KB-430/431: 피드·상세 프리뷰는 공용 FeedCard 경유(카드 내부가 <HelpfulButton>) —
    // 표면 직접 배선 금지는 동일하게 잠근다.
    expect(fs.readFileSync('src/features/review/FeedCard.tsx', 'utf8')).toContain('<HelpfulButton');
    const surfaces: [string, 'card' | 'button'][] = [
      ['src/features/community/ReviewFeed.tsx', 'card'],
      ['src/app/food/[id]/index.tsx', 'card'],
      ['src/app/food/[id]/reviews.tsx', 'button'],
      ['src/app/profile/reviews.tsx', 'card'], // KB-434 D-6: 내 리뷰 = FeedCard 경유
    ];
    for (const [f, via] of surfaces) {
      const src = fs.readFileSync(f, 'utf8') as string;
      expect(src).toContain(via === 'card' ? '<FeedCard' : '<HelpfulButton'); // 공용 경유
      expect(src).not.toContain('useToggleReviewLike'); // 표면 직접 뮤테이션 금지
      expect(src).not.toContain("t('reviews.helpful'"); // 인라인 렌더 금지
    }
  });
});


it('KB-431 후속(.fig 실측 2162:11360): 평점 행 = 좌측 정렬(hug @x20) — center 잔존 0', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const src = require('fs').readFileSync('src/features/review/FeedCard.tsx', 'utf8') as string;
  expect(src).toContain("justifyContent: 'flex-start', gap: 16");
  expect(src).not.toContain("justifyContent: 'center', gap: 16");
});

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

it('ExpandableBody — 3줄을 넘으면 See more, 탭 = 전문 펼침(See less), 재탭 = 접기', () => {
  const tree = render(<ExpandableBody body="long text" t={t} />);
  expect(flat(tree)).not.toContain('reviews.seeMore'); // 클램프 감지 전 토글 없음
  const text = tree.root.findAll((n) => typeof n.props?.onTextLayout === 'function')[0];
  act(() => text.props.onTextLayout({ nativeEvent: { lines: [{}, {}, {}, {}] } })); // 전체 4줄(KB-824: 클램프 없는 측정)
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
    expect(mockLikeToggle).toHaveBeenCalledWith({ reviewId: 'r1', foodId: '7' }, expect.objectContaining({ onSuccess: expect.any(Function) })); // #131 P2: 성공 콜백 동반
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

it('#131 P2(KB-529): 토글 실패(롤백) = 토스트 0 — 성공 콜백만 발화', () => {
  jest.clearAllMocks();
  mockLikeToggle.mockImplementation((_v: unknown, opts?: { onSuccess?: () => void }) => {
    void opts; // 실패 — onSuccess 미호출
  });
  const RVF = { id: 'rf', foodId: '7', rating: 4, likes: 0, myLike: false, anonymized: false, authorNationality: 'US', authorRankTier: null, createdAt: '2026-09-10' } as never;
  const tree = render(<HelpfulButton review={RVF} mine={false} t={(k: string) => k} />);
  act(() => tree.root.findAll((n) => n.props?.testID === 'helpful-rf' && typeof n.props?.onPress === 'function')[0].props.onPress());
  expect(mockLikeToggle).toHaveBeenCalledTimes(1);
  expect(mockToast).not.toHaveBeenCalled();
  mockLikeToggle.mockReset();
});

it('P-366 ④(KB-529): 비mine ON 탭 = 체크 토스트 1회(성공 시) · OFF 탭 = 토스트 0', () => {
  jest.clearAllMocks();
  mockLikeToggle.mockImplementation((_v: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()); // 성공 경로
  const RV2 = { id: 'r9', foodId: '7', rating: 4, likes: 3, myLike: false, anonymized: false, authorNationality: 'US', authorRankTier: null, createdAt: '2026-09-10' } as never;
  const tap = (tree: ReactTestRenderer, id: string) =>
    act(() => tree.root.findAll((n) => n.props?.testID === `helpful-${id}` && typeof n.props?.onPress === 'function')[0].props.onPress());
  const t2 = (k: string) => k;
  const tree = render(<HelpfulButton review={RV2} mine={false} t={t2} />); // myLike:false → 켜는 방향
  tap(tree, 'r9');
  expect(mockLikeToggle).toHaveBeenCalledTimes(1);
  expect(mockToast).toHaveBeenCalledTimes(1);
  expect(mockToast).toHaveBeenCalledWith('reviews.helpfulMarkedToast'); // 체크(기본 아이콘)
  mockToast.mockClear();
  const on = { ...(RV2 as unknown as Record<string, unknown>), myLike: true } as never;
  const tree2 = render(<HelpfulButton review={on} mine={false} t={t2} />); // 끄는 방향
  tap(tree2, 'r9');
  expect(mockToast).not.toHaveBeenCalled();
});

describe('KB-817 리뷰 탭 peek', () => {
  const { ScrollView, StyleSheet } = jest.requireActual<typeof import('react-native')>('react-native');
  const { PhotoViewer } = jest.requireActual<typeof import('@/components/PhotoViewer')>('@/components/PhotoViewer');
  const photos = ['a', 'b', 'c', 'd', 'e'].map((x) => `https://cdn/${x}.jpg`);
  const tile = (tree: ReactTestRenderer, i: number) =>
    StyleSheet.flatten(tree.root.findAll((n) => n.props?.testID === `photo-${i}`)[0].findAll((n) => n.props?.uri)[0].props.style);
  const measure = (tree: ReactTestRenderer, width: number) =>
    act(() => tree.root.findAll((n) => n.props?.testID === 'photo-peek' && typeof n.props?.onLayout === 'function')[0].props.onLayout({ nativeEvent: { layout: { width } } }));

  it('타일 폭 = 콘텐츠 폭 − 40 · 높이 = 폭×3/4 · radius 12 · snap = 폭+8 · 전체 장수 · 탭 index 유지', () => {
    const tree = render(<ReviewPhotoStrip photos={photos} variant="peek" />);
    measure(tree, 335);
    for (let i = 0; i < photos.length; i++) expect(tile(tree, i)).toMatchObject({ width: 295, height: 221.25, borderRadius: 12 });
    const scroll = tree.root.findByType(ScrollView);
    expect(scroll.props).toMatchObject({ horizontal: true, showsHorizontalScrollIndicator: false, snapToInterval: 303, decelerationRate: 'fast', scrollEnabled: true });
    act(() => tree.root.findAll((n) => n.props?.testID === 'photo-3')[0].props.onPress());
    expect(tree.root.findByType(PhotoViewer).props).toMatchObject({ index: 3, uris: photos });
  });
  it('1장 = 스크롤 없이 같은 크기 1장 · 0장 = 미렌더', () => {
    const one = render(<ReviewPhotoStrip photos={[photos[0]]} variant="peek" />);
    measure(one, 335);
    expect(tile(one, 0)).toMatchObject({ width: 295, height: 221.25 });
    expect(one.root.findByType(ScrollView).props.scrollEnabled).toBe(false);
    expect(render(<ReviewPhotoStrip photos={[]} variant="peek" />).toJSON()).toBeNull();
  });
  it('기본 tiles 불변 — 최대 3장 · 지정 size 정사각 · 가로 스크롤 없음', () => {
    const tree = render(<ReviewPhotoStrip photos={photos} size={104} radius={4} />);
    expect(new Set(tree.root.findAll((n) => typeof n.props?.testID === 'string' && /^photo-\d$/.test(n.props.testID)).map((n) => n.props.testID)).size).toBe(3);
    expect(tile(tree, 0)).toMatchObject({ width: 104, height: 104, borderRadius: 4 });
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
  });
  it('See more 색 — 기본 = 기존 primaryText · toggleColor 지정 시 라벨·아이콘 그 색', () => {
    const { color: C } = jest.requireActual<typeof import('@/lib/theme')>('@/lib/theme');
    const labelColor = (tree: ReactTestRenderer) => {
      const toggle = tree.root.findAll((n) => n.props?.testID === 'body-toggle')[0];
      return StyleSheet.flatten(toggle.findAll((n) => n.props?.children === 'reviews.seeMore')[0].props.style).color;
    };
    const open3 = (tree: ReactTestRenderer) => act(() => tree.root.findAll((n) => typeof n.props?.onTextLayout === 'function')[0].props.onTextLayout({ nativeEvent: { lines: [{}, {}, {}, {}] } }));
    const base = render(<ExpandableBody body="long" t={t} />); open3(base);
    expect(labelColor(base)).toBe(C.primaryText);
    const ink = render(<ExpandableBody body="long" t={t} toggleColor="#2F3137" />); open3(ink);
    expect(labelColor(ink)).toBe('#2F3137');
  });
  it('표면 배선 — 리뷰 탭만 peek, FeedCard 기본 tiles · peek일 때만 See more 잉크색', () => {
    const fs = jest.requireActual<typeof import('fs')>('fs');
    const feed = fs.readFileSync('src/features/community/ReviewFeed.tsx', 'utf8');
    expect(feed).toContain('photoVariant="peek"');
    const card = fs.readFileSync('src/features/review/FeedCard.tsx', 'utf8');
    expect(card).toContain("photoVariant = 'tiles'");
    expect(card).toContain("toggleColor={photoVariant === 'peek' ? INK_TITLE : undefined}");
    for (const f of ['src/app/food/[id]/index.tsx', 'src/app/profile/reviews.tsx']) expect(fs.readFileSync(f, 'utf8')).not.toContain('photoVariant');
  });
});

describe('KB-824 See more = 전체 줄 수가 3을 넘을 때만', () => {
  const measure = (tree: ReactTestRenderer, n: number) =>
    act(() => tree.root.findAll((x) => x.props?.testID === 'body-measure' && typeof x.props?.onTextLayout === 'function')[0].props.onTextLayout({ nativeEvent: { lines: Array(n).fill({}) } }));
  const toggle = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props?.testID === 'body-toggle' && typeof n.props?.onPress === 'function')[0];
  const visible = (tree: ReactTestRenderer) => tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'body-text')[0];

  it('정확히 3줄 = 버튼 없음 · 1·2줄도 없음 · 접힘 제한도 걸지 않음', () => {
    for (const n of [1, 2, 3]) {
      const tree = render(<ExpandableBody body={`body ${n}`} t={t} />);
      measure(tree, n);
      expect(toggle(tree)).toBeUndefined();
      expect(visible(tree).props.numberOfLines).toBeUndefined();
    }
  });
  it('4줄 = 버튼 + 3줄 접힘 → 펼침·접힘 왕복 5회 내내 버튼 유지 · 측정 Text는 클램프 없음', () => {
    const tree = render(<ExpandableBody body="four lines" t={t} />);
    measure(tree, 4);
    expect(tree.root.findAll((x) => x.props?.testID === 'body-measure' && typeof x.type === 'string')[0].props.numberOfLines).toBeUndefined();
    for (let i = 0; i < 5; i++) {
      expect(visible(tree).props.numberOfLines).toBe(3);
      act(() => toggle(tree).props.onPress());
      expect(visible(tree).props.numberOfLines).toBeUndefined();
      expect(flat(tree)).toContain('reviews.seeLess');
      act(() => toggle(tree).props.onPress());
      expect(toggle(tree)).toBeDefined();
      expect(flat(tree)).toContain('reviews.seeMore');
    }
  });
  it('Codex #301 P2: 측정 전엔 접힌 채(3줄) — 긴 본문이 전체로 그려졌다 줄어드는 점프 0 · 본문 교체 직후도 접힘', () => {
    const tree = render(<ExpandableBody body="unmeasured" t={t} />);
    expect(visible(tree).props.numberOfLines).toBe(3);
    expect(toggle(tree)).toBeUndefined();
    measure(tree, 2);
    expect(visible(tree).props.numberOfLines).toBeUndefined();
    act(() => tree.update(<ExpandableBody body="changed" t={t} />));
    expect(visible(tree).props.numberOfLines).toBe(3);
  });
  it('본문 교체(원문↔번역) = 접힘으로 돌아가 다시 측정 · 짧은 본문엔 잔상 0, 긴 본문엔 다시 버튼', () => {
    const tree = render(<ExpandableBody body="long one" t={t} />);
    measure(tree, 6);
    act(() => toggle(tree).props.onPress()); // 펼친 상태에서
    act(() => tree.update(<ExpandableBody body="short" t={t} />));
    expect(toggle(tree)).toBeUndefined(); // 측정 전 버튼 없음
    measure(tree, 3);
    expect(toggle(tree)).toBeUndefined();
    act(() => tree.update(<ExpandableBody body="long again" t={t} />));
    measure(tree, 5);
    expect(toggle(tree)).toBeDefined();
    expect(visible(tree).props.numberOfLines).toBe(3); // 접힘으로 시작
  });
  it('폭·글꼴 배율 변화 = 측정 Text가 다시 레이아웃되면 최신 줄 수로 갱신(4 → 3이면 버튼 사라짐)', () => {
    const tree = render(<ExpandableBody body="resize" t={t} />);
    measure(tree, 4);
    expect(toggle(tree)).toBeDefined();
    measure(tree, 3); // 회전·글꼴 축소로 3줄에 들어감
    expect(toggle(tree)).toBeUndefined();
  });
  it('KB-777: 앱을 켠 채 글씨 크기 변경(fontScale 전이) = 측정 Text 새로 마운트 + 줄 수 다시 잼 → 커진 글씨로 4줄 넘으면 See more · 펼침 상태 유지', () => {
    const RN = jest.requireActual('react-native');
    const spy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 375, height: 812, scale: 3, fontScale: 1 });
    const tree = render(<ExpandableBody body="three lines at 1x" t={t} />);
    measure(tree, 3);
    expect(toggle(tree)).toBeUndefined();
    const before = tree.root.findAll((x) => x.props?.testID === 'body-measure' && typeof x.type === 'string')[0];
    spy.mockReturnValue({ width: 375, height: 812, scale: 3, fontScale: 1.3 });
    act(() => tree.update(<ExpandableBody body="three lines at 1x" t={t} />));
    const after = tree.root.findAll((x) => x.props?.testID === 'body-measure' && typeof x.type === 'string')[0];
    expect(after).not.toBe(before); // 새 인스턴스 = 새 onTextLayout
    expect(visible(tree).props.numberOfLines).toBe(3); // 재측정 전 = 접힌 채(높이 점프 0)
    measure(tree, 5);
    expect(toggle(tree)).toBeDefined();
    act(() => toggle(tree).props.onPress());
    spy.mockReturnValue({ width: 375, height: 812, scale: 3, fontScale: 1 });
    act(() => tree.update(<ExpandableBody body="three lines at 1x" t={t} />));
    measure(tree, 4);
    expect(visible(tree).props.numberOfLines).toBeUndefined(); // 펼친 채 유지
    expect(flat(tree)).toContain('reviews.seeLess');
    spy.mockRestore();
  });
  it('측정 Text = 보이지 않고 스크린리더·터치 0', () => {
    const { StyleSheet } = jest.requireActual('react-native');
    const tree = render(<ExpandableBody body="x" t={t} />);
    const m = tree.root.findAll((x) => x.props?.testID === 'body-measure' && typeof x.type === 'string')[0];
    expect(StyleSheet.flatten(m.props.style)).toMatchObject({ position: 'absolute', opacity: 0 });
    expect(m.props).toMatchObject({ accessible: false, importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true, pointerEvents: 'none' });
  });
});

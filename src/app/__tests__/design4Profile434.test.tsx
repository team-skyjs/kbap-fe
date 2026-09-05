/**
 * KB-434(P-279) D-6 — 프로필·마이·랭킹 디자인 4차 잠금(발주 §8 지정 유닛).
 * ① 프로필 탭 메뉴 행 순서 스냅샷(tab_box h58 — 구분선 없음)
 * ② 편집 폼 — 국적 Disabled(잠금 필드) + 저장 P-173 가드 소스 잠금
 * ③ 탈퇴 — 체크박스 게이트(동의 전 비활성) + primary 오렌지(danger 빨강 금지)
 * ④ 저장 목록 — FoodGridCard 그리드 + 위험 칩 소스 잠금
 * (랭킹 현재 등급 하이라이트 = rankingReviewCleanup · 주문 카드 태그 변형 = myFoods253)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

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
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace, canDismiss: () => false, dismissAll: jest.fn() }),
  usePathname: () => '/profile',
  useFocusEffect: () => {},
  Redirect: () => null,
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
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/useBottomInset', () => ({ useBottomInset: () => 0 }));
jest.mock('@/components/SocialAuthButtons', () => ({ SocialAuthButtons: () => null }));
jest.mock('@/lib/data/useFoods', () => ({ useFoods: () => ({ data: [] }) }));
jest.mock('@/lib/data/bookmarks', () => ({ useBookmarks: () => ({ data: [] }) }));
jest.mock('@/lib/data/useHome', () => ({ useHome: () => ({ data: { recent: [] } }) }));
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({ name: (c: string) => c, imageUrl: () => null }),
}));
const mockWithdraw = jest.fn(async () => {});
jest.mock('@/lib/auth/beAuth', () => ({ withdrawBe: () => mockWithdraw(), logoutBe: jest.fn(async () => {}) }));
jest.mock('@/lib/auth/clearMemberLocal', () => ({ clearMemberLocalState: jest.fn(async () => {}) }));
const mockUseMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => mockUseMe(),
  useMyReviews: () => ({ data: [], isLoading: false, error: null, refetch: jest.fn() }),
}));

import Profile from '../(tabs)/profile';
import DeleteAccount from '../delete-account';

const ME = {
  data: {
    id: '1', nickname: 'A', nationality: 'US', readerLanguage: 'en', spiceTolerance: 'SKIP',
    restrictions: [{ kind: 'allergy' as const, code: 'EGG' }],
    rank: { tier: 'newcomer', level: 1, score: 0, nextTier: 'taster', pointsToNext: 30 },
    profileImageUrl: null, onboardingCompleted: true, provider: 'GOOGLE',
  },
  isLoading: false, isError: false, error: null, refetch: jest.fn(),
};

const trees: ReactTestRenderer[] = [];
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMe.mockReturnValue(ME);
});

it('① 메뉴 행 순서 스냅샷 — My Foods→Saved→My reviews→Language→Safety→Blocked→Log out→Delete', () => {
  const s = JSON.stringify(render(<Profile />).toJSON());
  const order = [
    'profile.myFoods', 'profile.saved', 'myReviews.title', 'profile.language',
    'profile.safetyNotice', 'community.blockedTitle', 'profile.logout', 'profile.deleteAccount',
  ].map((k) => s.indexOf(k));
  for (let i = 0; i < order.length; i++) expect(order[i]).toBeGreaterThan(-1);
  for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
  // tab_box h58 pad 17/22 — 구분선 없음(시안)
  const src = require('fs').readFileSync('src/app/(tabs)/profile.tsx', 'utf8') as string;
  expect(src).toContain("menuRow: { height: 58, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 17, paddingHorizontal: 22 }");
  expect(src).not.toContain('borderBottomWidth: StyleSheet.hairlineWidth'); // 구 AcctRow 구분선 소멸
});

it('② 편집 폼 — 국적 Disabled 필드(bg #F7F8FA + 자물쇠 + 헬퍼) · 저장 = P-173 가드 소스 잠금', () => {
  const src = require('fs').readFileSync('src/app/profile/edit.tsx', 'utf8') as string;
  expect(src).toContain('styles.fieldDisabled'); // Disabled 변형(수정 불가 — P-078 정책 무변)
  expect(src).toContain('<IconLock size={15}');
  expect(src).toContain("t('editProfile.nationalityLocked')");
  expect(src).toContain('busy={saving}'); // P-173 공용 가드 문법(Btn busy)
  expect(src).toContain("t('editProfile.save')"); // BottomBar Single "Save changes"
  // Input/Text 필드 D-1 Filled — bg surface2 r8(구 카드 보더 필드 소멸)
  expect(src).toContain('backgroundColor: C.surface2, borderRadius: 8');
});

it('③ 탈퇴 — 체크박스 게이트: 동의 전 확정 무동작, 동의 후 진행(GOOGLE = 게이트 없음)', async () => {
  const tree = render(<DeleteAccount />);
  const confirm = () => tree.root.findAll((n) => n.props?.testID === 'delete-confirm' && typeof n.props?.onPress === 'function');
  // 동의 전 — Btn off = onPress 미배선(무동작)
  for (const b of confirm()) expect(b.props.onPress).toBeUndefined();
  expect(mockWithdraw).not.toHaveBeenCalled();
  // 체크박스 동의 → 확정 활성
  const consent = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'profile.delete.confirm').length > 0)[0];
  act(() => consent.props.onPress());
  const btn = confirm().find((b) => typeof b.props.onPress === 'function');
  expect(btn).toBeTruthy();
  await act(async () => { btn!.props.onPress(); await Promise.resolve(); });
  expect(mockWithdraw).toHaveBeenCalledTimes(1);
});

it('③-b 탈퇴 확정 = primary 오렌지(예진 확정 9/5) — danger 빨강·구 아이콘 카드 소멸', () => {
  const src = require('fs').readFileSync('src/app/delete-account.tsx', 'utf8') as string;
  expect(src).toContain("variant={agreed ? 'primary' : 'off'}"); // danger → primary
  expect(src).not.toContain("'danger'");
  expect(src).toContain('D4OctagonAlert size={20}'); // 불릿 카드 아이콘(시안)
  expect(src).toContain('bulletDivider'); // 첫 카드 하단 line 1px
});

it('④ 저장 목록 — FoodGridCard 2열 그리드 + 위험 칩(All·Safe·Avoid·Warning) 소스 잠금', () => {
  const src = require('fs').readFileSync('src/app/profile/saved.tsx', 'utf8') as string;
  expect(src).toContain('<FoodGridCard'); // D-2 카드 재사용
  expect(src).toContain('numColumns={2}');
  expect(src).toContain("['all', 'safe', 'danger', 'caution']"); // 칩 순서 = D-2 홈 동일
  expect(src).toContain('onBookmark={() => onRemove(item)}'); // 별 = 해제 토글(Undo 무변)
  expect(src).not.toContain('Swipeable'); // 구 스와이프 행 소멸
});

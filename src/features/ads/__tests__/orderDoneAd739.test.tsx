/** KB-739 /review 2 — 주문 완료 → 리뷰 유도 → 전면 광고(큐, 유도 시트 닫힌 뒤) → 홈. '별로예요'는 문의 push가 뒤따르므로 광고 스텝 건너뛰고 즉시 복귀.
 * 하네스는 confetti166과 동일(목 블록 복제) + 광고 SDK 목. */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => mockReduced,
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) })); // KB-730 시트 useBottomInset
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }) })); // KB-730 useReviewPrompt
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }), initReactI18next: { type: '3rdParty', init: () => {} } }));

jest.mock('react-native-google-mobile-ads');
jest.mock('expo-tracking-transparency');
jest.mock('@/lib/flags', () => ({ ...jest.requireActual<typeof import('@/lib/flags')>('@/lib/flags'), isProdChannel: () => false }));
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: jest.fn() }));
jest.mock('@/lib/metaSdk', () => ({ setMetaTrackingEnabled: jest.fn() }));
jest.mock('@/lib/storeReview', () => ({ requestStoreReview: async () => true }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { FlippedOrderCard } from '@/features/order/FlippedOrderCard';
import { _resetAdsSessionForTest, canShowInterstitial, initAds } from '@/lib/ads/adsSession';
import { _resetAdsSdkForTest } from '@/lib/ads/sdk';
import * as adsModule from 'react-native-google-mobile-ads';
/* eslint-enable import/first */
const { mockAds } = adsModule as unknown as typeof import('../../../../__mocks__/react-native-google-mobile-ads');

const t = (k: string) => k;
/** 닫힌 Modal의 onDismiss 발화 — reviewOnly면 유도 시트(onShow 보유)만(완료 모달의 onDismiss 재발화로 큐가 중복 등록되는 하네스 아티팩트 방지) */
const fireDismissed = async (tree: ReactTestRenderer, reviewOnly = false) => {
  const seen = new Set<unknown>();
  for (const n of tree.root.findAll((x) => typeof x.props?.onDismiss === 'function' && x.props?.visible === false && (!reviewOnly || typeof x.props?.onShow === 'function'))) {
    if (seen.has(n.props.onDismiss)) continue;
    seen.add(n.props.onDismiss);
    await act(async () => { n.props.onDismiss(); });
  }
};
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); }); };
const trees: ReactTestRenderer[] = [];
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });

async function mountWithLoadedAd(onDone: jest.Mock) {
  const asMod = jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock') as { default?: unknown } & Record<string, unknown>;
  const AsyncStorage = (asMod.default ?? asMod) as { clear: () => Promise<void> };
  await AsyncStorage.clear();
  await act(async () => { await initAds(); });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<FlippedOrderCard items={[{ nameKo: '김치찌개', name: 'Kimchi', qty: 1, priceKrw: null }]} avoidCodes={[]} avoidNames={[]} currency="USD" onDone={onDone} t={t} />);
  });
  trees.push(tree);
  act(() => mockAds.update('interstitial', { status: 'loaded' }));
  await flush();
  const doneBtn = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'order.done').length > 0).pop()!;
  await act(async () => { doneBtn.props.onPress(); });
  const home = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'order.doneHome').length > 0).pop()!;
  await act(async () => { home.props.onPress(); });
  await flush();
  await fireDismissed(tree); // iOS: 완료 모달 닫힘 → 유도 시트
  expect(tree.root.findAll((n) => n.props?.testID === 'review-prompt' && typeof n.type === 'string')).toHaveLength(1);
  return tree;
}
const press = async (tree: ReactTestRenderer, id: string) => { const n = tree.root.findAll((x) => x.props?.testID === id && typeof x.props?.onPress === 'function')[0]; await act(async () => { n.props.onPress(); }); await flush(); };

beforeEach(() => { jest.clearAllMocks(); mockAds.reset(); _resetAdsSessionForTest(); _resetAdsSdkForTest(); mockReduced = false; });

it('나중에 = 유도 시트 닫힌 뒤 전면 show → 닫히면 onDone 1회(광고 중엔 복귀 0)', async () => {
  const onDone = jest.fn();
  const tree = await mountWithLoadedAd(onDone);
  await press(tree, 'review-prompt-later');
  expect(onDone).not.toHaveBeenCalled(); // 광고 스텝이 큐에 섰다 — 시트가 완전히 닫힌 뒤 실행
  expect(mockAds.interstitial.show).not.toHaveBeenCalled();
  await fireDismissed(tree, true); // 유도 시트 onDismiss → 큐 done → 광고 스텝
  expect(mockAds.interstitial.show).toHaveBeenCalledTimes(1);
  expect(onDone).not.toHaveBeenCalled();
  act(() => mockAds.update('interstitial', { status: 'showing' }));
  expect(canShowInterstitial()).toBe(false);
  act(() => mockAds.update('interstitial', { status: 'closed' }));
  await flush();
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('/review 2: 별로예요 = 광고 스텝 건너뛰고 즉시 onDone(문의 push가 dismissAll+replace에 지워지지 않게) · 광고 show 0', async () => {
  const onDone = jest.fn();
  const tree = await mountWithLoadedAd(onDone);
  await press(tree, 'review-prompt-negative');
  expect(onDone).toHaveBeenCalledTimes(1);
  await fireDismissed(tree, true);
  await flush();
  expect(mockAds.interstitial.show).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(canShowInterstitial()).toBe(true);
});

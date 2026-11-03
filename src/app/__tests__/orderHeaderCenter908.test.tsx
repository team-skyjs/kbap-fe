/** KB-908(T-111): 스캔 주문 화면 헤더("Your order / N dishes")만 왼쪽 정렬이었다 — 다른 화면처럼 가운데(뒤로 버튼과 같은 폭의 빈 칸으로 좌우 대칭) */
import ScanOrder from '../scan-order';
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canDismiss: () => false }), useLocalSearchParams: () => ({ items: '[]' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: null }) }));
jest.mock('@/lib/data/useIngredientCatalog', () => ({ useIngredientCatalog: () => ({ name: (c: string) => c }) }));
jest.mock('@/lib/exchange', () => ({ resolveCurrency: () => Promise.resolve('USD') }));
jest.mock('@/components', () => ({ IconChevron: () => null, IconArrowLeft: () => null }));
jest.mock('@/features/order/FlippedOrderCard', () => ({ FlippedOrderCard: () => null }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn(), EVENTS: {} }));


it('제목·부제 가운데 · 뒤로 버튼 반대편에 같은 폭 빈 칸', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<ScanOrder />); });
  const texts = tree.root.findAll((n) => typeof n.type === 'string' && (n.props.children === 'order.title' || String(n.props.children).startsWith('order.headerSub')));
  expect(texts.length).toBe(2);
  for (const n of texts) expect(StyleSheet.flatten(n.props.style).textAlign).toBe('center');
  const backW = StyleSheet.flatten(tree.root.findAll((n) => n.props?.testID === 'order-back' && typeof n.type === 'string')[0].props.style).width;
  expect(backW).toBe(36);
  // 헤더 줄 = 뒤로 버튼 · 제목 블록 · 같은 폭 빈 칸(자식 없음) 순
  let row = tree.root.findAll((n) => n.props?.testID === 'order-header-text' && typeof n.type === 'string')[0].parent!;
  while (typeof row.type !== 'string') row = row.parent!;
  const hostKids = row.findAll((n) => typeof n.type === 'string' && n.parent != null && (n.parent === row || (typeof n.parent.type !== 'string' && n.parent.parent === row)));
  const last = hostKids[hostKids.length - 1];
  expect(StyleSheet.flatten(last.props.style).width).toBe(backW);
  expect(last.props.testID).toBeUndefined();
  expect(last.findAll((n) => typeof n.type === 'string').length).toBe(1); // 빈 칸
  act(() => tree.unmount());
});

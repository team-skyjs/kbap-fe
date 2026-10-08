/** KB-730 — /states 카탈로그의 dev 전용 "리뷰 유도 상태 초기화": 진단 채널에서만 보이고, 누르면 kbap.reviewPrompt.v1 삭제. */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }), usePathname: () => '/states' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: { View, ScrollView, createAnimatedComponent: (c: unknown) => c }, useSharedValue: (v: unknown) => ({ value: v }), useAnimatedStyle: () => ({}), withSpring: (v: unknown) => v, withTiming: (v: unknown) => v, withRepeat: (v: unknown) => v, useReducedMotion: () => false, Easing: { out: () => () => 0, quad: 0, linear: () => 0 } };
});
const mockDiag = jest.fn(() => true);
jest.mock('@/lib/flags', () => ({ ...jest.requireActual('@/lib/flags'), isDiagnosticChannel: () => mockDiag() }));

/* eslint-disable import/first -- jest.mock 선언 뒤(팩토리 호이스팅) — 레포 관례 */
import States from '../states';
import { REVIEW_PROMPT_KEY } from '@/lib/reviewPrompt';
import AsyncStorage from '@react-native-async-storage/async-storage';
/* eslint-enable import/first */

const render = async () => { let t!: ReactTestRenderer; await act(async () => { t = renderer.create(<States />); }); return t; };
const btn = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'states-reset-review-prompt' && typeof n.type === 'string'); // 호스트 노드 1
const press = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'states-reset-review-prompt' && typeof n.props?.onPress === 'function')[0];

it('진단 채널 = 초기화 버튼 1 · 누르면 kbap.reviewPrompt.v1 삭제(스캔 성공 카운트 포함)', async () => {
  await AsyncStorage.setItem(REVIEW_PROMPT_KEY, JSON.stringify({ lastShownAt: 1, shows: 2, done: false, scanSuccess: 5, scanPrompted: true }));
  const t = await render();
  expect(btn(t)).toHaveLength(1);
  await act(async () => { press(t).props.onPress(); });
  await act(async () => { await Promise.resolve(); });
  expect(await AsyncStorage.getItem(REVIEW_PROMPT_KEY)).toBeNull();
});

it('운영(진단 채널 아님) = 버튼 0', async () => {
  mockDiag.mockReturnValue(false);
  const t = await render();
  expect(btn(t)).toHaveLength(0);
});

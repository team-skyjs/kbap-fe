/**
 * P-134: 첫 스캔 코치마크 — 1회 플래그·4행(정본 카피 키)·캡션·신규 키 ×10 패리티.
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
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    cancelAnimation: () => {},
    useReducedMotion: () => false,
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { markCoachSeen, ScanCoachMark, shouldShowCoachMark } from '../ScanCoachMark';

it('1회 플래그 — 처음 true, markCoachSeen 후 false', async () => {
  await AsyncStorage.clear();
  await expect(shouldShowCoachMark()).resolves.toBe(true);
  markCoachSeen();
  await new Promise((r) => setTimeout(r, 0));
  await expect(shouldShowCoachMark()).resolves.toBe(false);
});

it('4행(정본 의미 키) + 캡션 + Got it 렌더', () => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<ScanCoachMark open onClose={jest.fn()} t={(k) => k} />);
  });
  for (const r of ['safe', 'caution', 'danger', 'unable']) {
    expect(tree.root.findAll((n) => n.props?.testID === `coach-${r}`).length).toBeGreaterThanOrEqual(1);
    expect(tree.root.findAll((n) => n.props?.children === `coach.${r}`).length).toBeGreaterThanOrEqual(1);
  }
  expect(tree.root.findAll((n) => n.props?.children === 'coach.caption').length).toBeGreaterThanOrEqual(1);
});

const LANGS = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
it.each(LANGS)('%s — P-134 신규 키 패리티(코치·회피·맵기 카피)', (lang) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const d = require(`@/lib/i18n/${lang}.json`) as Record<string, Record<string, string>>;
  for (const k of ['title', 'safe', 'caution', 'danger', 'unable', 'caption']) expect(d.coach[k]).toBeTruthy();
  for (const k of ['avoidSub', 'selectedCount', 'noneSelectedYet', 'clearSelection', 'nothingToAvoid', 'kidsBadge', 'finishSetup', 'skipDecideLater']) expect(d.onboarding[k]).toBeTruthy();
  for (let i = 0; i <= 4; i++) expect(d.onboarding[`spiceDesc${i}`]).toBeTruthy();
  for (const k of ['dairy', 'nuts', 'grains', 'seafood', 'meat', 'produce', 'etc']) expect(d.ingCat[k]).toBeTruthy();
});

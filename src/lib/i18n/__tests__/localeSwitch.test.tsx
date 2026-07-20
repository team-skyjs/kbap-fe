/**
 * P-015(KB-187): 언어 전환 → lang 종속 서버 쿼리 1회 무효화를 잠근다.
 * 원인: changeLanguage(비동기) 완료 전 리렌더에선 쿼리 키의 i18n.language가
 * 이전 언어라 키가 안 바뀌고, staleTime(60s) 동안 구언어 데이터가 잔상으로
 * 남는다. 전환 완료 직후 home/foods/food/me만 invalidate — 비언어 쿼리 무접촉.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('../index', () => ({
  __esModule: true,
  default: { language: 'en', changeLanguage: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../useScriptFonts', () => ({ useScriptFonts: () => true }));

import { LocaleProvider, useLocale } from '../LocaleProvider';
import { queryClient } from '@/lib/queryClient';
import type { SupportedLang } from '../languages';

let capturedSetLang!: (l: SupportedLang) => void;
function Grab() {
  const { setLang } = useLocale();
  capturedSetLang = setLang;
  return null;
}

const isInvalidated = (key: unknown[]) =>
  queryClient.getQueryCache().find({ queryKey: key })?.state.isInvalidated ?? false;

afterEach(() => queryClient.clear());

it('setLang → lang 종속 쿼리(home/foods/food/me)만 무효화, 비언어 쿼리 무접촉', async () => {
  queryClient.setQueryData(['home', 'en'], {});
  queryClient.setQueryData(['foods', 'list', 'en'], []);
  queryClient.setQueryData(['food', '7', 'en'], {});
  queryClient.setQueryData(['me', 'en'], {});
  queryClient.setQueryData(['recentSearches'], []); // 언어 무관 — 건드리면 안 됨

  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <LocaleProvider>
        <Grab />
      </LocaleProvider>,
    );
  });
  await act(async () => {
    capturedSetLang('ko');
    await Promise.resolve(); // changeLanguage(resolved mock) → then(invalidate) 해소
  });

  expect(isInvalidated(['home', 'en'])).toBe(true);
  expect(isInvalidated(['foods', 'list', 'en'])).toBe(true);
  expect(isInvalidated(['food', '7', 'en'])).toBe(true);
  expect(isInvalidated(['me', 'en'])).toBe(true);
  expect(isInvalidated(['recentSearches'])).toBe(false);
  await act(async () => tree.unmount());
});

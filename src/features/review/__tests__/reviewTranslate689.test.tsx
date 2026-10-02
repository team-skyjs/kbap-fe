/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-689(P-434) — 번역 2차: X 방식. 스펙 = spec translate-2026-10-02.md **2차 절** · 레퍼런스 translate-ref-x-before/after.png.
 * 본문 **위 왼쪽** 한 줄 라벨: 번역 전 "Show translation"(#1B95E0) → 번역 중 "Translating…"(#536471) →
 * 번역 후 "Translated from {언어}"(#536471, 누르면 원문). 원문 언어 = 응답 sourceLanguage(KB-688 · null·없음 = "Translated").
 * 원문 언어 == 요청 언어 = 번역 표시 안 함 + 그 리뷰 라벨 숨김.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-router', () => ({ useSegments: () => [], useRouter: () => ({ push: jest.fn() }) }));
let mockLang = 'ko'; // #220 공부 ②: 앱 언어 전환 시나리오용 가변
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { language?: string }) => (o?.language ? `${k}:${o.language}` : k), i18n: { language: mockLang } }),
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'ko', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false, useSession: () => null }));
const mockPost = jest.fn();
jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual('@/lib/api/client') as Record<string, unknown>;
  return { ...actual, api: { get: jest.fn(), post: (...a: unknown[]) => mockPost(...a), patch: jest.fn(), del: jest.fn() }, apiLang: () => mockLang };
});
jest.mock('@/lib/flags', () => {
  const a = jest.requireActual('@/lib/flags') as { FLAGS: Record<string, unknown> };
  return { ...a, FLAGS: { ...a.FLAGS, contentTranslation: true } }; // 가변 사본 — off 케이스는 테스트 안에서 전환
});
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a) }));

import { FeedCard } from '../FeedCard';
import type { Review } from '@/lib/api/types';
import { StyleSheet } from 'react-native';
import { TRANSLATE_LABEL } from '@/components/TranslateButton';

const REVIEW = (over: Partial<Review> = {}): Review =>
  ({ id: '53', foodId: '7', rating: 5, body: 'Really good soup', createdAt: '2026-10-01', authorNationality: 'US', author: { nickname: 'Amy', memberId: 9 }, ...over }) as Review;

let qc: QueryClient;
const card = (review: Review) => (
  <QueryClientProvider client={qc}>
    <FeedCard review={review} t={(k) => k} mine={false} onOpenFood={jest.fn()} onGuestHelpful={jest.fn()} onMore={jest.fn()} />
  </QueryClientProvider>
);
function render(review: Review): ReactTestRenderer {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(card(review));
  });
  return tree;
}
const rerender = (tree: ReactTestRenderer, review: Review) => act(() => tree.update(card(review)));
const btn = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'translate-btn' && typeof n.props.onPress === 'function')[0];
const out = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());
const press = async (t: ReactTestRenderer) => {
  await act(async () => {
    btn(t).props.onPress();
    await Promise.resolve();
  });
};
/** 라벨 Text(호스트) — 색·크기 단언용 */
const labelText = (t: ReactTestRenderer) => {
  const texts = btn(t).findAll((n) => typeof n.type === 'string' && n.props?.style != null && typeof n.props.children === 'string');
  return { text: texts[0].props.children as string, style: StyleSheet.flatten(texts[0].props.style) as { color?: string; fontSize?: number } };
};
const RES = (over: Record<string, unknown> = {}) => ({ targetType: 'REVIEW', targetId: 53, language: 'ko', text: '정말 맛있는 국', sourceLanguage: 'en', ...over });

beforeEach(() => {
  mockLang = 'ko';
  mockPost.mockReset();
  mockToast.mockReset();
});

it('상수 = 스펙 값(레퍼런스 픽셀 실측) — 번역 전 #1B95E0 · 번역 중/후 #536471 · 글자 12.5', () => {
  expect(TRANSLATE_LABEL).toEqual({ idleColor: '#1B95E0', mutedColor: '#536471', fontSize: 12.5 });
});

it('라벨은 본문 **위**(같은 카드 안 렌더 순서) · 본문 아래 버튼 없음 · 번역 전 = "Show translation" #1B95E0 12.5', () => {
  const t = render(REVIEW());
  const s = out(t);
  expect(s.indexOf('translation.showTranslation')).toBeGreaterThan(-1);
  expect(s.indexOf('translation.showTranslation')).toBeLessThan(s.indexOf('Really good soup'));
  expect(labelText(t)).toEqual({ text: 'translation.showTranslation', style: expect.objectContaining({ color: '#1B95E0', fontSize: 12.5 }) });
});

it('번역 중 = 같은 자리 "Translating…" #536471 · 본문 원문 유지 · 비활성', async () => {
  let resolve!: (v: unknown) => void;
  mockPost.mockReturnValue(new Promise((r) => (resolve = r)));
  const t = render(REVIEW());
  await press(t);
  expect(labelText(t)).toEqual({ text: 'reviews.translating', style: expect.objectContaining({ color: '#536471', fontSize: 12.5 }) });
  expect(out(t)).toContain('Really good soup');
  expect(btn(t).props.disabled).toBe(true);
  await act(async () => {
    resolve(RES());
    await Promise.resolve();
  });
});

it('번역 후 = 본문 교체 + "Translated from {영어}" #536471 → 누르면 원문 + "Show translation"', async () => {
  mockPost.mockResolvedValue(RES());
  const t = render(REVIEW());
  await press(t);
  expect(out(t)).toContain('정말 맛있는 국');
  expect(out(t)).not.toContain('Really good soup');
  expect(labelText(t)).toEqual({ text: 'translation.translatedFrom:translation.lang.en', style: expect.objectContaining({ color: '#536471', fontSize: 12.5 }) });
  await press(t);
  expect(out(t)).toContain('Really good soup');
  expect(labelText(t).text).toBe('translation.showTranslation');
  expect(mockPost).toHaveBeenCalledTimes(1);
});

// 서버 KB-688 계약: 앱 10개 언어는 앱이 lang으로 보내는 코드와 글자까지 같게 정규화돼 온다 → 클라는 **정확 일치**만(재정규화 0)
it.each([
  ['en', 'translation.translatedFrom:translation.lang.en'],
  ['ja', 'translation.translatedFrom:translation.lang.ja'],
  ['zh-Hans', 'translation.translatedFrom:translation.lang.zh-Hans'],
  ['zh-Hant', 'translation.translatedFrom:translation.lang.zh-Hant'],
  ['es', 'translation.translatedFrom:translation.lang.es'],
  ['fr', 'translation.translated'], // 앱 10개 밖(서버는 언어 부분 소문자)
  ['en-US', 'translation.translated'], // 정규화 안 된 값 = 모르는 코드(서버 계약 위반 시에도 안전 폴백)
  [null, 'translation.translated'], // 판별 못 함
  ['', 'translation.translated'],
  [undefined, 'translation.translated'], // 구서버 — 키 없음(KB-688 배포 전 폴백)
])('sourceLanguage %j → %s', async (src, want) => {
  const res = RES();
  if (src === undefined) delete (res as Record<string, unknown>).sourceLanguage;
  else res.sourceLanguage = src;
  mockPost.mockResolvedValue(res);
  const t = render(REVIEW());
  await press(t);
  expect(labelText(t).text).toBe(want);
});

it('sourceLanguage === language(요청 언어) → 번역 표시로 바꾸지 않고 그 리뷰 라벨 숨김(토스트 0, 재렌더에도 숨김)', async () => {
  mockPost.mockResolvedValue(RES({ sourceLanguage: 'ko', language: 'ko', text: 'Really good soup' }));
  const t = render(REVIEW());
  await press(t);
  expect(btn(t)).toBeUndefined();
  expect(out(t)).toContain('Really good soup');
  expect(mockToast).not.toHaveBeenCalled();
  rerender(t, REVIEW());
  expect(btn(t)).toBeUndefined();
});

it('본문 접힘("more")과 함께 — 라벨은 접힘 대상 밖(본문 Text 위 별도 줄), 펼침 토글은 본문 아래', () => {
  const t = render(REVIEW());
  act(() => {
    t.root.findAll((x) => typeof x.props?.onTextLayout === 'function')[0].props.onTextLayout({ nativeEvent: { lines: Array(5).fill({}) } });
  });
  const clampText = t.root.findAll((x) => typeof x.props?.onTextLayout === 'function')[0];
  expect(JSON.stringify(clampText.props.children)).not.toContain('translation.');
  const s = out(t);
  expect(s.indexOf('translation.showTranslation')).toBeLessThan(s.indexOf('Really good soup'));
  expect(s.indexOf('Really good soup')).toBeLessThan(s.indexOf('"body-toggle"'));
});

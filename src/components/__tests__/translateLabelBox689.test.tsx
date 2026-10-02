/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-689 번역 라벨 터치 상자 — **44×44가 부모 안에 실제로 놓인다**를 한 곳에서(Codex #223 P2 3라운드: 세로 → 부모 경계 → 가로).
 * 모든 상태(번역 전·중·후 이름·후 폴백) × 10로케일의 최단·최장 실제 문구로 렌더해, 스타일로 계산한 상자를 단언한다.
 * - 세로: padTop + 줄 + padBottom ≥ 44 · 가로: minWidth 44 · 부모 안: 음수 marginTop/Left 0 · maxWidth 100% · hitSlop 없음 · 1줄
 * - 부모 쪽(래퍼 marginTop = −padTop, 상자 bottom ≤ 래퍼 최소 높이)은 reviewTranslate689가 FeedCard 렌더로 단언.
 */
import * as React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { StyleSheet } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
const DICT: Record<string, Record<string, unknown>> = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.join(__dirname, '../../lib/i18n', `${l}.json`), 'utf8'))]),
);
let mockLocale = 'en';
const lookup = (k: string, o?: Record<string, string>) => {
  const v = k.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], DICT[mockLocale]);
  return String(v).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => o?.[n] ?? '');
};
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => lookup(k, o) }) }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { TranslateButton, TRANSLATE_LABEL, TRANSLATE_LABEL_LINE_H, TRANSLATION_LANG_CODES, type TranslateLabelState } from '../TranslateButton';

type Case = { state: TranslateLabelState; src: string | null };
const CASES: Case[] = [
  { state: 'idle', src: null },
  { state: 'loading', src: null },
  { state: 'translated', src: null }, // 폴백 "Translated"
  ...TRANSLATION_LANG_CODES.map((c) => ({ state: 'translated' as const, src: c })),
];

function renderCase(c: Case) {
  let t!: ReactTestRenderer;
  act(() => {
    t = renderer.create(<TranslateButton state={c.state} sourceLanguage={c.src} onPress={() => {}} />);
  });
  const btn = t.root.findAll((n) => n.props?.testID === 'translate-btn' && typeof n.props?.onPress === 'function')[0];
  const text = btn.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')[0];
  return { btn, text };
}

describe.each(LOCALES)('%s', (locale) => {
  it('모든 상태 × 최단·최장 문구 — 상자 44×44 · 부모 안 · 1줄', () => {
    mockLocale = locale;
    const rendered = CASES.map((c) => ({ c, ...renderCase(c) }));
    const byLen = [...rendered].sort((a, b) => String(a.text.props.children).length - String(b.text.props.children).length);
    for (const r of [byLen[0], byLen[byLen.length - 1]]) {
      const box = StyleSheet.flatten(r.btn.props.style) as Record<string, number | string | undefined>;
      const label = StyleSheet.flatten(r.text.props.style) as { lineHeight?: number; fontSize?: number };
      expect(label.lineHeight).toBe(TRANSLATE_LABEL_LINE_H);
      expect(label.fontSize).toBe(TRANSLATE_LABEL.fontSize);
      expect((box.paddingTop as number) + TRANSLATE_LABEL_LINE_H + (box.paddingBottom as number)).toBeGreaterThanOrEqual(44); // 세로
      expect(box.minWidth).toBeGreaterThanOrEqual(44); // 가로(짧은 라벨도)
      expect(box.maxWidth).toBe('100%'); // 긴 라벨도 부모 폭 안(말줄임)
      expect((box.marginTop as number | undefined) ?? 0).toBeGreaterThanOrEqual(0); // 위로 부모 밖 금지
      expect((box.marginLeft as number | undefined) ?? 0).toBeGreaterThanOrEqual(0); // 왼쪽 부모 밖 금지
      expect(box.alignSelf).toBe('flex-start'); // 오른쪽으로만 넓어짐(왼쪽 정렬·글자 위치 무변)
      expect(r.btn.props.hitSlop).toBeUndefined();
      expect(r.text.props.numberOfLines).toBe(1);
    }
  });
});

it('minWidth가 실제로 필요한 경우가 있다 — 최단 라벨("已翻译" 등)이 44 미만(글자 크기 폭 추정)', () => {
  const shortest = LOCALES.flatMap((l) => {
    mockLocale = l;
    return CASES.map((c) => String(renderCase(c).text.props.children));
  }).sort((a, b) => a.length - b.length)[0];
  expect(shortest.length * TRANSLATE_LABEL.fontSize).toBeLessThan(44);
});

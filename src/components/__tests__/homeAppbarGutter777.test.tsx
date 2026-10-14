/* eslint-disable @typescript-eslint/no-require-imports, import/first --
   jest 구조상 불가피: jest.mock 팩토리는 호이스팅되어 import보다 먼저 실행 — 팩토리 안은 require만. 레포 관례 동일(subHeaderTitleCenter403). */
/**
 * KB-777 — 홈 앱바 마크·벨의 **보이는 끝**을 본문 거터(20)에 맞춘다(헤더 거터 16). 홈 전용 opt-in(alignToHomeGutter) —
 * 다른 화면·back 모드 무변.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: { createAnimatedComponent: (C: unknown) => C, View },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withSequence: (...v: unknown[]) => v[v.length - 1],
    Easing: { out: (e: unknown) => e, inOut: (e: unknown) => e, cubic: 'cubic', ease: 'ease', linear: 'linear' },
  };
});
jest.mock('react-native-svg', () => {
  const R = require('react') as typeof import('react');
  const mk = (name: string) => (props: Record<string, unknown>) => R.createElement(name, props, props.children as never);
  return { __esModule: true, default: mk('Svg'), Svg: mk('Svg'), Path: mk('Path'), G: mk('G'), Defs: mk('Defs'), ClipPath: mk('ClipPath'), Rect: mk('Rect'), Circle: mk('Circle'), Line: mk('Line') };
});

import { StickyHeader } from '../StickyHeader';

const flat = (s: unknown) => Object.assign({}, ...[s].flat(Infinity as 1).filter(Boolean) as object[]) as Record<string, unknown>;
const host = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string')[0];
const render = (el: React.ReactElement) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(el); }); return t; };
const HEADER_GUTTER = 16; // StickyHeader root paddingHorizontal
const BODY_GUTTER = 20; // 홈 검색·칩·카드 거터

it('홈(alignToHomeGutter) = 마크 왼쪽 16 + 4 = 20 · 벨 줄 오른쪽 -7', () => {
  const t = render(<StickyHeader hidden={false} atTop mode="brand" alignToHomeGutter bell onBell={() => {}} />);
  expect(flat(host(t, 'header-mark').props.style).marginLeft).toBe(4);
  expect(HEADER_GUTTER + 4).toBe(BODY_GUTTER);
  expect(flat(host(t, 'header-actions').props.style).marginRight).toBe(-7);
});

it('보이는 글리프 기준 산식 — 벨 오른쪽 끝(16 + 9 + 1.9 − 7)이 스캔 버튼 끝(거터 20)과 0.5px 안', () => {
  const pad = (40 - 22) / 2; // 터치 상자 40 안 아이콘 22
  const inset = (24 - (21.0 + 1.8 / 2)) * (22 / 24); // lucide 벨 오른쪽 발 x 21.0 + 획 절반 → 24단위 안쪽 여백
  expect(Math.abs(HEADER_GUTTER + pad + inset - 7 - BODY_GUTTER)).toBeLessThan(0.5);
});

it('다른 화면(food·profile brand)·back 모드 = 무변(마크 여백 0 · 벨 줄 여백 0)', () => {
  const brand = render(<StickyHeader hidden={false} atTop mode="brand" bell onBell={() => {}} />);
  expect(flat(host(brand, 'header-mark').props.style).marginLeft).toBeUndefined();
  expect(flat(host(brand, 'header-actions').props.style).marginRight).toBeUndefined();
  const back = render(<StickyHeader hidden={false} atTop mode="back" title="t" onBack={() => {}} />);
  expect(host(back, 'header-mark')).toBeUndefined();
  expect(flat(host(back, 'header-actions').props.style).marginRight).toBeUndefined();
});

it('opt-in은 홈(index.tsx) 두 곳만 — 음식·프로필·리뷰 목록 헤더는 안 씀', () => {
  const app = path.join(__dirname, '..', '..', 'app');
  const read = (...s: string[]) => fs.readFileSync(path.join(app, ...s), 'utf8');
  expect((read('(tabs)', 'index.tsx').match(/alignToHomeGutter/g) ?? []).length).toBe(2);
  for (const f of [['(tabs)', 'food.tsx'], ['(tabs)', 'profile.tsx'], ['food', '[id]', 'reviews.tsx']]) expect(read(...f)).not.toContain('alignToHomeGutter');
});

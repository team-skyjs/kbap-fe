/* eslint-disable @typescript-eslint/no-require-imports, import/first --
   jest 구조상 불가피: jest.mock 팩토리는 호이스팅되어 import보다 먼저 실행 — 팩토리 안은 require만. 레포 관례 동일(subHeaderTitleCenter403). */
/**
 * KB-820 — 4탭(홈·음식·리뷰·프로필) 앱바 마크·벨 위치 동일. KB-777의 홈 전용 오프셋(alignToHomeGutter, 마크 +4·벨 −7)은
 * "홈 본문 거터 20" 전제가 낡아(10/20 실기: 4탭 모두 본문 거터 16) 제거했다.
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

it('brand 헤더 = 마크·벨 줄에 별도 여백 없음(헤더 거터 16 그대로) — 벨 유무와 무관', () => {
  for (const bell of [true, false]) {
    const t = render(<StickyHeader hidden={false} atTop mode="brand" bell={bell} onBell={() => {}} />);
    expect(flat(host(t, 'header-mark').props.style).marginLeft).toBeUndefined();
    expect(flat(host(t, 'header-actions').props.style).marginRight).toBeUndefined();
  }
});

it('4탭 헤더 호출이 같은 규칙 — 홈 전용 오프셋 prop·상수가 코드에서 사라짐', () => {
  const src = path.join(__dirname, '..', '..');
  const read = (...s: string[]) => fs.readFileSync(path.join(src, ...s), 'utf8');
  for (const f of [['app', '(tabs)', 'index.tsx'], ['app', '(tabs)', 'food.tsx'], ['app', '(tabs)', 'profile.tsx'], ['app', '(tabs)', 'community.tsx'], ['components', 'StickyHeader.tsx']]) {
    const code = read(...f);
    expect(code).not.toMatch(/alignToHomeGutter|HOME_MARK_INSET|HOME_BELL_OUTSET/);
  }
});

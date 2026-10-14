/* eslint-disable import/first -- jest.mock 선언 뒤에 대상 모듈을 import(레포 테스트 관례) */
/**
 * KB-784 — ui_click·screen_view 규칙: target 정규화(PII 토큰 → :v) · 라우트 → screen · Pressable/Txt 자동 계측 · screen_view 1회.
 */
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  EVENTS: { ui_click: 'ui_click', screen_view: 'screen_view' },
  track: (...a: unknown[]) => mockTrack(...a),
}));
let mockSegments: string[] = [];
jest.mock('expo-router', () => ({ useSegments: () => mockSegments }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ script: 'latin' }) }));

import * as React from 'react';
import * as fs from 'fs';
import renderer, { act } from 'react-test-renderer';
import { normalizeTarget, screenFromSegments, setCurrentScreen } from '../uiClick';
import { useScreenTracking } from '../useScreenTracking';
import { Pressable } from '@/components/Pressable';
import { Txt } from '@/components/Txt';
import { INGREDIENTS } from '@/lib/mocks/ingredients';
import { COUNTRIES } from '@/lib/onboarding/countries';

beforeEach(() => {
  mockTrack.mockReset();
  setCurrentScreen('root');
});
const mount = (el: React.ReactElement) => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(el); });
  return t;
};

describe('normalizeTarget — 소문자 영단어만 원문, 나머지 :v', () => {
  it.each([
    ['profile-menu-saved', 'profile-menu-saved'],
    ['home-food-123', 'home-food-:v'],
    ['avoid-EGG', 'avoid-:v'],
    ['nat-US', 'nat-:v'],
    ['feed-flag-19', 'feed-flag-:v'],
    ['feed-flag-r_19', 'feed-flag-r_:v'], // 구분자 안쪽 소문자 조각은 남는다(규칙 그대로 — id는 숫자)
    ['order-item-photo-3-12', 'order-item-photo-:v'],
    ['home-chip-safe', 'home-chip-safe'],
    ['tab-scan', 'tab-scan'],
    ['place-pick-서울역', 'place-pick-:v'],
    ['  ', ':v'],
  ])('%s → %s', (raw, out) => {
    expect(normalizeTarget(raw)).toBe(out);
  });

  it('PII 전수: 회피 재료 코드·국가 코드가 testID에 실려도 target에 남지 않는다', () => {
    const leaks: string[] = [];
    for (const i of INGREDIENTS) if (normalizeTarget(`avoid-${i.code}`).includes(i.code)) leaks.push(i.code);
    for (const c of COUNTRIES) if (normalizeTarget(`nat-${c.code}`).includes(c.code)) leaks.push(c.code);
    expect(INGREDIENTS.length).toBeGreaterThan(50);
    expect(COUNTRIES.length).toBeGreaterThan(100);
    expect(leaks).toEqual([]);
  });
});

it('screenFromSegments — 라우트 패턴(id 값 없음), (tabs) 루트 = 홈', () => {
  expect(screenFromSegments([])).toBe('root');
  expect(screenFromSegments(['(tabs)'])).toBe('(tabs)/index');
  expect(screenFromSegments(['(tabs)', 'profile'])).toBe('(tabs)/profile');
  expect(screenFromSegments(['food', '[id]'])).toBe('food/[id]');
  expect(screenFromSegments(['profile', 'order', '[id]'])).toBe('profile/order/[id]');
});

it('useScreenTracking — 패턴이 바뀔 때만 1회 · 같은 패턴 재렌더 0 · ui_click의 screen 갱신', () => {
  function Probe() {
    useScreenTracking();
    return null;
  }
  mockSegments = ['(tabs)'];
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Probe />); });
  mockSegments = ['(tabs)']; // 같은 패턴(포그라운드 복귀·재렌더)
  act(() => tree.update(<Probe />));
  mockSegments = ['food', '[id]'];
  act(() => tree.update(<Probe />));
  expect(mockTrack.mock.calls).toEqual([
    ['screen_view', { screen: '(tabs)/index' }],
    ['screen_view', { screen: 'food/[id]' }],
  ]);
  // 이후 클릭은 현재 화면으로
  const press = mount(<Pressable testID="detail-ask-owner" onPress={() => {}} />);
  act(() => press.root.findAll((n) => n.props.testID === 'detail-ask-owner' && n.type !== Pressable)[0].props.onPress({}));
  expect(mockTrack).toHaveBeenLastCalledWith('ui_click', { screen: 'food/[id]', target: 'detail-ask-owner' });
});

it('포그라운드 복귀 재발화 없음 — 화면 조회 훅은 AppState를 구독하지 않는다(예진 10/14)', () => {
  expect(fs.readFileSync('src/lib/useScreenTracking.ts', 'utf8')).not.toMatch(/AppState/);
});

describe('components/Pressable — 자동 ui_click', () => {
  it('탭 = 핸들러보다 먼저 ui_click(현재 화면 + 정규화 target) 1건', () => {
    setCurrentScreen('(tabs)/profile');
    const order: string[] = [];
    mockTrack.mockImplementation(() => order.push('track'));
    const tree = mount(<Pressable testID="profile-menu-saved" onPress={() => order.push('handler')} />);
    act(() => tree.root.findAll((n) => typeof n.type === 'object' || typeof n.type === 'function').find((n) => typeof n.props.onPress === 'function' && n.props.testID === 'profile-menu-saved' && n.type !== Pressable)!.props.onPress({}));
    expect(order).toEqual(['track', 'handler']);
    expect(mockTrack).toHaveBeenCalledWith('ui_click', { screen: '(tabs)/profile', target: 'profile-menu-saved' });
  });
  it('uiTarget이 testID보다 우선(자유 텍스트 testID 보호) · 길게 누르기 = -long', () => {
    const tree = mount(<Pressable testID="place-pick-Myeongdong Kyoja" uiTarget="place-pick" onPress={() => {}} onLongPress={() => {}} />);
    const host = tree.root.findAll((n) => n.props.testID === 'place-pick-Myeongdong Kyoja' && n.type !== Pressable)[0];
    act(() => host.props.onPress({}));
    act(() => host.props.onLongPress({}));
    expect(mockTrack.mock.calls.map((c) => (c[1] as { target: string }).target)).toEqual(['place-pick', 'place-pick-long']);
  });
  it('onPress 없는 Pressable = 계측 0(핸들러 미부착 유지)', () => {
    const tree = mount(<Pressable testID="x" />);
    const host = tree.root.findAll((n) => n.props.testID === 'x' && n.type !== Pressable)[0];
    expect(host.props.onPress).toBeUndefined();
    expect(mockTrack).not.toHaveBeenCalled();
  });
});

it('Txt onPress(링크 텍스트) = ui_click · onPress 없는 글자 = 무변', () => {
  setCurrentScreen('login');
  const tree = mount(<Txt testID="terms-tos" onPress={() => {}}>Terms</Txt>);
  act(() => tree.root.findAll((n) => n.props.testID === 'terms-tos' && n.type !== Txt)[0].props.onPress({}));
  expect(mockTrack).toHaveBeenCalledWith('ui_click', { screen: 'login', target: 'terms-tos' });
  const plain = mount(<Txt testID="plain">Hi</Txt>);
  expect(plain.root.findAll((n) => n.props.testID === 'plain' && n.type !== Txt)[0].props.onPress).toBeUndefined();
});

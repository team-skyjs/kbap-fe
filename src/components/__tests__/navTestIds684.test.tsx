/**
 * KB-684(P-433) — 내비게이션 요소 testID(시뮬레이터 자동 검증 — 글자·좌표 의존 제거). 동작·모양 무변.
 * 렌더 = TabBar(누르면 원래 핸들러) · 소스 잠금 = 화면·애니메이션 헤더(testID가 **그 핸들러를 가진 요소**에 붙었는지).
 */
import * as React from 'react';
import * as fs from 'fs';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: undefined }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => true }));
jest.mock('../RemoteImage', () => ({ RemoteImage: () => null }));

// eslint-disable-next-line import/first
import { TabBar } from '../TabBar';

const LABELS = { home: 'H', food: 'F', scan: 'S', reviews: 'R', profile: 'P' };
const hostById = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function');

it('탭 4개 = tab-{key} · 스캔 FAB = tab-scan — 누르면 원래 핸들러(키 그대로)', () => {
  const onPress = jest.fn();
  const onScan = jest.fn();
  let t!: ReactTestRenderer;
  act(() => {
    t = renderer.create(<TabBar active="home" labels={LABELS} onPress={onPress} onScan={onScan} />);
  });
  for (const key of ['home', 'food', 'reviews', 'profile'] as const) {
    const el = hostById(t, `tab-${key}`);
    expect(el.length).toBeGreaterThan(0);
    act(() => el[0].props.onPress());
    expect(onPress).toHaveBeenLastCalledWith(key);
  }
  act(() => hostById(t, 'tab-scan')[0].props.onPress());
  expect(onScan).toHaveBeenCalledTimes(1);
  expect(onPress).toHaveBeenCalledTimes(4);
});

describe('소스 잠금 — testID가 그 핸들러를 가진 요소에', () => {
  const read = (p: string) => fs.readFileSync(p, 'utf8');
  it.each([
    ['src/app/search.tsx', /onPress=\{\(\) => router\.back\(\)\}[^>]*testID="search-back"/, 1],
    ['src/components/SubHeader.tsx', /onPress=\{onBack\}[^>]*testID="header-back"/, 1],
    ['src/components/StickyHeader.tsx', /onPress=\{onBack\}[^>]*testID="header-back"/, 1],
    ['src/components/StickyHeader.tsx', /onPress=\{onSearch\}[^>]*testID="header-search"/, 1],
    ['src/components/StickyHeader.tsx', /onPress=\{onSignIn\}[^>]*testID="header-signin"/, 1],
    ['src/app/scan.tsx', /onPress=\{\(\) => router\.back\(\)\}[^>]*testID="scan-close"/g, 2], // 커스텀 카메라 · 시스템 카메라 런처
    ['src/app/food/[id]/owner.tsx', /onPress=\{\(\) => router\.back\(\)\}[^>]*testID="owner-close"/, 1],
  ])('%s — %s', (file, re, count) => {
    const hits = read(file).match(re instanceof RegExp && re.global ? re : new RegExp(re.source, 'g')) ?? [];
    expect(hits).toHaveLength(count as number);
  });
});

/**
 * P-287(최종본) — 빈 상태·에러 블록·스켈레톤 잠금.
 * ① EmptyBlock 렌더 스냅샷(circle-dashed 24 + 16/400·버튼 0)
 * ② 에러 블록 — 마크 36 primary10% + Retry(outline) 라벨
 * ③ 스켈레톤 구조 스냅샷(홈·상세) + 톤(#F2F3F6/#EAEBEE).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Easing: { linear: () => 0, out: () => () => 0, quad: 0 },
  };
});
jest.mock('expo-router', () => ({ useSegments: () => [] }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/analytics', () => ({ EVENTS: { error_state_view: 'error_state_view' }, track: jest.fn() }));

import { EmptyBlock, QueryErrorBlock } from '@/components/StateBlock';
import { SkeletonHome, SkeletonFoodDetail } from '@/components/Skeleton';

const trees: ReactTestRenderer[] = [];
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
const flat = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());

it('① EmptyBlock — circle-dashed 24 + 16/400 #000, 버튼 0 (스냅샷)', () => {
  const tree = render(<EmptyBlock label="No recent scans" />);
  const s = flat(tree);
  expect(s).toContain('No recent scans');
  expect(s).toContain('"fontSize":16');
  expect(s).toContain('"fontWeight":"400"');
  expect(s).not.toContain('accessibilityState":{"disabled'); // 버튼 없음
  expect(tree.toJSON()).toMatchSnapshot();
});

it('①-b Codex #47 5차: EmptyBlock = 계측 0(빈 섹션 ≠ 에러 표면 — P-213 지표 오염 방지)', () => {
  const { track } = require('@/lib/analytics') as { track: jest.Mock };
  track.mockClear();
  render(<EmptyBlock label="Nothing" />);
  expect(track).not.toHaveBeenCalled();
});

it('② 에러 블록 — 마크 36 primary 10% + outline Retry(common.retry)·Go back 유지', () => {
  const onRetry = jest.fn();
  const tree = render(<QueryErrorBlock error={new Error('HTTP 500')} onRetry={onRetry} onGoBack={() => {}} />);
  const s = flat(tree);
  expect(s).toContain('states.errorTitle');
  expect(s).toContain('common.retry');
  expect(s).toContain('common.goBack');
  expect(s).toContain('"backgroundColor":"rgba(255,113,52,0.10)"'); // 마크 36 원
  expect(s).not.toContain('common.tryAgain'); // 구 라벨·아이콘 장식 소멸
  const retry = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'common.retry').length > 0).pop()!;
  act(() => retry.props.onPress());
  expect(onRetry).toHaveBeenCalledTimes(1);
});

it('②-b 오프라인(NETWORK) — 같은 골격·오프라인 카피', () => {
  const s = flat(render(<QueryErrorBlock error={new Error('NETWORK: timeout')} onRetry={() => {}} />));
  expect(s).toContain('states.offlineTitle');
  expect(s).toContain('common.retry');
});

it('③ 스켈레톤 — 홈·상세 구조 스냅샷 + 톤(#F2F3F6 이미지/#EAEBEE 바)', () => {
  const home = render(<SkeletonHome />);
  const hs = flat(home);
  expect(hs).toContain('"backgroundColor":"#F2F3F6"');
  expect(hs).toContain('"backgroundColor":"#EAEBEE"');
  expect(home.toJSON()).toMatchSnapshot('skeleton-home');
  const detail = render(<SkeletonFoodDetail />);
  // Codex #47 3차: 로드 전 = 중립(false-safe 차단) — safe 계열 색 부재 잠금(헌법 III)
  const ds = flat(detail);
  expect(ds).not.toContain('#EFFFF7');
  expect(ds).not.toContain('#00BE65');
  expect(ds).toContain('"height":56'); // 안전 행 자리(중립 회색)는 유지 — 시프트 0
  expect(detail.toJSON()).toMatchSnapshot('skeleton-food-detail');
});

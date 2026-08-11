/**
 * P-173: 제출 연타 공용 가드 — 동기 ref(같은 틱 N탭 = 1발사)·완료 후 재실행·실패 복구,
 * Btn busy(스피너 오버레이 + 원 라벨 투명 보존 = 메트릭 불변 + 탭 차단).
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
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
  };
});

import { useSubmitGuard } from '../useSubmitGuard';
import { Btn } from '@/components/Btn';

let guard!: ReturnType<typeof useSubmitGuard>;
function Probe() {
  guard = useSubmitGuard();
  return null;
}

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

it('같은 틱 연타 3회 = 1발사 · 완료 후엔 재실행 가능', async () => {
  render(<Probe />);
  const fn = jest.fn().mockResolvedValue(undefined);
  await act(async () => {
    void guard.run(fn);
    void guard.run(fn);
    void guard.run(fn);
    await Promise.resolve();
  });
  expect(fn).toHaveBeenCalledTimes(1);
  await act(async () => {
    await guard.run(fn); // 완료 후 재실행 — 1회성 아님
  });
  expect(fn).toHaveBeenCalledTimes(2);
});

it('실패해도 finally 복구 — 다음 제출 가능(에러는 로그 흡수)', async () => {
  render(<Probe />);
  const fail = jest.fn().mockRejectedValue(new Error('HTTP 500'));
  await act(async () => {
    await guard.run(fail);
  });
  const ok = jest.fn().mockResolvedValue(undefined);
  await act(async () => {
    await guard.run(ok);
  });
  expect(ok).toHaveBeenCalledTimes(1);
});

it('Btn busy — 탭 차단 + 스피너 + 원 라벨 투명 보존(메트릭 불변)', () => {
  const onPress = jest.fn();
  const tree = render(<Btn busy onPress={onPress}>Save</Btn>);
  expect(tree.root.findAll((n) => n.props?.testID === 'btn-busy').length).toBeGreaterThanOrEqual(1);
  // 라벨은 사라지지 않고 투명(자리 유지 — 리플로 0)
  const { StyleSheet } = require('react-native');
  const hidden = tree.root.findAll((n) => {
    const st = StyleSheet.flatten(n.props?.style ?? {}) as { opacity?: number };
    return st.opacity === 0;
  });
  expect(hidden.length).toBeGreaterThanOrEqual(1);
  // 탭 차단
  const pressable = tree.root.findAll((n) => n.props?.accessibilityState?.disabled === true);
  expect(pressable.length).toBeGreaterThanOrEqual(1);
});

it('P-175: dangerGhost — 취소(ghost)와 같은 버튼 프레임(보더+라운딩+패딩), 색만 destructive', () => {
  const { StyleSheet } = require('react-native');
  const tree = render(<Btn variant="dangerGhost">Rescan</Btn>);
  const framed = tree.root.findAll((n) => {
    const st = StyleSheet.flatten(n.props?.style ?? {}) as { borderWidth?: number; borderRadius?: number };
    return st.borderWidth === 1.5 && (st.borderRadius ?? 0) >= 12; // ghost와 동일 프레임 문법
  });
  expect(framed.length).toBeGreaterThanOrEqual(1);
  const label = tree.root.findAll((n) => {
    const st = StyleSheet.flatten(n.props?.style ?? {}) as { color?: string };
    return st.color === '#cf3a2c'; // destructive 텍스트(기존 riskDanger 토큰)
  });
  expect(label.length).toBeGreaterThanOrEqual(1);
});

it('P-175: 노출처 전수 — 재스캔·커뮤니티 이탈 destructive 행 = dangerGhost(텍스트 행 잔존 0)', () => {
  const fs = require('fs');
  for (const f of ['src/app/scan.tssx'.replace('tssx', 'tsx'), 'src/app/community/compose.tsx']) {
    const src = fs.readFileSync(f, 'utf8') as string;
    expect(src).toContain('variant="dangerGhost"');
    expect(src).not.toContain('discardRow'); // 구 텍스트 행 문법 소멸
  }
});

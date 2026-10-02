/**
 * KB-699 · Codex #229 — 동작 줄이기 세션 기억(useMotionState 새 마운트의 초깃값).
 * 이번 포그라운드 구간에서 확인된 값만 믿는다: 뒤로 갔다 오면 새 마운트는 미확인(null)으로 시작(낡은 false로 움직임 시작 금지),
 * 돌아온 순간 재조회가 떠 있는 컴포넌트까지 갱신, 마운트 0일 때 바뀐 설정도 앱 수명 리스너가 받는다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, AppState } from 'react-native';

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => (() => void) | void) => {
    const { useEffect } = jest.requireActual('react') as typeof import('react');
    useEffect(() => cb(), [cb]);
  },
}));

// 모듈의 앱 수명 리스너(import 시 1회 등록)를 잡는다 — 컴포넌트 리스너보다 먼저 등록되므로 "첫 등록"이 모듈 것
let appCb: ((s: string) => void) | undefined;
let a11yCb: ((v: boolean) => void) | undefined;
jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
  appCb ??= cb;
  return { remove: () => {} };
}) as never);
jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_: string, cb: (v: boolean) => void) => {
  a11yCb ??= cb;
  return { remove: () => {} };
}) as never);
const isReduce = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- 위 스파이가 모듈의 import 시 등록을 잡아야 한다(정적 import는 호이스팅)
const { useMotionState, _resetMotionMemoryForTest } = require('../useMotionPaused') as typeof import('../useMotionPaused');

type Seen = { first?: boolean | null; now?: boolean | null };
function Probe({ onValue }: { onValue: (v: boolean | null) => void }) {
  onValue(useMotionState().reduceMotion);
  return null;
}
const trees: ReactTestRenderer[] = [];
function mount(): Seen {
  const seen: Seen = {};
  act(() => {
    trees.push(
      renderer.create(
        <Probe
          onValue={(v) => {
            if (!('first' in seen)) seen.first = v;
            seen.now = v;
          }}
        />,
      ),
    );
  });
  return seen;
}
const unmountAll = () => {
  while (trees.length) act(() => trees.pop()!.unmount());
};
const flush = () => act(async () => {});
const never = () => new Promise<boolean>(() => {}); // 조회가 아직 안 끝남

beforeEach(() => {
  _resetMotionMemoryForTest();
  isReduce.mockReset();
  isReduce.mockImplementation(() => Promise.resolve(false));
});
afterEach(unmountAll);

it('모듈이 앱 수명 리스너 두 개를 import 때 등록했다', () => {
  expect(appCb).toBeDefined();
  expect(a11yCb).toBeDefined();
});

it('KB-699 유지: 이번 포그라운드에서 확인된 값(false)으로 새 마운트가 시작한다(미확인 null 아님)', async () => {
  mount();
  await flush();
  unmountAll();
  isReduce.mockImplementation(never);
  expect(mount().first).toBe(false);
});

it('Codex #229: 뒤로 갔다 오면(설정 앱) 낡은 false로 시작하지 않는다 — 새 마운트 = 미확인(null, 정지)', async () => {
  mount();
  await flush();
  unmountAll();
  isReduce.mockImplementation(never);
  act(() => appCb!('background'));
  act(() => appCb!('active')); // 재조회는 아직 안 끝남
  expect(mount().first).toBeNull();
});

it('Codex #229: 포그라운드 복귀 재조회가 떠 있는 컴포넌트의 낡은 값도 갱신한다', async () => {
  const seen = mount();
  await flush();
  expect(seen.now).toBe(false);
  act(() => appCb!('background'));
  isReduce.mockImplementation(() => Promise.resolve(true)); // 설정 앱에서 켬
  act(() => appCb!('active'));
  await flush();
  expect(seen.now).toBe(true);
});

it('Codex #229: 마운트가 0인 동안 바뀐 설정도 받는다(앱 수명 리스너) — 다음 마운트가 새 값으로 시작', async () => {
  mount();
  await flush();
  unmountAll();
  act(() => a11yCb!(true));
  isReduce.mockImplementation(never);
  expect(mount().first).toBe(true);
});

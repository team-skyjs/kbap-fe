/**
 * P-403 ①(KB-586) — `SubHeader` 타이틀 중앙 정렬이 `trailing` 유무에 좌우되면 안 된다.
 *
 * 예진 실기: "Contact us" 타이틀이 왼쪽으로 밀려 있다. 화면 버그가 아니라 **공용 컴포넌트**다 —
 * 타이틀이 `flex:1 + textAlign:'center'`였고, 좌측 back(38)을 상쇄하는 우측 자리표시자가
 * **`trailing`이 없을 때만** 들어갔다. `trailing`(텍스트 링크)은 폭이 38이 아니라서 좌우가
 * 비대칭이 되고, 타이틀 박스가 `(38 - trailing폭) / 2`만큼 밀린다.
 *
 * ⚠️ `trailing`을 쓰는 화면은 3곳뿐이고 **나머지 28곳은 1px도 바뀌면 안 된다.** 멀쩡한 쪽을
 * 깨는 게 이 수정의 진짜 위험이라, 아래 ②가 그 불변을 숫자로 잠근다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable, Text as RNText } from 'react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => {
  const R = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: { createAnimatedComponent: (C: unknown) => C, View },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    Easing: { out: (e: unknown) => e, inOut: (e: unknown) => e, cubic: 'cubic' },
    _R: R,
  };
});
jest.mock('react-native-svg', () => {
  const R = require('react') as typeof import('react');
  const mk = (name: string) => (props: Record<string, unknown>) => R.createElement(name, props, props.children as never);
  return { __esModule: true, default: mk('Svg'), Svg: mk('Svg'), Path: mk('Path'), G: mk('G'), Defs: mk('Defs'), ClipPath: mk('ClipPath'), Rect: mk('Rect'), Circle: mk('Circle'), Line: mk('Line') };
});

import { SubHeader } from '../SubHeader';

const flat = (s: unknown) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)) as Record<string, unknown>;

const render = (el: React.ReactElement): ReactTestRenderer => {
  let r!: ReactTestRenderer;
  act(() => {
    r = renderer.create(el);
  });
  return r;
};

/** 타이틀 텍스트를 감싸는 **위치 결정 요소**의 좌/우 인셋. 타이틀이 흐름에서 빠져 나와
 *  절대 위치로 중앙에 놓이면 left/right가 숫자로 잡힌다. */
function titleInsets(tree: ReactTestRenderer, title: string) {
  const text = tree.root.findAll((n) => n.children.includes(title as never))[0];
  // 텍스트 자신부터 위로 올라가며 left/right가 숫자인 첫 조상을 찾는다
  let node: typeof text | null = text;
  while (node) {
    const st = flat((node.props as { style?: unknown }).style);
    if (typeof st.left === 'number' && typeof st.right === 'number') {
      return { left: st.left as number, right: st.right as number };
    }
    node = node.parent as typeof text | null;
  }
  return { left: undefined, right: undefined };
}

const TITLE = 'Contact us';
/** 실제 사용부와 같은 모양 — 텍스트 링크라 폭이 38pt가 아니다(로케일마다 다르다). */
const wideTrailing = (
  <Pressable>
    <RNText>My feedback</RNText>
  </Pressable>
);

describe('P-403 ① SubHeader 타이틀 중앙 정렬', () => {
  it('trailing이 있어도 타이틀 인셋이 좌우 대칭이다', () => {
    const { left, right } = titleInsets(render(<SubHeader title={TITLE} trailing={wideTrailing} />), TITLE);
    expect(typeof left).toBe('number'); // 흐름 배치(flex:1)면 여기서 걸린다 — 인셋 자체가 없다
    expect(left).toBe(right);
  });

  it('trailing이 없을 때도 같은 인셋 — 멀쩡한 28개 화면이 1px도 안 바뀐다', () => {
    const none = titleInsets(render(<SubHeader title={TITLE} />), TITLE);
    const withT = titleInsets(render(<SubHeader title={TITLE} trailing={wideTrailing} />), TITLE);
    expect(none).toEqual(withT);
    // back(38) + gap(16) = 54 — 수정 전 흐름 배치에서 타이틀 박스가 놓이던 바로 그 자리다.
    // 이 숫자가 달라지면 trailing 없는 화면의 타이틀 폭이 바뀐 것이다.
    expect(none.left).toBe(54);
  });

  /** 폭 38 · 자식 없음 = 우측 자리표시자. ⚠️ `findAllByType(View)`로 찾으면 **항상 0건**이다
   *  — react-test-renderer 트리의 View는 호스트 요소라 컴포넌트 참조와 안 맞는다. 0을 기대하는
   *  테스트가 그 쿼리로는 영원히 통과한다(작업 중 실제로 그렇게 통과시켰다). 전체 노드를 훑는다. */
  const spacers = (tree: ReactTestRenderer) =>
    tree.root.findAll((n) => {
      const st = flat((n.props as { style?: unknown }).style);
      return st.width === 38 && st.height === undefined && n.children.length === 0;
    });

  it('trailing이 없으면 우측 자리표시자(38)는 그대로 유지된다', () => {
    expect(spacers(render(<SubHeader title={TITLE} />)).length).toBe(1);
  });

  it('trailing이 있으면 자리표시자를 넣지 않는다(이중 여백 금지)', () => {
    expect(spacers(render(<SubHeader title={TITLE} trailing={wideTrailing} />)).length).toBe(0);
  });
});

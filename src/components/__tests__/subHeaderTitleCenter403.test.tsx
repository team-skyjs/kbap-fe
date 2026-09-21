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
/* eslint-disable @typescript-eslint/no-require-imports, import/first --
   jest 구조상 불가피하다: `jest.mock` 팩토리는 파일 최상단으로 **호이스팅**되어 import보다
   먼저 실행되므로 팩토리 안에서는 `require`만 쓸 수 있고, 대상(`SubHeader`)의 import는
   목 선언 **뒤**에 와야 목이 걸린다. 레포 관례와 동일(login.tsx:35 · mentorFeedback.test.tsx:97). */
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

/* ────────────────────────────────────────────────────────────────────────────
 * Codex #181 P2 — 고정 인셋(54)은 **중앙 이탈을 겹침과 맞바꾼다.**
 *
 * 타이틀 박스가 넓은 trailing 밑까지 뻗어 두 글자가 겹친다(스페인어 `Editar perfil` ×
 * `Guardar cambios`). 이전 `flex:1`은 실제 trailing 폭만큼 줄어들어 겹치진 않았다.
 *
 * ⚠️ 위 ①~④는 이 동작을 **검증하지 못한다** — react-test-renderer는 `onLayout`을 발화하지
 * 않아 실측폭이 초기값(38)에 머물고 인셋이 항상 54로 나온다. 즉 고정값으로 되돌려도 통과한다.
 * 실측 경로를 타려면 레이아웃 이벤트를 **직접 쏴야** 한다.
 * ──────────────────────────────────────────────────────────────────────────── */
describe('Codex #181 P2 — 넓은 trailing 아래로 타이틀이 들어가지 않는다', () => {
  const SIDE_GAP = 16;

  /** ⚠️ `onLayout`을 가진 호스트가 **둘**이다 — 내부 행(폭 기준)과 우측 슬롯 래퍼(trailing 폭).
   *  스타일 유무로 가른다: 행은 `flexDirection: 'row'`를 갖고, 래퍼는 스타일이 없다. */
  const layoutHosts = (tree: ReactTestRenderer) => {
    const hosts = tree.root.findAll((n) => typeof n.type === 'string' && typeof (n.props as { onLayout?: unknown }).onLayout === 'function');
    const styleOf = (n: (typeof hosts)[number]) => flat((n.props as { style?: unknown }).style);
    const row = hosts.filter((n) => styleOf(n).flexDirection === 'row');
    const trail = hosts.filter((n) => styleOf(n).flexDirection === undefined);
    expect(row.length).toBe(1);
    expect(trail.length).toBe(1);
    return { row: row[0], trail: trail[0] };
  };

  const fire = (node: { props: unknown }, width: number) =>
    act(() => {
      (node.props as { onLayout: (e: unknown) => void }).onLayout({ nativeEvent: { layout: { width, height: 38, x: 0, y: 0 } } });
    });

  /** 우측 슬롯 폭만 통보(행 폭은 미측정 = 대칭 모드 유지). */
  const layoutTrailing = (tree: ReactTestRenderer, width: number) => fire(layoutHosts(tree).trail, width);

  it('trailing이 넓으면 인셋이 그만큼 커진다 — 좌우 동시에(중앙 유지)', () => {
    const tree = render(<SubHeader title={TITLE} trailing={wideTrailing} />);
    expect(titleInsets(tree, TITLE).left).toBe(54); // 실측 전 초기값
    layoutTrailing(tree, 120);
    const { left, right } = titleInsets(tree, TITLE);
    expect(left).toBe(right); // 대칭이 깨지면 중앙 정렬이 무너진다
    expect(left).toBe(120 + SIDE_GAP); // 큰 쪽(120)을 양옆에 예약
  });

  it('예약 폭이 trailing 실측폭 이상이라 글자가 겹치지 않는다', () => {
    for (const w of [60, 120, 180]) {
      const tree = render(<SubHeader title={TITLE} trailing={wideTrailing} />);
      layoutTrailing(tree, w);
      const { left } = titleInsets(tree, TITLE);
      expect(left).toBeGreaterThanOrEqual(w + SIDE_GAP);
    }
  });

  it('trailing이 back보다 좁아도 인셋은 back 아래로 내려가지 않는다', () => {
    const tree = render(<SubHeader title={TITLE} trailing={wideTrailing} />);
    layoutTrailing(tree, 10); // back(38)보다 좁은 trailing
    expect(titleInsets(tree, TITLE).left).toBe(38 + SIDE_GAP); // back 쪽이 기준이 된다
  });
});

/* 첫 프레임 문제 — `onLayout` 실측이라 1프레임은 초기값(54)으로 그려지고 측정 후 보정된다.
   그런데 인셋은 **좌우가 항상 함께** 바뀐다(54/54 → 136/136). 박스는 좁아지지만 대칭이
   유지되므로 **타이틀의 중심점은 움직이지 않는다** — 위치가 튀지 않는다는 뜻이다.
   바뀔 수 있는 건 폭뿐이라, 좁아진 박스에 안 들어가는 **아주 긴 타이틀만** 말줄임 상태가
   한 프레임 달라진다. 그 경우는 어차피 trailing과 겹치던 경우다. */
describe('첫 프레임 — 측정 전후로 중심점이 움직이지 않는다', () => {
  const symmetric = (t: ReactTestRenderer) => {
    const { left, right } = titleInsets(t, TITLE);
    expect(typeof left).toBe('number');
    return left === right;
  };

  it('측정 전에도, 측정 후에도 인셋이 대칭이다(= 중심 = 행 중앙)', () => {
    const tree = render(<SubHeader title={TITLE} trailing={wideTrailing} />);
    expect(symmetric(tree)).toBe(true); // 첫 프레임
    const trail = tree.root.findAll((n) => {
      const st = Object.assign({}, ...[(n.props as { style?: unknown }).style].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
      return typeof n.type === 'string' && typeof (n.props as { onLayout?: unknown }).onLayout === 'function' && st.flexDirection === undefined;
    });
    act(() => {
      (trail[0].props as { onLayout: (e: unknown) => void }).onLayout({ nativeEvent: { layout: { width: 120, height: 38, x: 0, y: 0 } } });
    });
    expect(symmetric(tree)).toBe(true); // 보정 후 — 폭만 줄고 중심은 그대로
  });

  /* ⚠️ 원래 여기에 "같은 폭이 다시 통보되면 상태를 안 바꾼다"는 테스트를 뒀는데 **빈 통이었다**:
     동등성 가드를 지워도 React가 동일 state에서 bail out 해서 렌더 결과가 같다. 실제로 값이
     흔들리는 걸 막는 건 가드가 아니라 **`Math.round`**다 — 서브픽셀 폭(120.4 → 120.2)이
     그대로 들어오면 인셋이 매 레이아웃마다 달라진다. 그쪽을 잠근다. */
  it('서브픽셀 폭 변동은 인셋을 흔들지 않는다(반올림)', () => {
    const tree = render(<SubHeader title={TITLE} trailing={wideTrailing} />);
    const trail = tree.root.findAll((n) => {
      const st = Object.assign({}, ...[(n.props as { style?: unknown }).style].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
      return typeof n.type === 'string' && typeof (n.props as { onLayout?: unknown }).onLayout === 'function' && st.flexDirection === undefined;
    });
    const fire = (w: number) =>
      act(() => {
        (trail[0].props as { onLayout: (e: unknown) => void }).onLayout({ nativeEvent: { layout: { width: w, height: 38, x: 0, y: 0 } } });
      });
    fire(120.4);
    const first = titleInsets(tree, TITLE);
    fire(120.2);
    fire(119.6); // 반올림하면 셋 다 120
    expect(titleInsets(tree, TITLE)).toEqual(first);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * Codex #181 2R P2 — 대칭 예약은 **넓은 trailing의 비용을 두 배**로 문다.
 *
 * 320pt 화면(내부 행 288)에서 일본어 `マイお問い合わせ`가 120pt면 대칭 예약 시 타이틀에
 * 16pt만 남아 사실상 사라진다. 1.3× 글자 크기에선 더 심하다.
 *
 * 그래서 남는 폭을 보고 모드를 고른다 — 쓸 만하면 대칭(중앙), 아니면 비대칭(겹침 없이
 * 타이틀 폭 최대). **겹침은 어느 모드에서도 허용하지 않고, 포기하는 건 중앙 정렬뿐이다.**
 * ──────────────────────────────────────────────────────────────────────────── */
describe('Codex #181 2R — 좁은 화면에서 타이틀이 소멸하지 않는다', () => {
  const BACK = 38;
  const GAP = 16;
  const MIN_TITLE = 96;

  const hosts = (tree: ReactTestRenderer) => {
    const all = tree.root.findAll((n) => typeof n.type === 'string' && typeof (n.props as { onLayout?: unknown }).onLayout === 'function');
    const st = (n: (typeof all)[number]) => flat((n.props as { style?: unknown }).style);
    return { row: all.filter((n) => st(n).flexDirection === 'row')[0], trail: all.filter((n) => st(n).flexDirection === undefined)[0] };
  };
  const emit = (node: { props: unknown }, width: number) =>
    act(() => {
      (node.props as { onLayout: (e: unknown) => void }).onLayout({ nativeEvent: { layout: { width, height: 38, x: 0, y: 0 } } });
    });
  /** 행 폭과 trailing 폭을 모두 통보한 뒤의 인셋 + 남는 타이틀 폭. */
  const measure = (rowW: number, trailW: number, trailingNode: React.ReactNode = wideTrailing) => {
    const tree = render(<SubHeader title={TITLE} trailing={trailingNode} />);
    const h = hosts(tree);
    emit(h.trail, trailW);
    emit(h.row, rowW);
    const { left, right } = titleInsets(tree, TITLE);
    return { left: left as number, right: right as number, titleW: rowW - (left as number) - (right as number) };
  };

  it('여유가 있으면 대칭(중앙 정렬)을 유지한다 — 흔한 경우는 여기 머문다', () => {
    // 영어 `My feedback`(14pt/600) ≈ 85pt, 아이폰 기본 폭(390 − 패딩 32 = 358)
    const { left, right, titleW } = measure(358, 85);
    expect(left).toBe(right);
    expect(left).toBe(85 + GAP);
    expect(titleW).toBeGreaterThanOrEqual(MIN_TITLE);
  });

  /* 경계를 숫자로 박아 둔다 — 임계값을 건드리면 여기가 먼저 깨진다.
     358 − 2(t+16) ≥ 96  ⟺  t ≤ 115 */
  it('임계값 경계 — 115는 대칭, 116부터 비대칭', () => {
    expect(measure(358, 115).left).toBe(measure(358, 115).right);
    const over = measure(358, 116);
    expect(over.left).toBe(BACK + GAP);
    expect(over.right).toBe(116 + GAP);
  });

  it('좁은 화면 + 넓은 trailing이면 비대칭으로 떨어져 타이틀 폭을 지킨다', () => {
    const { left, right, titleW } = measure(320 - 32, 120); // 288 - 272 = 16pt만 남던 조합
    expect(left).toBe(BACK + GAP); // 좌측은 back 기준
    expect(right).toBe(120 + GAP); // 우측은 trailing 기준
    expect(left).not.toBe(right); // 중앙 정렬을 포기한 상태
    expect(titleW).toBeGreaterThanOrEqual(MIN_TITLE); // 하지만 타이틀은 살아 있다
  });

  it('비대칭으로 떨어져도 겹치지는 않는다 — 우측 예약이 trailing 폭 이상', () => {
    for (const [rowW, trailW] of [[288, 120], [288, 160], [260, 140]] as const) {
      const { right } = measure(rowW, trailW);
      expect(right).toBeGreaterThanOrEqual(trailW + GAP);
    }
  });

  it('trailing이 없으면 두 모드가 같은 값(54/54)으로 수렴한다 — 28개 화면 불변', () => {
    for (const rowW of [288, 358, 120 /* 비현실적으로 좁아도 */]) {
      const tree = render(<SubHeader title={TITLE} />);
      emit(hosts(tree).row, rowW);
      expect(titleInsets(tree, TITLE)).toEqual({ left: BACK + GAP, right: BACK + GAP });
    }
  });
});

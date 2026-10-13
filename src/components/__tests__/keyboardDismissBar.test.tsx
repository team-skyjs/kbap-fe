/**
 * P-106: 키보드 내리기 전역 — Input 래퍼의 iOS 액세서리 연결, ↓ 탭 시
 * Keyboard.dismiss, 안드 바의 show/hide 이벤트 표시 토글을 잠근다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Keyboard, Platform } from 'react-native';

import { Input, KeyboardDismissBar, KEYBOARD_ACCESSORY_ID } from '../KeyboardDismissBar';
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) })); // KB-768: useKeyboardLift(내비 바 인셋) — 프로바이더 없는 하네스

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

beforeEach(() => {
  Platform.OS = 'ios';
});
afterEach(() => {
  jest.restoreAllMocks();
});

/** 호스트 TextInput 노드 — 컴포지트(Input) 말고 실제 네이티브 프롭을 본다. */
const hostInput = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => typeof n.type === 'string' && n.props?.testID === 'in')[0];

it('Input(iOS) — 공유 inputAccessoryViewID로 액세서리 바 연결', () => {
  const tree = render(<Input testID="in" />);
  expect(hostInput(tree).props.inputAccessoryViewID).toBe(KEYBOARD_ACCESSORY_ID);
});

it('Input(안드) — 액세서리 ID 미지정 (안드는 이벤트 기반 하단 바)', () => {
  Platform.OS = 'android';
  const tree = render(<Input testID="in" />);
  expect(hostInput(tree).props.inputAccessoryViewID).toBeUndefined();
});

it('iOS 바 — ↓ 버튼 탭 = Keyboard.dismiss', () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  const tree = render(<KeyboardDismissBar />);
  const btn = tree.root.findAll((n) => typeof n.props?.onPress === 'function')[0];
  act(() => btn.props.onPress());
  expect(dismiss).toHaveBeenCalled();
});

it('iOS modal 변형 — null (루트 액세서리 1개가 모달 포함 전역 커버, 중복 등록 방지)', () => {
  const tree = render(<KeyboardDismissBar modal />);
  expect(tree.toJSON()).toBeNull();
});

it('안드 바 — 키보드 show 때만 표시(KB-768: 키보드 위 끝 = 높이 + 내비 바 인셋에 붙음), hide 시 사라짐', () => {
  Platform.OS = 'android';
  const listeners: Record<string, (e?: { endCoordinates: { height: number } }) => void> = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((ev: string, cb: (e?: { endCoordinates: { height: number } }) => void) => {
    listeners[ev] = cb;
    return { remove: jest.fn() };
  }) as never);
  const tree = render(<KeyboardDismissBar />);
  expect(tree.toJSON()).toBeNull(); // 키보드 없음 = 바 없음
  act(() => listeners['keyboardDidShow']({ endCoordinates: { height: 300 } }));
  expect(tree.root.findAll((n) => typeof n.props?.onPress === 'function').length).toBeGreaterThan(0);
  // edge-to-edge라 창이 안 줄어 bottom 0이면 키보드 뒤 — 키보드 위 끝(300 + 내비 바 인셋 0[목])에 붙는다
  const wrap = tree.root.findAll((n) => typeof n.type === 'string' && n.props?.pointerEvents === 'box-none')[0];
  expect(Object.assign({}, ...[wrap.props.style].flat())).toMatchObject({ position: 'absolute', bottom: 300 });
  act(() => listeners['keyboardDidHide']());
  expect(tree.toJSON()).toBeNull();
});

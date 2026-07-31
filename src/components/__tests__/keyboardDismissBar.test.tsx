/**
 * P-106: 키보드 내리기 전역 — Input 래퍼의 iOS 액세서리 연결, ↓ 탭 시
 * Keyboard.dismiss, 안드 바의 show/hide 이벤트 표시 토글을 잠근다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Keyboard, Platform } from 'react-native';

import { Input, KeyboardDismissBar, KEYBOARD_ACCESSORY_ID } from '../KeyboardDismissBar';

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

it('안드 바 — 키보드 show 때만 표시, hide 시 사라짐', () => {
  Platform.OS = 'android';
  const listeners: Record<string, () => void> = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((ev: string, cb: () => void) => {
    listeners[ev] = cb;
    return { remove: jest.fn() };
  }) as never);
  const tree = render(<KeyboardDismissBar />);
  expect(tree.toJSON()).toBeNull(); // 키보드 없음 = 바 없음
  act(() => listeners['keyboardDidShow']());
  expect(tree.root.findAll((n) => typeof n.props?.onPress === 'function').length).toBeGreaterThan(0);
  act(() => listeners['keyboardDidHide']());
  expect(tree.toJSON()).toBeNull();
});

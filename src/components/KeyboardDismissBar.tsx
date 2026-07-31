/**
 * KeyboardDismissBar (P-106) — 키보드 내리기 전역 UX.
 *
 * iOS: InputAccessoryView(공유 nativeID) — 키보드 위 액세서리 바에 ↓ 버튼.
 *      전 TextInput은 아래 `Input` 래퍼로 연결(신규 화면도 래퍼만 쓰면 자동).
 * 안드: 키보드 show/hide 이벤트 기반 하단 고정 바 — softwareKeyboardLayoutMode
 *      기본 resize라 bottom:0 = 키보드 바로 위. 표시 중에만 렌더.
 * 톤은 앱 스타일(카드 배경+hairline) — 시스템 흉내 금지(발주).
 *
 * 배치: 루트 _layout에 1회 + **TextInput을 품은 Modal 안마다 `modal` 프롭으로
 * 추가** — RN Modal은 별도 네이티브 레이어라 루트의 안드 바가 못 덮는다
 * (iOS 액세서리는 키보드 소속이라 루트 1개로 전역 커버 — modal 변형은 iOS null).
 */
import * as React from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { color as C } from '@/lib/theme';
import { IconChevronDown } from './icons';

export const KEYBOARD_ACCESSORY_ID = 'kbap-kbd-dismiss';

/** 공용 TextInput — iOS 액세서리 바 연결 내장. 앱의 모든 텍스트 입력은 이걸로. */
export const Input = React.forwardRef<TextInput, TextInputProps>(function Input(props, ref) {
  return (
    <TextInput
      ref={ref}
      inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_ACCESSORY_ID : undefined}
      {...props}
    />
  );
});

function Bar() {
  return (
    <View style={styles.bar}>
      <Pressable style={styles.btn} hitSlop={8} onPress={() => Keyboard.dismiss()} accessibilityLabel="dismiss keyboard">
        <IconChevronDown size={18} color={C.ink2} />
      </Pressable>
    </View>
  );
}

/** 안드 — 키보드 표시 중에만 하단 고정(resize 모드: bottom 0 = 키보드 위). */
function AndroidBar() {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (!visible) return null;
  return (
    <View style={styles.androidWrap} pointerEvents="box-none">
      <Bar />
    </View>
  );
}

export function KeyboardDismissBar({ modal = false }: { modal?: boolean }) {
  if (Platform.OS === 'ios') {
    // modal 변형은 중복 액세서리 등록 방지 — 루트 1개가 전역(모달 포함) 커버
    if (modal) return null;
    return (
      <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
        <Bar />
      </InputAccessoryView>
    );
  }
  return <AndroidBar />;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.hair,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  btn: { width: 36, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  androidWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

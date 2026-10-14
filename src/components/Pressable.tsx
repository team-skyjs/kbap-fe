/**
 * Pressable (KB-784) — 앱의 **모든** 누르는 요소가 지나가는 한 곳. react-native Pressable과 같은 API에 ui_click 자동 계측만 더한다.
 * target = `uiTarget` ?? `testID`(lib/uiClick이 정규화 — id·코드·이름 토큰은 `:v`). 핸들러보다 **먼저** 기록(이동 전 화면 기준).
 * react-native에서 Pressable을 직접 import하는 것은 잠금 유닛(uiClickCoverage784)이 막는다 — 예외는 애니메이션 래퍼 Btn·PressScale(자체 계측).
 * 자유 텍스트(장소명 등)가 testID에 들어가는 자리는 `uiTarget`에 고정 문자열을 준다.
 */
import * as React from 'react';
import { Pressable as RNPressable, type PressableProps, type View } from 'react-native';
import { trackUiClick } from '@/lib/uiClick';

export type AppPressableProps = PressableProps & {
  /** 계측 target 고정값 — testID에 자유 텍스트가 섞이는 자리용(없으면 testID) */
  uiTarget?: string;
  /** PR 280 Codex P2: 계측 제외 — 시트 카드의 배경 닫힘 방지 인터셉터(`onPress={() => {}}`)처럼 버튼이 아닌 자리 전용.
   *  잠금(uiClickCoverage784 R7)이 빈 핸들러에만 허용한다. */
  noTrack?: boolean;
};

export const Pressable = React.forwardRef<View, AppPressableProps>(function Pressable({ onPress, onLongPress, uiTarget, noTrack, ...rest }, ref) {
  const target = uiTarget ?? rest.testID ?? undefined;
  return (
    <RNPressable
      ref={ref}
      {...rest}
      onPress={
        onPress && !noTrack
          ? (e) => {
              trackUiClick(target);
              onPress(e);
            }
          : onPress
      }
      onLongPress={
        onLongPress
          ? (e) => {
              trackUiClick(target ? `${target}-long` : undefined);
              onLongPress(e);
            }
          : undefined
      }
    />
  );
});

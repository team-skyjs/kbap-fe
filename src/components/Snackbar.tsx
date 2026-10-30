/**
 * Snackbar — bottom dark pill with optional action (design: Bookmark Mods /
 * Saved). Presentational only; visibility/timers are the caller's job.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import Animated, { FadeOut, SlideInDown } from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { spring } from '@/lib/motion';

export function Snackbar({
  icon,
  text,
  actionLabel,
  onAction,
  bottom = 24,
}: {
  icon?: React.ReactNode;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  /** KB-900: 탭 바 없는 화면은 하단 인셋을 더해 넘긴다(3버튼 내비 바가 Undo를 덮음) */
  bottom?: number;
}) {
  return (
    <View style={[styles.root, { bottom }]} pointerEvents="box-none">
      {/* P-031: 하단 등장 = damped 스프링, 퇴장 = 짧은 페이드 (등장 경로 대칭은
          타이머 소멸이라 페이드가 자연스러움 — apple-design §14 비전정 폴백 겸) */}
      <Animated.View
        entering={SlideInDown.springify().damping(spring.sheet.damping).stiffness(spring.sheet.stiffness)}
        exiting={FadeOut.duration(150)}
        style={styles.bar}
      >
        {icon}
        <Text style={styles.text}>{text}</Text>
        {actionLabel != null && (
          <Pressable testID="snackbar-action" onPress={onAction} hitSlop={10}>
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 16, right: 16 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: C.ink,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...shadow.sh2,
  },
  text: { flex: 1, fontFamily: font.body, fontSize: 14, color: '#fff' },
  action: { fontFamily: font.bodyBold, fontSize: 14, color: '#FFB27A' },
});

export default Snackbar;

/**
 * TopToast (P-339 ⑤/KB-494) — 화면 상단 다크 토스트 공용 표면(KB-142 계열 복원).
 *
 * 전 표면(홈·음식 탭·저장·상세)의 북마크 토글이 같은 위치에 떠야 하므로 호스트는
 * 루트 레이아웃에 1개만 마운트하고, 발화는 모듈 함수 `showTopToast`(리스너 1개) —
 * 화면별 배선 금지. 표시 1.5s, 헤더 아래(safe-area + 헤더 높이) 고정, 터치 투과.
 * 에러도 같은 위치(붉은 틴트 대신 다크 유지 + 문구만 — 시각 소음 최소).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt as Text } from '@/components/Txt';

const SHOW_MS = 1500;

type ToastMsg = { text: string; key: number };
let listener: ((m: ToastMsg) => void) | null = null;
let seq = 0;

/** 어디서든 호출 — 호스트 미마운트면 조용히 무시(웹·테스트 안전). */
export function showTopToast(text: string) {
  listener?.({ text, key: ++seq });
}

export function TopToastHost() {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = React.useState<ToastMsg | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    listener = (m) => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), SHOW_MS);
    };
    return () => {
      listener = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  if (!msg) return null;
  return (
    <View style={[styles.wrap, { top: insets.top + 56 + 8 }]} pointerEvents="none" testID="top-toast">
      <View style={styles.toast}>
        <Text style={styles.text} numberOfLines={2}>{msg.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 헤더(56) 바로 아래 중앙 — 어느 화면이든 같은 위치(P-339 ⑤)
  wrap: { position: 'absolute', left: 20, right: 20, zIndex: 100, alignItems: 'center' },
  toast: { backgroundColor: 'rgba(28,30,33,0.92)', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, maxWidth: 335 },
  text: { fontSize: 14, fontWeight: '500', color: '#FFFFFF', textAlign: 'center' },
});

export default TopToastHost;

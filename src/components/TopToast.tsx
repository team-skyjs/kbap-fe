/**
 * TopToast (P-339 ⑤/KB-494) — 화면 상단 다크 토스트 공용 표면(KB-142 계열 복원).
 *
 * 전 표면(홈·음식 탭·저장·상세)의 북마크 토글이 같은 위치에 떠야 하므로 호스트는
 * 루트 레이아웃에 1개만 마운트하고, 발화는 모듈 함수 `showTopToast`(리스너 1개) —
 * 화면별 배선 금지. P-343(KB-504): DS toast(9:4239) — 335×36·#000 50%·r9·14/600 흰,
 * 위치 = **화면 최상단 insets.top+8, 헤더·탭바 위 오버레이**(zIndex 최상위, 터치 투과).
 * 표시 1.5s. 에러도 같은 위치(다크 유지 + 문구만).
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
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="none" testID="top-toast">
      <View style={styles.toast}>
        <Text style={styles.text} numberOfLines={2}>{msg.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // P-343: 최상단 오버레이 — 헤더·탭바 위(전 화면 동일 위치), zIndex 최상위
  wrap: { position: 'absolute', left: 20, right: 20, zIndex: 1000, alignItems: 'center' },
  // DS toast 9:4239 — 335×36 · #000 50% · r9 · pad 8/50
  // Codex #105 P2(i18n): 성공 1줄 = 8+20+8 = 36(DS 치수 그대로), 긴 에러 문구만 2줄 자연 확장
  toast: { width: 335, maxWidth: '100%', minHeight: 36, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', textAlign: 'center', lineHeight: 20 },
});

export default TopToastHost;

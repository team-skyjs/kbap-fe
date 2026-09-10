/**
 * TopToast (P-339 ⑤ → P-343 → P-346/KB-507) — 상단 토스트 공용 표면.
 *
 * P-346: Mobbin(Wealthsimple) 레퍼런스 그대로 — DS 9:4239 폐기. 다크 필(#2F3137
 * 불투명) r24 · 좌 흰 원 22 + 다크 체크(에러 = AlertTri 흰) · 텍스트 16/500 좌정렬
 * 2줄 · 우 Close(common.close) 탭 = 즉시 소멸. 진입 = 스프링 슬라이드(위→0)+페이드,
 * 퇴장 = 220ms out-cubic, 자동 2.5s. reduce-motion = 페이드만.
 *
 * 구조 유지: 호스트는 루트 1개, 발화 = showTopToast(리스너 1개 — 화면별 배선 금지).
 * 위치 = 최상단 insets.top+8, 헤더·탭바 위(zIndex 1000). 래퍼 box-none(Close만 히트).
 * 표시 중 재발화 = 타이머 리셋·텍스트 교체(재진입 애니메이션 없음).
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { IconAlertTri, IconCheck } from '@/components/icons';
import { RiskGlyph } from '@/components/RiskMark';
import Svg from 'react-native-svg';

const SHOW_MS = 2500;
const EXIT_MS = 220;
const ENTER_SPRING = { damping: 18, stiffness: 180, mass: 0.8 };

import { dismissTopToast, subscribeTopToast, type ToastMsg } from './topToastStore';
export { showTopToast } from './topToastStore'; // 기존 소비처 호환 재수출

export function TopToastHost() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [msg, setMsg] = React.useState<ToastMsg | null>(null);
  const visibleRef = React.useRef(false);
  const msgRef = React.useRef<ToastMsg | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0);
  const enterFrom = -(56 + insets.top + 8);

  // Codex #108 P2 ①: 퇴장 진행 중 재발화 레이스 — 세대(gen) 비교로 stale 언마운트 무시
  const genRef = React.useRef(0);
  const exitingRef = React.useRef(false);
  const unmountIfCurrent = React.useCallback((gen: number) => {
    if (gen !== genRef.current) return; // 퇴장 중 새 토스트가 왔음 — 이 언마운트는 무효
    visibleRef.current = false;
    exitingRef.current = false;
    msgRef.current = null;
    setMsg(null);
  }, []);
  // P-373(KB-537) ①: 닫힌 토스트는 스토어에서 지워 핸드오프 대상에서 제외한다
  // (Close 탭·자동 만료 공통 — 이 화면이 pop돼도 이전 호스트에 재등장하지 않는다).
  const dismiss = React.useCallback(() => {
    if (msgRef.current) dismissTopToast(msgRef.current.key);
    if (timer.current) clearTimeout(timer.current);
    exitingRef.current = true;
    const gen = genRef.current;
    // 퇴장: 위로 40 + 페이드(out-cubic) 후 언마운트 — reduce-motion은 페이드만
    if (!reducedMotion) ty.value = withTiming(-40, { duration: EXIT_MS, easing: Easing.out(Easing.cubic) });
    // #108 3R: ReducedMotionConfig(System)가 페이드까지 스킵(즉시 팝) — 페이드는 항상 재생
    opacity.value = withTiming(0, { duration: reducedMotion ? 150 : EXIT_MS, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }, (finished) => {
      'worklet'; // 완료 콜백 = UI 스레드(P-065) — JS 복귀는 runOnJS
      if (finished) runOnJS(unmountIfCurrent)(gen);
    });
  }, [reducedMotion, ty, opacity, unmountIfCurrent]);

  // 리스너 등록은 마운트 1회 — 렌더마다 재등록하면 클린업이 진행 중 타이머를 지운다.
  // 최신 값은 ref로 참조(reanimated sharedValue는 안정 — 클로저 캡처 무해).
  const dismissRef = React.useRef(dismiss);
  dismissRef.current = dismiss;
  const enterFromRef = React.useRef(enterFrom);
  enterFromRef.current = enterFrom;
  const reducedRef = React.useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  React.useEffect(() => {
    const unsubscribe = subscribeTopToast((m, remainingMs) => {
      setMsg(m);
      msgRef.current = m;
      genRef.current += 1; // 진행 중 퇴장의 완료 콜백 무효화(#108 P2 ①)
      cancelAnimation(ty);
      cancelAnimation(opacity);
      if (timer.current) clearTimeout(timer.current);
      // P-373 ②: 핸드오프 수신은 남은 시간만 — 총 노출이 SHOW_MS를 넘지 않는다
      timer.current = setTimeout(() => dismissRef.current(), remainingMs ?? SHOW_MS);
      if (!visibleRef.current || exitingRef.current) {
        visibleRef.current = true;
        exitingRef.current = false;
        // 진입: 위에서 스프링 슬라이드 + 150ms 페이드 — reduce-motion은 페이드만
        if (reducedRef.current) {
          ty.value = 0;
        } else {
          ty.value = enterFromRef.current;
          ty.value = withSpring(0, ENTER_SPRING);
        }
        opacity.value = 0;
        opacity.value = withTiming(1, { duration: 150, reduceMotion: ReduceMotion.Never }); // #108 3R
      } // 표시 중 재발화 = 텍스트 교체 + 타이머 리셋만(재진입 애니메이션 없음)
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }], opacity: opacity.value }));
  if (!msg) return null;
  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none" testID="top-toast">
      {/* #108 P2 ②: 필 아래 UI 탭 투과 — Close만 히트 */}
      <Animated.View style={[styles.toast, anim]} pointerEvents="box-none">
        {/* #108 2R: 자식도 히트 제외(none) — Close Pressable만 auto */}
        {msg.error ? (
          <View pointerEvents="none">
            <IconAlertTri size={22} color="#FFFFFF" />
          </View>
        ) : (
          <View style={styles.checkDot} pointerEvents="none">
            {/* P-366 ③: icon='alert' = 같은 흰 원 안 느낌표(에러 변형 아님 — 배경·크기 동일) */}
            {msg.icon === 'alert' ? (
              <Svg width={12} height={12} viewBox="0 0 22 22">
                <RiskGlyph state="caution" fill="#2F3137" />
              </Svg>
            ) : (
              <IconCheck size={12} color="#2F3137" />
            )}
          </View>
        )}
        <Text style={styles.text} numberOfLines={2} pointerEvents="none">{msg.text}</Text>
        <Pressable onPress={dismiss} hitSlop={12} testID="top-toast-close">
          <Text style={styles.close}>{t('common.close')}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 최상단 오버레이 — 헤더·탭바 위(전 화면 동일), Close만 히트(box-none)
  wrap: { position: 'absolute', left: 20, right: 20, zIndex: 1000 },
  // P-346(Mobbin): 다크 필 r24 + 부유 그림자
  toast: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#2F3137',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  checkDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, fontSize: 16, fontWeight: '500', color: '#FFFFFF', lineHeight: 22, textAlign: 'left' },
  close: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

export default TopToastHost;

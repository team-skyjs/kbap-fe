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
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { IconAlertTri, IconCheck } from '@/components/icons';

const SHOW_MS = 2500;
const EXIT_MS = 220;
const ENTER_SPRING = { damping: 18, stiffness: 180, mass: 0.8 };

import { subscribeTopToast, type ToastMsg } from './topToastStore';
export { showTopToast } from './topToastStore'; // 기존 소비처 호환 재수출

export function TopToastHost() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [msg, setMsg] = React.useState<ToastMsg | null>(null);
  const visibleRef = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0);
  const enterFrom = -(56 + insets.top + 8);

  const unmount = React.useCallback(() => {
    visibleRef.current = false;
    setMsg(null);
  }, []);
  const dismiss = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    // 퇴장: 위로 40 + 페이드(out-cubic) 후 언마운트 — reduce-motion은 페이드만
    if (!reducedMotion) ty.value = withTiming(-40, { duration: EXIT_MS, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(0, { duration: reducedMotion ? 150 : EXIT_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      'worklet'; // 완료 콜백 = UI 스레드(P-065) — JS 복귀는 runOnJS
      if (finished) runOnJS(unmount)();
    });
  }, [reducedMotion, ty, opacity, unmount]);

  // 리스너 등록은 마운트 1회 — 렌더마다 재등록하면 클린업이 진행 중 타이머를 지운다.
  // 최신 값은 ref로 참조(reanimated sharedValue는 안정 — 클로저 캡처 무해).
  const dismissRef = React.useRef(dismiss);
  dismissRef.current = dismiss;
  const enterFromRef = React.useRef(enterFrom);
  enterFromRef.current = enterFrom;
  const reducedRef = React.useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  React.useEffect(() => {
    const unsubscribe = subscribeTopToast((m) => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => dismissRef.current(), SHOW_MS);
      if (!visibleRef.current) {
        visibleRef.current = true;
        // 진입: 위에서 스프링 슬라이드 + 150ms 페이드 — reduce-motion은 페이드만
        if (reducedRef.current) {
          ty.value = 0;
        } else {
          ty.value = enterFromRef.current;
          ty.value = withSpring(0, ENTER_SPRING);
        }
        opacity.value = 0;
        opacity.value = withTiming(1, { duration: 150 });
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
      <Animated.View style={[styles.toast, anim]}>
        {msg.error ? (
          <IconAlertTri size={22} color="#FFFFFF" />
        ) : (
          <View style={styles.checkDot}>
            <IconCheck size={12} color="#2F3137" />
          </View>
        )}
        <Text style={styles.text} numberOfLines={2}>{msg.text}</Text>
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

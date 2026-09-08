/**
 * useSheetSwipeDismiss (P-337/KB-490) — 핸들 바 있는 바텀시트의 "끌어서 닫기" 공용 훅.
 *
 * 계약: 제스처 영역 = **핸들 + 제목 헤더만**(내부 스크롤 리스트와 충돌 방지 — 반환된
 * `gesture`를 그 영역의 GestureDetector에만 건다). 드래그 중 시트 translateY 추종
 * (위로는 0 고정), 놓을 때 이동 ≥ 80pt 또는 속도 ≥ 500pt/s → 아래로 퇴장 후 onClose,
 * 미만 = 스프링 복귀(spring.sheet). 배경 딤은 translateY 비례 페이드(dimStyle을
 * 딤 전용 레이어에 — 시트를 품는 컨테이너에 걸면 시트까지 바랜다).
 *
 * P-131/P-065 준수: 콜백은 전부 `runOnJS(true)` — 워클릿 경계 없음(jest가 못 잡는
 * 'worklet' 지시자 계열 위험 회피). 그래도 제스처 변경이라 발행 전 실기 확인 대상.
 * 재사용 시트(마운트 유지형)는 open 전환 시 훅이 translateY를 0으로 리셋한다.
 */
import * as React from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { spring } from '@/lib/motion';

const DISMISS_DY = 80;
const DISMISS_VY = 500; // pt/s
const DIM_RANGE = 280; // 이만큼 끌면 딤 최저

export function useSheetSwipeDismiss(onClose: () => void, open = true) {
  const ty = useSharedValue(0);
  const closingRef = React.useRef(false);
  // Codex #98 P2: 퇴장 목표 = 시트 실높이(onLayout) — 고정 640은 844폰·태블릿에서
  // 시트가 남은 채 Modal이 사라짐. 측정 전 폴백 = 화면 높이(항상 화면 밖 보장).
  const winH = useWindowDimensions().height;
  const sheetH = React.useRef(0);
  const onSheetLayout = React.useCallback((e: LayoutChangeEvent) => {
    sheetH.current = e.nativeEvent.layout.height;
  }, []);
  React.useEffect(() => {
    if (open) {
      ty.value = 0; // 마운트 유지형 시트 재오픈 — 이전 드래그 잔존 제거
      closingRef.current = false;
    }
  }, [open, ty]);

  const dismiss = React.useCallback(() => {
    if (closingRef.current) return; // 임계 통과 후 재발화 방지(단일 발사)
    closingRef.current = true;
    ty.value = withTiming(sheetH.current || winH, { duration: 180 }, (finished) => {
      'worklet'; // 완료 콜백은 UI 스레드(P-065 지시자 필수) — JS 복귀는 runOnJS
      if (finished) runOnJS(onClose)();
    });
  }, [onClose, ty, winH]);

  const gesture = React.useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true) // P-131 문법 — JS 스레드 콜백(워클릿 0)
        .onUpdate((e) => {
          if (!closingRef.current) ty.value = Math.max(0, e.translationY);
        })
        // Codex #98 2R P2: 판정·복귀 = onFinalize(성공/취소 공통) — OS 인터럽트·경쟁
        // 제스처로 pan이 취소되면 onEnd 미발화 → 시트가 중간에 멈추던 결함. 취소는 무조건 복귀.
        .onFinalize((e, success) => {
          if (closingRef.current) return;
          if (success && (e.translationY >= DISMISS_DY || e.velocityY >= DISMISS_VY)) dismiss();
          else ty.value = withSpring(0, spring.sheet);
        }),
    [dismiss, ty],
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [0, DIM_RANGE], [1, 0.25], Extrapolation.CLAMP),
  }));
  return { gesture, sheetStyle, dimStyle, onSheetLayout };
}

export default useSheetSwipeDismiss;

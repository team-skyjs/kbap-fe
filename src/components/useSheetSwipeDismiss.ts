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
import { Gesture } from 'react-native-gesture-handler';
import { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { spring } from '@/lib/motion';

const DISMISS_DY = 80;
const DISMISS_VY = 500; // pt/s
const EXIT_Y = 640; // 시트 높이 상회 — 퇴장 목표
const DIM_RANGE = 280; // 이만큼 끌면 딤 최저

export function useSheetSwipeDismiss(onClose: () => void, open = true) {
  const ty = useSharedValue(0);
  const closingRef = React.useRef(false);
  React.useEffect(() => {
    if (open) {
      ty.value = 0; // 마운트 유지형 시트 재오픈 — 이전 드래그 잔존 제거
      closingRef.current = false;
    }
  }, [open, ty]);

  const dismiss = React.useCallback(() => {
    if (closingRef.current) return; // 임계 통과 후 재발화 방지(단일 발사)
    closingRef.current = true;
    ty.value = withTiming(EXIT_Y, { duration: 180 }, (finished) => {
      'worklet'; // 완료 콜백은 UI 스레드(P-065 지시자 필수) — JS 복귀는 runOnJS
      if (finished) runOnJS(onClose)();
    });
  }, [onClose, ty]);

  const gesture = React.useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true) // P-131 문법 — JS 스레드 콜백(워클릿 0)
        .onUpdate((e) => {
          if (!closingRef.current) ty.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          if (closingRef.current) return;
          if (e.translationY >= DISMISS_DY || e.velocityY >= DISMISS_VY) dismiss();
          else ty.value = withSpring(0, spring.sheet);
        }),
    [dismiss, ty],
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [0, DIM_RANGE], [1, 0.25], Extrapolation.CLAMP),
  }));
  return { gesture, sheetStyle, dimStyle };
}

export default useSheetSwipeDismiss;

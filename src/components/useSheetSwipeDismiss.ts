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
 *
 * KB-553: `animateIn` 옵션 = open 전환 시 화면 아래(winH)에서 ease-out 240ms로 올라온다(스프링은 실기에서
 * "둥 뜨는" 느낌으로 반려 — 퇴장 180ms와 같은 직선 계열) — Modal을
 * fade로 두고 시트만 슬라이드하는 시트용(Modal slide는 딤 레이어까지 같이 밀어 올린다). 반환 `dismiss(onDone)`
 * = 외부 닫힘 경로(스크림·버튼·백버튼)도 같은 슬라이드 다운을 타게 한다. 퇴장 **진행 중**이면 완료 시 함께 호출(코얼레싱),
 * 이미 **끝났으면** 즉시 onDone — 진행 중 호출을 즉시 처리하면 Modal이 애니메이션 중간에 사라진다(Codex 리뷰 #150).
 * (Modal fade는 시트도 함께 페이드한다 — "딤만"은 아니며, 등장 슬라이드와 겹쳐 실기 승인.)
 */
import * as React from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { Easing, Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { spring } from '@/lib/motion';

const DISMISS_DY = 80;
const DISMISS_VY = 500; // pt/s
const DIM_RANGE = 280; // 이만큼 끌면 딤 최저
/** animateIn 등장 — "쓱" 올라오는 직선 ease-out(오버슈트 0). 퇴장 180ms 직선과 한 쌍. */
const ENTER_TIMING = { duration: 240, easing: Easing.out(Easing.cubic) };

export function useSheetSwipeDismiss(onClose: () => void, open = true, opts: { animateIn?: boolean } = {}) {
  const animateIn = opts.animateIn === true;
  const ty = useSharedValue(0);
  /** idle = 열림(드래그 가능) · closing = 퇴장 애니메이션 진행 중 · closed = 퇴장 완료(화면 밖) */
  const phase = React.useRef<'idle' | 'closing' | 'closed'>('idle');
  const pendingDone = React.useRef<Array<() => void>>([]); // closing 중 들어온 외부 onDone — 완료 시 1회씩
  // Codex #98 P2: 퇴장 목표 = 시트 실높이(onLayout) — 고정 640은 844폰·태블릿에서
  // 시트가 남은 채 Modal이 사라짐. 측정 전 폴백 = 화면 높이(항상 화면 밖 보장).
  const winH = useWindowDimensions().height;
  const winHRef = React.useRef(winH); // 등장 effect는 open 전환에만 반응 — 회전(winH 변화)으로 재생되면 열린 시트가 튄다(Codex #150 P2)
  winHRef.current = winH;
  const sheetH = React.useRef(0);
  const onSheetLayout = React.useCallback((e: LayoutChangeEvent) => {
    sheetH.current = e.nativeEvent.layout.height;
  }, []);
  React.useEffect(() => {
    if (open) {
      phase.current = 'idle';
      pendingDone.current = []; // 이전 열림의 완료 콜백은 무효(재오픈이 애니메이션을 취소하므로 finished=false → 미호출)
      if (animateIn) {
        ty.value = winHRef.current; // KB-553: 화면 아래에서 등장(측정 전이라 화면 높이) — 딤은 dimStyle 비례로 함께 짙어진다
        ty.value = withTiming(0, ENTER_TIMING);
      } else {
        ty.value = 0; // 마운트 유지형 시트 재오픈 — 이전 드래그 잔존 제거
      }
    }
  }, [open, ty, animateIn]);

  /** 슬라이드 다운 후 onDone(기본 onClose). closing 중 외부 호출 = 완료 시 함께 · closed 뒤 외부 호출 = 즉시. */
  const dismiss = React.useCallback((onDone: () => void = onClose) => {
    const external = onDone !== onClose; // 내부(onFinalize) 기본 호출은 단일 발사 — 재발화 0
    if (phase.current === 'closed') {
      if (external) onDone();
      return;
    }
    if (phase.current === 'closing') {
      if (external) pendingDone.current.push(onDone);
      return;
    }
    phase.current = 'closing';
    const finish = () => {
      phase.current = 'closed';
      onDone();
      pendingDone.current.splice(0).forEach((f) => f());
    };
    ty.value = withTiming(sheetH.current || winH, { duration: 180 }, (finished) => {
      'worklet'; // 완료 콜백은 UI 스레드(P-065 지시자 필수) — JS 복귀는 runOnJS
      if (finished) runOnJS(finish)();
    });
  }, [onClose, ty, winH]);

  const gesture = React.useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true) // P-131 문법 — JS 스레드 콜백(워클릿 0)
        .onUpdate((e) => {
          if (phase.current === 'idle') ty.value = Math.max(0, e.translationY);
        })
        // Codex #98 2R P2: 판정·복귀 = onFinalize(성공/취소 공통) — OS 인터럽트·경쟁
        // 제스처로 pan이 취소되면 onEnd 미발화 → 시트가 중간에 멈추던 결함. 취소는 무조건 복귀.
        .onFinalize((e, success) => {
          if (phase.current !== 'idle') return;
          if (success && (e.translationY >= DISMISS_DY || e.velocityY >= DISMISS_VY)) dismiss();
          else ty.value = withSpring(0, spring.sheet);
        }),
    [dismiss, ty],
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [0, DIM_RANGE], [1, 0.25], Extrapolation.CLAMP),
  }));
  /** 퇴장 시작 이후(closing·closed) = true — 드래그 퇴장은 시트가 알 수 없으므로 확정 버튼 등이 탭 시점에 확인(Codex #150 P1). */
  const isClosing = React.useCallback(() => phase.current !== 'idle', []);
  return { gesture, sheetStyle, dimStyle, onSheetLayout, dismiss, isClosing };
}

export default useSheetSwipeDismiss;

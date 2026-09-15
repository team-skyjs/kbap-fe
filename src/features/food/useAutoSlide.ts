/**
 * useAutoSlide (P-383/KB-566) — 음식 상세 히어로 갤러리 자동 넘김 타이머.
 *
 * FlatList와 떼어 둔 이유: 타이머 규칙(생성 조건·순환·리셋·해제)을 가짜 타이머로
 * 실기 없이 잠그기 위해서다. 화면은 index를 받아 스크롤만 한다.
 *
 * 규칙(발주 2):
 *  - 2장 미만이면 타이머를 만들지 않는다.
 *  - 2000ms마다 다음 장, 마지막 다음은 처음(순환).
 *  - 드래그가 시작되면 즉시 멈추고, 안착한 장에서 타이머를 **다시 시작**한다 → 스와이프 직후 2초 정지 후 재개.
 *  - paused(화면 blur·앱 background·reduce motion)면 타이머를 해제한다. 언마운트도 해제.
 */
import * as React from 'react';

export const AUTO_SLIDE_MS = 2000;

export function useAutoSlide(count: number, paused: boolean) {
  const [index, setIndex] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // Codex P2(3R): start를 늦게 부르는 호출자(스와이프 안착 폴백 등)가 옛 렌더의 클로저를
  // 들고 있어도 **지금의** paused·count를 보도록 ref로 읽는다. 클로저에 박으면 정지 중에
  // 뒤늦게 도착한 호출이 타이머를 되살리고, 그걸 치울 의존성 변화도 더 오지 않는다.
  const pausedRef = React.useRef(paused);
  pausedRef.current = paused;
  const countRef = React.useRef(count);
  countRef.current = count;

  const stop = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const start = React.useCallback(() => {
    stop();
    if (countRef.current < 2 || pausedRef.current) return;
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % countRef.current), AUTO_SLIDE_MS);
  }, [stop]);

  // start는 ref를 읽으므로 정지·장수 변화에 반응하려면 여기서 의존성으로 받는다
  React.useEffect(() => {
    start();
    return stop;
  }, [start, stop, paused, count]);

  // 장수가 줄어 index가 범위를 벗어나면 처음으로(리페치로 이미지 목록이 바뀌는 경우)
  React.useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  /** 사용자가 직접 넘겼을 때 — 그 장으로 맞추고 2초를 새로 센다. */
  const onUserSwipe = React.useCallback(
    (next: number) => {
      setIndex(next);
      start();
    },
    [start],
  );

  /** 드래그가 시작되는 순간 멈춘다(Codex P2) — 제스처·관성 중에 틱이 index를 바꾸면
   *  프로그램 스크롤이 사용자가 고르던 장에서 화면을 끌어간다. 재개는 onUserSwipe(안착 장). */
  const pause = stop;

  return { index, onUserSwipe, pause };
}

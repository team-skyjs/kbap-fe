/**
 * useSplashDone (KB-729 공부 #244 2) — 루트 AnimatedSplash 오버레이가 걷힌 뒤 true. 콜드 스타트는 부트 프리페치가 me를 먼저 받아
 * 홈 마운트 순간부터 조건이 참인데, RN Modal은 별도 창이라 스플래시(zIndex 1000) **위에** 그려진다 — login.tsx의
 * OS 알림 팝업과 같은 게이트(whenSplashDone). 언마운트 뒤 setState 없음.
 */
import { useEffect, useState } from 'react';
import { whenSplashDone } from '@/lib/bootGate';

export function useSplashDone(): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    let on = true;
    void whenSplashDone().then(() => { if (on) setDone(true); });
    return () => { on = false; };
  }, []);
  return done;
}

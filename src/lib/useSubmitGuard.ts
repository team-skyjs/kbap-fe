/**
 * useSubmitGuard (P-173) — 제출 연타 공용 가드. P-168(리뷰 Post 중복 5건 실사고)에서
 * 검증된 패턴의 공용화: **동기 ref**(같은 틱 더블탭 차단 — setState 지연 레이스 봉쇄,
 * P-062⓪ 관례) + busy 상태(스피너/비활성 표시용). 완료(성공/실패)까지 재진입 불가,
 * finally 복구 보장. 에러 표면은 호출측 관례(fn 내부 try/catch·mutation 상태) 몫 —
 * 여기까지 새는 에러는 로그 후 흡수(가드 복구가 우선).
 *
 * 예외(가드 불필요): 낙관 토글류(좋아요/Helpful·북마크) — 목표 상태 지정형·멱등이라
 * 연타 무해. 비멱등 제출(작성·탈퇴·저장)만 이 가드를 쓴다.
 */
import { useCallback, useRef, useState } from 'react';

export function useSubmitGuard() {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown> | unknown): Promise<void> => {
    if (busyRef.current) return; // 동기 가드 — 응답 전 재탭 무발사
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      console.log('[submitGuard] 제출 실패(호출측 표면 담당):', (e as Error)?.message ?? e);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}

export default useSubmitGuard;

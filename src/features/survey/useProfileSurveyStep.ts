/**
 * useProfileSurveyStep (KB-733) — 프로필 설문 시트(KB-729)를 화면의 **일회성 모달 큐**(oneShotQueue, KB-730) 스텝으로.
 * 호스트(홈)는 포커스 때 `step()`을 큐에 넣고(순서: 코치마크 → 푸시 넛지 → 설문 → 리뷰 유도), 블러 때 `cancelPending()` + 큐 clear,
 * `open`·`onClosed`를 시트에 준다. 종전 `homeFocused` 임시 가드(/review #244 4)는 이 등록/취소 수명으로 대체.
 *
 * present(done) 계약:
 * - 스플래시가 걷히고(whenSplashDone — Modal은 별도 창이라 스플래시 위에 뜬다) **프로필이 판정 가능**(members/me 도착·조회 실패)해질 때까지
 *   기다린 뒤 판정한다 — 콜드 스타트는 포커스가 me보다 먼저라, 기다리지 않으면 "아직 모름"을 "안 띄움"으로 소모한다.
 * - 기다리는 동안 호스트가 블러되면(cancelPending — 딥링크·푸시 콜드 스타트 = 대상 화면이 위) false: "대상 화면 → 시트" 순서 유지.
 *   시트가 떠 있는 동안 들어온 알림 탭 이동은 종전대로 deferUntilSurveyClosed(_layout)가 닫힌 뒤로 미룬다.
 * - surveyCompleted===false 회원 아님(true·게스트·구서버 null·온보딩 미완)·이번 실행 "나중에"·강제 업데이트 게이트 = **즉시 false**(소모 0).
 * - 띄우면 true, 시트가 완전히 닫힌 뒤(iOS onDismiss / Android 폼 언마운트) `done()` 한 번 → 다음 스텝(리뷰 유도 등).
 * 시트가 닫히는 계기는 종전과 같다: 제출 성공 = members/me 캐시 surveyCompleted=true · 나중에 = hideSurveyThisRun — `open`은 그 값에 계속 반응한다.
 *
 * 판정은 **렌더의 `shouldOpen` 한 곳**(공부 #245 1): present는 그 최신값(ref)을 읽고, `open = turn && shouldOpen`. present가 true를 돌려준 직후
 * 다음 렌더 전에 값이 깨지면(콜드 스타트에서 버전 게이트가 blocked 확정·me 재조회가 true) 시트는 한 번도 present되지 않아 onDismiss/언마운트가
 * 안 온다 → 큐가 `await closed`에 영원히(다음 스텝 전부 조용히 안 뜸). 그래서 "차례를 받았는데 열린 적 없이 닫힘"이면 effect가 즉시 onClosed(반납).
 */
import * as React from 'react';
import type { User } from '@/lib/api/types';
import { whenSplashDone } from '@/lib/bootGate';
import type { QueueStep } from '@/lib/oneShotQueue';
import { shouldShowSurvey } from '@/lib/survey/profileSurvey';
import { useSurveyHiddenThisRun } from '@/lib/survey/surveySession';
import { useVersionGate } from '@/lib/versionGate';

export interface ProfileSurveyStepInput {
  /** members/me (undefined = 아직 모름) */
  me: User | undefined;
  /** 프로필을 더 기다릴 필요가 없다 — 도착(게스트는 mock 사용자) 또는 조회 실패 */
  meKnown: boolean;
}

export function useProfileSurveyStep({ me, meKnown }: ProfileSurveyStepInput) {
  const [turn, setTurn] = React.useState(false); // 큐가 이 스텝 차례를 줬다
  const surveyHidden = useSurveyHiddenThisRun();
  const versionGate = useVersionGate();
  const blocked = versionGate.mode === 'blocked';
  // 띄울/유지할 조건 — 한 곳. 서버 surveyCompleted===false 회원 + 이번 실행 "나중에" 아님 + 강제 업데이트 게이트 아님
  const shouldOpen = shouldShowSurvey(me) && !surveyHidden && !blocked;

  // present는 나중에(큐 차례) 실행되므로 최신 판정은 ref로 — 렌더 중 ref 읽기 없음(react-hooks/refs)
  const latest = React.useRef(shouldOpen);
  React.useEffect(() => { latest.current = shouldOpen; }, [shouldOpen]);

  // "프로필 판정 가능" 약속 — 한 번 풀리면 유지
  const [known] = React.useState(() => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => { resolve = r; });
    return { promise, resolve };
  });
  React.useEffect(() => { if (meKnown) known.resolve(); }, [meKnown, known]);

  const genRef = React.useRef(0); // cancelPending마다 +1 — 대기 중이던 present는 무효
  const doneRef = React.useRef<(() => void) | null>(null);
  const openedRef = React.useRef(false); // 이번 차례에 시트가 실제로 열린 적 있나

  const step = React.useCallback((): QueueStep => ({
    key: 'survey',
    present: async (done) => {
      const gen = genRef.current;
      await Promise.all([whenSplashDone(), known.promise]);
      if (genRef.current !== gen) return false; // 대기 중 블러 — 다음 포커스에 다시 등록된다
      if (!latest.current) return false; // true·게스트·구서버·온보딩 미완·나중에·blocked = 소모 0
      doneRef.current = done;
      setTurn(true);
      return true;
    },
  }), [known]);

  /** 호스트 블러 — 아직 판정 전인 스텝을 무효화(떠 있는 시트는 건드리지 않는다) */
  const cancelPending = React.useCallback(() => { genRef.current += 1; }, []);

  /** 시트가 완전히 닫혔다(iOS onDismiss / Android 폼 언마운트) — 큐에 done, 차례 반납 */
  const onClosed = React.useCallback(() => {
    const done = doneRef.current;
    doneRef.current = null;
    openedRef.current = false;
    setTurn(false);
    done?.();
  }, []);

  const open = turn && shouldOpen;
  // 차례를 받았는데 열린 적 없이 조건이 깨진 경우(present 직후 ~ 첫 렌더 사이) — Modal이 present된 적 없어 onDismiss/언마운트가 안 온다 → 즉시 반납.
  // 열렸다가 닫히는 경우는 종전대로 onDismiss/언마운트가 맡는다(iOS present-중-dismiss 순서 보존).
  React.useEffect(() => {
    if (!turn) return;
    if (open) { openedRef.current = true; return; }
    if (!openedRef.current) onClosed();
  }, [turn, open, onClosed]);
  return { open, step, cancelPending, onClosed };
}

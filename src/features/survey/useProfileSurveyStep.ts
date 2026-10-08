/**
 * useProfileSurveyStep (KB-733) — 프로필 설문 시트(KB-729)를 화면의 **일회성 모달 큐**(oneShotQueue, KB-730) 스텝으로.
 * 호스트(홈)는 포커스 때 `step()`을 큐에 넣고(순서: 코치마크 → 푸시 넛지 → 설문 → 리뷰 유도), 블러 때 큐 `clear()`(판정 전 대기 abort),
 * `open`·`onClosed`를 시트에 준다. 종전 `homeFocused` 임시 가드(/review #244 4)는 이 등록/취소 수명으로 대체.
 *
 * present(done, signal) — **판정은 여기 한 곳**(공부 #245 1):
 * - 스플래시(whenSplashDone — Modal은 별도 창이라 스플래시 위에 뜬다)와 **프로필**을 기다린다. 프로필은 렌더 스냅샷이 아니라
 *   `queryClient.ensureQueryData(['me', lang])`로 **판정 시점에** 읽는다(/review 1·4): 게스트 콜드 스타트 → 가입/로그인(beAuth가 캐시 clear →
 *   `/(tabs)` 교체) → 홈 재포커스 때 캐시가 비어 있으면 새로 받아 **새 회원을 본다**. 종전의 1회성 "known" 약속·ref 스냅샷은 그 경로에서
 *   옛 게스트 값을 읽어 설문을 안 띄웠다.
 * - 대기는 `waitStep`으로 취소(큐 clear = 블러)·상한(SURVEY_DECIDE_CAP.ms — 오프라인 콜드 스타트는 react-query가 paused라 데이터도 isError도
 *   안 온다, /review 2)·조회 실패에 false로 끝난다 — 큐가 running에 고정되지 않는다. 블러 취소면 다음 포커스에 다시 등록된다("대상 화면 → 시트").
 * - surveyCompleted===false 회원 아님(true·게스트·구서버 null·온보딩 미완)·이번 실행 "나중에" = **false 즉시**(소모 0).
 * - 띄우면 `turn=true` + 판정에 쓴 회원(`decided`)을 기억하고 true. 시트가 완전히 닫힌 뒤(iOS onDismiss / Android 폼 언마운트) `done()` → 다음 스텝.
 *
 * open = turn && shouldShowSurvey(me ?? decided) && !hidden && !blocked — 닫히는 계기는 종전과 같다(제출 성공 = 캐시 surveyCompleted=true ·
 * 나중에 = hideSurveyThisRun). `me ?? decided`: 판정 직후 옵저버 알림(setTimeout 0)이 아직이라 `me`가 undefined인 한 렌더를 "대상 아님"으로 읽지 않기 위해.
 *
 * 닫힘 사유 두 갈래(/review 5 — 결정): **일시 조건(강제 업데이트 blocked)은 턴을 유지하고 숨김만** — 풀리면 같은 턴에서 다시 뜬다.
 * **영구 조건(제출 성공·나중에·회원 전환으로 대상 아님)만 턴 반납**(done). 차례를 받았는데 열린 적 없이 영구 조건으로 open=false가 되면
 * (present 직후 ~ 첫 렌더 사이에 me 재조회가 true 등, 공부 1) Modal이 present된 적 없어 onDismiss/언마운트가 안 온다 → effect가 즉시 반납.
 */
import * as React from 'react';
import type { User } from '@/lib/api/types';
import { whenSplashDone } from '@/lib/bootGate';
import { fetchMe, useMe } from '@/lib/data/useMe';
import { useAppLanguage } from '@/lib/i18n/useAppLanguage';
import { waitStep, type QueueStep } from '@/lib/oneShotQueue';
import { queryClient } from '@/lib/queryClient'; // 루트 프로바이더와 동일 인스턴스(홈의 invalidate와 같은 관례) — 프로바이더 없는 홈 유닛 5개 무변
import { shouldShowSurvey } from '@/lib/survey/profileSurvey';
import { isSurveyHiddenThisRun, useSurveyHiddenThisRun } from '@/lib/survey/surveySession';
import { useVersionGate } from '@/lib/versionGate';

/** 판정 대기 상한 — 스플래시 폴백(SPLASH_CAP_MS 4s)보다 조금 길게. 넘기면 이번 포커스는 건너뛴다(다음 포커스에 재등록). 객체 = 유닛에서 줄여 쓰기 위해 */
export const SURVEY_DECIDE_CAP = { ms: 6000 };

export function useProfileSurveyStep() {
  const { data: me } = useMe();
  const lang = useAppLanguage();
  const [turn, setTurn] = React.useState(false); // 큐가 이 스텝 차례를 줬다
  const [decided, setDecided] = React.useState<User | undefined>(undefined); // present가 판정에 쓴 회원
  const surveyHidden = useSurveyHiddenThisRun();
  const versionGate = useVersionGate();
  const blocked = versionGate.mode === 'blocked';

  // 콜백(onClosed)은 네이티브 이벤트에서 불리므로 최신 blocked는 ref로 — 렌더 중 ref 읽기 없음(react-hooks/refs)
  const blockedRef = React.useRef(blocked);
  React.useEffect(() => { blockedRef.current = blocked; }, [blocked]);
  const doneRef = React.useRef<(() => void) | null>(null);
  const openedRef = React.useRef(false); // 이번 차례에 시트가 실제로 열린 적 있나

  const step = React.useCallback((): QueueStep => ({
    key: 'survey',
    present: async (done, signal) => {
      const r = await waitStep(
        Promise.all([whenSplashDone(), queryClient.ensureQueryData({ queryKey: ['me', lang], queryFn: fetchMe })]),
        signal,
        SURVEY_DECIDE_CAP.ms,
      );
      if (!r.ok) return false; // 블러(abort)·상한·조회 실패 — 소모 0
      const user = r.value[1];
      if (!shouldShowSurvey(user) || isSurveyHiddenThisRun()) return false;
      doneRef.current = done;
      setDecided(user);
      setTurn(true);
      return true;
    },
  }), [lang]);

  /** 시트가 완전히 닫혔다(iOS onDismiss / Android 폼 언마운트). 일시 조건(blocked)이면 턴 유지, 아니면 큐에 done + 차례 반납 */
  const onClosed = React.useCallback(() => {
    openedRef.current = false;
    if (blockedRef.current) return; // 숨김만 — 게이트가 풀리면 같은 턴에서 다시 뜬다
    const done = doneRef.current;
    doneRef.current = null;
    setTurn(false);
    setDecided(undefined);
    done?.();
  }, []);

  const open = turn && shouldShowSurvey(me ?? decided) && !surveyHidden && !blocked;
  // 차례를 받았는데 열린 적 없이 영구 조건으로 닫힘(present 직후 ~ 첫 렌더 사이) → Modal present 0 → onDismiss/언마운트 0 → 즉시 반납.
  // blocked(일시)면 기다린다. 열렸다가 닫히는 경우는 onDismiss/언마운트가 맡는다(iOS present-중-dismiss 순서 보존).
  React.useEffect(() => {
    if (!turn) return;
    if (open) { openedRef.current = true; return; }
    if (!openedRef.current && !blocked) onClosed();
  }, [turn, open, blocked, onClosed]);

  return { open, step, onClosed };
}

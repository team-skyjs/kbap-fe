/**
 * ScanExitPrompts (KB-908 T-010, 예진 10/30 "뒤로 미루자") — 스캔 결과 직후 알림 넛지 + "Is K-Bap helping you?" 시트가 2연속으로 떴다(QA aos#7).
 * 결과 화면에선 코치마크만 두고, 두 시트는 **스캔 화면을 닫은 뒤 하나만** 띄운다: 알림 넛지가 해당되면 넛지, 아니면 리뷰 유도.
 * 노출 조건·빈도(넛지 판정 scanNudge · 리뷰 7일·3회·스캔 2회 이상)는 그대로 — 판정 시점만 옮겼다.
 *
 * 스캔 = 결과 도달 때 `armScanExitPrompt`, 스캔 화면 언마운트 때 `fireScanExitPrompt`. 호스트는 루트 _layout에 1개.
 * 결과에서 음식 상세로 들어갔다 오는 건 스캔 화면이 살아 있어 "떠남"이 아니다.
 * 스캔 fullScreenModal이 내려가는 중에 RN Modal을 띄우면 iOS가 교착한다(KB-377) — 전환이 끝난 뒤(runAfterInteractions) 판정.
 */
import * as React from 'react';
import { InteractionManager } from 'react-native';
import { FLAGS } from '@/lib/flags';
import { decideScanNudge, type ScanNudgeMode } from '@/lib/push/scanNudge';
import { useReviewPrompt } from '@/lib/useReviewPrompt';
import { ReviewPromptSheet } from '@/components/ReviewPromptSheet';
import { PushPrimerModal } from '@/features/push/PushPrimerModal';

type Armed = { isGuest: boolean; ready: Promise<unknown> };
let armed: Armed | null = null;
const listeners = new Set<(a: Armed) => void>();

/** 결과 도달 — 마지막 결과 기준(같은 스캔 세션에서 다시 찍으면 덮어씀) */
export function armScanExitPrompt(a: Armed) {
  armed = a;
}

/** 스캔 화면 닫힘 — 결과가 있었으면 호스트에 한 번 알린다 */
export function fireScanExitPrompt() {
  const a = armed;
  armed = null;
  if (a) listeners.forEach((l) => l(a));
}

export function ScanExitPrompts() {
  const review = useReviewPrompt();
  const { request } = review;
  const [nudgeOpen, setNudgeOpen] = React.useState(false);
  const [nudgeMode, setNudgeMode] = React.useState<ScanNudgeMode>('primer');
  const busy = React.useRef(false); // 한 번에 하나 — 떠 있는 동안 또 닫힘이 와도 무시

  React.useEffect(() => {
    const on = (a: Armed) => {
      if (busy.current) return;
      busy.current = true;
      InteractionManager.runAfterInteractions(() => {
        void (async () => {
          const m = FLAGS.pushEnabled ? await decideScanNudge(a.isGuest).catch(() => null) : null;
          if (m) {
            setNudgeMode(m);
            setNudgeOpen(true);
            return;
          }
          await a.ready; // 성공 카운트 저장이 끝난 뒤 판정(스캔 2회 이상 규칙)
          const shown = await request('scan', { onClosed: () => { busy.current = false; } });
          if (!shown) busy.current = false;
        })();
      });
    };
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, [request]);

  return (
    <>
      <PushPrimerModal surface="scan" mode={nudgeMode} open={nudgeOpen} onDone={() => { setNudgeOpen(false); busy.current = false; }} />
      <ReviewPromptSheet open={review.open} onAnswer={review.respond} onShow={review.onShow} onClosed={review.onClosed} disabled={review.answered} />
    </>
  );
}

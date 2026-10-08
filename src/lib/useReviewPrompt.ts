/**
 * useReviewPrompt — KB-730 리뷰 유도 시트의 상태 훅. 호출측은 `step(trigger, { after })`을 화면의 일회성 모달 큐에 넣는다(oneShotQueue).
 * - 규칙(7일·3회·종료·스캔 2회 이상)은 reviewPrompt.ts. 조건 미달·blocked = 안 띄우고 `after`만 즉시(소모 0).
 * - 노출 카운트·시각·계측은 시트가 **실제로 보인 뒤**(Modal onShow)에만 기록 — present 실패로 1회가 사라지지 않게.
 * - 응답은 한 번만(페이드 중 더블탭 = 문의 화면 2장·계측 2회 방지). 별로예요의 문의 이동은 복귀(after)가 끝난 뒤.
 */
import * as React from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { EVENTS, track } from '@/lib/analytics';
import { canShow, fixClockRewind, loadPromptState, markDone, markShown, savePromptState, scanTriggerDue, type PromptAnswer, type PromptTrigger } from '@/lib/reviewPrompt';
import { requestStoreReview } from '@/lib/storeReview';
import type { QueueStep } from '@/lib/oneShotQueue';

export function useReviewPrompt() {
  const router = useRouter();
  const [trigger, setTrigger] = React.useState<PromptTrigger | null>(null);
  const triggerRef = React.useRef<PromptTrigger | null>(null); // onShow는 네이티브 콜백 — 렌더 클로저에 안 기댄다
  const [answered, setAnswered] = React.useState(false);
  const answeredRef = React.useRef(false); // 같은 틱 더블탭은 state로 못 막는다
  const afterRef = React.useRef<(() => void) | null>(null);
  const closedRef = React.useRef<(() => void) | null>(null);

  /** 조건이 맞으면 시트를 열고 true. 저장·계측은 onShow에서 */
  const request = React.useCallback(async (t: PromptTrigger, opts: { blocked?: boolean; after?: () => void; onClosed?: () => void } = {}): Promise<boolean> => {
    if (opts.blocked) return false;
    const now = Date.now();
    let s = fixClockRewind(await loadPromptState(), now);
    if (s.lastShownAt != null && now === s.lastShownAt) await savePromptState(s); // 되돌림 보정분 저장
    if (!canShow(s, now)) return false;
    if (t === 'scan' && !scanTriggerDue(s)) return false;
    afterRef.current = opts.after ?? null;
    closedRef.current = opts.onClosed ?? null;
    answeredRef.current = false;
    setAnswered(false);
    triggerRef.current = t;
    setTrigger(t);
    return true;
  }, []);

  /** Modal onShow — 실제로 보인 뒤에만 소모·계측 */
  const onShow = React.useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    track(EVENTS.review_prompt_view, { trigger: t });
    void loadPromptState().then((s) => savePromptState(markShown(s, Date.now(), t)));
  }, []);

  const respond = React.useCallback(async (answer: PromptAnswer) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setAnswered(true);
    track(EVENTS.review_prompt_response, { answer });
    setTrigger(null);
    const after = afterRef.current;
    afterRef.current = null;
    if (answer !== 'later') await savePromptState(markDone(await loadPromptState())); // 좋아요·별로예요 = 종료 · 나중에 = 7일 뒤 재평가
    if (answer === 'positive') await requestStoreReview();
    after?.();
    // 별로예요 → 문의 작성(기존 라우트). 복귀(after)와 같은 틱의 push는 네이티브 스택에서 순서가 깨진다 — 전환이 끝난 뒤
    if (answer === 'negative') InteractionManager.runAfterInteractions(() => router.push('/profile/feedback/new' as Href));
  }, [router]);

  /** 시트가 완전히 닫힌 뒤(iOS onDismiss / Android onClose) — 큐의 done */
  const onClosed = React.useCallback(() => {
    const c = closedRef.current;
    closedRef.current = null;
    c?.();
  }, []);

  /** 큐 스텝 — 호출측 3곳 공통. 안 띄우면 after를 즉시 실행하고 false */
  const step = React.useCallback((t: PromptTrigger, opts: { after?: () => void; blocked?: boolean; ready?: Promise<unknown> } = {}): QueueStep => ({
    key: `review-prompt:${t}`,
    present: async (done) => {
      await opts.ready; // 선행 저장(스캔 성공 카운트)이 끝난 뒤 판정
      const shown = await request(t, { blocked: opts.blocked, after: opts.after, onClosed: done });
      if (!shown) opts.after?.();
      return shown;
    },
  }), [request]);

  return { trigger, open: trigger != null, answered, request, respond, onShow, onClosed, step };
}

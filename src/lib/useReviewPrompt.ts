/**
 * useReviewPrompt — KB-730 리뷰 유도 시트의 상태 훅. 트리거 3곳(스캔 성공 2회째·리뷰 등록·주문 완료)이 request()로 묻고,
 * 규칙(7일·3회·종료)은 reviewPrompt.ts가, 금지 자리(제출 중·다른 모달 위·에러 상태)는 호출측이 `blocked`로 알려 준다 —
 * 막힌 호출은 **트리거를 소모하지 않는다**(노출 카운트·시각 무변).
 */
import * as React from 'react';
import { useRouter, type Href } from 'expo-router';
import { EVENTS, track } from '@/lib/analytics';
import { canShow, loadPromptState, markDone, markShown, savePromptState, type PromptAnswer, type PromptTrigger } from '@/lib/reviewPrompt';
import { requestStoreReview } from '@/lib/storeReview';

export function useReviewPrompt() {
  const router = useRouter();
  const [trigger, setTrigger] = React.useState<PromptTrigger | null>(null);
  // 응답 뒤 호출측이 이어서 할 일(예: 완료 모달의 복귀) — 시트가 닫힌 다음에 실행
  const afterRef = React.useRef<(() => void) | null>(null);

  /** 조건이 맞으면 시트를 열고 true. blocked·조건 미달 = false(아무것도 소모하지 않음). after = 응답 뒤 실행 */
  const request = React.useCallback(async (t: PromptTrigger, opts: { blocked?: boolean; after?: () => void } = {}): Promise<boolean> => {
    if (opts.blocked) return false;
    const now = Date.now();
    const s = await loadPromptState();
    if (!canShow(s, now)) return false;
    await savePromptState(markShown(s, now));
    track(EVENTS.review_prompt_view, { trigger: t });
    afterRef.current = opts.after ?? null;
    setTrigger(t);
    return true;
  }, []);

  const respond = React.useCallback(async (answer: PromptAnswer) => {
    track(EVENTS.review_prompt_response, { answer });
    setTrigger(null);
    const after = afterRef.current;
    afterRef.current = null;
    if (answer !== 'later') await savePromptState(markDone(await loadPromptState())); // 좋아요·별로예요 = 종료(다시 안 띄움) · 나중에 = 7일 뒤 재평가
    if (answer === 'positive') await requestStoreReview();
    after?.();
    if (answer === 'negative') router.push('/profile/feedback/new' as Href); // 별로예요 → 문의 작성(기존 라우트)
  }, [router]);

  return { trigger, open: trigger != null, request, respond };
}

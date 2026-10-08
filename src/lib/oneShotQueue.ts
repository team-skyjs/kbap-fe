/**
 * oneShotQueue — 화면별 **일회성 모달 큐**(KB-730, P-267 직렬화의 일반화). iOS는 Modal 두 장을 같은 커밋에 present/dismiss하면
 * 교착한다(KB-377·#236 2R) → 스텝을 순서대로 하나씩: present가 true면 그 모달이 **완전히 닫힌 뒤**(done) 다음 스텝.
 * 스캔 = 코치마크 → 알림 넛지 → 리뷰 유도 · 홈 = (코치마크 → 넛지) → 설문(KB-733) → (리뷰 유도) · 리뷰 작성·주문 완료 = 완료 모달 닫힘 → 리뷰 유도.
 * 스텝의 present는 "안 뜸"이면 false를 돌려 즉시 다음으로(소모 0).
 *
 * 취소(KB-733 /review 3): `clear()`는 대기 스텝을 버리고, **present 전에 기다리는 중인 스텝**엔 `signal`로 abort를 알린다 — 스텝은
 * `waitStep`으로 기다리면 취소·상한에 false로 끝난다(큐가 running에 고정되지 않는다). 이미 띄운 모달(present가 true를 돌려준 뒤)은 건드리지 않는다.
 */
import * as React from 'react';

export interface QueueStep {
  key: string;
  /**
   * 모달을 띄우면 true를 돌려주고, 모달이 완전히 닫힌 뒤(iOS onDismiss / Android onClose) `done()`을 한 번 부른다. 안 띄우면 false.
   * `signal`: 호스트가 `clear()`하면(화면 전환·블러) abort — 판정 전 대기는 `waitStep`으로 감싸 false로 끝낼 것.
   */
  present: (done: () => void, signal: AbortSignal) => Promise<boolean> | boolean;
}

export interface OneShotQueue {
  add: (step: QueueStep) => void;
  /** 대기 스텝 폐기 + 판정 전 대기 중인 스텝 abort(화면 전환) — 이미 띄운 모달은 건드리지 않는다 */
  clear: () => void;
  /** 유닛용 */
  size: () => number;
}

export type WaitResult<T> = { ok: true; value: T } | { ok: false; reason: 'aborted' | 'timeout' | 'error' };

/** 스텝의 판정 전 대기 — 약속·취소(signal)·상한(capMs) 중 먼저 오는 것. 취소·상한·실패면 ok:false(스텝은 false를 돌려줄 것) */
export function waitStep<T>(promise: Promise<T>, signal: AbortSignal, capMs: number): Promise<WaitResult<T>> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve({ ok: false, reason: 'aborted' }); return; }
    let settled = false;
    const finish = (r: WaitResult<T>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve(r);
    };
    const onAbort = () => finish({ ok: false, reason: 'aborted' });
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), capMs);
    signal.addEventListener('abort', onAbort);
    promise.then((value) => finish({ ok: true, value }), () => finish({ ok: false, reason: 'error' }));
  });
}

export function createOneShotQueue(): OneShotQueue {
  const steps: QueueStep[] = [];
  let running = false;
  let inflight: AbortController | null = null; // present가 아직 안 끝난 스텝(판정 전 대기 중)
  const pump = async () => {
    if (running) return;
    running = true;
    try {
      while (steps.length) {
        const step = steps.shift()!;
        let resolveClosed!: () => void;
        let settled = false;
        const closed = new Promise<void>((r) => { resolveClosed = r; });
        const done = () => { if (!settled) { settled = true; resolveClosed(); } }; // 두 번 불러도 한 번
        const ac = new AbortController();
        inflight = ac;
        let presented = false;
        try {
          presented = await step.present(done, ac.signal);
        } catch {
          presented = false; // 판정 실패 = 건너뜀(유도 시트·넛지는 안전 기능이 아니다)
        } finally {
          inflight = null;
        }
        if (presented) await closed;
      }
    } finally {
      running = false;
    }
  };
  return {
    add: (step) => { steps.push(step); void pump(); },
    clear: () => { steps.length = 0; inflight?.abort(); },
    size: () => steps.length,
  };
}

/** 화면 수명 동안 하나(지연 초기화 state — 렌더 중 ref 접근 없이 안정 인스턴스) */
export function useOneShotQueue(): OneShotQueue {
  const [queue] = React.useState(createOneShotQueue);
  return queue;
}

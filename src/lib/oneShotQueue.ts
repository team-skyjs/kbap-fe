/**
 * oneShotQueue — 화면별 **일회성 모달 큐**(KB-730, P-267 직렬화의 일반화). iOS는 Modal 두 장을 같은 커밋에 present/dismiss하면
 * 교착한다(KB-377·#236 2R) → 스텝을 순서대로 하나씩: present가 true면 그 모달이 **완전히 닫힌 뒤**(done) 다음 스텝.
 * 스캔 = 코치마크 → 알림 넛지 → (설문 KB-729 자리) → 리뷰 유도 · 리뷰 작성·주문 완료 = 완료 모달 닫힘 → 리뷰 유도.
 * 스텝의 present는 "안 뜸"이면 false를 돌려 즉시 다음으로(소모 0).
 */
import * as React from 'react';

export interface QueueStep {
  key: string;
  /** 모달을 띄우면 true를 돌려주고, 모달이 완전히 닫힌 뒤(iOS onDismiss / Android onClose) `done()`을 한 번 부른다. 안 띄우면 false */
  present: (done: () => void) => Promise<boolean> | boolean;
}

export interface OneShotQueue {
  add: (step: QueueStep) => void;
  /** 대기 스텝 폐기(화면 전환 등) — 진행 중인 모달은 건드리지 않는다 */
  clear: () => void;
  /** 유닛용 */
  size: () => number;
}

export function createOneShotQueue(): OneShotQueue {
  const steps: QueueStep[] = [];
  let running = false;
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
        let presented = false;
        try {
          presented = await step.present(done);
        } catch {
          presented = false; // 판정 실패 = 건너뜀(유도 시트·넛지는 안전 기능이 아니다)
        }
        if (presented) await closed;
      }
    } finally {
      running = false;
    }
  };
  return {
    add: (step) => { steps.push(step); void pump(); },
    clear: () => { steps.length = 0; },
    size: () => steps.length,
  };
}

/** 화면 수명 동안 하나(지연 초기화 state — 렌더 중 ref 접근 없이 안정 인스턴스) */
export function useOneShotQueue(): OneShotQueue {
  const [queue] = React.useState(createOneShotQueue);
  return queue;
}

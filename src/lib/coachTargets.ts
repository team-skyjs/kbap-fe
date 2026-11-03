/**
 * coachTargets (KB-968) — 코치마크 스포트라이트 대상 등록부. 대상(탭바 스캔 버튼·음식 탭 Packaged 탭)이 ref 콜백으로 자기 노드를 등록하고,
 * 오버레이가 열릴 때 measureInWindow로 잰다(고정 좌표 금지 — 기기·큰 글자·안전영역 그대로). 못 재면 null(딤 없이 말풍선만).
 */
import type { LayoutRectangle } from 'react-native';

export type CoachTarget = 'scan' | 'packaged';
type Measurable = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };
const targets: Partial<Record<CoachTarget, Measurable | null>> = {};
const refFor = (name: CoachTarget) => (node: Measurable | null) => { targets[name] = node; };
/** 모듈 수준 상수(같은 identity) — 렌더마다 새 ref 콜백이 아니다.
 *  각각 이름으로 export: JSX에서 `ref={obj.key}`(멤버 접근)는 React Compiler가 "렌더 중 ref 읽기"로 보고 그 컴포넌트를 건너뛴다 */
export const scanCoachAnchor = refFor('scan');
export const packagedCoachAnchor = refFor('packaged');

export function measureCoachTarget(name: CoachTarget, capMs = 500): Promise<LayoutRectangle | null> {
  const node = targets[name];
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), capMs);
    try {
      node.measureInWindow((x, y, width, height) => {
        clearTimeout(timer);
        resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}


/**
 * motion.ts — 공용 스프링 프리셋 (P-031/KB-206, apple-design 스킬 직역).
 *
 * 원칙(SKILL.md §4): 기본은 critically damped(오버슈트 0) — 바운스는 사용자
 * 모멘텀이 있던 제스처의 릴리스에만. 등장하는 시트/모달에 바운스 금지.
 * reanimated withSpring(damping/stiffness)로 Apple의 damping ratio·response를
 * 근사한다 (RN-MAPPING.md 치환표).
 */
export const spring = {
  /** press 다운/업 — 즉답(response ~0.15s), 오버슈트 없음 */
  press: { damping: 28, stiffness: 340 },
  /** 시트/카드 등장 — damped, 바운스 0 (모멘텀 없는 등장, response ~0.35s) */
  sheet: { damping: 26, stiffness: 220 },
  /** 헤더 숨김/복귀 등 소거리 UI 이동 — damped, 기존 timing 200ms 상당 */
  move: { damping: 24, stiffness: 260 },
} as const;

/** press 피드백 스케일 (SKILL.md §1 — pointer-down 즉시, 릴리스 대기 금지) */
export const PRESS_SCALE = 0.97;

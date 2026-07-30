/**
 * spiceAdapter.ts — 맵기 와이어 변환의 **유일한** 격리 지점 (P-081/KB-261 후속).
 *
 * ⚠️ 스왑 지점: 현행 와이어 계약 = 정수(0~10, 미설정 -1). BE가 enum 문자열
 * (SKIP/NONE/MILD/MEDIUM/HOT/EXTREME)로 스웨거를 재배포하면 **이 파일만**
 * 문자열 통과(passthrough)로 교체한다 — 앱 내부는 이미 enum이라 무변.
 *
 * 변환 규약 (7/30 회의):
 *   송신: NONE→0 / MILD→2 / MEDIUM→5 / HOT→7 / EXTREME→10 (앵커) · SKIP→-1
 *   수신(유저·음식 공용 근사): 0=NONE / 1–3=MILD / 4–6=MEDIUM / 7–8=HOT / 9–10=EXTREME
 *   유저 수신 한정: -1·비정수·범위 밖·비숫자 = SKIP(미설정)
 */
import { isSpiceLevel, type SpiceChoice, type SpiceLevel } from '@/lib/spice';

const CHOICE_TO_WIRE: Record<SpiceLevel, number> = { NONE: 0, MILD: 2, MEDIUM: 5, HOT: 7, EXTREME: 10 };

/** 유저 설정 → 와이어 정수 (SKIP = -1 센티널, KB-150 승계). */
export function spiceChoiceToWire(choice: SpiceChoice): number {
  return choice === 'SKIP' ? -1 : CHOICE_TO_WIRE[choice];
}

/** 와이어 정수(0~10) → 단계 — 앵커 사이 중간값은 구간 근사 스냅. */
export function wireToSpiceLevel(raw: number): SpiceLevel {
  if (raw <= 0) return 'NONE';
  if (raw <= 3) return 'MILD';
  if (raw <= 6) return 'MEDIUM';
  if (raw <= 8) return 'HOT';
  return 'EXTREME';
}

/** 유저 맵기 수신 — -1(미설정)·비정수·범위 밖·비숫자는 전부 SKIP (구 adaptSpice null 정책 승계). */
export function wireToSpiceChoice(raw: number | null | undefined): SpiceChoice {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 10) return 'SKIP';
  return wireToSpiceLevel(raw);
}

/** 음식 맵기 수신 — 숫자가 아니면 null(데이터 없음, 표시 생략). */
export function wireToFoodSpice(raw: unknown): SpiceLevel | null {
  return typeof raw === 'number' ? wireToSpiceLevel(raw) : null;
}

/** 로컬 보관값(kbap.profile.spice.v1) 파서 — enum 문자열 + 구 숫자 문자열 마이그레이션. */
export function parseStoredSpice(v: string | null): SpiceChoice | null {
  if (v == null) return null;
  if (isSpiceLevel(v) || v === 'SKIP') return v;
  const n = Number(v);
  return Number.isFinite(n) ? wireToSpiceChoice(n) : null;
}

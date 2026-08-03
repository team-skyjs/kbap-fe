/**
 * spiceAdapter.ts — 맵기 와이어 변환의 **유일한** 격리 지점 (P-081 → P-084 스왑
 * → P-114 송신 채널 겸용).
 *
 * P-084(7/30 dev 재배포 실측): 유저 맵기 `spicinessPreference` = **enum 문자열**
 * (SKIP/NONE/MILD/MEDIUM/HOT/EXTREME, 서버 strict 파싱). 수신은 정수(구계약)
 * 폴백 유지 — 같은 빌드가 dev/prod 어느 쪽을 봐도 동작(하위호환).
 *
 * P-114(KB-280, Q-27 vc6 회원가입 400): **송신도 채널 겸용** — prod 스웨거
 * 실측(8/3) spicinessPreference = integer(구계약)라 enum 문자열을 보내면 본문
 * 파싱 400. production 채널 = 구정수 앵커(P-081 원규약) / dev·teamtest·Metro =
 * enum 문자열.
 * ⚠️ 전환 계획: prod BE enum 전환(겸수신 배포) + production OTA 후 이 분기
 * 제거 — iOS 심사 통과가 선행 게이트(2026-07-30 조율).
 *
 * 음식 `spiciness`는 **정수(0~10) 유지** — BE 미전환("음식도 enum"은 BE 후속).
 * 구정수 규약(송신 앵커·수신 폴백): 0=NONE / 1–3=MILD / 4–6=MEDIUM / 7–8=HOT /
 * 9–10=EXTREME · -1=미설정(SKIP).
 */
import { isSpiceLevel, type SpiceChoice, type SpiceLevel } from '@/lib/spice';
import { isProdChannel } from '@/lib/flags';

/** P-081 원규약 앵커 정수 (049edff CHOICE_TO_WIRE 복원) — prod 구계약 송신용. */
const CHOICE_TO_WIRE_INT: Record<SpiceChoice, number> = {
  SKIP: -1,
  NONE: 0,
  MILD: 2,
  MEDIUM: 5,
  HOT: 7,
  EXTREME: 10,
};

/** 유저 설정 → 와이어 — production 채널 = 구정수(P-114) / 그 외 = enum 문자열(P-084). */
export function spiceChoiceToWire(choice: SpiceChoice): string | number {
  return isProdChannel() ? CHOICE_TO_WIRE_INT[choice] : choice;
}

/** 구계약 정수(0~10) → 단계 — 수신 폴백·음식 공용 구간 스냅. */
export function wireToSpiceLevel(raw: number): SpiceLevel {
  if (raw <= 0) return 'NONE';
  if (raw <= 3) return 'MILD';
  if (raw <= 6) return 'MEDIUM';
  if (raw <= 8) return 'HOT';
  return 'EXTREME';
}

/**
 * 유저 맵기 수신 — 문자열(신계약) 파싱 우선: 유효 enum만 통과, 그 외 문자열은
 * SKIP(strict). 숫자(구계약 prod)는 근사 스냅 폴백 — -1·비정수·범위 밖은 SKIP.
 */
export function wireToSpiceChoice(raw: number | string | null | undefined): SpiceChoice {
  if (typeof raw === 'string') return isSpiceLevel(raw) ? raw : 'SKIP'; // 'SKIP' 포함 비레벨 문자열 전부 SKIP
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 10) return 'SKIP';
  return wireToSpiceLevel(raw);
}

/** 음식 맵기 수신 — 정수 계약 유지(P-084에서 미전환). 숫자 아니면 null(데이터 없음). */
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

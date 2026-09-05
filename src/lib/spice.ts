/**
 * spice.ts — 맵기 내부 표현 = enum 6종 (P-081/KB-261 후속, 7/30 회의 확정).
 *
 *   SKIP / NONE / MILD / MEDIUM / HOT / EXTREME
 *
 * 앱 내부(온보딩 draft·프로필·경고 판정·표시)는 **enum만** 쓴다. SKIP은 기존
 * -1/UNSET 의미 승계 — 경고 미표시·프로필 "미설정"·"설정 해제". 음식 맵기도
 * 동일 enum(단, SKIP 없음 — 데이터 없음은 null). 정수(0~10) 와이어 변환은
 * `api/spiceAdapter.ts` 한 곳에만 존재한다 — 여기엔 숫자 지식 금지.
 */
export type SpiceLevel = 'NONE' | 'MILD' | 'MEDIUM' | 'HOT' | 'EXTREME';
/** 유저 맵기 설정 — SKIP = 미설정(온보딩 스킵·설정 해제). */
export type SpiceChoice = SpiceLevel | 'SKIP';

/** 순서 정본 (경고 비교·슬라이더 스톱 인덱스의 기준). */
export const SPICE_LEVELS: readonly SpiceLevel[] = ['NONE', 'MILD', 'MEDIUM', 'HOT', 'EXTREME'];

/** 단계 순위 0..4 — enum 순서 비교용. */
export function spiceRank(level: SpiceLevel): number {
  return SPICE_LEVELS.indexOf(level);
}

/** i18n 라벨 키 (None/Mild/Medium/Hot/Extreme). */
export const SPICE_LEVEL_LABEL: Record<SpiceLevel, string> = {
  NONE: 'spice.band.0',
  MILD: 'spice.band.1',
  MEDIUM: 'spice.band.2',
  HOT: 'spice.band.3',
  EXTREME: 'spice.band.4',
};

/** 단계별 대표 음식 예시 i18n 키 (구 spice.scale 10단에서 승계). */
export const SPICE_LEVEL_EXAMPLE: Record<SpiceLevel, string> = {
  NONE: 'spice.example.0',
  MILD: 'spice.example.1',
  MEDIUM: 'spice.example.2',
  HOT: 'spice.example.3',
  EXTREME: 'spice.example.4',
};

/** 음식 맵기 라벨 (P-104/Q-23 → P-231): 라벨 텍스트만 — 고추 표시는 SpicePeppers
 *  (5개 고정 프레임)가 담당한다. 반복 이모지 조립 경로는 P-231에서 제거(사용처 0
 *  확인) — MILD 1개가 "그냥 매운 음식"으로 읽히던 문제의 원인이었다.
 *  NONE = 자기설명 키(spice.foodNone — 밴드 라벨 단독 "None"은 맥락 상실). */
export function foodSpiceText(level: SpiceLevel, t: (key: string) => string): string {
  if (level === 'NONE') return t('spice.foodNone');
  return t(SPICE_LEVEL_LABEL[level]);
}


export function isSpiceLevel(v: unknown): v is SpiceLevel {
  return typeof v === 'string' && (SPICE_LEVELS as readonly string[]).includes(v);
}

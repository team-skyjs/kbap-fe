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

/** 음식 맵기 표시 문자열 (P-104/Q-23): 🌶️×rank + 라벨. NONE은 🌶️ 0개라
 *  밴드 라벨 단독("None") = 맥락 상실 → 자기설명 키(spice.foodNone)로 대체.
 *  (유저 톨러런스 표시는 라벨 있는 행이라 별개 — 이 함수는 음식 표시 전용.) */
export function foodSpiceText(level: SpiceLevel, t: (key: string) => string): string {
  if (level === 'NONE') return t('spice.foodNone');
  return `${'\u{1F336}\u{FE0F}'.repeat(spiceRank(level))} ${t(SPICE_LEVEL_LABEL[level])}`;
}

/** 경고 판정 = 단계(음식) > 단계(유저). SKIP(미설정)은 경고 없음. */
export function spicierThanUser(food: SpiceLevel, user: SpiceChoice): boolean {
  if (user === 'SKIP') return false;
  return spiceRank(food) > spiceRank(user);
}

export function isSpiceLevel(v: unknown): v is SpiceLevel {
  return typeof v === 'string' && (SPICE_LEVELS as readonly string[]).includes(v);
}

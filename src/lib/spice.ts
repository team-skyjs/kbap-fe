/**
 * spice.ts — 맵기 5단계 구간 (P-080/KB-261, 7/30 확정).
 *
 * DB·API는 10-스케일(0~10) 무변 — 화면 표시와 경고 판정만 5단계로 통일한다.
 * 표시와 판정이 **같은 구간 함수 하나**를 공유하는 것이 핵심: 원값 비교를
 * 섞으면 "같은 표시 단계인데 경고가 나는" 모순이 생긴다.
 *   구간: 0=None / 1–3=Mild / 4–6=Medium / 7–8=Hot / 9–10=Extreme
 */
export type SpiceBand = 0 | 1 | 2 | 3 | 4;

/** 온보딩 선택(단계) → 10-스케일 저장값 앵커 (BE 계약 무변, 종한 합의 7/30). */
export const SPICE_ANCHOR: readonly number[] = [0, 2, 5, 7, 10];

/** i18n 라벨 키 (None/Mild/Medium/Hot/Extreme) — `t(SPICE_BAND_LABEL[band])`. */
export const SPICE_BAND_LABEL = [0, 1, 2, 3, 4].map((i) => `spice.band.${i}`);

export function spiceBand(raw: number): SpiceBand {
  if (raw <= 0) return 0;
  if (raw <= 3) return 1;
  if (raw <= 6) return 2;
  if (raw <= 8) return 3;
  return 4;
}

/** 경고 판정 = 단계(음식) > 단계(유저). 원값 비교 금지 — 표시와 동일 소스. */
export function spicierThanUser(foodRaw: number, userRaw: number): boolean {
  return spiceBand(foodRaw) > spiceBand(userRaw);
}

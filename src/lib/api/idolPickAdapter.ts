/**
 * idolPickAdapter (KB-836) — GET /api/foods/idol-picks 와이어 → 화면 모델.
 * 항목 = 음식 요약(MenuSummaryWire 와 같은 평탄 키) + video{url, platform: YOUTUBE|TIKTOK}.
 * platform 은 소문자로(계측 값) — 화면에는 내보내지 않는다. 알 수 없는 platform·빈 url 항목은 버린다(카드·영상 열기 불가).
 */
import type { FoodCard } from './types';
import type { MenuSummaryWire } from './foodListTypes';
import { adaptMenuSummary } from './foodAdapter';

export interface IdolVideo {
  url: string;
  platform: 'youtube' | 'tiktok';
}
export type IdolPick = FoodCard & { video: IdolVideo };

export type IdolPickWire = MenuSummaryWire & { video?: { url?: string | null; platform?: string | null } | null };
export interface IdolPicksWire {
  items?: IdolPickWire[] | null;
}

export function adaptIdolPicks(wire: IdolPicksWire): IdolPick[] {
  return (wire.items ?? []).flatMap((w) => {
    const platform = w.video?.platform?.toLowerCase();
    const url = w.video?.url;
    if (!url || (platform !== 'youtube' && platform !== 'tiktok')) return [];
    return [{ ...adaptMenuSummary(w), video: { url, platform } }];
  });
}

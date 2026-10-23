/**
 * useIdolPicks (KB-836) — K-POP & K-FOOD 목록 전용 쿼리(GET /api/foods/idol-picks, 기본 X-API-Version).
 * 홈·상세 API 와 섞지 않는다(사용자 결정 2026-10-21). 기피 성분 변경은 useMe 의 전면 invalidateQueries() 가 덮는다.
 *
 * useIdolPickVideo(foodId) — 상세 V1 카드용: 같은 queryKey·queryFn 에 enabled:false 로 **캐시만** 구독한다.
 * 캐시에 그 음식이 없으면 null(카드 없음). 상세 진입으로 목록 API 를 부르지 않는다(D3).
 */
import { useQuery } from '@tanstack/react-query';
import { FLAGS } from '../flags';
import { useAppLanguage } from '../i18n/useAppLanguage';
import { api, apiLang } from '../api/client';
import { adaptIdolPicks, type IdolPicksWire, type IdolVideo } from '../api/idolPickAdapter';

export async function fetchIdolPicks() {
  return adaptIdolPicks(await api.get<IdolPicksWire>(`/foods/idol-picks?lang=${apiLang()}`));
}

export const idolPicksKey = (lang: string) => ['idolPicks', lang] as const;

export function useIdolPicks() {
  const lang = useAppLanguage();
  return useQuery({ queryKey: idolPicksKey(lang), queryFn: fetchIdolPicks });
}

export function useIdolPickVideo(foodId: string): IdolVideo | null {
  const lang = useAppLanguage();
  const { data } = useQuery({ queryKey: idolPicksKey(lang), queryFn: fetchIdolPicks, enabled: false });
  if (!FLAGS.idolPicksEnabled) return null; // KB-870: 운영 채널 = 카드 없음(떠 있는 리뷰 버튼은 카드 없을 때 동작)
  return data?.find((p) => p.foodId === foodId)?.video ?? null;
}

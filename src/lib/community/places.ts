/**
 * community/places.ts — 장소 태그 목 데이터 (P-087). 장소 실검색은 KB-249
 * (장소 프록시 API 선정 후) — 그때 이 파일이 어댑터 호출로 스왑된다.
 */
import type { PlaceTagRef } from './types';

export const MOCK_PLACES: PlaceTagRef[] = [
  { name: 'Hongdae Kimchi House', roadAddress: '12 Wausan-ro, Mapo-gu, Seoul' },
  { name: 'Gwangjang Market', roadAddress: '88 Changgyeonggung-ro, Jongno-gu, Seoul' },
  { name: 'Myeongdong Kyoja', roadAddress: '29 Myeongdong 10-gil, Jung-gu, Seoul' },
  { name: 'Itaewon Halal Grill', roadAddress: '10 Usadan-ro, Yongsan-gu, Seoul' },
  { name: 'Busan Jagalchi Fish Market', roadAddress: '52 Jagalchihaean-ro, Jung-gu, Busan' },
  { name: 'Tosokchon Samgyetang', roadAddress: '5 Jahamun-ro 5-gil, Jongno-gu, Seoul' },
];

export function searchPlaces(q: string): PlaceTagRef[] {
  const term = q.trim().toLowerCase();
  if (!term) return MOCK_PLACES;
  return MOCK_PLACES.filter((p) => p.name.toLowerCase().includes(term) || p.roadAddress.toLowerCase().includes(term));
}

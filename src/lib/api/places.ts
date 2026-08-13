/**
 * api/places.ts — 리뷰 장소 태그 실연결 (P-201/KB-249).
 *
 * GET /api/places/nearby(좌표 → 탑10) · GET /api/places/search(query+좌표).
 * ⚠️ P-201 = 좌표 **고정값**(스웨거 예시 — 강남역) 기반: 유저 실위치 획득만 빼고
 * 전부 실동작(nearby가 강남역 기준인 것이 알려진 한계). expo-location 불필요 =
 * 네이티브 무변(OTA 가능). 응답 어댑터는 방어적(주소 키 이형 수용).
 */
import { api } from './client';

/** P-200에서 expo-location 실위치로 스왑 — 좌표 소스는 이 상수 한 곳. */
export const REVIEW_PLACE_FALLBACK_COORD = { latitude: 37.4979502, longitude: 127.0276368 }; // 강남역(스웨거 예시)

/** 리뷰 장소 — MANUAL(직접 입력)은 name만, 좌표 부재. */
export interface ReviewPlace {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

function adaptPlace(w: unknown): ReviewPlace | null {
  if (!w || typeof w !== 'object') return null;
  const o = w as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name : null;
  if (!name) return null;
  const addr = typeof o.address === 'string' ? o.address : typeof o.roadAddress === 'string' ? o.roadAddress : null;
  return {
    name,
    address: addr,
    latitude: typeof o.latitude === 'number' ? o.latitude : null,
    longitude: typeof o.longitude === 'number' ? o.longitude : null,
  };
}

function adaptPlaceList(wire: unknown): ReviewPlace[] {
  const arr = Array.isArray(wire) ? wire : Array.isArray((wire as { items?: unknown[] })?.items) ? (wire as { items: unknown[] }).items : [];
  return arr.map(adaptPlace).filter((p): p is ReviewPlace => p != null);
}

const coordQ = () => `latitude=${REVIEW_PLACE_FALLBACK_COORD.latitude}&longitude=${REVIEW_PLACE_FALLBACK_COORD.longitude}`;

/** 근처 탑10 — 시트 열림 프리로드. */
export async function fetchNearbyPlaces(): Promise<ReviewPlace[]> {
  return adaptPlaceList(await api.get<unknown>(`/api/places/nearby?${coordQ()}`));
}

/** 장소 검색(query+좌표 — 좌표 옵셔널화는 P-200 종한 확답 대기). */
export async function fetchSearchPlaces(query: string): Promise<ReviewPlace[]> {
  return adaptPlaceList(await api.get<unknown>(`/api/places/search?query=${encodeURIComponent(query)}&${coordQ()}`));
}

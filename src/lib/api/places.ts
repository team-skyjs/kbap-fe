/**
 * api/places.ts — 리뷰 장소 태그 실연결 (P-201 고정 좌표 → P-200 실위치/KB-249).
 *
 * GET /api/places/nearby(좌표 → 탑10) · GET /api/places/search(query+좌표).
 * P-200: 좌표 = **실위치**(권한 허용 시) — 미결정이면 OS 팝업 바로(사전 모달 없음,
 * 예진 확정), 거절/불가/오류 = 강남 폴백(P-201 경로 그대로 — 기능 전부 동작,
 * 정렬만 강남 기준). 재요청 없음(iOS 1회성 — 거절 후엔 조용히 폴백).
 * expo-location 접근 = 지연 require(P-192 관례 — 구 런타임 번들 동승 시 크래시 0).
 * 응답 어댑터는 방어적(주소 키 이형 수용).
 */
import { api, apiLang } from './client';

/** 실위치 불가 시 폴백 — 강남역(스웨거 예시). 검색 좌표 옵셔널 확정 시 폴백 제거 지점. */
export const REVIEW_PLACE_FALLBACK_COORD = { latitude: 37.4979502, longitude: 127.0276368 };

export interface Coord {
  latitude: number;
  longitude: number;
}

/* ---- P-200: 실위치 — 60초 메모(시트 세션 내 키 입력마다 GPS 재조회 방지) ---- */
let coordCache: { at: number; coord: Coord } | null = null;
const COORD_TTL_MS = 60_000;

/** 유닛용 — 메모 리셋. */
export function _resetCoordCacheForTest(): void {
  coordCache = null;
}

async function currentCoord(): Promise<Coord> {
  if (coordCache && Date.now() - coordCache.at < COORD_TTL_MS) return coordCache.coord;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Location = require('expo-location') as typeof import('expo-location');
    const perm = await Location.getForegroundPermissionsAsync();
    let status = perm.status;
    // 미결정 = OS 팝업 바로(사전 모달 없음 — 예진 확정). 거절 이력은 재요청 없음.
    if (status === 'undetermined' && perm.canAskAgain !== false) {
      status = (await Location.requestForegroundPermissionsAsync()).status;
    }
    if (status !== 'granted') return REVIEW_PLACE_FALLBACK_COORD;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const coord = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    coordCache = { at: Date.now(), coord };
    return coord;
  } catch {
    return REVIEW_PLACE_FALLBACK_COORD; // 모듈 부재(구 런타임)·GPS 오류 — 조용히 폴백
  }
}

/** 리뷰 장소 — MANUAL(직접 입력)은 name만, 좌표·placeId 부재. */
export interface ReviewPlace {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** P-240(KB-350 구글 전환): 검색 결과 장소의 Google placeId — 가게 단위 기능의
   *  열쇠(종한). 리뷰 작성·수정 시 동반 전송, MANUAL은 없음. */
  placeId: string | null;
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
    placeId: typeof o.placeId === 'string' ? o.placeId : null,
  };
}

function adaptPlaceList(wire: unknown): ReviewPlace[] {
  const arr = Array.isArray(wire) ? wire : Array.isArray((wire as { items?: unknown[] })?.items) ? (wire as { items: unknown[] }).items : [];
  return arr.map(adaptPlace).filter((p): p is ReviewPlace => p != null);
}

const coordQ = (c: Coord) => `latitude=${c.latitude}&longitude=${c.longitude}`;

/** P-240 🚨 핫픽스: KB-350 구글 전환으로 `lang` 필수(누락 400 — 현행이 dev 즉사).
 *  최대 20건 단일 응답(PlaceSearchPageResponse 소멸 — 페이징 없음). */
export async function fetchNearbyPlaces(): Promise<ReviewPlace[]> {
  return adaptPlaceList(await api.get<unknown>(`/api/places/nearby?${coordQ(await currentCoord())}&lang=${apiLang()}`));
}

/** 장소 검색(query+좌표+lang — P-240 구글 전환). */
export async function fetchSearchPlaces(query: string): Promise<ReviewPlace[]> {
  return adaptPlaceList(
    await api.get<unknown>(`/api/places/search?query=${encodeURIComponent(query)}&${coordQ(await currentCoord())}&lang=${apiLang()}`),
  );
}

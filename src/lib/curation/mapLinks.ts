/**
 * 큐레이션 장소 지도 열기(KB-863) — 세 지도의 검색 링크. Kakao·NAVER는 **앱 스킴 먼저**(kakaomap:// · nmap:// — https 도메인이 앱 링크로
 * 안 잡힌 기기에서도 고른 앱이 열리게, Codex #334) → 실패(앱 없음)면 https 범용 링크(브라우저). Google은 https 하나(앱이 있으면 OS가 앱으로).
 * 스킴은 canOpenURL 없이 openURL만 시도 → 네이티브 설정 변경 없음(LSApplicationQueriesSchemes·intent queries 추가 금지 — 지문 무변, OTA 가능).
 * 같은 방식 = 리뷰 장소 지도(features/community/placeMap — 이름 검색 분기와 같은 스킴).
 * 검색어 = 한국어 이름(서버 nameKo, KB-864) 우선, 없으면 이름(name). 경로·쿼리 모두 URL 인코딩.
 */
export type MapProvider = 'google' | 'kakao' | 'naver';
export const MAP_PROVIDERS: MapProvider[] = ['google', 'kakao', 'naver'];

/** 지도 검색어 — 서버 한국어 이름이 있으면 그것(지도 앱 검색 정확도), 없으면 표시 이름 */
export const mapQueryOf = (item: { name: string; nameKo?: string | null }): string => (item.nameKo?.trim() ? item.nameKo.trim() : item.name.trim());

/** 앱 스킴(먼저 시도) — Google은 없음(https가 앱 링크) */
export function mapAppUrl(provider: MapProvider, query: string): string | null {
  const q = encodeURIComponent(query);
  if (provider === 'kakao') return `kakaomap://search?q=${q}`;
  if (provider === 'naver') return `nmap://search?query=${q}`;
  return null;
}

export function mapSearchUrl(provider: MapProvider, query: string): string {
  const q = encodeURIComponent(query);
  switch (provider) {
    case 'google':
      return `https://www.google.com/maps/search/?api=1&query=${q}`;
    case 'kakao':
      return `https://map.kakao.com/link/search/${q}`;
    case 'naver':
      return `https://map.naver.com/p/search/${q}`;
  }
}

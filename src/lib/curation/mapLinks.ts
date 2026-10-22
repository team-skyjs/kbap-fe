/**
 * 큐레이션 장소 지도 열기(KB-863) — 세 지도 앱의 **범용(https) 검색 링크**. 앱이 깔려 있으면 앱으로, 없으면 브라우저로 열린다.
 * 네이티브 설정 변경 없음(LSApplicationQueriesSchemes·intent queries 추가 금지 — 지문 무변, OTA 가능).
 * 검색어 = 한국어 이름(서버 nameKo, KB-864) 우선, 없으면 이름(name). 경로·쿼리 모두 URL 인코딩.
 */
export type MapProvider = 'google' | 'kakao' | 'naver';
export const MAP_PROVIDERS: MapProvider[] = ['google', 'kakao', 'naver'];

/** 지도 검색어 — 서버 한국어 이름이 있으면 그것(지도 앱 검색 정확도), 없으면 표시 이름 */
export const mapQueryOf = (item: { name: string; nameKo?: string | null }): string => (item.nameKo?.trim() ? item.nameKo.trim() : item.name.trim());

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

/** KB-863 지도 범용 검색 링크 — nameKo 우선(없거나 공백이면 name) · 경로·쿼리 URL 인코딩 · 세 지도 */
import { MAP_PROVIDERS, mapQueryOf, mapSearchUrl } from '../mapLinks';

it('검색어 = nameKo 우선, 없거나 공백 = name(앞뒤 공백 제거)', () => {
  expect(mapQueryOf({ name: 'Bukchon Hanok Village', nameKo: '북촌한옥마을' })).toBe('북촌한옥마을');
  expect(mapQueryOf({ name: ' Bukchon Hanok Village ', nameKo: null })).toBe('Bukchon Hanok Village');
  expect(mapQueryOf({ name: 'Bukchon', nameKo: '   ' })).toBe('Bukchon');
});

it('세 URL = Google·Kakao·NAVER 범용 검색 · 공백·한글·&·/ 인코딩', () => {
  const q = '북촌 한옥마을 & 길/1';
  const e = encodeURIComponent(q);
  expect(MAP_PROVIDERS).toEqual(['google', 'kakao', 'naver']);
  expect(mapSearchUrl('google', q)).toBe(`https://www.google.com/maps/search/?api=1&query=${e}`);
  expect(mapSearchUrl('kakao', q)).toBe(`https://map.kakao.com/link/search/${e}`);
  expect(mapSearchUrl('naver', q)).toBe(`https://map.naver.com/p/search/${e}`);
  expect(e).not.toMatch(/[ &/]/);
});

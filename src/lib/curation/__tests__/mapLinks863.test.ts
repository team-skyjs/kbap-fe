/** KB-863 지도 범용 검색 링크 — nameKo 우선(없거나 공백이면 name) · 경로·쿼리 URL 인코딩 · 세 지도 */
import { readFileSync } from 'fs';
import { MAP_PROVIDERS, mapAppUrl, mapQueryOf, mapSearchUrl } from '../mapLinks';

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

it('Codex #334: 앱 스킴(먼저 시도) = Kakao kakaomap://search · NAVER nmap://search(리뷰 장소 지도와 같은 스킴) · Google = 없음(https가 앱 링크)', () => {
  const e = encodeURIComponent('북촌 한옥마을');
  expect(mapAppUrl('kakao', '북촌 한옥마을')).toBe(`kakaomap://search?q=${e}`);
  expect(mapAppUrl('naver', '북촌 한옥마을')).toBe(`nmap://search?query=${e}`);
  expect(mapAppUrl('google', '북촌 한옥마을')).toBeNull();
  const place = readFileSync('src/features/community/placeMap.tsx', 'utf8');
  expect(place).toContain('kakaomap://search?q=${q}');
  expect(place).toContain('nmap://search?query=${q}');
});

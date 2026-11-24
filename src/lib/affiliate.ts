/**
 * affiliate (KB-1031) — Amazon Associates 제휴 링크.
 *
 * 추적 ID = `EXPO_PUBLIC_AMAZON_TAG`. **빈 값이면 제휴 UI는 어디에도 그려지지 않는다**(가입·승인 전 = 빈 값으로 머지·발행 가능).
 * 약관상 지켜야 하는 것(이 파일과 AffiliateCard가 한 곳에서 지킨다):
 *  - 아마존 페이지를 WebView·인앱 브라우저로 그리지 않는다 → OS에 넘긴다(`openStoreLink` = Linking.openURL + 실패 토스트).
 *  - 누르지 않아도 기능은 그대로(강제 게이트·클릭 보상 0) · 가격 표시 0 · 로고 0(글자 "Amazon"만) · 고지 문구 동반.
 * 검색어는 카탈로그 이름(제품·음식 영문 이름)이나 아래 고정 목록뿐 — 사용자가 친 글자는 넣지 않는다(계측 query도 같은 값).
 */
import { EVENTS, track } from '@/lib/analytics';
import { FLAGS } from '@/lib/flags';
import { openStoreLink } from '@/lib/openExternal';

export const AMAZON_TAG = (process.env.EXPO_PUBLIC_AMAZON_TAG ?? '').trim();

export type AffiliatePlacement = 'processed_detail' | 'home' | 'food_list' | 'processed_list' | 'scan_loading' | 'scan_result';

export function affiliateEnabled(): boolean {
  return FLAGS.affiliate && AMAZON_TAG !== '';
}

export function amazonSearchUrl(query: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query.trim())}&tag=${encodeURIComponent(AMAZON_TAG)}`;
}

/** 목록·홈·스캔 대기 카드의 고정 검색어 — key = 표시 문구(i18n `affiliate.items.<key>`), query = 아마존 검색어(영문 고정) */
export const AFFILIATE_ITEMS = [
  { key: 'ramen', query: 'Korean ramen' },
  { key: 'tteokbokki', query: 'tteokbokki kit' },
  { key: 'gochujang', query: 'gochujang' },
  { key: 'kimchi', query: 'kimchi' },
  { key: 'snacks', query: 'Korean snacks' },
] as const;
export type AffiliateItem = (typeof AFFILIATE_ITEMS)[number];

/** 화면 진입마다 하나 — 호출처는 useState 초기값으로 한 번만 뽑는다(렌더마다 바뀌지 않게) */
export function randomAffiliateStart(): number {
  return Math.floor(Math.random() * AFFILIATE_ITEMS.length);
}
export function affiliateItemAt(n: number): AffiliateItem {
  return AFFILIATE_ITEMS[((n % AFFILIATE_ITEMS.length) + AFFILIATE_ITEMS.length) % AFFILIATE_ITEMS.length];
}

/** 그리드 목록 사이 카드 자리 — 데이터 `every`개마다 1칸. foodId·id = FlatList 키(음식·가공식품 목록 공용) */
export type AffiliateCell = { __affiliate: true; n: number; foodId: string; id: string };
export const isAffiliateCell = (x: unknown): x is AffiliateCell => (x as AffiliateCell)?.__affiliate === true;
export const AFFILIATE_LIST_EVERY = 8;
export function withAffiliateCells<T>(items: T[], on: boolean, every = AFFILIATE_LIST_EVERY): (T | AffiliateCell)[] {
  if (!on || items.length < every) return items;
  const out: (T | AffiliateCell)[] = [];
  items.forEach((it, i) => {
    out.push(it);
    if ((i + 1) % every === 0) {
      const n = (i + 1) / every - 1;
      out.push({ __affiliate: true, n, foodId: `__affiliate${n}`, id: `__affiliate${n}` });
    }
  });
  return out;
}

/** 열기 + 클릭 계측. 열렸으면 true(실패는 openStoreLink가 토스트) */
export function openAmazon(placement: AffiliatePlacement, query: string): Promise<boolean> {
  track(EVENTS.affiliate_click, { placement, query });
  return openStoreLink(amazonSearchUrl(query));
}

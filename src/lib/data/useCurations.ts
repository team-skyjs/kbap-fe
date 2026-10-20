/**
 * useCurations (KB-796, P-480-R2) — 서울·부산 큐레이션. dev Swagger `/api/curations/seoul`(카드 3장) ·
 * `/api/curations/seoul/{collectionKey}`(모음 상세). 둘 다 `X-API-Version`·`lang` 필수(이 오퍼레이션은 1.0 이상에서 응답).
 *
 * - 홈 카드: state가 PUBLISHED이고 카드가 **정확히 3장**일 때만 보인다. 최초 공개 전·하나라도 내림 = UNPUBLISHED + 빈 카드 →
 *   섹션 자체를 숨긴다(1~2장 부분 노출 금지). 503(CURATION-006)은 미게시와 다른 **조회 실패**다.
 * - 카드 순서·키는 응답 그대로(세 번째 모음이 restaurants → busan으로 바뀔 예정 — 키 하드코딩 금지).
 * - 사진 출처 캡션(`coverImageAttribution`·`imageAttribution`)은 표시 의무가 있을 때만 문자열, 아니면 null → 있을 때만 그린다.
 * - 상세 404(CURATION-001) = 공개되지 않은 모음(빈 상태 "더 이상 볼 수 없어요"), 503 = 조회 실패(다시 시도).
 */
import { useQuery } from '@tanstack/react-query';
import { api, apiLang, ApiError } from '../api/client';
import { useAppLanguage } from '../i18n/useAppLanguage';

export const CURATION_API_VERSION = '1.0';
/** 정상 공개 = 정확히 3카드(서버 계약). */
export const CURATION_CARD_COUNT = 3;

export type CurationCard = {
  key: string;
  title: string;
  description: string;
  coverImageUrl: string;
  coverAttribution: string | null;
  itemCount: number;
};
export type CurationIndex = { published: boolean; cards: CurationCard[]; fallbackUsed: boolean };

export type CurationItem = {
  id: string;
  position: number;
  name: string;
  area: string;
  introduction: string;
  reason: string;
  imageUrl: string;
  imageAttribution: string | null;
  externalUrl: string;
  nearby: string[];
};
export type CurationDetail = {
  key: string;
  title: string;
  description: string;
  coverImageUrl: string;
  coverAttribution: string | null;
  fallbackUsed: boolean;
  items: CurationItem[];
};

type CardWire = { collectionKey: string; title: string; description: string; coverImageUrl: string; coverImageAttribution?: string | null; itemCount: number };
type IndexWire = { state: string; fallbackUsed: boolean; collections: CardWire[] };
type ItemWire = {
  entryId: string; position: number; name: string; area: string; introduction: string; recommendationReason: string;
  imageUrl: string; imageAttribution?: string | null; externalUrl: string; nearby?: string[] | null;
};
type DetailWire = {
  collectionKey: string; title: string; description: string; coverImageUrl: string; coverImageAttribution?: string | null;
  fallbackUsed: boolean; items: ItemWire[];
};

/** 빈 문자열·공백 캡션 = 없음(그리지 않는다). */
const caption = (s: string | null | undefined): string | null => (typeof s === 'string' && s.trim() ? s : null);

export function adaptCurationIndex(w: IndexWire): CurationIndex {
  const cards = (w.collections ?? []).map((c) => ({
    key: c.collectionKey,
    title: c.title,
    description: c.description,
    coverImageUrl: c.coverImageUrl,
    coverAttribution: caption(c.coverImageAttribution),
    itemCount: c.itemCount,
  }));
  // 부분 노출 금지: 서버가 PUBLISHED라도 정확히 3장이 아니면 섹션을 숨긴다(방어)
  return { published: w.state === 'PUBLISHED' && cards.length === CURATION_CARD_COUNT, cards, fallbackUsed: w.fallbackUsed === true };
}

export function adaptCurationDetail(w: DetailWire): CurationDetail {
  return {
    key: w.collectionKey,
    title: w.title,
    description: w.description,
    coverImageUrl: w.coverImageUrl,
    coverAttribution: caption(w.coverImageAttribution),
    fallbackUsed: w.fallbackUsed === true,
    items: [...(w.items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((it) => ({
        id: it.entryId,
        position: it.position,
        name: it.name,
        area: it.area,
        introduction: it.introduction,
        reason: it.recommendationReason,
        imageUrl: it.imageUrl,
        imageAttribution: caption(it.imageAttribution),
        externalUrl: it.externalUrl,
        nearby: (it.nearby ?? []).filter((n) => typeof n === 'string' && n.trim()),
      })),
  };
}

const headers = { headers: { 'X-API-Version': CURATION_API_VERSION } };

export async function fetchCurationIndex(): Promise<CurationIndex> {
  return adaptCurationIndex(await api.get<IndexWire>(`/api/curations/seoul?lang=${apiLang()}`, headers));
}
export async function fetchCurationDetail(key: string): Promise<CurationDetail> {
  return adaptCurationDetail(await api.get<DetailWire>(`/api/curations/seoul/${encodeURIComponent(key)}?lang=${apiLang()}`, headers));
}

/** 404 CURATION-001(또는 404) = 공개되지 않은 모음 — 재시도로 바뀌지 않는 상태. */
export function isCurationUnavailable(e: unknown): boolean {
  return e instanceof ApiError && (e.code === 'CURATION-001' || e.status === 404);
}

export function useCurationIndex() {
  const lang = useAppLanguage(); // 구독 — 언어 전환 시 재조회(KB-695)
  return useQuery({ queryKey: ['curations', 'seoul', lang], queryFn: fetchCurationIndex, retry: false });
}

export function useCurationDetail(key: string | undefined) {
  const lang = useAppLanguage();
  return useQuery({
    queryKey: ['curations', 'seoul', key, lang],
    queryFn: () => fetchCurationDetail(key as string),
    enabled: !!key,
    retry: false,
  });
}

/**
 * curationAdapter (KB-796) — 큐레이션 와이어(dev Swagger CurationIndex·CurationDetail) → 앱 모델. 와이어 형식 변환은 여기만
 * (AGENTS.md 어댑터 격리 — 데이터 훅 useCurations는 조회·캐시만).
 * - 홈 카드: state=PUBLISHED이고 정확히 3장일 때만 공개(부분 노출 금지 방어). 카드 순서·키 = 응답 그대로.
 * - 사진 출처(`coverImageAttribution`·`imageAttribution`)는 표시 의무가 있을 때만 문자열 — 빈 값·공백 = 없음.
 */
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

export type CardWire = { collectionKey: string; title: string; description: string; coverImageUrl: string; coverImageAttribution?: string | null; itemCount: number };
export type IndexWire = { state: string; fallbackUsed: boolean; collections: CardWire[] };
export type ItemWire = {
  entryId: string; position: number; name: string; area: string; introduction: string; recommendationReason: string;
  imageUrl: string; imageAttribution?: string | null; externalUrl: string; nearby?: string[] | null;
};
export type DetailWire = {
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


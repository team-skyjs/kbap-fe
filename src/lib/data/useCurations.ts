/**
 * useCurations (KB-796, P-480-R2) — 서울·부산 큐레이션. dev Swagger `/api/curations/seoul`(카드 3장) ·
 * `/api/curations/seoul/{key}`(모음 상세). 둘 다 `X-API-Version`·`lang` 필수(이 오퍼레이션은 1.0 이상에서 응답).
 *
 * 와이어 → 앱 모델 변환은 lib/api/curationAdapter(어댑터 격리). 이 파일은 요청·캐시만.
 * - 홈 카드: state가 PUBLISHED이고 카드가 **정확히 3장**일 때만 보인다. 최초 공개 전·하나라도 내림 = UNPUBLISHED + 빈 카드 →
 *   섹션 자체를 숨긴다(1~2장 부분 노출 금지). 503(CURATION-006)은 미게시와 다른 **조회 실패**다.
 * - 카드 순서·키는 응답 그대로(세 번째 모음이 restaurants → busan으로 바뀔 예정 — 키 하드코딩 금지).
 * - 사진 출처 캡션은 표시 의무가 있을 때만 문자열(어댑터가 빈 값을 null로) → 있을 때만 그린다.
 * - 상세 404(CURATION-001) = 공개되지 않은 모음(빈 상태 "더 이상 볼 수 없어요"), 503 = 조회 실패(다시 시도).
 */
import * as React from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { api, apiLang, ApiError } from '../api/client';
import { adaptCurationDetail, adaptCurationIndex, type CurationDetail, type CurationIndex, type DetailWire, type IndexWire } from '../api/curationAdapter';
import { useAppLanguage } from '../i18n/useAppLanguage';

export const CURATION_API_VERSION = '1.0';
// 앱 모델은 어댑터가 정본 — 화면은 여기서 함께 가져간다
export { CURATION_CARD_COUNT, type CurationCard, type CurationDetail, type CurationIndex, type CurationItem } from '../api/curationAdapter';
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

/** KB-931: 홈 큐레이션 섹션이 그려지면 모음 상세 첫 화면 사진을 미리 받는다 — 모음마다 상세(같은 캐시 키)를 받아 앞 PREFETCH_PER_COLLECTION장.
 *  상세는 언어별 캐시라 세션에 모음당 1번 · 실패는 조용히(진입하면 화면이 다시 시도) */
export const PREFETCH_PER_COLLECTION = 2;
export async function prefetchCurationCovers(qc: QueryClient, keys: readonly string[], lang: string): Promise<string[]> {
  const urls = (
    await Promise.all(
      keys.map((key) =>
        qc
          .fetchQuery({ queryKey: ['curations', 'seoul', key, lang], queryFn: () => fetchCurationDetail(key), staleTime: 5 * 60_000, retry: false })
          // Codex #376 P2: 카드가 그리는 사진 = images[0](galleryOf — 서버 images[] 우선, 없으면 imageUrl) — 같은 것을 받는다
          .then((d) => d.items.slice(0, PREFETCH_PER_COLLECTION).map((it) => it.images[0]?.url).filter((u): u is string => !!u && !!u.trim()))
          .catch(() => [] as string[]),
      ),
    )
  ).flat();
  if (urls.length) await Image.prefetch(urls).catch(() => false);
  return urls;
}

/** 섹션용 — 공개 모음 키가 바뀔 때만(같은 키 = 다시 안 받음) */
export function useCurationCoverPrefetch(keys: readonly string[] | null) {
  const qc = useQueryClient();
  const lang = useAppLanguage();
  const joined = keys?.join('|') ?? '';
  React.useEffect(() => {
    if (joined) void prefetchCurationCovers(qc, joined.split('|'), lang);
  }, [joined, qc, lang]);
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

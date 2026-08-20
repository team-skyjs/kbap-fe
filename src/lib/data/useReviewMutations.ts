/**
 * useReviewMutations — 리뷰 작성/수정/삭제 (P-085/KB-73 실연결 · P-086 플래그 봉인).
 *
 * FLAGS.reviewsLiveEnabled=false(현행) → **P-077 목 경로**: 리뷰 API 호출 0,
 * React Query 캐시(['me','reviews'] + 음식 목록 첫 페이지)에 직접 반영 — 화면
 * 코드 무변. 무효화도 안 한다(재조회가 목 삽입분을 지움 — P-077 시맨틱 유지).
 *
 * on(실연결) → POST/PATCH/DELETE + `['food',foodId]` 프리픽스·['me','reviews']
 * 무효화(서버 재조회가 진실). PATCH는 buildReviewUpdate(풀 페이로드)만 통과 —
 * "생략=제거" 함정 봉쇄.
 */
import { useMutation, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import i18n from '../i18n';
import { api } from '@/lib/api/client';
import { buildReviewUpdate, type ReviewUpdateWire } from '@/lib/api/reviewAdapter';
import type { Review, ReviewPage, User } from '@/lib/api/types';
import { FLAGS } from '@/lib/flags';
import { buildReviewExtras, EMPTY_EXTRAS, type ReviewExtras } from '@/lib/review/reviewExtras';

function useInvalidateReviews() {
  const qc = useQueryClient();
  return (foodId: string) => {
    void qc.invalidateQueries({ queryKey: ['food', foodId] }); // 상세(평점)·리뷰 목록
    void qc.invalidateQueries({ queryKey: ['me', 'reviews'] });
    // P-211 ③: 전역 피드 — 누락 시 피드 발 작성이 복귀 후에도 안 보임(P-196 like와 같은 족보).
    // 생성/수정/삭제 전부 이 함수 경유 — 무효화 대상 추가는 여기 한 곳만.
    void qc.invalidateQueries({ queryKey: ['reviews', 'global'] });
  };
}

/* ---- P-086 목 경로 캐시 헬퍼 (P-077 시맨틱) ---- */

function mockInsert(qc: QueryClient, review: Review) {
  qc.setQueryData<Review[]>(['me', 'reviews'], (prev) => [review, ...(prev ?? [])]);
  qc.setQueryData<InfiniteData<ReviewPage>>(['food', review.foodId, 'reviews', 'all'], (prev) =>
    prev && prev.pages.length
      ? { ...prev, pages: [{ ...prev.pages[0], items: [review, ...prev.pages[0].items] }, ...prev.pages.slice(1)] }
      : prev,
  );
}

export function useCreateReview() {
  const qc = useQueryClient();
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (input: { foodId: string; rating: number; content?: string; imagePaths?: string[]; place?: { name: string; roadAddress: string | null; latitude?: number | null; longitude?: number | null; placeId?: string | null } | null; extras?: ReviewExtras }) => {
      if (!FLAGS.reviewsLiveEnabled) {
        const me = qc.getQueryData<User>(['me', i18n.language]);
        mockInsert(qc, {
          id: `my-${Date.now()}`,
          foodId: input.foodId,
          rating: input.rating,
          body: input.content ?? null,
          photos: input.imagePaths ?? [],
          createdAt: new Date().toISOString(),
          memberId: me?.id,
          authorNationality: me?.nationality ?? null,
          authorRankTier: me?.rank.tier ?? null,
          anonymized: false,
          bodyLanguage: i18n.language,
          translatedBody: null,
          place: input.place ?? null, // P-095: 장소 목 저장 (live 전송은 계약 배포 시 스왑)
          likes: 0,
        });
        return;
      }
      await api.post('/api/reviews', { // P-165(#144) 버전리스
        foodId: Number(input.foodId),
        rating: input.rating,
        // P-236(KB-347): 2축 — 미평가 = 0(서버 규약)
        ...buildReviewExtras(input.extras ?? EMPTY_EXTRAS),
        ...(input.content ? { content: input.content } : {}),
        ...(input.imagePaths?.length ? { imagePaths: input.imagePaths } : {}),
        // P-201(KB-249): 장소 실전송 — MANUAL(좌표 null) = name만
        ...(input.place
          ? {
              place:
                input.place.latitude == null || input.place.longitude == null
                  ? { name: input.place.name } // MANUAL — placeId 없음(현행)
                  : {
                      name: input.place.name,
                      ...(input.place.roadAddress ? { address: input.place.roadAddress } : {}),
                      latitude: input.place.latitude,
                      longitude: input.place.longitude,
                      // P-240: 구글 placeId 동반(가게 단위 기능 열쇠). source는 계속 미전송(서버 유도)
                      ...(input.place.placeId ? { placeId: input.place.placeId } : {}),
                    },
            }
          : {}),
      });
    },
    onSuccess: (_d, v) => {
      if (FLAGS.reviewsLiveEnabled) invalidate(v.foodId);
    },
  });
}

export function useUpdateReview() {
  const qc = useQueryClient();
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (input: {
      reviewId: string;
      foodId: string;
      current: { rating: number; body: string | null; photos?: string[]; place?: { name: string; roadAddress: string | null; latitude?: number | null; longitude?: number | null } | null; servingSpeed?: number; staffKindness?: number };
      changes: { rating?: number; body?: string | null; place?: { name: string; roadAddress: string | null; latitude?: number | null; longitude?: number | null } | null; extras?: ReviewExtras };
    }) => {
      if (!FLAGS.reviewsLiveEnabled) {
        const body = (input.changes.body !== undefined ? input.changes.body : input.current.body)?.trim() || null;
        qc.setQueryData<Review[]>(['me', 'reviews'], (prev) =>
          (prev ?? []).map((r) =>
            r.id === input.reviewId ? { ...r, rating: input.changes.rating ?? r.rating, body } : r,
          ),
        );
        return;
      }
      const body: ReviewUpdateWire = buildReviewUpdate(input.current, {
        ...input.changes,
        // P-236: extras → 와이어 2필드(풀 페이로드 — 누락 = 0 리셋이라 항상 채움)
        ...(input.changes.extras ? buildReviewExtras(input.changes.extras) : {}),
      });
      await api.patch(`/api/reviews/${input.reviewId}`, body); // P-165 버전리스
    },
    onSuccess: (_d, v) => {
      if (FLAGS.reviewsLiveEnabled) invalidate(v.foodId);
    },
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (input: { reviewId: string; foodId: string }) => {
      if (!FLAGS.reviewsLiveEnabled) {
        qc.setQueryData<Review[]>(['me', 'reviews'], (prev) => (prev ?? []).filter((r) => r.id !== input.reviewId));
        return;
      }
      await api.del(`/api/reviews/${input.reviewId}`); // P-165 버전리스
    },
    onSuccess: (_d, v) => {
      if (FLAGS.reviewsLiveEnabled) invalidate(v.foodId);
    },
  });
}

/** 좋아요가 사는 infinite 캐시 전부 — 음식 리뷰(전 필터 키) + **전역 피드**.
 *  P-196 반려: 전역 피드(['reviews','global']) 누락으로 커뮤니티탭 낙관 반영 0이던
 *  원인 — 캐시 목록은 이 함수 한 곳만 만진다(표면 추가 시 여기). */
function likeInfiniteQueries(qc: QueryClient, foodId: string) {
  return [
    ...qc.getQueryCache().findAll({ queryKey: ['food', foodId, 'reviews'] }),
    ...qc.getQueryCache().findAll({ queryKey: ['reviews', 'global'] }),
  ];
}

/** 캐시 전역 좋아요 반전 — 내리뷰 + likeInfiniteQueries 전부. */
function flipLikeCaches(qc: QueryClient, input: { reviewId: string; foodId: string }) {
  const flip = (r: Review): Review =>
    r.id === input.reviewId
      ? { ...r, myLike: !r.myLike, likes: Math.max(0, (r.likes ?? 0) + (r.myLike ? -1 : 1)) }
      : r;
  qc.setQueryData<Review[]>(['me', 'reviews'], (prev) => prev?.map(flip));
  likeInfiniteQueries(qc, input.foodId).forEach((query) => {
    qc.setQueryData<InfiniteData<ReviewPage>>(query.queryKey, (prev) =>
      prev ? { ...prev, pages: prev.pages.map((p) => ({ ...p, items: p.items.map(flip) })) } : prev,
    );
  });
}

/** 현재 myLike — 캐시가 진실(화면도 이걸 그린다). 내리뷰 → infinite 캐시 순.
 *  P-196: 전역 피드 포함 — 피드에만 있는 리뷰의 next 계산 오류(항상 true 송신) 보수. */
function currentMyLike(qc: QueryClient, input: { reviewId: string; foodId: string }): boolean {
  const mine = qc.getQueryData<Review[]>(['me', 'reviews'])?.find((r) => r.id === input.reviewId);
  if (mine) return mine.myLike === true;
  for (const query of likeInfiniteQueries(qc, input.foodId)) {
    const data = query.state.data as InfiniteData<ReviewPage> | undefined;
    for (const p of data?.pages ?? []) {
      const r = p.items.find((x) => x.id === input.reviewId);
      if (r) return r.myLike === true;
    }
  }
  return false;
}

/**
 * P-095(KB-257) 목 → P-108 실연결: `POST /reviews/{id}/like?liked=` (응답 Unit).
 * 낙관적 토글(캐시 반전) + 실패 롤백(역반전). 서버값(likeCount·likedByMe)은
 * 다음 재조회가 진실 — 표시 전용(정렬 미반영) 유지. off = 목 캐시 토글만.
 */
export function useToggleReviewLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reviewId: string; foodId: string }) => {
      const next = !currentMyLike(qc, input);
      flipLikeCaches(qc, input); // 낙관 반영 (off 경로는 이게 전부 — P-095 목 시맨틱)
      if (!FLAGS.reviewsLiveEnabled) return;
      try {
        await api.post(`/api/reviews/${input.reviewId}/like?liked=${next}`); // P-165 버전리스
      } catch (e) {
        flipLikeCaches(qc, input); // 실패 롤백
        throw e;
      }
    },
  });
}

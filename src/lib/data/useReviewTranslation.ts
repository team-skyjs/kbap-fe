/**
 * useReviewTranslation — per-review translation seam (FR-023). Hides whether the
 * translation is PRE-computed (payload.translatedBody, strategy A → instant) or
 * ON-DEMAND (fetched on request, strategy B → loading/error). The screen just
 * calls translate()/showOriginal() and reads status; the BE strategy can change
 * without touching the UI.
 *
 * MOCK_MODE resolves via translateReviewMock (simulated latency + one flaky case).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Review } from '@/lib/api/types';
import { api } from '@/lib/api/client';
import { translateReviewMock } from '@/lib/mocks/reviews';
import { MOCK_MODE } from './config';

export interface ReviewTranslation {
  /** false when the review is already in the reader language (no button shown). */
  canTranslate: boolean;
  /** currently showing the translated text (vs original). */
  showingTranslated: boolean;
  /** text to render (original or translated). */
  text: string | null;
  /** original language code (for the "Translated from X" note). */
  fromLang: string;
  loading: boolean;
  error: boolean;
  translate: () => void;
  showOriginal: () => void;
  retry: () => void;
}

export function useReviewTranslation(review: Review, targetLang: string): ReviewTranslation {
  const canTranslate = review.bodyLanguage !== targetLang;
  const preTranslated = canTranslate ? review.translatedBody : null;
  const [wantTranslated, setWant] = useState(false);

  // on-demand fetch only when the user asked AND there's no pre-translation
  const enabled = canTranslate && wantTranslated && !preTranslated;
  const q = useQuery({
    queryKey: ['review-tx', review.id, targetLang],
    queryFn: () =>
      MOCK_MODE
        ? translateReviewMock(review, targetLang)
        : api.post<{ translatedBody: string; from: string }>(`/reviews/${review.id}/translate`, { targetLang }),
    enabled,
    retry: 0,
    staleTime: Infinity,
  });

  const fetched = q.data?.translatedBody ?? null;
  const translatedText = preTranslated ?? fetched;
  const showingTranslated = wantTranslated && !!translatedText;
  const loading = enabled && q.isFetching && !translatedText;
  const error = enabled && q.isError && !q.isFetching && !translatedText;

  return {
    canTranslate,
    showingTranslated,
    text: showingTranslated ? translatedText : review.body,
    fromLang: review.bodyLanguage,
    loading,
    error,
    translate: () => setWant(true),
    showOriginal: () => setWant(false),
    retry: () => q.refetch(),
  };
}

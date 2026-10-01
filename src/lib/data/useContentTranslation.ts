/**
 * useContentTranslation (KB-679, P-431) — 콘텐츠 본문 번역 공용 훅. 1차 표면 = 리뷰(`REVIEW`), 게시글·댓글은
 * targetType만 바꿔 그대로 붙인다(본문 렌더는 호출부 몫 — 이 훅은 "지금 무엇을 보여 줄지"만 준다).
 * 스펙 = spec specs/001-personalized-menu-mvp/translate-2026-10-02.md (예진 10/2: 항상 노출 · 본문 교체 · 토글).
 *
 * 계약(초안 — 정본은 서버 KB-678 dev 배포 후 Swagger): `POST /api/translations?lang={앱 언어}`
 *   body `{ targetType, targetId }` → 200 `{ targetType, targetId, language, text }` · 503 `TRANSLATION-001`.
 * - 요청은 **버튼을 눌렀을 때만**(자동 번역 0). 결과는 react-query 캐시(키 = 종류·id·언어) — 원문으로 돌렸다가
 *   다시 번역해도 재요청 0, 언어를 바꾸면 다른 키.
 * - 보기 상태(원문/번역)는 **카드 로컬 상태** — 서버가 아는 사실이 아니라 보기 설정이다.
 * - 실패 = 토스트(에러 변형) + 원문 유지. 실패는 캐시하지 않는다(다음 탭에서 다시 요청).
 */
import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, apiLang } from '@/lib/api/client';
import { showTopToast } from '@/components/topToastStore';
import { EVENTS, track } from '@/lib/analytics';

export type TranslationTargetType = 'REVIEW';

interface TranslationWire {
  targetType: string;
  targetId: number | string;
  language: string;
  text: string;
}

export interface ContentTranslation {
  /** 번역문을 보여 주는 중이면 그 텍스트, 아니면 null(= 원문을 그린다). */
  translatedText: string | null;
  showingTranslated: boolean;
  loading: boolean;
  /** 버튼 한 번 — 원문이면 번역(캐시 있으면 즉시), 번역 중이면 원문으로. */
  toggle: () => void;
}

export function useContentTranslation(targetType: TranslationTargetType, targetId: string): ContentTranslation {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const lang = i18n?.language ?? 'en';
  const queryKey = React.useMemo(() => ['translation', targetType, targetId, lang] as const, [targetType, targetId, lang]);
  // 캐시 구독만(자동 요청 0) — 탭에서 fetchQuery로 채운다
  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchTranslation(targetType, targetId),
    enabled: false,
    staleTime: Infinity,
  });
  const [showing, setShowing] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const toggle = React.useCallback(() => {
    if (loading) return;
    if (showing) {
      track(EVENTS.review_translate_toggle, { action: 'original', target: 'review' });
      setShowing(false);
      return;
    }
    track(EVENTS.review_translate_toggle, { action: 'translate', target: 'review' });
    if (data != null) {
      setShowing(true); // 캐시 — 재요청 0
      return;
    }
    setLoading(true);
    qc.fetchQuery({ queryKey, queryFn: () => fetchTranslation(targetType, targetId), staleTime: Infinity, retry: 0 })
      .then(() => setShowing(true))
      .catch(() => showTopToast(t('translation.translateFailed'), { error: true })) // 원문 유지
      .finally(() => setLoading(false));
  }, [data, loading, qc, queryKey, showing, t, targetId, targetType]);

  return { translatedText: showing && data != null ? data : null, showingTranslated: showing && data != null, loading, toggle };
}

async function fetchTranslation(targetType: TranslationTargetType, targetId: string): Promise<string> {
  const id = Number(targetId);
  const res = await api.post<TranslationWire>(`/api/translations?lang=${apiLang()}`, {
    targetType,
    targetId: Number.isFinite(id) ? id : targetId,
  });
  return res.text ?? '';
}

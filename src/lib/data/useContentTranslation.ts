/**
 * useContentTranslation (KB-679, P-431) — 콘텐츠 본문 번역 공용 훅. 1차 표면 = 리뷰(`REVIEW`), 게시글·댓글은
 * targetType만 바꿔 그대로 붙인다(본문 렌더는 호출부 몫 — 이 훅은 "지금 무엇을 보여 줄지"만 준다).
 * 스펙 = spec specs/001-personalized-menu-mvp/translate-2026-10-02.md (예진 10/2: 항상 노출 · 본문 교체 · 토글).
 *
 * 계약(초안 — 정본은 서버 KB-678 dev 배포 후 Swagger): `POST /api/translations?lang={앱 언어}`
 *   body `{ targetType, targetId }` → 200 `{ targetType, targetId, language, text }` · 503 `TRANSLATION-001`.
 * - 요청은 **버튼을 눌렀을 때만**(자동 번역 0). 결과는 react-query 캐시(키 = 종류·id·언어) — 원문으로 돌렸다가
 *   다시 번역해도 재요청 0, 언어를 바꾸면 다른 키. 캐시는 **세션 동안**(gcTime ∞ — 셀이 내려가거나 화면을 떠났다 와도 유지).
 * - 보기 상태(원문/번역)는 **카드 로컬 상태** — 서버가 아는 사실이 아니라 보기 설정이다.
 * - 실패(503·400 REVIEW-001·네트워크·빈 text) = 토스트(에러 변형) + 원문 유지. 실패는 캐시하지 않는다(다음 탭에서 다시 요청).
 * - 캐시 키에 본문 해시 · 보기 상태는 "보고 있는 키" — 본문·언어가 바뀌면 원문으로 돌아가고 다음 탭에 재요청.
 */
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, apiLang } from '@/lib/api/client';
import { adaptTranslation, type Translation, type TranslationSource, type TranslationWire } from '@/lib/api/translationAdapter';
import { showTopToast } from '@/components/topToastStore';
import { EVENTS, track } from '@/lib/analytics';

export type TranslationTargetType = 'REVIEW';

export interface ContentTranslation {
  /** 번역문을 보여 주는 중이면 그 텍스트, 아니면 null(= 원문을 그린다). */
  translatedText: string | null;
  showingTranslated: boolean;
  loading: boolean;
  /** 번역을 보여 주는 중일 때의 원문 언어(도메인 — 어댑터가 판정). 번역 중이 아니면 null. */
  source: TranslationSource | null;
  /** KB-689: 원문 언어 == 요청 언어로 확인된 글 — 번역 표시 안 함 + 라벨 숨김(세션 동안 — 캐시 gcTime ∞, 앱 재시작·본문/언어 변경 시 다시 판정). */
  sameLanguage: boolean;
  /** 버튼 한 번 — 원문이면 번역(캐시 있으면 즉시), 번역 중이면 원문으로. */
  toggle: () => void;
}

export function useContentTranslation(targetType: TranslationTargetType, targetId: string, text: string): ContentTranslation {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const lang = i18n?.language ?? 'en';
  // #220 공부 ①: 키에 본문 해시 — 리뷰가 수정되면(누가 고쳤든) 다른 키 = 옛 번역 재사용 0, 다음 탭에 재요청
  const queryKey = React.useMemo(() => ['translation', targetType, targetId, lang, hashText(text)] as const, [targetType, targetId, lang, text]);
  const keyStr = queryKey.join('|');
  // 캐시 **읽기만**(Codex #223 P2): useQuery(enabled:false)는 리뷰마다 빈 캐시 항목을 만들어 무한 스크롤에 쌓인다 —
  // getQueryData는 항목을 만들지 않는다. 항목은 탭 시점 fetchQuery만 만들고(gcTime ∞ = 받아 온 번역·같은 언어 판정만 세션 동안),
  // 재렌더 계기는 탭 흐름의 로컬 상태(loading·shownKey)와 부모 props(본문·언어) — 같은 리뷰가 두 곳에 동시에 떠 있으면
  // 다른 쪽은 다음 렌더에 반영(ponytail: 실사용상 동시 노출 없음, 필요해지면 useSyncExternalStore로 캐시 구독).
  const data = qc.getQueryData<Translation>(queryKey);
  // #220 공부 ②: 보기 상태 = "어느 키의 번역을 보고 있나". 키가 바뀌면(언어·본문) 저절로 원문 — 표시와 탭 판정이 같은 값을 본다
  const [shownKey, setShownKey] = React.useState<string | null>(null);
  // KB-689: 같은 언어(어댑터 판정) = text가 원문 그대로 → 번역 표시로 전환하지 않는다
  const sameLanguage = data?.sameLanguage === true;
  const showing = shownKey === keyStr && data != null && !sameLanguage;
  const [loading, setLoading] = React.useState(false);
  const target = targetType.toLowerCase(); // 계측 enum(review|post …) — 공용 훅이라 하드코딩 금지

  const toggle = React.useCallback(() => {
    if (loading) return;
    if (showing) {
      track(EVENTS.review_translate_toggle, { action: 'original', target });
      setShownKey(null);
      return;
    }
    if (data != null) {
      if (sameLanguage) return; // 라벨이 숨겨져 있어 실사용 경로 아님 — 방어
      track(EVENTS.review_translate_toggle, { action: 'translate', target, result: 'ok' });
      setShownKey(keyStr); // 캐시 — 재요청 0
      return;
    }
    setLoading(true);
    qc.fetchQuery({ queryKey, queryFn: () => fetchTranslation(targetType, targetId), staleTime: Infinity, gcTime: Infinity, retry: 0 })
      .then((tr) => {
        track(EVENTS.review_translate_toggle, { action: 'translate', target, result: tr.sameLanguage ? 'same' : 'ok' }); // 계측 = enum만(원시 코드 0)
        if (!tr.sameLanguage) setShownKey(keyStr); // 같은 언어 = 원문 유지, 라벨은 sameLanguage로 숨김
      })
      .catch(() => {
        // Codex #223 P2: 실패해도 fetchQuery가 만든 항목(오류 상태)이 gcTime ∞로 남는다 → 그 항목만 제거(무한 보존 = 성공만)
        qc.removeQueries({ queryKey, exact: true });
        track(EVENTS.review_translate_toggle, { action: 'translate', target, result: 'fail' });
        showTopToast(t('translation.translateFailed'), { error: true }); // 원문 유지
      })
      .finally(() => setLoading(false));
  }, [data, keyStr, loading, qc, queryKey, sameLanguage, showing, t, target, targetId, targetType]);

  return {
    translatedText: showing ? data.text : null,
    showingTranslated: showing,
    loading,
    source: showing ? data.source : null,
    sameLanguage,
    toggle,
  };
}

/** 키용 짧은 해시(djb2) — 본문 원문을 키에 통째로 싣지 않으려는 것뿐, 보안 용도 아님.
 *  ponytail: 충돌 시 최악 = 다른 본문의 번역 재사용(같은 리뷰·같은 언어 안에서만) — 32비트라 실사용 무시 가능. */
function hashText(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

async function fetchTranslation(targetType: TranslationTargetType, targetId: string): Promise<Translation> {
  const id = Number(targetId);
  const res = await api.post<TranslationWire>(`/api/translations?lang=${apiLang()}`, {
    targetType,
    targetId: Number.isFinite(id) ? id : targetId,
  });
  const tr = adaptTranslation(res); // 와이어 판정은 어댑터에서만 — 이 아래는 도메인 값
  // #220 공부 메모 ③: 빈 결과 = 실패(throw → 항목 제거·토스트) — 빈 본문 + 번역 라벨 방지
  if (!tr.text?.trim()) throw new Error('empty translation');
  return tr;
}

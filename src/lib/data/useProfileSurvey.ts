/**
 * useSubmitProfileSurvey (KB-729) — PUT /members/me/survey. 성공 = members/me 캐시 surveyCompleted=true(즉시) + 재조회,
 * Amplitude user property(분기 미해당 제외) + survey_submit. 실패는 화면이 표면(재시도·시트 유지) — 400은 코드 결함이라 Sentry.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api/client';
import type { User } from '@/lib/api/types';
import { EVENTS, setUserProps, track, type UserPropKey } from '@/lib/analytics';
import { reportSurveyContractError } from '@/lib/sentry';
import { surveyUserProps, type MemberSurveyResponseWire, type MemberSurveyWire } from '@/lib/survey/profileSurvey';

export const SURVEY_PATH = '/members/me/survey';

export function useSubmitProfileSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: MemberSurveyWire) => {
      const res = await api.put<MemberSurveyResponseWire | null>(SURVEY_PATH, body);
      return res ?? body; // 응답 본문이 비면 보낸 값(이미 분기 정규화됨) 기준
    },
    onSuccess: (saved) => {
      // 서버 정본 즉시 반영(시트가 닫힌다) + 재조회로 확정 — 로컬 플래그 없음.
      // 전 언어 키(['me', lang] 전부) — 제출 뒤 언어를 바꾸면 옛 false 캐시가 먼저 그려져 시트가 떴다 닫히고 survey_view가 겹친다(공부 #244 3).
      // ['me','reviews'](배열)는 건드리지 않는다.
      qc.setQueriesData<User>({ queryKey: ['me'] }, (u) => (u && typeof u === 'object' && !Array.isArray(u) ? { ...u, surveyCompleted: true } : u));
      void qc.invalidateQueries({ queryKey: ['me'] });
      setUserProps(surveyUserProps(saved) as Partial<Record<UserPropKey, string | number>>);
      track(EVENTS.survey_submit);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 400) reportSurveyContractError(e.status, e.code);
    },
  });
}

/**
 * ProfileSurveySheet (KB-729) — 가입 회원 1회 프로필 설문. **닫기 불가**(SheetShell dismissable=false: 스크림 탭·Android 뒤로 가기 무시,
 * 건너뛰기 없음 — 예진 10/8 결정). 문항은 Radio 행(Choice.tsx) + 한식 선호 1~5 Chip, 진행 점은 공용 ProgressDots.
 * 3페이지 — 보이는 문항이 다 답해져야 다음/제출 활성. 제출은 useSubmitGuard + Btn busy(헌법).
 * 실패 = 한 줄 안내 + 재시도(시트 유지). 4xx·2회 연속이면 "나중에"(이번 실행만 숨김 — 벽돌화 방지, 공부 #244 1).
 * MEMBER-003(좀비 세션)은 재시도 대상이 아니다 — 세션 만료 경로가 닫는다(/review 3).
 * 폼은 열려 있을 때만 + 회원 번호 키로 마운트: 세션 경계·계정 전환(A→B)이면 반쯤 쓴 답을 폐기(생애주기 불변 규칙).
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Chip } from '@/components/Chip';
import { Radio } from '@/components/Choice';
import { ProgressDots } from '@/components/ProgressDots';
import { SheetShell } from '@/components/SheetShell';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { EVENTS, track } from '@/lib/analytics';
import { color as C, font } from '@/lib/theme';
import { isMemberMissing, useSubmitProfileSurvey } from '@/lib/data/useProfileSurvey';
import { ApiError } from '@/lib/api/client';
import { hideSurveyThisRun, setSurveyPresented } from '@/lib/survey/surveySession';
import {
  ACQUISITIONS, AGE_BANDS, EMPTY_ANSWERS, FOOD_AFFINITIES, GENDERS, PAGES, PURPOSES, SITUATIONS, TRIP_DURATIONS, TRIP_TIMINGS,
  isPageComplete, normalizeAnswers, toWire, visibleFields, type SurveyAnswers, type SurveyField,
} from '@/lib/survey/profileSurvey';

const OPTIONS: Record<Exclude<SurveyField, 'foodAffinity'>, readonly string[]> = {
  ageBand: AGE_BANDS, gender: GENDERS, acquisition: ACQUISITIONS, situation: SITUATIONS, tripTiming: TRIP_TIMINGS, tripDuration: TRIP_DURATIONS, purpose: PURPOSES,
};

/** 껍데기 — 쿼리 훅 없음. 폼은 열려 있을 때만 마운트(닫힌 홈·QueryClientProvider 없는 유닛에 뮤테이션 훅이 붙지 않는다) + 회원 번호 키 */
export function ProfileSurveySheet({ open, memberId }: { open: boolean; memberId?: string }) {
  return (
    <SheetShell visible={open} dismissable={false}>
      {open && <SurveyForm key={memberId ?? ''} />}
    </SheetShell>
  );
}

function SurveyForm() {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(0);
  const [answers, setAnswers] = React.useState<SurveyAnswers>(EMPTY_ANSWERS);
  const [failed, setFailed] = React.useState(false);
  // 공부 #244 1: 실패가 4xx(계약 결함 등)이거나 2회 연속이면 "나중에"(이번 실행만 숨김) — 벽돌화 방지. 1회 네트워크 실패는 재시도만
  const [failCount, setFailCount] = React.useState(0);
  const [client4xx, setClient4xx] = React.useState(false);
  const canDefer = client4xx || failCount >= 2;
  const guard = useSubmitGuard();
  const submit = useSubmitProfileSurvey();

  // 노출 1회 계측 — 폼 마운트 = 열림(AuthGateSheet 관례) · 떠 있는 동안 알림 탭 딥링크 보류(닫힌 뒤 실행)
  React.useEffect(() => {
    track(EVENTS.survey_view);
    setSurveyPresented(true);
    return () => setSurveyPresented(false);
  }, []);

  const set = (field: SurveyField, value: string | number) => {
    setFailed(false);
    setAnswers((a) => normalizeAnswers({ ...a, [field]: value } as SurveyAnswers)); // 상황이 바뀌면 묻지 않는 분기 답은 비운다
  };
  const last = page === PAGES.length - 1;
  const complete = isPageComplete(page, answers);
  const fields = visibleFields(page, answers);

  const onPrimary = () => {
    if (!last) { setPage((p) => p + 1); return; }
    void guard.run(async () => {
      const body = toWire(answers);
      if (!body) return;
      setFailed(false); // 재시도 시작 = 이전 안내 제거(성공하면 시트가 닫히고, 실패면 다시 켠다)
      try {
        await submit.mutateAsync(body); // 성공 = members/me 캐시 갱신 → open=false(부모) — 시트는 서버 값으로만 닫힌다
      } catch (e) {
        if (isMemberMissing(e)) return; // 좀비 세션 — beAuth가 세션을 끝내면 me 캐시가 비어 시트도 닫힌다
        setFailed(true); // 네트워크·400 모두 시트 유지 + 재시도(400의 Sentry는 훅)
        setFailCount((n) => n + 1);
        if (e instanceof ApiError && e.status != null && e.status >= 400 && e.status < 500) setClient4xx(true);
      }
    });
  };

  return (
    <View style={styles.body} testID="survey-sheet">
      <ProgressDots count={PAGES.length} active={page} testID="survey-dots" dotTestIDPrefix="survey-dot" />
      <Text style={styles.title}>{t('survey.title')}</Text>
      <Text style={styles.sub}>{t('survey.sub')}</Text>
      <View style={styles.page} testID={`survey-page-${page}`}>
        {fields.map((field) => (
          <View key={field} style={styles.q} testID={`survey-q-${field}`}>
            <Text style={styles.qLabel}>{t(`survey.q.${field}`)}</Text>
            {field === 'foodAffinity' ? (
              <View style={styles.chipRow}>
                {FOOD_AFFINITIES.map((n) => (
                  <Chip key={n} label={t(`survey.affinity.${n}`)} selected={answers.foodAffinity === n} onPress={() => set('foodAffinity', n)} testID={`survey-opt-foodAffinity-${n}`} />
                ))}
              </View>
            ) : (
              OPTIONS[field].map((code) => {
                const selected = answers[field] === code;
                const pick = () => set(field, code);
                return (
                  <Pressable key={code} style={styles.optRow} onPress={pick} testID={`survey-opt-${field}-${code}`} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                    {/* 원 자체도 onPress — Radio는 Pressable이라 안 주면 터치를 삼킨다(/review 2) */}
                    <Radio selected={selected} onPress={pick} testID={`survey-radio-${field}-${code}`} />
                    <Text style={[styles.optLabel, selected && styles.optLabelOn]}>{t(`survey.opt.${field}.${code}`)}</Text>
                  </Pressable>
                );
              })
            )}
          </View>
        ))}
      </View>
      {failed && (
        <Text style={styles.err} testID="survey-error">
          {t('survey.error')}
        </Text>
      )}
      {canDefer && (
        <Pressable onPress={hideSurveyThisRun} hitSlop={10} style={styles.laterBtn} testID="survey-later">
          <Text style={styles.later}>{t('survey.later')}</Text>
        </Pressable>
      )}
      <View style={styles.actions}>
        {page > 0 && (
          <View style={styles.actionBack}>
            <Btn variant="ghost" onPress={() => { setFailed(false); setPage((p) => p - 1); }} disabled={guard.busy} testID="survey-back">
              {t('survey.back')}
            </Btn>
          </View>
        )}
        <View style={styles.actionNext}>
          <Btn onPress={onPrimary} disabled={!complete} busy={guard.busy} testID={last ? 'survey-submit' : 'survey-next'}>
            {last ? (failed ? t('survey.retry') : t('survey.submit')) : t('survey.next')}
          </Btn>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 8 },
  title: { fontFamily: font.display, fontSize: 20, color: C.ink, lineHeight: 27 },
  sub: { fontFamily: font.body, fontSize: 14, color: C.ink3, lineHeight: 21 },
  page: { paddingTop: 8, paddingBottom: 8, gap: 18 },
  q: { gap: 6 },
  qLabel: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink, lineHeight: 21, marginBottom: 2 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingVertical: 4 },
  optLabel: { flex: 1, fontFamily: font.body, fontSize: 15, color: C.ink2, lineHeight: 21 },
  optLabelOn: { color: C.ink, fontFamily: font.bodyBold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  err: { fontFamily: font.body, fontSize: 13, color: C.riskDangerText, lineHeight: 18, textAlign: 'center' },
  laterBtn: { alignSelf: 'center', padding: 8 },
  later: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink2 },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  actionBack: { flex: 1 },
  actionNext: { flex: 2 },
});

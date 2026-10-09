/**
 * ProfileSurveyScreen (KB-734 — 구 ProfileSurveySheet KB-729) — 가입 회원 1회 프로필 설문, **전체 화면**(RN Modal fullScreen).
 * 한 화면 한 문항: 선택지를 누르면 선택 표시 → SURVEY_ADVANCE.ms(250) 뒤 다음 문항(동작 줄이기면 즉시). 마지막 문항(한식 선호 1~5)
 * 탭 = **바로 제출**(완료 버튼 없음). 상단 왼쪽 뒤로 = 이전 문항(답 유지) · Android 뒤로 가기 = 같음(첫 문항은 무시). **닫기 불가**
 * (배경 없음·건너뛰기 없음 — 예진 10/8 결정). 분기: 상황 답에 따라 시기·기간 문항이 뒤에 끼어들고, 상황을 바꾸면 분기 답은 비운다.
 * 제출은 useSubmitGuard(헌법) — 제출 중 선택지 비활성 + 스피너. 실패 = 한 줄 안내 + 재시도(화면 유지). 4xx·2회 연속이면 "나중에"
 * (이번 실행만 숨김 — 벽돌화 방지, 공부 #244 1). MEMBER-003(좀비 세션)은 재시도 대상이 아니다 — 세션 만료 경로가 닫는다(/review 3).
 * 큐 done 계약(KB-733): iOS = Modal onDismiss · Android = 폼 언마운트. 폼은 열려 있을 때만 + 회원 번호 키로 마운트:
 * 세션 경계·계정 전환(A→B)이면 반쯤 쓴 답을 폐기(생애주기 불변 규칙).
 */
import * as React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Radio } from '@/components/Choice';
import { IconArrowLeft } from '@/components/icons';
import { ProgressDots } from '@/components/ProgressDots';
import { Spinner } from '@/components/Spinner';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { EVENTS, track } from '@/lib/analytics';
import { color as C, font } from '@/lib/theme';
import { isMemberMissing, useSubmitProfileSurvey } from '@/lib/data/useProfileSurvey';
import { ApiError } from '@/lib/api/client';
import { hideSurveyThisRun, setSurveyPresented } from '@/lib/survey/surveySession';
import {
  ACQUISITIONS, AGE_BANDS, EMPTY_ANSWERS, FOOD_AFFINITIES, GENDERS, PURPOSES, SITUATIONS, TRIP_DURATIONS, TRIP_TIMINGS,
  normalizeAnswers, questionFlow, toWire, type SurveyAnswers, type SurveyField,
} from '@/lib/survey/profileSurvey';

const OPTIONS: Record<SurveyField, readonly (string | number)[]> = {
  ageBand: AGE_BANDS, gender: GENDERS, acquisition: ACQUISITIONS, situation: SITUATIONS, tripTiming: TRIP_TIMINGS, tripDuration: TRIP_DURATIONS, purpose: PURPOSES, foodAffinity: FOOD_AFFINITIES,
};

/** 선택 → 다음 문항까지 — 선택 표시가 보일 만큼(발주 "약 250ms"). 동작 줄이기면 0. 테스트는 ms를 줄인다 */
export const SURVEY_ADVANCE = { ms: 250 };

const noop = () => {};

/** 껍데기 — 쿼리 훅 없음. 폼은 열려 있을 때만 마운트(닫힌 홈·QueryClientProvider 없는 유닛에 뮤테이션 훅이 붙지 않는다) + 회원 번호 키 */
export function ProfileSurveyScreen({ open, memberId, onClosed }: { open: boolean; memberId?: string; onClosed?: () => void }) {
  // Android 뒤로 가기(onRequestClose) = 폼의 "이전 문항" — 폼이 effect에서 등록. 닫지 않는다(닫기 불가)
  const backRef = React.useRef<() => void>(noop);
  return (
    // KB-733: 완전히 닫힌 뒤 큐에 done — iOS는 Modal onDismiss(P-267: onClose 직후 present = race), Android는 폼 언마운트(onDismiss 미지원)
    <Modal visible={open} presentationStyle="fullScreen" animationType="slide" statusBarTranslucent onRequestClose={() => backRef.current()} onDismiss={Platform.OS === 'ios' ? onClosed : undefined}>
      {open && <SurveyForm key={memberId ?? ''} onClosed={onClosed} backRef={backRef} />}
    </Modal>
  );
}

function SurveyForm({ onClosed, backRef }: { onClosed?: () => void; backRef: React.MutableRefObject<() => void> }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<SurveyAnswers>(EMPTY_ANSWERS);
  const [failed, setFailed] = React.useState(false);
  // 공부 #244 1: 실패가 4xx(계약 결함 등)이거나 2회 연속이면 "나중에"(이번 실행만 숨김) — 벽돌화 방지. 1회 네트워크 실패는 재시도만
  const [failCount, setFailCount] = React.useState(0);
  const [client4xx, setClient4xx] = React.useState(false);
  const canDefer = client4xx || failCount >= 2;
  const retried = failCount > 0; // 한 번이라도 실패했으면 재시도 버튼이 자리를 지킨다(재시도 중엔 버튼 안 스피너 — 버튼↔스피너 깜빡임 금지)
  const guard = useSubmitGuard();
  const busy = guard.busy;
  const submit = useSubmitProfileSurvey();

  // 노출 1회 계측 — 폼 마운트 = 열림(AuthGateSheet 관례) · 떠 있는 동안 알림 탭 딥링크 보류(닫힌 뒤 실행)
  const onClosedRef = React.useRef(onClosed);
  React.useEffect(() => { onClosedRef.current = onClosed; }, [onClosed]);
  React.useEffect(() => {
    track(EVENTS.survey_view);
    setSurveyPresented(true);
    return () => {
      setSurveyPresented(false);
      if (Platform.OS !== 'ios') onClosedRef.current?.(); // Android: 닫힘 = 언마운트(iOS는 Modal onDismiss)
    };
  }, []);

  // 자동 진행 타이머는 하나뿐 — 재선택·뒤로·언마운트면 취소(늦게 도착한 전환이 되돌린 문항을 다시 넘기지 않게)
  const advanceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current); }, []);

  // 이전 문항(답 유지) — 상단 뒤로 + Android 뒤로 가기가 같은 구현을 쓴다. 첫 문항·제출 중이면 무시
  React.useEffect(() => {
    backRef.current = () => {
      if (busy) return;
      if (advanceRef.current) { clearTimeout(advanceRef.current); advanceRef.current = null; }
      setFailed(false);
      setIdx((i) => Math.max(0, i - 1));
    };
    return () => { backRef.current = noop; };
  }, [backRef, busy]);

  const flow = questionFlow(answers);
  const field = flow[Math.min(idx, flow.length - 1)];
  const last = idx >= flow.length - 1;

  const doSubmit = (a: SurveyAnswers) => guard.run(async () => {
    const body = toWire(a);
    if (!body) return;
    setFailed(false); // 재시도 시작 = 이전 안내 제거(성공하면 화면이 닫히고, 실패면 다시 켠다)
    try {
      await submit.mutateAsync(body); // 성공 = members/me 캐시 갱신 → open=false(부모) — 화면은 서버 값으로만 닫힌다
    } catch (e) {
      if (isMemberMissing(e)) return; // 좀비 세션 — beAuth가 세션을 끝내면 me 캐시가 비어 화면도 닫힌다
      setFailed(true); // 네트워크·400 모두 화면 유지 + 재시도(400의 Sentry는 훅)
      setFailCount((n) => n + 1);
      if (e instanceof ApiError && e.status != null && e.status >= 400 && e.status < 500) setClient4xx(true);
    }
  });

  const pick = (value: string | number) => {
    if (busy) return;
    if (advanceRef.current) { clearTimeout(advanceRef.current); advanceRef.current = null; }
    setFailed(false);
    const next = normalizeAnswers({ ...answers, [field]: value } as SurveyAnswers); // 상황이 바뀌면 묻지 않는 분기 답은 비운다
    setAnswers(next);
    if (last) { void doSubmit(next); return; } // 마지막 문항 = 바로 제출
    const go = () => setIdx((i) => i + 1);
    if (reduceMotion) go();
    else advanceRef.current = setTimeout(() => { advanceRef.current = null; go(); }, SURVEY_ADVANCE.ms);
  };

  const label = (v: string | number) => (field === 'foodAffinity' ? t(`survey.affinity.${v}`) : t(`survey.opt.${field}.${v}`));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="survey-screen">
      <View style={styles.header}>
        {/* 뒤로 슬롯은 첫 문항에도 자리 유지(헤더 프레임 불변) */}
        <View style={styles.headerSlot}>
          {idx > 0 && (
            <Pressable onPress={() => backRef.current()} disabled={busy} hitSlop={10} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('survey.back')} testID="survey-back">
              <IconArrowLeft size={24} color={C.ink2} />
            </Pressable>
          )}
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>{t('survey.title')}</Text>
        <View style={styles.headerSlot} />
      </View>
      {/* 큰 글자·SE에서 넘치면 이 문항만 스크롤 */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} bounces={false} keyboardShouldPersistTaps="handled" testID="survey-scroll">
        <ProgressDots count={flow.length} active={idx} testID="survey-dots" dotTestIDPrefix="survey-dot" />
        {/* 문항 전환 = 등장 페이드(앱 공용 reanimated entering 관례 — scan 결과·스낵바). 동작 줄이기면 즉시 */}
        <Animated.View key={field} entering={reduceMotion ? undefined : FadeIn.duration(180)} style={styles.q} testID={`survey-q-${field}`}>
          <Text style={styles.qLabel}>{t(`survey.q.${field}`)}</Text>
          {OPTIONS[field].map((code) => {
            const selected = answers[field] === code;
            const onPick = () => pick(code);
            return (
              <Pressable key={code} style={styles.optRow} onPress={onPick} disabled={busy} testID={`survey-opt-${field}-${code}`} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                {/* 원 자체도 onPress — Radio는 Pressable이라 안 주면 터치를 삼킨다(/review 2) */}
                <Radio selected={selected} onPress={busy ? undefined : onPick} testID={`survey-radio-${field}-${code}`} />
                <Text style={[styles.optLabel, selected && styles.optLabelOn]}>{label(code)}</Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </ScrollView>
      {/* 하단 슬롯(고정 최소 높이): 첫 제출 중 = 스피너만 / 실패 = 안내 + 재시도(+ 나중에), 재시도 중 = 버튼 busy */}
      <View style={[styles.foot, { paddingBottom: insets.bottom + 16 }]} testID="survey-foot">
        {busy && !retried && <Spinner size={22} color={C.primary} />}
        {failed && (
          <Text style={styles.err} testID="survey-error">
            {t('survey.error')}
          </Text>
        )}
        {retried && (
          <Btn variant="primary" onPress={() => { void doSubmit(answers); }} busy={busy} testID="survey-retry">
            {t('survey.retry')}
          </Btn>
        )}
        {canDefer && (
          <Pressable onPress={hideSurveyThisRun} hitSlop={10} style={styles.laterBtn} testID="survey-later">
            <Text style={styles.later}>{t('survey.later')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: 'row', alignItems: 'center', height: 48, paddingHorizontal: 8 },
  headerSlot: { width: 44, height: 44, justifyContent: 'center' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: font.bodyBold, fontSize: 15, color: C.ink2, lineHeight: 21 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 16 },
  q: { gap: 4 },
  qLabel: { fontFamily: font.display, fontSize: 22, color: C.ink, lineHeight: 30, marginBottom: 12 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 6 },
  optLabel: { flex: 1, fontFamily: font.body, fontSize: 16, color: C.ink2, lineHeight: 22 },
  optLabelOn: { color: C.ink, fontFamily: font.bodyBold },
  foot: { minHeight: 72, justifyContent: 'center', paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  err: { fontFamily: font.body, fontSize: 13, color: C.riskDangerText, lineHeight: 18, textAlign: 'center' },
  laterBtn: { alignSelf: 'center', padding: 8 },
  later: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink2 },
});

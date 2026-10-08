/**
 * ProfileSurveySheet (KB-729) — 가입 회원 1회 프로필 설문. **닫기 불가**(배경 탭·Android 뒤로 가기 무시, 건너뛰기 없음 — 예진 10/8 결정).
 * 바텀시트 문법은 AuthGateSheet(dimmed·라운드 26) + 온보딩 title-stack(진행 점 17×4·제목 20/700). 문항은 Radio 행(Choice.tsx 프리미티브),
 * 한식 선호 1~5는 Chip 행. 3페이지 — 보이는 문항이 다 답해져야 다음/제출 활성. 제출은 useSubmitGuard + Btn busy(헌법).
 * 실패 = 한 줄 안내 + 재시도(시트 유지). 큰 글자(Txt ×1.3 상한)·SE 폭 = 세로 스크롤(ScrollView, 시트 최대 높이 86%).
 */
import * as React from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Txt as Text } from "@/components/Txt";
import { Btn } from "@/components/Btn";
import { Chip } from "@/components/Chip";
import { Radio } from "@/components/Choice";
import { useBottomInset } from "@/lib/useBottomInset";
import { useSubmitGuard } from "@/lib/useSubmitGuard";
import { EVENTS, track } from "@/lib/analytics";
import { color as C, font, shadow } from "@/lib/theme";
import { useSubmitProfileSurvey } from "@/lib/data/useProfileSurvey";
import {
  ACQUISITIONS,
  AGE_BANDS,
  EMPTY_ANSWERS,
  FOOD_AFFINITIES,
  GENDERS,
  PAGES,
  PURPOSES,
  SITUATIONS,
  TRIP_DURATIONS,
  TRIP_TIMINGS,
  isPageComplete,
  normalizeAnswers,
  toWire,
  visibleFields,
  type SurveyAnswers,
  type SurveyField,
} from "@/lib/survey/profileSurvey";

const OPTIONS: Record<
  Exclude<SurveyField, "foodAffinity">,
  readonly string[]
> = {
  ageBand: AGE_BANDS,
  gender: GENDERS,
  acquisition: ACQUISITIONS,
  situation: SITUATIONS,
  tripTiming: TRIP_TIMINGS,
  tripDuration: TRIP_DURATIONS,
  purpose: PURPOSES,
};

/** 껍데기(Modal) — 쿼리 훅 없음. 폼은 열려 있을 때만 마운트: 닫힌 홈(게스트·완료 회원·QueryClientProvider 없는 유닛)에 뮤테이션 훅이 붙지 않는다 */
export function ProfileSurveySheet({ open }: { open: boolean }) {
  return (
    // 닫기 불가: onRequestClose = Android 뒤로 가기 무시(no-op) · 배경은 Pressable 아님
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
      testID="survey-modal"
    >
      {open && <SurveyForm />}
    </Modal>
  );
}

function SurveyForm() {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const bottom = useBottomInset();
  const [page, setPage] = React.useState(0);
  const [answers, setAnswers] = React.useState<SurveyAnswers>(EMPTY_ANSWERS);
  const [failed, setFailed] = React.useState(false);
  const guard = useSubmitGuard();
  const submit = useSubmitProfileSurvey();

  // 노출 1회 계측 — 폼 마운트 = 열림(AuthGateSheet 관례)
  React.useEffect(() => {
    track(EVENTS.survey_view);
  }, []);

  const set = (field: SurveyField, value: string | number) => {
    setFailed(false);
    setAnswers((a) =>
      normalizeAnswers({ ...a, [field]: value } as SurveyAnswers),
    ); // 상황이 바뀌면 묻지 않는 분기 답은 비운다
  };
  const last = page === PAGES.length - 1;
  const complete = isPageComplete(page, answers);
  const fields = visibleFields(page, answers);

  const onPrimary = () => {
    if (!last) {
      setPage((p) => p + 1);
      return;
    }
    void guard.run(async () => {
      const body = toWire(answers);
      if (!body) return;
      setFailed(false); // 재시도 시작 = 이전 안내 제거(성공하면 시트가 닫히고, 실패면 다시 켠다)
      try {
        await submit.mutateAsync(body); // 성공 = members/me 캐시 갱신 → open=false(부모) — 시트는 서버 값으로만 닫힌다
      } catch {
        setFailed(true); // 네트워크·400 모두 시트 유지 + 재시도(400의 Sentry는 훅)
      }
    });
  };

  return (
    <View style={styles.backdrop} testID="survey-backdrop">
      <View
        style={[
          styles.sheet,
          { maxHeight: Math.round(height * 0.86) },
          Platform.OS === "android" ? { paddingBottom: 18 + bottom } : null,
        ]}
        testID="survey-sheet"
      >
        <View style={styles.dotRow} testID="survey-dots">
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === page && styles.dotOn]}
              testID={`survey-dot-${i}-${i === page ? "on" : "off"}`}
            />
          ))}
        </View>
        <Text style={styles.title}>{t("survey.title")}</Text>
        <Text style={styles.sub}>{t("survey.sub")}</Text>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
          testID={`survey-page-${page}`}
        >
          {fields.map((field) => (
            <View key={field} style={styles.q} testID={`survey-q-${field}`}>
              <Text style={styles.qLabel}>{t(`survey.q.${field}`)}</Text>
              {field === "foodAffinity" ? (
                <View style={styles.chipRow}>
                  {FOOD_AFFINITIES.map((n) => (
                    <Chip
                      key={n}
                      label={t(`survey.affinity.${n}`)}
                      selected={answers.foodAffinity === n}
                      onPress={() => set("foodAffinity", n)}
                      testID={`survey-opt-foodAffinity-${n}`}
                    />
                  ))}
                </View>
              ) : (
                OPTIONS[field].map((code) => {
                  const selected = answers[field] === code;
                  return (
                    <Pressable
                      key={code}
                      style={styles.optRow}
                      onPress={() => set(field, code)}
                      testID={`survey-opt-${field}-${code}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <Radio selected={selected} />
                      <Text
                        style={[styles.optLabel, selected && styles.optLabelOn]}
                      >
                        {t(`survey.opt.${field}.${code}`)}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          ))}
        </ScrollView>
        {failed && (
          <Text style={styles.err} testID="survey-error">
            {t("survey.error")}
          </Text>
        )}
        <View style={styles.actions}>
          {page > 0 && (
            <View style={styles.actionBack}>
              <Btn
                variant="ghost"
                onPress={() => {
                  setFailed(false);
                  setPage((p) => p - 1);
                }}
                disabled={guard.busy}
                testID="survey-back"
              >
                {t("survey.back")}
              </Btn>
            </View>
          )}
          <View style={styles.actionNext}>
            <Btn
              onPress={onPrimary}
              disabled={!complete}
              busy={guard.busy}
              testID={last ? "survey-submit" : "survey-next"}
            >
              {last
                ? failed
                  ? t("survey.retry")
                  : t("survey.submit")
                : t("survey.next")}
            </Btn>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 22,
    paddingBottom: 30,
    paddingHorizontal: 20,
    gap: 8,
    ...shadow.sh2,
  },
  dotRow: { flexDirection: "row", gap: 4 },
  dot: { width: 17, height: 4, borderRadius: 8, backgroundColor: C.line2 },
  dotOn: { backgroundColor: C.primary },
  title: {
    fontFamily: font.display,
    fontSize: 20,
    color: C.ink,
    lineHeight: 27,
  },
  sub: { fontFamily: font.body, fontSize: 14, color: C.ink3, lineHeight: 21 },
  scroll: { flexGrow: 0 },
  scrollBody: { paddingTop: 8, paddingBottom: 8, gap: 18 },
  q: { gap: 6 },
  qLabel: {
    fontFamily: font.bodyBold,
    fontSize: 15,
    color: C.ink,
    lineHeight: 21,
    marginBottom: 2,
  },
  optRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
    paddingVertical: 4,
  },
  optLabel: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 15,
    color: C.ink2,
    lineHeight: 21,
  },
  optLabelOn: { color: C.ink, fontFamily: font.bodyBold },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 4 },
  err: {
    fontFamily: font.body,
    fontSize: 13,
    color: C.riskDangerText,
    lineHeight: 18,
    textAlign: "center",
  },
  actions: { flexDirection: "row", gap: 10, paddingTop: 4 },
  actionBack: { flex: 1 },
  actionNext: { flex: 2 },
});

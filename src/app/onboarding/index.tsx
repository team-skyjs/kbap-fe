/**
 * Onboarding flow (KB-110 골격 · P-080/KB-261 재구조 2차) — 6화면:
 *   ① 약관 동의(전체 동의 + 필수 3: 이용약관·개인정보·안전 고지, 행별 전문 시트)
 *   ② 프로필 → ③ 위험도 마크 인터랙티브 데모 → ④ 회피재료 → ⑤ 맵기(5단계)
 *   → ⑥ 완료 요약 카드(행별 수정 chevron, SuccessCheck 진입 연출)
 *
 * The setup steps collect LOCALLY and batch-submit ONCE at the end (summary
 * CTA). No per-step API calls. 동의는 3항목 전부 필수 — BE `consented` 단일
 * 기록 무변 (spec onboarding-restructure-2026-07-29).
 *
 * Mid-flow exits persist a draft (position + inputs); re-entry hydrates and
 * resumes from the saved step. The draft clears on successful submit.
 * Constitution v2.2.0: no emoji (SVG) — 유일 예외 맵기 표시의 🌶️.
 */
import { useMemo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler, Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '@/lib/useBottomInset';
import { useTranslation } from 'react-i18next';
import { primaryTint, color as C, font, radius, shadow, type RiskState } from '@/lib/theme';
import {
  Btn,
  IconCheck,
  IconChevron,
  IconClose,
  IconLock,
  IconSearch,
  Input,
  RiskMark,
} from '@/components';
import { SuccessCheck } from '@/components/SuccessCheck';
import { Spinner } from '@/components/Spinner';
import { useShake } from '@/lib/useShake';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { LANG_ENDONYM } from '@/lib/i18n/languages';
import { COUNTRIES, countryByCode, deviceCountry, type Country } from '@/lib/onboarding/countries';
import { POPULAR_DISHES, restrictionLabel } from '@/lib/onboarding/data';
import { isSpiceLevel, SPICE_LEVEL_EXAMPLE, SPICE_LEVEL_LABEL, spiceRank, type SpiceLevel } from '@/lib/spice';
import { wireToSpiceLevel } from '@/lib/api/spiceAdapter';
import { SpiceLevelSlider } from '@/components/SpiceLevelSlider';
import { fetchLegalText, type LegalDoc } from '@/lib/legalText';
import { FLAGS } from '@/lib/flags';
import { clearOnboardingDraft, loadOnboardingDraft, saveOnboardingDraft, type DraftStep } from '@/lib/onboarding/draft';
import { generateNickname, pickDefaultAvatarPath } from '@/lib/onboarding/autoProfile';
import { IngredientTileSections } from '@/components/IngredientTileSections';
import { SPICE_RAIL } from '@/lib/onboarding/spiceRail';
import { INGREDIENTS, INGREDIENT_SECTIONS, ingredientLabel } from '@/lib/mocks/ingredients';
import { flagEmoji } from '@/lib/flagEmoji';
import i18n from '@/lib/i18n';
import { submitOnboardingProfile, UNSET } from '@/lib/onboarding/submit';
import { queryClient } from '@/lib/queryClient';
import { EVENTS, setUserProps, track } from '@/lib/analytics';

// P-130(온보딩 v3, 8/6 확정): 마찰 제로 4스텝 — 유저 입력은 국적·회피·맵기뿐.
// 프로필(닉네임·사진)·마크 데모·요약 스텝 소멸(자동 프로필·첫 스캔 코치마크로 이관).
type Step = 'consent' | 'nationality' | 'restrictions' | 'spice';
const ORDER: Step[] = ['consent', 'nationality', 'restrictions', 'spice'];
/** 구버전 draft 스텝 → v3 매핑 (무해 파싱 — 소멸 스텝은 근접 스텝으로). */
/** P-144: 계측 step 와이어명 — amplitude-taxonomy.csv (terms|nationality|avoid|spice). */
const STEP_WIRE: Record<Step, string> = { consent: 'terms', nationality: 'nationality', restrictions: 'avoid', spice: 'spice' };

const LEGACY_STEP: Record<string, Step> = {
  profile: 'nationality',
  riskdemo: 'restrictions',
  interests: 'spice',
  summary: 'spice',
};

/** 약관 3항목 — 전부 필수 (안전 고지는 구 consent 화면 흡수분). */
type ConsentKey = 'terms' | 'privacy' | 'safety';
const CONSENT_KEYS: ConsentKey[] = ['terms', 'privacy', 'safety'];

export default function Onboarding() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { lang } = useLocale(); // P-060: 언어 = 기기(OS) — 인앱 선택 소멸

  const [step, setStep] = useState<Step>('consent');

  // collected LOCALLY (KB-110) — nothing leaves the device until the final
  // batch submit. Nationality defaults to the device region when recognized.
  // P-130: 닉네임·사진 = 자동 프로필(제출 시 생성) — 온보딩 UI 무노출
  const [nationality, setNationality] = useState(() => deviceCountry() ?? 'US');
  const [restrictions, setRestrictions] = useState<Set<string>>(new Set());
  // P-051 원칙 유지(화면 그대로 제출) · P-081: 내부 표현 = enum (와이어 변환은
  // spiceAdapter 격리). 기본 MEDIUM은 종전 기본 5(앵커)와 와이어 동일.
  const [spice, setSpice] = useState<SpiceLevel>('MEDIUM');
  // P-080: 항목별 동의 — 3개 전부 = 기존 consented(단일 기록)와 동치
  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({ terms: false, privacy: false, safety: false });
  const agreed = CONSENT_KEYS.every((k) => consents[k]);
  const [legalDoc, setLegalDoc] = useState<ConsentKey | null>(null); // 전문 시트
  // skips are explicit states — they submit as UNSET, distinct from "chose none"
  const [skipped, setSkipped] = useState({ restrictions: false, spice: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false); // 제출 실패 — 화면 유지+표시
  // P-080: 요약 카드에서 행 수정으로 점프한 경우 — 해당 스텝의 계속/스킵이 요약으로 복귀
  const { shakeStyle, shake } = useShake(); // P-032: 제출 에러 진동
  const hydrated = useRef(false);
  const done = useRef(false); // permanently stops draft persistence after submit

  // Resume (KB-110): hydrate once from a mid-flow draft, jumping to the saved
  // step. Consent was already given when the draft exists.
  useEffect(() => {
    void loadOnboardingDraft().then((d) => {
      if (d && !hydrated.current) {
        if (d.consented) setConsents({ terms: true, privacy: true, safety: true });
        // P-130: 구버전 draft의 nickname·profileImageUrl은 무시(자동 프로필) — 무해 파싱
        setNationality(d.nationality);
        if (d.restrictions) setRestrictions(new Set(d.restrictions));
        // P-081: 구버전 draft(number)는 근사 스냅 마이그레이션, null(스킵)은 기본 MEDIUM 표시
        setSpice(d.spice == null ? 'MEDIUM' : isSpiceLevel(d.spice) ? d.spice : wireToSpiceLevel(d.spice));
        setSkipped({ restrictions: d.restrictions === null, spice: d.spice === null });
        const step3 = (ORDER as string[]).includes(d.step) ? (d.step as Step) : LEGACY_STEP[d.step] ?? 'nationality';
        setStep(step3); // v3 클램프 — 소멸 스텝 draft도 무해
      }
      hydrated.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the draft on every relevant change once consented — an app kill at
  // any point resumes losslessly. Stops once submitting.
  useEffect(() => {
    // done.current: without it the finally{setSubmitting(false)} re-render
    // would fire this effect once more and RE-SAVE the just-cleared draft.
    if (!hydrated.current || !agreed || submitting || done.current || step === 'consent') return;
    saveOnboardingDraft({
      consented: true,
      step: step as DraftStep,
      nickname: '', // P-130: 자동 프로필 — draft 스키마 호환용 빈 값
      nationality,
      language: lang,
      restrictions: skipped.restrictions ? null : Array.from(restrictions),
      spice: skipped.spice ? null : spice,
      profileImageUrl: null,
      updatedAt: new Date().toISOString(),
    });
  }, [agreed, step, nationality, lang, restrictions, spice, skipped, submitting]);

  // P-098②a: 슬라이더 드래그 중 부모 스크롤 잠금
  const [sliderDragging, setSliderDragging] = useState(false);
  const idx = ORDER.indexOf(step);
  const back = () => (idx > 0 ? setStep(ORDER[idx - 1]) : router.back());

  // P-088④: 안드 하드웨어 백 = 온보딩 내 스텝 back과 동일 — 첫 스텝이면 기본
  // 동작(앱 종료 관례). iOS 스와이프 백은 _layout gestureEnabled:false가 차단.
  const backRef = useRef({ idx, back });
  backRef.current = { idx, back };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const { idx: i, back: goBack } = backRef.current;
      if (i > 0) {
        goBack();
        return true;
      }
      return false; // 첫 스텝 — 기본(앱 종료)
    });
    return () => sub.remove();
  }, []);

  // ONE-SHOT batch submit (KB-110): the only server hand-off in the flow —
  // 이제 요약 카드(⑥)의 CTA에서만 호출된다. Skips go out as explicit UNSET;
  // the draft clears only after success. 실패(검증 400·네트워크)는 화면에 남아
  // 에러를 표시한다 — 미저장 상태로 홈 진입 금지 (KB-75 검토 수정, false-safe).
  // P-130: 맵기 완료/스킵 즉시 제출(요약 스텝 소멸). spiceSkipped는 setState 지연을
  // 피해 명시 인자 — 스킵 탭 직후 stale skipped 상태로 제출되는 버그 방지.
  const finish = async (spiceSkipped: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      await submitOnboardingProfile({
        nickname: generateNickname(), // P-130 자동 프로필 — 유저 무노출, 프로필 수정에서 변경 가능
        nationality,
        language: lang,
        avoidIngredients: skipped.restrictions ? UNSET : Array.from(restrictions),
        // P-039 계열: 스킵 = SKIP(미설정) — 안 건드림은 미설정이다 (P-081 enum 승계)
        spiceTolerance: spiceSkipped ? 'SKIP' : spice,
        profileImageUrl: pickDefaultAvatarPath(), // P-140: 색상 아바타 6종 랜덤(path 전송 — P-016 컨벤션)
      });
      done.current = true; // block any further draft writes before clearing
      await clearOnboardingDraft();
      // P-083: 최종 제출 — 회피 재료는 **개수만**(내용 금지, PII 정책) + 스킵 여부
      track(EVENTS.onboarding_submit, {
        avoid_count: skipped.restrictions ? 0 : restrictions.size,
        avoid_skipped: skipped.restrictions,
        spice_skipped: spiceSkipped,
      });
      // P-144: user property — CSV 트리거(온보딩 제출 시 갱신). 재료명 아닌 개수·enum·코드만.
      setUserProps({
        country: nationality,
        spice_level: spiceSkipped ? 'SKIP' : spice,
        avoid_count: skipped.restrictions ? 0 : restrictions.size,
        is_registered: true,
      });
      // 제출 전 fetch된 홈/프로필 캐시(개인화 빈 값)가 staleTime(60s) 동안
      // 살아남아 "저장 안 된 것처럼" 보이는 버그 방지 — 전부 fresh로.
      queryClient.clear();
      // P-080: SuccessCheck는 요약 카드 진입 연출로 결합(스펙) — 완료 오버레이 없이 직행
      router.replace('/(tabs)');
    } catch (e) {
      console.log('[onboarding] submit failed — staying on screen:', (e as Error)?.message);
      setSubmitError(true);
      shake(); // P-032: Error Shake — 재제출 실패도 재트리거
    } finally {
      setSubmitting(false);
    }
  };

  // P-083: 온보딩 퍼널 계측 — 스텝 진입은 step 변화로 1회씩.
  // P-144: step 값 = CSV v3 스텝명(consent→terms, restrictions→avoid)
  useEffect(() => {
    track(EVENTS.onboarding_step_view, { step: STEP_WIRE[step] });
  }, [step]);

  /** 계속(완료) 경로 — 계측 후 전진. P-130: 마지막 스텝(spice)은 즉시 제출 → 홈. */
  const advance = () => {
    track(EVENTS.onboarding_step_complete, { step: STEP_WIRE[step] });
    if (step === 'spice') {
      setSkipped((s) => ({ ...s, spice: false }));
      return void finish(false);
    }
    setStep(ORDER[idx + 1]);
  };
  const skipStep = () => {
    track(EVENTS.onboarding_step_skip, { step: STEP_WIRE[step] });
    if (step === 'restrictions') {
      setSkipped((s) => ({ ...s, restrictions: true }));
      return setStep(ORDER[idx + 1]);
    }
    // spice 스킵도 제출 트리거 (v3)
    setSkipped((s) => ({ ...s, spice: true }));
    void finish(true);
  };
  const answerStep = () => {
    if (step === 'restrictions') setSkipped((s) => ({ ...s, restrictions: false }));
    advance();
  };

  const toggle = (set: Set<string>, key: string, apply: (s: Set<string>) => void) => {
    const copy = new Set(set);
    copy.has(key) ? copy.delete(key) : copy.add(key);
    apply(copy);
  };

  // KB-197→P-055: 안드 내비바 클리어런스는 공용 훅으로 승격 (전수 적용)
  const bottomInset = useBottomInset();

  // P-101(Q-23): 6스텝 CTA 공용 푸터 — 어느 스텝에서도 CTA 프레임(y·높이) 픽셀
  // 동일. Skip/노트는 CTA 아래 **고정 높이 슬롯**(없는 스텝은 빈 슬롯 유지).
  const footer = ((): { label: string; variant?: 'primary' | 'off'; onPress?: () => void; icon?: ReactNode; onSkip?: () => void; skipLabel?: string; note?: string } => {
    switch (step) {
      case 'consent':
        return {
          label: t('onboarding.continue'),
          variant: agreed ? 'primary' : 'off',
          onPress: agreed ? advance : undefined,
          icon: agreed ? <IconCheck size={18} color="#fff" /> : undefined,
          note: t('onboarding.consentNote'),
        };
      case 'nationality':
        return { label: t('onboarding.continue'), onPress: advance };
      case 'restrictions':
        return {
          label: restrictions.size
            ? `${t('onboarding.continue')} · ${t('onboarding.added', { count: restrictions.size })}`
            : t('onboarding.continue'),
          onPress: answerStep,
          onSkip: skipStep,
          skipLabel: t('onboarding.nothingToAvoid'), // P-134 시안 — 0개 Continue와 동일 동작
        };
      case 'spice':
        // P-130: 맵기 = 마지막 스텝 — 완료/스킵 즉시 제출. P-134: 시안 라벨
        return {
          label: t('onboarding.finishSetup'),
          onPress: submitting ? undefined : answerStep,
          icon: submitting ? <Spinner size={18} color="#fff" /> : undefined,
          onSkip: submitting ? undefined : skipStep,
          skipLabel: t('onboarding.skipDecideLater'),
        };
    }
  })();

  return (
    <View style={[styles.app, { paddingTop: insets.top }]}>
      {/* P-133: 국적 스텝 = 헤더·검색 고정, 리스트만 스크롤(시안 kbap-ob4) — 자체 스크롤 구조 */}
      {step === 'nationality' ? (
        <View style={[styles.body, { flex: 1 }]}>
          <View style={styles.miniHeader}>
            <Pressable onPress={back} hitSlop={10} style={styles.miniBack} testID="ob-back">
              <IconChevron size={18} color={C.ink2} style={{ transform: [{ rotate: '180deg' }] }} />
            </Pressable>
          </View>
          <Nationality selected={nationality} onSelect={setNationality} t={t} />
        </View>
      ) : (
      <ScrollView keyboardDismissMode="on-drag"
        scrollEnabled={!sliderDragging}
        // P-101: CTA가 전 스텝 스크롤 밖 공용 푸터로 — 하단 패딩 전 스텝 동일
        contentContainerStyle={[styles.body, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* P-130: 단계 프로그레스 바 소멸(v3) — 백 버튼만 남긴 미니 헤더 */}
        <View style={styles.miniHeader}>
          <Pressable onPress={back} hitSlop={10} style={styles.miniBack} testID="ob-back">
            <IconChevron size={18} color={C.ink2} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
        </View>

        {/* 제출 실패 — 화면 유지 + 안내 (KB-75, false-safe) · P-032 Error Shake */}
        {submitError && (
          <Animated.View style={[styles.submitErr, shakeStyle]}>
            <RiskMark state="caution" size={16} />
            <Text style={styles.submitErrText}>{t('onboarding.submitError')}</Text>
          </Animated.View>
        )}

        {step === 'consent' && (
          <Consent
            consents={consents}
            onToggle={(k) => setConsents((c) => ({ ...c, [k]: !c[k] }))}
            onToggleAll={() =>
              setConsents(agreed ? { terms: false, privacy: false, safety: false } : { terms: true, privacy: true, safety: true })
            }
            onOpenDoc={setLegalDoc}
            allAgreed={agreed}
            t={t}
          />
        )}

        {step === 'restrictions' && (
          <Restrictions
            selected={Array.from(restrictions)}
            onToggle={(code) => toggle(restrictions, code, setRestrictions)}
            onClear={() => setRestrictions(new Set())}
            t={t}
          />
        )}

        {step === 'spice' && (
          <Spice
            level={spice}
            // P-039 계열: 조작 즉시 skip 해제 — draft 복귀(skipped=true) 후 조작분이
            // draft 저장에서 null로 지워지지 않게 (저장식이 skipped를 참조)
            setLevel={(l) => {
              setSpice(l);
              setSkipped((s) => (s.spice ? { ...s, spice: false } : s));
            }}
            onDragStateChange={setSliderDragging}
            t={t}
          />
        )}

      </ScrollView>
      )}

      {/* P-101: 공용 OnboardingFooter — 6스텝 전부 (P-011 restrictions 스티키의
          전 스텝 확장). CTA 프레임 고정 + Skip/노트 고정 높이 슬롯. */}
      {/* P-133: 시안 푸터 규격 — 패딩 12/20/34·헤어라인·CTA radius 16/패딩 17·primary 글로우 */}
      <View testID="ob-footer" style={[styles.footer, { paddingBottom: Math.max(bottomInset, 20) + 14 }]}>
        <Btn variant={footer.variant ?? 'primary'} icon={footer.icon} onPress={footer.onPress} style={styles.obCta}>
          {footer.label}
        </Btn>
        <View style={styles.skipSlot}>
          {footer.onSkip ? (
            <Pressable onPress={footer.onSkip} hitSlop={8}>
              <Text style={styles.linkbtn}>{footer.skipLabel ?? t('onboarding.skip')}</Text>
            </Pressable>
          ) : footer.note ? (
            <Text style={[styles.tag, { textAlign: 'center' }]}>{footer.note}</Text>
          ) : null}
        </View>
      </View>

      {/* P-080: 약관 전문 바텀시트 — Agree 시 해당 행 체크 + 닫힘 */}
      <LegalSheet
        doc={legalDoc}
        onAgree={() => {
          if (legalDoc) setConsents((c) => ({ ...c, [legalDoc]: true }));
          setLegalDoc(null);
        }}
        onClose={() => setLegalDoc(null)}
        t={t}
      />
    </View>
  );
}

/* ---------- steps ---------- */

type TFn = ReturnType<typeof useTranslation>['t'];

/** ① 약관 동의 (P-080) — 전체 동의 + 필수 3행, 행별 chevron→전문 시트. */
function Consent({
  consents,
  onToggle,
  onToggleAll,
  onOpenDoc,
  allAgreed,
  t,
}: {
  consents: Record<ConsentKey, boolean>;
  onToggle: (k: ConsentKey) => void;
  onToggleAll: () => void;
  onOpenDoc: (k: ConsentKey) => void;
  allAgreed: boolean;
  t: TFn;
}) {
  const rows: { k: ConsentKey; label: string }[] = [
    { k: 'terms', label: t('onboarding.termsOfService') },
    { k: 'privacy', label: t('onboarding.privacyPolicy') },
    { k: 'safety', label: t('profile.safetyNotice') },
  ];
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.consentTitle')} sub={t('onboarding.consentSub')} />
      <View style={styles.consentRows}>
        {rows.map(({ k, label }) => (
          <View key={k} style={styles.consentRow}>
            <Pressable style={styles.consentRowMain} onPress={() => onToggle(k)} hitSlop={6}>
              <View style={[styles.check, consents[k] && styles.checkOn]}>{consents[k] && <IconCheck size={15} color="#fff" />}</View>
              <Text style={styles.consentRowText} numberOfLines={2}>
                {label} <Text style={styles.requiredTag}>({t('onboarding.requiredTag')})</Text>
              </Text>
            </Pressable>
            <Pressable onPress={() => onOpenDoc(k)} hitSlop={10} style={styles.consentChevron}>
              <IconChevron size={16} color={C.ink3} />
            </Pressable>
          </View>
        ))}
      </View>
      {/* P-130(v3): 전체 동의 = 개별 3행 아래(맨 밑) — 그 외 무변 */}
      <Pressable style={[styles.consent, allAgreed && styles.consentAllOn, { marginTop: 12 }]} onPress={onToggleAll}>
        <View style={[styles.check, allAgreed && styles.checkOn]}>{allAgreed && <IconCheck size={15} color="#fff" />}</View>
        <Text style={styles.consentText}>{t('onboarding.agreeAll')}</Text>
      </Pressable>
    </View>
  );
}

/** 전문 바텀시트 — terms/privacy는 kbap-legal fetch, safety는 i18n 재사용. */
function LegalSheet({ doc, onAgree, onClose, t }: { doc: ConsentKey | null; onAgree: () => void; onClose: () => void; t: TFn }) {
  const bottomInset = useBottomInset();
  const [remote, setRemote] = useState<{ doc: string; text: string } | null>(null);
  const [error, setError] = useState(false);
  const isRemote = doc === 'terms' || doc === 'privacy';

  const load = useCallback((d: LegalDoc) => {
    setError(false);
    setRemote(null);
    fetchLegalText(d)
      .then((text) => setRemote({ doc: d, text }))
      .catch(() => setError(true));
  }, []);
  useEffect(() => {
    if (doc === 'terms' || doc === 'privacy') load(doc);
  }, [doc, load]);

  const title =
    doc === 'terms' ? t('onboarding.termsOfService') : doc === 'privacy' ? t('onboarding.privacyPolicy') : t('profile.safetyNotice');
  // 안전 고지 = 구 consent 화면 문구 재사용 (아이콘 나열만 삭제 — 스펙)
  const safetyText = [t('onboarding.consentGuidance'), t('onboarding.consentVary'), t('onboarding.consentYours')].join('\n\n');
  const remoteReady = remote != null && remote.doc === doc;

  return (
    <Modal visible={doc != null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose} />
      <View style={[styles.legalSheet, { paddingBottom: bottomInset + 16 }]}>
        <View style={styles.grab} />
        <Text style={styles.sheetTitle}>{title}</Text>
        <ScrollView keyboardDismissMode="on-drag" style={styles.legalScroll} showsVerticalScrollIndicator>
          {isRemote ? (
            error ? (
              <View style={styles.legalError}>
                <Text style={styles.legalErrorText}>{t('onboarding.legalLoadError')}</Text>
                <Pressable onPress={() => doc && load(doc as LegalDoc)} hitSlop={8}>
                  <Text style={styles.legalRetry}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            ) : remoteReady ? (
              <Text style={styles.legalText}>{remote.text}</Text>
            ) : (
              <View style={styles.legalLoading}>
                <ActivityIndicator color={C.primary} />
              </View>
            )
          ) : (
            <Text style={styles.legalText}>{safetyText}</Text>
          )}
        </ScrollView>
        <Btn onPress={onAgree}>{t('onboarding.agree')}</Btn>
      </View>
    </Modal>
  );
}


/** ② 국적 (P-130 v3 → P-133 시안 kbap-ob4 정합).
 *  헤더·검색 고정 + 리스트만 스크롤 · 감지국 핀 카드(기본 선택 — 시안 결정:
 *  대부분 유저는 Continue만) · quiet 불변 안내 · 행 62 고정(리플로 방지) ·
 *  검색 시 핀/안내 숨김 인플레이스 필터. 국기 = 이모지(26pt/34 슬롯). */
function Nationality({ selected, onSelect, t }: { selected: string; onSelect: (code: string) => void; t: TFn }) {
  const [q, setQ] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const detected = deviceCountry();
  const detectedCountry = detected ? countryByCode(detected) : undefined;
  const query = q.trim().toLowerCase();
  const list = useMemo(() => {
    const all = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, i18n.language));
    const filtered = query
      ? all.filter((c) => c.name.toLowerCase().includes(query) || (c.native ?? '').toLowerCase().includes(query))
      : all.filter((c) => c.code !== detected); // 핀 카드가 감지국 담당 — 본 리스트 중복 제거
    return filtered;
  }, [query, detected]);

  const Row = (c: Country, pinned: boolean) => {
    const on = c.code === selected;
    return (
      <Pressable
        key={c.code}
        // P-148①→P-151: 핀 카드 프레임(보더 폭·minHeight·라운딩·마진)은 **상시 고정**
        // (미선택 = 동폭 투명 보더) — 선택 바인딩은 색(보더·틴트)만. 강조는 항상 1곳.
        style={[styles.natRow, pinned && styles.natPinFrame, pinned && on && styles.natPinOn]}
        onPress={() => onSelect(c.code)}
        testID={`nat-${c.code}`}
      >
        <View style={styles.natFlagSlot}>
          <Text style={styles.natFlag}>{flagEmoji(c.code)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.natName, on && styles.natNameOn]} numberOfLines={1}>{c.native ?? c.name}</Text>
          {c.native && c.native !== c.name && (
            <Text style={styles.natSub} numberOfLines={1}>{c.name}</Text>
          )}
        </View>
        <View style={[styles.natCheck, on && styles.natCheckOn]}>
          {on && <IconCheck size={13} color="#fff" />}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* 고정부: 타이틀 + 검색 (시안 — display 29·서브 13.5 max 34ch) */}
      <View style={styles.natHead}>
        <Text style={styles.natTitle}>{t('onboarding.nationalityTitle')}</Text>
        <Text style={styles.natTitleSub}>{t('onboarding.nationalitySub')}</Text>
      </View>
      <View style={[styles.natSearch, searchFocus && styles.natSearchFocus]}>
        <IconSearch size={17} color={C.ink2} />
        <Input
          value={q}
          onChangeText={setQ}
          onFocus={() => setSearchFocus(true)}
          onBlur={() => setSearchFocus(false)}
          placeholder={t('onboarding.nationalitySearch')}
          placeholderTextColor={C.ink3}
          style={styles.natSearchInput}
          autoCorrect={false}
        />
        {q.length > 0 && (
          <Pressable style={styles.natClear} hitSlop={8} onPress={() => setQ('')} testID="nat-clear">
            <IconClose size={12} color={C.ink2} />
          </Pressable>
        )}
      </View>

      {/* 리스트만 스크롤 */}
      <ScrollView style={{ flex: 1 }} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
        {!query && detectedCountry && (
          <>
            <View style={styles.natSecHead}>
              <Text style={styles.natSecText}>{t('onboarding.fromYourPhone')}</Text>
              <View style={styles.natSecLine} />
            </View>
            {Row(detectedCountry, true)}
            {/* quiet 불변 안내 — 자물쇠 13 + 11.5 두 줄 */}
            <View style={styles.natNotice}>
              <IconLock size={13} color={C.ink2} />
              <Text style={styles.natNoticeText}>{t('onboarding.nationalityNotice')}</Text>
            </View>
          </>
        )}
        <View>
          {list.map((c) => Row(c, false))}
        </View>
      </ScrollView>
    </View>
  );
}

/** ③ 회피재료 (P-134 시안 Ob4Avoid) — 카테고리 섹션 + 4열 정사각 사진 타일.
 *  데이터 = 실카탈로그 81종(INGREDIENT_SECTIONS — 시안 30종은 예시). 이미지 URL은
 *  BE ⑧ 대기 — 현재 전 타일 폴백(카테고리 틴트+약어 2글자+이름, FB_TINT 순환),
 *  imageRef 생기면 tileImage 슬롯으로 자동 사진 전환. 타일 프레임 불변(P-103). */
function Restrictions({ selected, onToggle, onClear, t }: { selected: string[]; onToggle: (code: string) => void; onClear: () => void; t: TFn }) {
  const [q, setQ] = useState('');
  const sel = new Set(selected);
  const query = q.trim().toLowerCase();
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.restrictionsTitle')} sub={t('onboarding.avoidSub')} />
      <View style={styles.natSearch}>
        <IconSearch size={17} color={C.ink2} />
        <Input value={q} onChangeText={setQ} placeholder={t('restrictionsEdit.searchPlaceholder')} placeholderTextColor={C.ink3} style={styles.natSearchInput} autoCorrect={false} />
      </View>
      {/* 선택 카운트 줄 — n selected + Clear / 0개 안내 (시안) */}
      <View style={styles.avCount}>
        <Text style={styles.avCountText}>
          {selected.length ? t('onboarding.selectedCount', { count: selected.length }) : t('onboarding.noneSelectedYet')}
        </Text>
        {selected.length > 0 && (
          <Pressable onPress={onClear} hitSlop={8} testID="avoid-clear">
            <Text style={styles.avClear}>{t('onboarding.clearSelection')}</Text>
          </Pressable>
        )}
      </View>
      {/* P-150 ①: 섹션+타일 그리드 = 공용 컴포넌트(프로필 회피 수정과 공유) */}
      <IngredientTileSections selected={sel} onToggle={onToggle} query={query} />
    </View>
  );
}

/** ④ 맵기 (P-134 시안 Ob4Spice + 개정 8/6) — 🌶️ 히어로(현행 공존 확정) +
 *  레벨명+👶배지 줄 + 슬라이더(P-098 무변) + 사진 카드 레일(레벨당 3장, DB CDN
 *  재사용 — 미로드 폴백 색 카드) + 레벨 설명 한 줄(교정 카피 — 기능 약속 금지). */
function Spice({ level, setLevel, onDragStateChange, t }: { level: SpiceLevel; setLevel: (l: SpiceLevel) => void; onDragStateChange?: (d: boolean) => void; t: TFn }) {
  const rank = spiceRank(level);
  const rail = SPICE_RAIL[level];
  const kids = level === 'NONE' || level === 'MILD';
  // P-148 ③: 캐러셀 카드 = 화면폭 58%(다음 카드 피크 — emo 톤, 재량 보고)
  const { width: winW } = useWindowDimensions();
  const cardW = Math.round(winW * 0.58);
  const railRef = useRef<ScrollView>(null);
  // 레벨 전환 시 스크롤 처음으로 리셋
  useEffect(() => {
    railRef.current?.scrollTo({ x: 0, animated: false });
  }, [level]);
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.spiceTitle')} sub={t('onboarding.spiceSub')} />
      <View style={{ alignItems: 'center', gap: 10, marginTop: 8 }}>
        {/* 🌶️ 카운트 히어로 — 점등 수 = 단계 (None=0개) · P-119 고정 프레임 유지 */}
        <View style={styles.chiliRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Text key={i} style={[styles.chili, i >= rank && styles.chiliDim]}>
              {'\u{1F336}\u{FE0F}'}
            </Text>
          ))}
        </View>
        {/* P-148 ②: 레벨명 **아래** 👶 배지(NONE·MILD 한정 — 헌법 v2.3.1) —
            배지 줄 = 고정 높이 슬롯(레벨 전환에도 아래 슬라이더 프레임 불변, P-134 승계) */}
        <Text style={styles.bandName}>{t(SPICE_LEVEL_LABEL[level])}</Text>
        <View style={styles.kidSlot} testID="kid-slot">
          {kids && (
            <View style={styles.kidBadge} testID="kid-badge">
              <Text style={styles.kidBadgeText}>{t('onboarding.kidsBadge')}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={{ marginTop: 18 }}>
        <SpiceLevelSlider level={level} onChange={setLevel} onDragStateChange={onDragStateChange} />
      </View>
      {/* P-148 ③: 사진 캐러셀 — 크게(화면폭 58%)+가로 스크롤+다음 카드 피크,
          레벨 전환 시 처음으로 리셋. 데이터 = spiceRail 상수 그대로(레벨당 3장) */}
      <ScrollView
        ref={railRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 16 }}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 2 }}
        snapToInterval={cardW + 12}
        decelerationRate="fast"
        testID="spice-rail"
      >
        {rail.map((f) => (
          <View key={f.foodId} style={{ width: cardW }} testID={`rail-${f.foodId}`}>
            <View style={[styles.railImgWrap, { width: cardW, height: Math.round(cardW * 0.68) }]}>
              <Image source={{ uri: f.imageUrl }} style={styles.railImg} />
            </View>
            <Text style={styles.railName} numberOfLines={1}>{f.name}</Text>
            <Text style={styles.railKo} numberOfLines={1}>{f.nameKo}</Text>
          </View>
        ))}
      </ScrollView>
      {/* 레벨 설명 — 교정 카피(맵기 표시 사실만) */}
      <Text style={styles.spiceDesc}>{t(`onboarding.spiceDesc${rank}`)}</Text>
    </View>
  );
}

function ObTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.obTitle}>{title}</Text>
      {!!sub && <Text style={styles.obSub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // P-134 회피 타일 그리드 (시안 ob4-tile) — 4열 정사각, 프레임 불변(P-103)
  avCount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, minHeight: 20 },
  avCountText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  avClear: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primaryText },
  avTile: { width: '100%', aspectRatio: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  avTileOn: { borderColor: C.primary },
  avAbbr: { fontFamily: font.displayBlack, fontSize: 18, color: C.ink2, opacity: 0.55 },
  // P-134 맵기 — 배지 줄(고정 높이)·레일·설명
  // P-148 ②: 배지 슬롯 — 고정 높이(배지 부재 레벨에서도 프레임 불변)
  kidSlot: { height: 26, alignItems: 'center', justifyContent: 'center' },
  kidBadge: { backgroundColor: 'rgba(47,143,91,0.1)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  kidBadgeText: { fontFamily: font.bodyBold, fontSize: 11.5, color: '#2f8f5b' },
  railImgWrap: { borderRadius: 15, overflow: 'hidden', backgroundColor: C.surface2 }, // P-148: 크기 동적(화면폭 58%)
  railImg: { width: '100%', height: '100%' },
  railName: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink, marginTop: 6 },
  railKo: { fontFamily: font.ko, fontSize: 11, color: C.ink3 },
  spiceDesc: { fontFamily: font.body, fontSize: 12.5, lineHeight: 18, height: 36, color: C.ink2, textAlign: 'center', marginTop: 14, paddingHorizontal: 8 }, // P-119 승계: 2줄 고정 슬롯 — 레벨 전환 프레임 불변
  // P-130 v3
  miniHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  miniBack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  // P-133 국적 화면(시안 kbap-ob4): 헤더 56/14 패딩 골격은 body 공용 — 여기선 스텝 내부 규격
  natHead: { paddingTop: 8, paddingBottom: 14 },
  natTitle: { fontFamily: font.displayBlack, fontSize: 29, letterSpacing: -0.72, color: C.ink },
  natTitleSub: { fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: C.ink2, marginTop: 6, maxWidth: 300 },
  natSearch: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 13, marginBottom: 10 },
  natSearchFocus: { borderColor: C.primary },
  natSearchInput: { flex: 1, paddingVertical: 11, fontFamily: font.body, fontSize: 14.5, color: C.ink },
  natClear: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  natSecHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 7 },
  natSecText: { fontFamily: font.bodyBold, fontSize: 9.5, letterSpacing: 1.1, textTransform: 'uppercase', color: C.ink3 },
  natSecLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.hair },
  natRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 62, paddingHorizontal: 12 }, // 62 고정 — 리플로 방지
  // P-151(P-148 회귀 교정): 핀 카드 **프레임은 상시 고정**(투명 보더 동폭·minHeight 70)
  // — 선택 상태는 색만 바꾼다(P-103 원칙). 선택 이동 시 아래 목록 픽셀 이동 0.
  natPinFrame: { borderWidth: 1.5, borderColor: 'transparent', borderRadius: 18, minHeight: 70, marginBottom: 8 },
  natPinOn: { borderColor: C.primary, backgroundColor: primaryTint },
  natFlagSlot: { width: 34, alignItems: 'center' },
  natFlag: { fontSize: 26, lineHeight: 32 },
  natName: { fontFamily: font.bodyBold, fontSize: 15.5, color: C.ink },
  natNameOn: { color: C.primaryText },
  natSub: { fontFamily: font.body, fontSize: 12, color: C.ink2, marginTop: 1 },
  natCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  natCheckOn: { backgroundColor: C.primary, borderColor: C.primary },
  natNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 4, marginBottom: 10 },
  natNoticeText: { flex: 1, fontFamily: font.body, fontSize: 11.5, lineHeight: 16, color: C.ink2 },
  app: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 28, flexGrow: 1 },

  // P-101: 공용 푸터 (P-011 스티키의 전 스텝 확장) — CTA 프레임 전 스텝 동일,
  // skipSlot은 고정 높이(Skip/노트 유무와 무관 — CTA y 불변의 핵심)
  footer: { paddingTop: 12, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair, backgroundColor: 'rgba(252,245,239,0.92)' },
  skipSlot: { height: 34, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  obCta: { borderRadius: 16, paddingVertical: 17, shadowColor: C.primary, shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  // 제출 실패 안내 (KB-75)
  submitErr: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fdf3e7', borderWidth: 1, borderColor: '#f3ddc0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  submitErrText: { flex: 1, fontFamily: font.body, fontSize: 12.5, color: C.ink, lineHeight: 17 },

  // titles
  obTitle: { fontFamily: font.display, fontSize: 25, color: C.ink, letterSpacing: -0.4 },
  obSub: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 20, marginTop: 6 },

  // fields
  // KB-149 프로필 사진 (edit.tsx avatar 패턴)
  avatarWrap: { alignItems: 'center', gap: 8, paddingVertical: 2 },
  av: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(226,88,12,0.08)', alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  avImg: { position: 'absolute', top: 0, left: 0, width: 88, height: 88, borderRadius: 44 },
  avBusy: { backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  cam: { position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.surface },
  phLbl: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primary },
  phErr: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.riskCaution },

  fieldset: { gap: 6 },
  fieldLbl: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, paddingHorizontal: 14, minHeight: 50, ...shadow.sh1 },
  fieldFocus: { borderColor: C.primary },
  fieldInput: { flex: 1, fontFamily: font.bodyBold, fontSize: 15, color: C.ink, paddingVertical: 13 },
  fieldVal: { flex: 1, fontFamily: font.bodyBold, fontSize: 15, color: C.ink },

  // notice
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginBottom: 18 },
  noticeText: { flex: 1, fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink2, lineHeight: 19 },

  // ① consent (P-080) · P-088①: 카드를 화면 패딩보다 13 안쪽으로 당기고 내부
  // 패딩 13 — 카드 안 체크박스 좌측 x가 아래 3행 체크박스와 일직선(카드만 살짝 넓게)
  consent: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: radius.sm, padding: 13, marginHorizontal: -14.5, ...shadow.sh1 },
  consentAllOn: { borderColor: C.primary },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: C.primary, borderColor: C.primary },
  consentText: { flex: 1, fontFamily: font.bodyBold, fontSize: 15, color: C.ink, lineHeight: 20 },
  consentRows: { marginTop: 12, gap: 2 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9 },
  consentRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  consentRowText: { flex: 1, fontFamily: font.body, fontSize: 14, color: C.ink, lineHeight: 19 },
  requiredTag: { fontFamily: font.body, fontSize: 12.5, color: C.ink3 },
  consentChevron: { padding: 4 },

  // ③ risk demo (P-080 · P-088 에셋 슬롯+펄스)
  demoCard: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: radius.sm, overflow: 'hidden', ...shadow.sh1 },
  demoImg: { width: '100%', height: 150, backgroundColor: C.surface2 },
  demoMark: { position: 'absolute', top: 104, right: 16, backgroundColor: '#fff', borderRadius: 33, padding: 10, ...shadow.shPop },
  // P-088③: 펄스 링 — 마크 버튼과 동심원 (66 = 46 + padding 10×2)
  pulseRing: { position: 'absolute', top: 0, left: 0, width: 66, height: 66, borderRadius: 33, borderWidth: 2, borderColor: C.primary },
  demoCap: { paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  demoName: { fontFamily: font.bodyBold, fontSize: 15.5, color: C.ink },
  demoHint: { fontFamily: font.body, fontSize: 12, color: C.ink3 },
  demoMeaning: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 13 },
  demoLabel: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink },
  demoBody: { fontFamily: font.body, fontSize: 13, color: C.ink2, lineHeight: 18, marginTop: 2 },

  // ⑤ spice (P-080 → P-081: 슬라이더는 공용 SpiceLevelSlider로 승격 — 히어로만 잔존)
  // P-119: minHeight→height 고정 — 어느 단계에서도 히어로 줄 프레임 불변(P-101/103 원칙)
  chiliRow: { flexDirection: 'row', gap: 6, height: 46, alignItems: 'center' },
  chili: { fontSize: 34, lineHeight: 44 },
  chiliDim: { opacity: 0.18 },
  bandName: { fontFamily: font.displayBlack, fontSize: 30, lineHeight: 38, height: 38, color: C.ink, letterSpacing: -0.3 }, // P-119: 고정
  analogy: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 15, height: 36, backgroundColor: 'rgba(226,88,12,0.08)' }, // P-119: paddingV→고정 높이
  analogyText: { fontFamily: font.bodyBold, fontSize: 14, color: C.primary },
  tag: { fontFamily: font.body, fontSize: 11, color: C.ink3 },

  // interests grid
  foodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  foodCard: { width: '31.5%', backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: radius.sm, overflow: 'hidden', ...shadow.sh1 },
  foodCardOn: { borderColor: C.primary },
  foodImg: { height: 58, backgroundColor: C.surface2 },
  foodCap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5, paddingHorizontal: 9, paddingVertical: 8 },
  foodName: { flex: 1, fontFamily: font.bodyBold, fontSize: 12, color: C.ink },
  foodAdd: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.ink3, alignItems: 'center', justifyContent: 'center' },
  foodAddOn: { backgroundColor: C.primary, borderColor: C.primary },

  // ⑥ summary (P-080)
  sumHero: { alignItems: 'center', paddingVertical: 14 },
  sumCard: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: radius.sm, paddingHorizontal: 14, ...shadow.sh1 },
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  sumRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  sumLbl: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2, width: 96 },
  sumRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  sumValRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sumVal: { fontFamily: font.bodyBold, fontSize: 14, lineHeight: 22, color: C.ink, textAlign: 'right', flexShrink: 1 }, // P-119: 🌶️ 유무 불변
  sumValMuted: { fontFamily: font.body, color: C.ink3 },

  // legal sheet (P-080)
  sheetScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(42,33,27,0.42)' },
  legalSheet: { marginTop: 'auto', maxHeight: '82%', backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, gap: 12, ...shadow.shPop },
  grab: { width: 44, height: 5, borderRadius: 3, backgroundColor: C.ink3, opacity: 0.5, alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontFamily: font.display, fontSize: 18, color: C.ink },
  legalScroll: { flexGrow: 0, minHeight: 180, borderWidth: 1, borderColor: C.hair, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4, backgroundColor: C.surface },
  legalText: { fontFamily: font.body, fontSize: 13, color: C.ink, lineHeight: 20, paddingVertical: 10 },
  legalLoading: { paddingVertical: 40, alignItems: 'center' },
  legalError: { paddingVertical: 30, alignItems: 'center', gap: 10 },
  legalErrorText: { fontFamily: font.body, fontSize: 13, color: C.ink2, textAlign: 'center' },
  legalRetry: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.primary, padding: 4 },

  linkbtn: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink2, textAlign: 'center', padding: 6 },
});

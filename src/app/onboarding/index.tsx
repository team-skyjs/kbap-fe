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
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt as Text } from '@/components/Txt';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '@/lib/useBottomInset';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow, type RiskState } from '@/lib/theme';
import {
  Btn,
  Flag,
  RiskMark,
  TopBar,
  IconCheck,
  IconCamera,
  IconChevron,
  IconPlus,
  IconProfile,
} from '@/components';
import { IngredientFilter } from '@/components/IngredientFilter';
import { SuccessCheck } from '@/components/SuccessCheck';
import { Spinner } from '@/components/Spinner';
import { useShake } from '@/lib/useShake';
import { NationalityPicker } from '@/components/NationalityPicker';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { LANG_ENDONYM } from '@/lib/i18n/languages';
import { countryByCode, deviceCountry } from '@/lib/onboarding/countries';
import { POPULAR_DISHES, restrictionLabel, SPICE_SCALE } from '@/lib/onboarding/data';
import { SPICE_ANCHOR, SPICE_BAND_LABEL, spiceBand } from '@/lib/spice';
import { fetchLegalText, type LegalDoc } from '@/lib/legalText';
import { FLAGS } from '@/lib/flags';
import { clearOnboardingDraft, loadOnboardingDraft, saveOnboardingDraft, type DraftStep } from '@/lib/onboarding/draft';
import { submitOnboardingProfile, UNSET } from '@/lib/onboarding/submit';
import { choosePhotoSource, pickBySource, uploadProfileImage } from '@/lib/data/profileImage';
import { queryClient } from '@/lib/queryClient';

type Step = 'consent' | 'profile' | 'riskdemo' | 'restrictions' | 'spice' | 'interests' | 'summary';
// consent leads (it belongs to the signup moment); interests is MVP-flagged off.
const ORDER: Step[] = [
  'consent',
  'profile',
  'riskdemo',
  'restrictions',
  'spice',
  ...(FLAGS.onboardingTriedDishes ? (['interests'] as Step[]) : []),
  'summary',
];

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
  const [nickname, setNickname] = useState('');
  // KB-149 프로필 사진 (선택 사항) — 선택 즉시 업로드. 제출 body엔 path(objectKey)만
  // (P-006, BE 확정 — 도메인 조합은 서버 몫), 미리보기는 로컬 파일 uri (세션 한정 —
  // draft 복귀 시 미리보기는 사라져도 path는 유지되어 제출에 포함된다).
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [nationality, setNationality] = useState(() => deviceCountry() ?? 'US');
  const [restrictions, setRestrictions] = useState<Set<string>>(new Set());
  // P-051 원칙 유지(화면 그대로 제출) · P-080: 조작은 5단계 스냅 — 저장은 앵커
  // 값(0/2/5/7/10)의 10-스케일. 기본 Medium(=5)은 종전 기본 5와 와이어 동일.
  const [spice, setSpice] = useState(5);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  // P-080: 항목별 동의 — 3개 전부 = 기존 consented(단일 기록)와 동치
  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({ terms: false, privacy: false, safety: false });
  const agreed = CONSENT_KEYS.every((k) => consents[k]);
  const [legalDoc, setLegalDoc] = useState<ConsentKey | null>(null); // 전문 시트
  // skips are explicit states — they submit as UNSET, distinct from "chose none"
  const [skipped, setSkipped] = useState({ restrictions: false, spice: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false); // 제출 실패 — 화면 유지+표시
  // P-080: 요약 카드에서 행 수정으로 점프한 경우 — 해당 스텝의 계속/스킵이 요약으로 복귀
  const [returnToSummary, setReturnToSummary] = useState(false);
  const { shakeStyle, shake } = useShake(); // P-032: 제출 에러 진동
  const hydrated = useRef(false);
  const done = useRef(false); // permanently stops draft persistence after submit

  // Resume (KB-110): hydrate once from a mid-flow draft, jumping to the saved
  // step. Consent was already given when the draft exists.
  useEffect(() => {
    void loadOnboardingDraft().then((d) => {
      if (d && !hydrated.current) {
        if (d.consented) setConsents({ terms: true, privacy: true, safety: true });
        setNickname(d.nickname);
        setPhotoPath(d.profileImageUrl ?? null);
        setNationality(d.nationality);
        if (d.restrictions) setRestrictions(new Set(d.restrictions));
        setSpice(d.spice ?? 5); // P-051: null draft(구 스킵분)도 5 표시로 호환
        setSkipped({ restrictions: d.restrictions === null, spice: d.spice === null });
        setStep(ORDER.includes(d.step) ? d.step : 'spice'); // clamp (e.g. flagged-off/구스텝)
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
      nickname,
      nationality,
      language: lang,
      restrictions: skipped.restrictions ? null : Array.from(restrictions),
      spice: skipped.spice ? null : spice,
      profileImageUrl: photoPath,
      updatedAt: new Date().toISOString(),
    });
  }, [agreed, step, nickname, nationality, lang, restrictions, spice, skipped, submitting, photoPath]);

  const [natOpen, setNatOpen] = useState(false);
  const nation = countryByCode(nationality) ?? countryByCode('US')!;

  // P-060: 국적→언어 제안 소멸 — 언어는 기기(OS)가 정본
  const pickNationality = (code: string) => setNationality(code);

  const idx = ORDER.indexOf(step);
  const back = () => {
    if (returnToSummary) {
      setReturnToSummary(false);
      return setStep('summary');
    }
    return idx > 0 ? setStep(ORDER[idx - 1]) : router.back();
  };

  // ONE-SHOT batch submit (KB-110): the only server hand-off in the flow —
  // 이제 요약 카드(⑥)의 CTA에서만 호출된다. Skips go out as explicit UNSET;
  // the draft clears only after success. 실패(검증 400·네트워크)는 화면에 남아
  // 에러를 표시한다 — 미저장 상태로 홈 진입 금지 (KB-75 검토 수정, false-safe).
  const finish = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      await submitOnboardingProfile({
        nickname,
        nationality,
        language: lang,
        avoidIngredients: skipped.restrictions ? UNSET : Array.from(restrictions),
        // P-039: 미조작(스킵)=UNSET — 안 건드림은 미설정이다
        spiceTolerance: skipped.spice ? UNSET : spice,
        profileImageUrl: photoPath, // path(objectKey), null = 미선택 → 필드 생략 (P-006)
      });
      done.current = true; // block any further draft writes before clearing
      await clearOnboardingDraft();
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

  // advance — 요약에서 수정하러 온 스텝이면 요약으로 복귀 (마지막 스텝 = summary,
  // 제출은 summary CTA가 전담하므로 next()에 제출 분기 없음)
  const next = () => {
    if (returnToSummary) {
      setReturnToSummary(false);
      return setStep('summary');
    }
    setStep(ORDER[idx + 1]);
  };
  const skipStep = () => {
    if (step === 'restrictions') setSkipped((s) => ({ ...s, restrictions: true }));
    if (step === 'spice') setSkipped((s) => ({ ...s, spice: true }));
    next();
  };
  const answerStep = () => {
    if (step === 'restrictions') setSkipped((s) => ({ ...s, restrictions: false }));
    if (step === 'spice') setSkipped((s) => ({ ...s, spice: false }));
    next();
  };
  const editFromSummary = (target: Step) => {
    setReturnToSummary(true);
    setStep(target);
  };

  // KB-149: 선택 즉시 업로드 — 실패는 정직한 에러 표시, 사진 없이 진행 가능
  const pickPhoto = async () => {
    setPhotoError(false);
    // P-049(KB-218): 시스템 선택 시트(촬영/갤러리) — 프로필 수정과 공용 경로.
    // 온보딩엔 삭제 옵션 없음(재선택으로 대체 — 기존과 동일).
    const src = await choosePhotoSource({
      title: t('photo.sheetTitle'),
      camera: t('photo.take'),
      gallery: t('photo.gallery'),
      cancel: t('common.cancel'),
    });
    if (!src || src === 'remove') return;
    const file = await pickBySource(src, {
      permTitle: t('photo.permTitle'),
      permBody: t('photo.permBody'),
      openSettings: t('photo.openSettings'),
      cancel: t('common.cancel'),
    }).catch(() => null);
    if (!file) return; // 취소/권한 거부(안내 완료)
    setPhotoBusy(true);
    try {
      setPhotoPath(await uploadProfileImage(file));
      setPhotoPreview(file.uri); // 업로드 성공분만 미리보기 (path는 렌더 불가)
    } catch (e) {
      console.log('[onboarding] photo upload failed:', (e as Error)?.message ?? e);
      setPhotoError(true);
    } finally {
      setPhotoBusy(false);
    }
  };

  const toggle = (set: Set<string>, key: string, apply: (s: Set<string>) => void) => {
    const copy = new Set(set);
    copy.has(key) ? copy.delete(key) : copy.add(key);
    apply(copy);
  };

  // KB-197→P-055: 안드 내비바 클리어런스는 공용 훅으로 승격 (전수 적용)
  const bottomInset = useBottomInset();

  return (
    <View style={[styles.app, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          // restrictions는 CTA가 스티키(아래 stickyFoot) — 목록 하단 여백만.
          // 그 외 스텝은 CTA가 in-scroll foot이라 내비바 클리어런스를 body에 실어야 함.
          step === 'restrictions' ? { paddingBottom: 130 } : { paddingBottom: 28 + bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* P-080: 6-세그먼트 진행 바 — 현재 스텝 포함 채움. 채움 애니메이션은
            P-042 절제 전례(진행 표시 애니는 소음)에 따라 즉시 전환 유지. */}
        <TopBar
          seg={idx + 1}
          of={ORDER.length}
          onBack={back}
          skipLabel={['restrictions', 'spice', 'interests'].includes(step) ? t('common.skip') : undefined}
          onSkip={skipStep}
        />

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
            onStart={next}
            t={t}
          />
        )}

        {step === 'profile' && (
          <Profile
            nickname={nickname}
            setNickname={setNickname}
            photoPreview={photoPreview}
            photoBusy={photoBusy}
            photoError={photoError}
            onPickPhoto={() => void pickPhoto()}
            nationality={nation}
            onPickNationality={() => setNatOpen(true)}
            onContinue={next}
            t={t}
          />
        )}

        {step === 'riskdemo' && <RiskDemo onContinue={next} t={t} />}

        {step === 'restrictions' && (
          <Restrictions
            selected={Array.from(restrictions)}
            onToggle={(code) => toggle(restrictions, code, setRestrictions)}
            t={t}
          />
        )}

        {step === 'spice' && (
          <Spice
            band={spiceBand(spice)}
            // P-039 계열: 조작 즉시 skip 해제 — draft 복귀(skipped=true) 후 조작분이
            // draft 저장에서 null로 지워지지 않게 (저장식이 skipped를 참조)
            setBand={(b) => {
              setSpice(SPICE_ANCHOR[b]);
              setSkipped((s) => (s.spice ? { ...s, spice: false } : s));
            }}
            onContinue={answerStep}
            onSkip={skipStep}
            t={t}
          />
        )}

        {step === 'interests' && (
          <Interests
            selected={interests}
            onToggle={(name) => toggle(interests, name, setInterests)}
            onContinue={next}
            onSkip={next}
            t={t}
          />
        )}

        {step === 'summary' && (
          <Summary
            nation={nation}
            lang={lang}
            restrictions={Array.from(restrictions)}
            skipped={skipped}
            band={spiceBand(spice)}
            submitting={submitting}
            onEdit={editFromSummary}
            onSubmit={() => void finish()}
            t={t}
          />
        )}
      </ScrollView>

      {/* P-011(KB-178, B안): restrictions 스텝 CTA 하단 고정 — 81종 목록 스크롤과
          무관하게 항상 노출. 목록 하단 패딩(130)으로 마지막 칩 가림 방지. */}
      {step === 'restrictions' && (
        <View style={[styles.stickyFoot, { paddingBottom: bottomInset + 14 }]}>
          <Btn onPress={answerStep}>
            {t('onboarding.continue')}
            {restrictions.size ? ` · ${t('onboarding.added', { count: restrictions.size })}` : ''}
          </Btn>
          <Pressable onPress={skipStep} hitSlop={8} style={{ alignSelf: 'center' }}>
            <Text style={styles.linkbtn}>{t('onboarding.skip')}</Text>
          </Pressable>
        </View>
      )}

      {/* shared nationality picker (I4) */}
      <NationalityPicker open={natOpen} selectedCode={nationality} onSelect={pickNationality} onClose={() => setNatOpen(false)} />

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
  onStart,
  t,
}: {
  consents: Record<ConsentKey, boolean>;
  onToggle: (k: ConsentKey) => void;
  onToggleAll: () => void;
  onOpenDoc: (k: ConsentKey) => void;
  allAgreed: boolean;
  onStart: () => void;
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
      <Pressable style={[styles.consent, allAgreed && styles.consentAllOn]} onPress={onToggleAll}>
        <View style={[styles.check, allAgreed && styles.checkOn]}>{allAgreed && <IconCheck size={15} color="#fff" />}</View>
        <Text style={styles.consentText}>{t('onboarding.agreeAll')}</Text>
      </Pressable>
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
      <View style={styles.foot}>
        <Btn variant={allAgreed ? 'primary' : 'off'} icon={allAgreed ? <IconCheck size={18} color="#fff" /> : undefined} onPress={allAgreed ? onStart : undefined}>
          {t('onboarding.continue')}
        </Btn>
        <Text style={[styles.tag, { textAlign: 'center' }]}>{t('onboarding.consentNote')}</Text>
      </View>
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
        <ScrollView style={styles.legalScroll} showsVerticalScrollIndicator>
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

/** ③ 위험도 마크 인터랙티브 데모 (P-080) — 탭 순환 safe→caution→danger→unable.
 *  마크는 기존 RiskMark 재사용 (신규 제작 금지 — 앱 전체 일관성, 스펙). */
const DEMO_CYCLE: RiskState[] = ['safe', 'caution', 'danger', 'unable'];
function RiskDemo({ onContinue, t }: { onContinue: () => void; t: TFn }) {
  const [i, setI] = useState(0);
  const state = DEMO_CYCLE[i];
  const reduced = useReducedMotion(); // reduced-motion 시 크로스페이드 없이 즉시 전환
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.demoTitle')} sub={t('onboarding.demoSub')} />
      <View style={styles.demoCard}>
        <View style={styles.demoImg} />
        <Pressable onPress={() => setI((n) => (n + 1) % DEMO_CYCLE.length)} hitSlop={14} style={styles.demoMark}>
          <Animated.View key={state} entering={reduced ? undefined : FadeIn.duration(140)}>
            <RiskMark state={state} size={46} />
          </Animated.View>
        </Pressable>
        <View style={styles.demoCap}>
          <Text style={styles.demoName}>{t('onboarding.demoDish')}</Text>
          <Text style={styles.demoHint}>{t('onboarding.demoTap')}</Text>
        </View>
      </View>
      <Animated.View key={`m-${state}`} entering={reduced ? undefined : FadeIn.duration(140)} style={styles.demoMeaning}>
        <RiskMark state={state} size={20} />
        <View style={{ flex: 1 }}>
          <Text style={styles.demoLabel}>{t(`risk.${state}`)}</Text>
          <Text style={styles.demoBody}>{t(`onboarding.demo.${state}`)}</Text>
        </View>
      </Animated.View>
      <View style={styles.foot}>
        <Btn onPress={onContinue}>{t('onboarding.continue')}</Btn>
      </View>
    </View>
  );
}

function Profile(props: {
  nickname: string;
  setNickname: (s: string) => void;
  photoPreview: string | null; // 로컬 파일 uri — 서버 path는 렌더 불가 (P-006)
  photoBusy: boolean;
  photoError: boolean;
  onPickPhoto: () => void;
  nationality: { code: string; name: string };
  onPickNationality: () => void;
  onContinue: () => void;
  t: TFn;
}) {
  const { nickname, setNickname, photoPreview, photoBusy, photoError, onPickPhoto, nationality, onPickNationality, onContinue, t } = props;
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.profileTitle')} sub={t('onboarding.profileSub')} />
      <View style={{ gap: 15 }}>
        {/* KB-149 프로필 사진 (선택 사항) — 탭 → 갤러리 1:1 크롭 → 즉시 업로드 */}
        <View style={styles.avatarWrap}>
          <Pressable style={styles.av} onPress={photoBusy ? undefined : onPickPhoto}>
            {photoPreview ? (
              <Image source={{ uri: photoPreview }} style={styles.avImg} />
            ) : (
              <IconProfile size={40} color={C.primary} />
            )}
            {photoBusy && (
              <View style={[styles.avImg, styles.avBusy]}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            <View style={styles.cam}>
              <IconCamera size={15} color="#fff" />
            </View>
          </Pressable>
          <Text style={photoError ? styles.phErr : styles.phLbl}>
            {photoError ? t('editProfile.photoError') : t('editProfile.changePhoto')}
          </Text>
        </View>
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('onboarding.nickname')} *</Text>
          <View style={[styles.field, !!nickname && styles.fieldFocus]}>
            <IconProfile size={18} color={C.ink2} />
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('onboarding.nicknamePlaceholder')}
              placeholderTextColor={C.ink3}
              style={styles.fieldInput}
            />
          </View>
        </View>
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('onboarding.nationality')} *</Text>
          <Pressable style={styles.field} onPress={onPickNationality}>
            <Text style={styles.fieldVal}>{nationality.name}</Text>
            <IconChevron size={16} color={C.ink3} style={{ transform: [{ rotate: '90deg' }] }} />
          </Pressable>
        </View>
      </View>
      <View style={styles.foot}>
        <Btn variant={nickname.trim() ? 'primary' : 'off'} onPress={nickname.trim() ? onContinue : undefined}>
          {t('onboarding.continue')}
        </Btn>
      </View>
    </View>
  );
}

function Restrictions({ selected, onToggle, t }: { selected: string[]; onToggle: (code: string) => void; t: TFn }) {
  // P-011(B안): CTA는 부모의 하단 스티키 바로 이동 — 81종 목록 아래가 아니라 항상 노출
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.restrictionsTitle')} sub={t('onboarding.restrictionsSub')} />
      <View style={styles.notice}>
        <RiskMark state="caution" size={22} />
        <Text style={styles.noticeText}>{t('onboarding.restrictionsNotice')}</Text>
      </View>
      {/* KB-8 override: flat 81-ingredient filter, shared with the profile editor (I6) */}
      <IngredientFilter selected={selected} onToggle={onToggle} />
    </View>
  );
}

/** ⑤ 맵기 (P-080 재설계) — 노랑→빨강 히트 그라데이션 5스톱 스냅 슬라이더 +
 *  🌶️ 카운트 히어로(5C 확정, None=0개 점등). 저장은 앵커 매핑 — 부모가 담당.
 *  ⚠️ 🌶️는 헌법 v2.2.0의 유일한 유니코드 이모지 예외 (맵기 표시 한정). */
function Spice({ band, setBand, onContinue, onSkip, t }: { band: number; setBand: (b: number) => void; onContinue: () => void; onSkip: () => void; t: TFn }) {
  const trackW = useRef(0);
  const bandRef = useRef(band);
  bandRef.current = band;
  // 드래그 스냅 — JS 스레드 PanResponder(워클릿 없음). 탭은 아래 스톱 Pressable.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => snapTo(e.nativeEvent.locationX),
      onPanResponderMove: (e) => snapTo(e.nativeEvent.locationX),
    }),
  ).current;
  const snapTo = (x: number) => {
    if (!trackW.current) return;
    const b = Math.round((x / trackW.current) * 4);
    const clamped = Math.min(4, Math.max(0, b));
    if (clamped !== bandRef.current) setBand(clamped);
  };
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.spiceTitle')} sub={t('onboarding.spiceSub')} />
      <View style={{ alignItems: 'center', gap: 10, marginTop: 8 }}>
        {/* 🌶️ 카운트 히어로 — 점등 수 = 단계 (None=0개, 시안의 1개 점등은 오류 보정) */}
        <View style={styles.chiliRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Text key={i} style={[styles.chili, i >= band && styles.chiliDim]}>
              {'\u{1F336}\u{FE0F}'}
            </Text>
          ))}
        </View>
        <Text style={styles.bandName}>{t(SPICE_BAND_LABEL[band])}</Text>
        <View style={styles.analogy}>
          <Text style={styles.analogyText}>≈ {t(SPICE_SCALE[SPICE_ANCHOR[band]])}</Text>
        </View>
      </View>
      <View style={{ marginTop: 26 }}>
        <View
          style={styles.heatTrackBox}
          onLayout={(e) => {
            trackW.current = e.nativeEvent.layout.width;
          }}
          {...pan.panHandlers}
        >
          {/* 히트 그라데이션 = 의미색(열) — 위험도 4색과 무관, 맵기 트랙 한정 허용 */}
          <LinearGradient colors={['#f2c14e', '#e2580c', '#c22d20']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.heatTrack} />
          <View style={styles.stopsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Pressable key={i} onPress={() => setBand(i)} hitSlop={12} style={[styles.stop, i === band && styles.stopOn]} />
            ))}
          </View>
        </View>
        <View style={styles.trackLabels}>
          <Text style={styles.tag}>{t(SPICE_BAND_LABEL[0])}</Text>
          <Text style={styles.tag}>{t(SPICE_BAND_LABEL[4])}</Text>
        </View>
      </View>
      <View style={styles.foot}>
        <Btn onPress={onContinue}>{t('onboarding.continue')}</Btn>
        <Pressable onPress={onSkip} hitSlop={8}>
          <Text style={styles.linkbtn}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Interests({ selected, onToggle, onContinue, onSkip, t }: { selected: Set<string>; onToggle: (name: string) => void; onContinue: () => void; onSkip: () => void; t: TFn }) {
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.interestsTitle')} sub={t('onboarding.interestsSub')} />
      <View style={styles.foodGrid}>
        {POPULAR_DISHES.map((name) => {
          const on = selected.has(name);
          return (
            <Pressable key={name} style={[styles.foodCard, on && styles.foodCardOn]} onPress={() => onToggle(name)}>
              <View style={styles.foodImg} />
              <View style={styles.foodCap}>
                <Text style={styles.foodName} numberOfLines={1}>
                  {name}
                </Text>
                <View style={[styles.foodAdd, on && styles.foodAddOn]}>
                  {on ? <IconCheck size={12} color="#fff" /> : <IconPlus size={12} color={C.ink3} />}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.tag, { marginTop: 12 }]}>{t('onboarding.interestsTag')}</Text>
      <View style={styles.foot}>
        <Btn variant={selected.size ? 'primary' : 'off'} onPress={onContinue}>
          {t('onboarding.continue')}
          {selected.size ? ` · ${t('onboarding.picked', { count: selected.size })}` : ''}
        </Btn>
        <Pressable onPress={onSkip} hitSlop={8}>
          <Text style={styles.linkbtn}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** ⑥ 완료 요약 카드 (P-080) — 국적·언어·회피·맵기 + 행별 수정 chevron.
 *  SuccessCheck는 요약 진입 연출로 결합(스펙) — 제출 성공 시 홈 직행. */
function Summary({
  nation,
  lang,
  restrictions,
  skipped,
  band,
  submitting,
  onEdit,
  onSubmit,
  t,
}: {
  nation: { code: string; name: string };
  lang: string;
  restrictions: string[];
  skipped: { restrictions: boolean; spice: boolean };
  band: number;
  submitting: boolean;
  onEdit: (target: Step) => void;
  onSubmit: () => void;
  t: TFn;
}) {
  const restrictionsValue = skipped.restrictions
    ? t('profile.spiceUnset')
    : restrictions.length
      ? `${restrictions.slice(0, 3).map(restrictionLabel).join(', ')}${restrictions.length > 3 ? ` +${restrictions.length - 3}` : ''}`
      : t('onboarding.added', { count: 0 });
  // 맵기 행 — 불꽃 아이콘 금지(시안 드리프트 보정), 🌶️ 카운트 또는 텍스트
  const spiceValue = skipped.spice ? t('profile.spiceUnset') : `${'\u{1F336}\u{FE0F}'.repeat(band)}${band > 0 ? ' ' : ''}${t(SPICE_BAND_LABEL[band])}`;
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.sumHero}>
        <SuccessCheck size={76} />
      </View>
      <ObTitle title={t('onboarding.summaryTitle')} sub={t('onboarding.summarySub')} />
      <View style={styles.sumCard}>
        <SumRow label={t('onboarding.nationality')} onPress={() => onEdit('profile')}>
          <View style={styles.sumValRow}>
            <Flag code={nation.code} size={16} />
            <Text style={styles.sumVal}>{nation.name}</Text>
          </View>
        </SumRow>
        {/* 언어 = 현행 앱 언어(OS 정본, P-060) — 온보딩에 언어 스텝이 없어 표시 전용 */}
        <SumRow label={t('profile.language')}>
          <Text style={styles.sumVal}>{LANG_ENDONYM[lang] ?? lang}</Text>
        </SumRow>
        <SumRow label={t('profile.restrictionsTitle')} onPress={() => onEdit('restrictions')}>
          <Text style={[styles.sumVal, skipped.restrictions && styles.sumValMuted]} numberOfLines={2}>
            {restrictionsValue}
            {!skipped.restrictions && restrictions.length > 0 ? `  ·  ${t('onboarding.added', { count: restrictions.length })}` : ''}
          </Text>
        </SumRow>
        <SumRow label={t('profile.spiceTitle')} onPress={() => onEdit('spice')} last>
          <Text style={[styles.sumVal, skipped.spice && styles.sumValMuted]}>{spiceValue}</Text>
        </SumRow>
      </View>
      <View style={styles.foot}>
        <Btn onPress={submitting ? undefined : onSubmit} icon={submitting ? <Spinner size={18} color="#fff" /> : undefined}>
          {t('onboarding.start')}
        </Btn>
      </View>
    </View>
  );
}

function SumRow({ label, children, onPress, last }: { label: string; children: ReactNode; onPress?: () => void; last?: boolean }) {
  return (
    <Pressable style={[styles.sumRow, !last && styles.sumRowDivider]} onPress={onPress} disabled={!onPress}>
      <Text style={styles.sumLbl}>{label}</Text>
      <View style={styles.sumRight}>
        {children}
        {onPress && <IconChevron size={15} color={C.ink3} />}
      </View>
    </Pressable>
  );
}

/* ---------- shared bits ---------- */

function ObTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.obTitle}>{title}</Text>
      {!!sub && <Text style={styles.obSub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 28, flexGrow: 1 },

  foot: { marginTop: 'auto', gap: 10, paddingTop: 16 },
  // P-011(B안): restrictions CTA 스티키 바 — restrictions.tsx savebar 톤과 동일
  stickyFoot: { paddingHorizontal: 22, paddingTop: 12, gap: 6, backgroundColor: 'rgba(252,245,239,0.92)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair },
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

  // ① consent (P-080)
  consent: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: radius.sm, padding: 13, ...shadow.sh1 },
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

  // ③ risk demo (P-080)
  demoCard: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: radius.sm, overflow: 'hidden', ...shadow.sh1 },
  demoImg: { height: 150, backgroundColor: C.surface2 },
  demoMark: { position: 'absolute', top: 104, right: 16, backgroundColor: '#fff', borderRadius: 33, padding: 10, ...shadow.shPop },
  demoCap: { paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  demoName: { fontFamily: font.bodyBold, fontSize: 15.5, color: C.ink },
  demoHint: { fontFamily: font.body, fontSize: 12, color: C.ink3 },
  demoMeaning: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 13 },
  demoLabel: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink },
  demoBody: { fontFamily: font.body, fontSize: 13, color: C.ink2, lineHeight: 18, marginTop: 2 },

  // ⑤ spice (P-080 — 5단계 히트 슬라이더 + 🌶️ 히어로)
  chiliRow: { flexDirection: 'row', gap: 6, minHeight: 46, alignItems: 'center' },
  chili: { fontSize: 34, lineHeight: 44 },
  chiliDim: { opacity: 0.18 },
  bandName: { fontFamily: font.displayBlack, fontSize: 30, color: C.ink, letterSpacing: -0.3 },
  analogy: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8, backgroundColor: 'rgba(226,88,12,0.08)' },
  analogyText: { fontFamily: font.bodyBold, fontSize: 14, color: C.primary },
  heatTrackBox: { height: 40, justifyContent: 'center' },
  heatTrack: { position: 'absolute', left: 0, right: 0, height: 10, borderRadius: 6 },
  stopsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 1 },
  stop: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  stopOn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', borderWidth: 3, borderColor: C.primary, ...shadow.sh1 },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
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
  sumVal: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink, textAlign: 'right', flexShrink: 1 },
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

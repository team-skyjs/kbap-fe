/**
 * Onboarding flow (KB-110 restructure) — consent first (가입 = OAuth + 동의;
 * /login routes here after the social sheet), then the setup steps collect
 * LOCALLY and batch-submit ONCE at the end (submitOnboardingProfile stub —
 * BE endpoint not deployed). No per-step API calls.
 *
 * Steps: consent → profile → restrictions → spice → (interests: MVP-flagged
 * off, FR-005). Restrictions/spice are skippable — a skip submits as an
 * explicit UNSET (미설정), never a silent default.
 *
 * Mid-flow exits persist a draft (position + inputs); re-entry hydrates and
 * resumes from the saved step (the tabs shell shows a resume nudge). The
 * draft clears on successful submit.
 * Constitution: no emoji (SVG), reader text via i18n, risk colors fixed.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '@/lib/useBottomInset';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import {
  Btn,
  RiskMark,
  TopBar,
  IconCheck,
  IconCamera,
  IconChevron,
  IconFlame,
  IconGlobe,
  IconPlus,
  IconProfile,
} from '@/components';
import { IngredientFilter } from '@/components/IngredientFilter';
import { SuccessCheck } from '@/components/SuccessCheck';
import { useShake } from '@/lib/useShake';
import { LanguagePicker } from '@/components/LanguagePicker';
import { NationalityPicker } from '@/components/NationalityPicker';
import { LANG_ENDONYM } from '@/lib/i18n/languages';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { countryByCode, countryLang, deviceCountry } from '@/lib/onboarding/countries';
import { POPULAR_DISHES, SPICE_SCALE } from '@/lib/onboarding/data';
import { FLAGS } from '@/lib/flags';
import { clearOnboardingDraft, loadOnboardingDraft, saveOnboardingDraft, type DraftStep } from '@/lib/onboarding/draft';
import { submitOnboardingProfile, UNSET } from '@/lib/onboarding/submit';
import { choosePhotoSource, pickBySource, uploadProfileImage } from '@/lib/data/profileImage';
import { queryClient } from '@/lib/queryClient';
import type { SupportedLang } from '@/lib/i18n/languages';

type Step = 'consent' | 'profile' | 'restrictions' | 'spice' | 'interests';
// consent leads (it belongs to the signup moment); interests is MVP-flagged off.
const ORDER: Step[] = ['consent', 'profile', 'restrictions', 'spice', ...(FLAGS.onboardingTriedDishes ? (['interests'] as Step[]) : [])];

export default function Onboarding() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { lang, setLang } = useLocale(); // reader language = the active app locale (set via the shared picker)

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
  // P-051(KB-195 후속, Q-03): **화면 그대로 제출** 원칙 — 기본 5 표시, 미조작
  // Continue도 화면값(5) 제출(표시=전송 일치). Skip만 UNSET(-1). P-039의 미선택
  // UI는 원복, stale closure 수정(finish 인자화)은 유지.
  const [spice, setSpice] = useState(5);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [agreed, setAgreed] = useState(false);
  // skips are explicit states — they submit as UNSET, distinct from "chose none"
  const [skipped, setSkipped] = useState({ restrictions: false, spice: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false); // 제출 실패 — 화면 유지+표시
  const [doneSplash, setDoneSplash] = useState(false); // P-032: 제출 성공 체크 오버레이
  const { shakeStyle, shake } = useShake(); // P-032: 제출 에러 진동
  const hydrated = useRef(false);
  const done = useRef(false); // permanently stops draft persistence after submit

  // Resume (KB-110): hydrate once from a mid-flow draft, jumping to the saved
  // step. Consent was already given when the draft exists.
  useEffect(() => {
    void loadOnboardingDraft().then((d) => {
      if (d && !hydrated.current) {
        setAgreed(d.consented);
        setNickname(d.nickname);
        setPhotoPath(d.profileImageUrl ?? null);
        setNationality(d.nationality);
        setLang(d.language as SupportedLang);
        if (d.restrictions) setRestrictions(new Set(d.restrictions));
        setSpice(d.spice ?? 5); // P-051: null draft(구 스킵분)도 5 표시로 호환
        setSkipped({ restrictions: d.restrictions === null, spice: d.spice === null });
        setStep(ORDER.includes(d.step) ? d.step : 'spice'); // clamp (e.g. flagged-off step)
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
  const [langOpen, setLangOpen] = useState(false);
  const nation = countryByCode(nationality) ?? countryByCode('US')!;

  // Picking a nationality suggests the reader language: the country's language if
  // it's one of our 9, else English. The user can still override it on A3.
  const pickNationality = (code: string) => {
    setNationality(code);
    setLang(countryLang(code));
  };

  const idx = ORDER.indexOf(step);
  const back = () => (idx > 0 ? setStep(ORDER[idx - 1]) : router.back());

  // ONE-SHOT batch submit (KB-110): the only server hand-off in the flow.
  // Skips go out as explicit UNSET; the draft clears only after success.
  // 실패(검증 400·네트워크)는 화면에 남아 에러를 표시한다 — 미저장 상태로
  // 홈 진입 금지 (KB-75 검토 수정, false-safe).
  // P-039→P-051: 제출식은 skipped 플래그 대신 **호출측이 확정값을 인자로** —
  // 같은 탭 setState 직후 finish()의 stale closure 경로 봉쇄(P-039 수정 유지).
  // Continue = finish(spice)(화면값 그대로, 기본 5), Skip = finish(null)(UNSET→-1).
  const finish = async (spiceFinal: number | null = spice) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      await submitOnboardingProfile({
        nickname,
        nationality,
        language: lang,
        avoidIngredients: skipped.restrictions ? UNSET : Array.from(restrictions),
        // P-039: 미조작(null)=건너뛰기=UNSET — 안 건드림은 미설정이다
        spiceTolerance: spiceFinal == null ? UNSET : spiceFinal,
        profileImageUrl: photoPath, // path(objectKey), null = 미선택 → 필드 생략 (P-006)
      });
      done.current = true; // block any further draft writes before clearing
      await clearOnboardingDraft();
      // 제출 전 fetch된 홈/프로필 캐시(개인화 빈 값)가 staleTime(60s) 동안
      // 살아남아 "저장 안 된 것처럼" 보이는 버그 방지 — 전부 fresh로.
      queryClient.clear();
      // P-032: Success Check — 완료 체크 스트로크 드로잉 0.9s 후 홈 진입.
      // reduced-motion이면 드로잉이 스킵돼 정적 체크가 잠깐 보이고 넘어간다.
      setDoneSplash(true);
      setTimeout(() => router.replace('/(tabs)'), 900);
    } catch (e) {
      console.log('[onboarding] submit failed — staying on screen:', (e as Error)?.message);
      setSubmitError(true);
      shake(); // P-032: Error Shake — 재제출 실패도 재트리거
    } finally {
      setSubmitting(false);
    }
  };

  // advance; the last step's continue IS the submit
  const next = () => (idx === ORDER.length - 1 ? void finish() : setStep(ORDER[idx + 1]));
  const skipStep = () => {
    if (step === 'restrictions') setSkipped((s) => ({ ...s, restrictions: true }));
    if (step === 'spice') {
      setSkipped((s) => ({ ...s, spice: true })); // draft에 null 저장용
      if (idx === ORDER.length - 1) return void finish(null); // Skip = UNSET(-1), stale closure 회피
    }
    next();
  };
  const answerStep = () => {
    if (step === 'restrictions') setSkipped((s) => ({ ...s, restrictions: false }));
    if (step === 'spice') {
      setSkipped((s) => ({ ...s, spice: false }));
      if (idx === ORDER.length - 1) return void finish(spice); // 화면에 보이는 그 값 그대로
    }
    next();
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
        <TopBar
          seg={idx}
          of={ORDER.length - 1}
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
          <Consent agreed={agreed} setAgreed={setAgreed} onStart={next} t={t} />
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
            languageLabel={LANG_ENDONYM[lang] ?? lang}
            onPickNationality={() => setNatOpen(true)}
            onPickLanguage={() => setLangOpen(true)}
            onContinue={next}
            t={t}
          />
        )}

        {step === 'restrictions' && (
          <Restrictions
            selected={Array.from(restrictions)}
            onToggle={(code) => toggle(restrictions, code, setRestrictions)}
            t={t}
          />
        )}

        {step === 'spice' && (
          <Spice
            level={spice}
            // P-039: 조작 즉시 skip 해제 — draft 복귀(skipped=true) 후 조작분이
            // draft 저장에서 null로 지워지지 않게 (저장식이 skipped를 참조)
            setLevel={(n) => {
              setSpice(n);
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

      {/* shared nationality (I4) / language (I5, 9 langs) pickers */}
      <NationalityPicker open={natOpen} selectedCode={nationality} onSelect={pickNationality} onClose={() => setNatOpen(false)} />
      <LanguagePicker open={langOpen} onClose={() => setLangOpen(false)} />

      {/* P-032: 제출 성공 — 체크 스트로크 드로잉 오버레이 (0.9s 후 홈) */}
      {doneSplash && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.doneSplash} pointerEvents="auto">
          <SuccessCheck size={104} />
        </Animated.View>
      )}
    </View>
  );
}

/* ---------- steps ---------- */

type TFn = ReturnType<typeof useTranslation>['t'];

function Profile(props: {
  nickname: string;
  setNickname: (s: string) => void;
  photoPreview: string | null; // 로컬 파일 uri — 서버 path는 렌더 불가 (P-006)
  photoBusy: boolean;
  photoError: boolean;
  onPickPhoto: () => void;
  nationality: { code: string; name: string };
  languageLabel: string;
  onPickNationality: () => void;
  onPickLanguage: () => void;
  onContinue: () => void;
  t: TFn;
}) {
  const { nickname, setNickname, photoPreview, photoBusy, photoError, onPickPhoto, nationality, languageLabel, onPickNationality, onPickLanguage, onContinue, t } = props;
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
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('onboarding.readerLanguage')} *</Text>
          <Pressable style={styles.field} onPress={onPickLanguage}>
            <IconGlobe size={18} color={C.ink2} />
            <Text style={styles.fieldVal}>{languageLabel}</Text>
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

function Spice({ level, setLevel, onContinue, onSkip, t }: { level: number; setLevel: (n: number) => void; onContinue: () => void; onSkip: () => void; t: TFn }) {
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.spiceTitle')} sub={t('onboarding.spiceSub')} />
      <View style={{ alignItems: 'center', gap: 8, marginTop: 8 }}>
        {/* P-051: 기본 5 표시 원복 — 화면 그대로 제출이라 착시 아님(표시=전송) */}
        <Text style={styles.bignum}>
          {level}
          <Text style={styles.bignumDen}>/10</Text>
        </Text>
        <View style={styles.analogy}>
          <IconFlame size={15} color={C.primary} />
          <Text style={styles.analogyText}>≈ {t(SPICE_SCALE[level])}</Text>
        </View>
      </View>
      <View style={{ marginTop: 22 }}>
        <View style={styles.heatRow}>
          {Array.from({ length: 11 }).map((_, i) => (
            <Pressable key={i} onPress={() => setLevel(i)} hitSlop={6}>
              <IconFlame size={18} color={i <= level ? C.primary : C.ink3} />
            </Pressable>
          ))}
        </View>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${level * 10}%` }]} />
          <View style={[styles.knob, { left: `${level * 10}%` }]} />
        </View>
        <View style={styles.trackLabels}>
          <Text style={styles.tag}>{t('onboarding.spiceNone')}</Text>
          <Text style={styles.tag}>{t('onboarding.spiceExtreme')}</Text>
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

function Consent({ agreed, setAgreed, onStart, t }: { agreed: boolean; setAgreed: (b: boolean) => void; onStart: () => void; t: TFn }) {
  const lines: { state: 'caution' | 'unable' | 'safe'; text: string }[] = [
    { state: 'caution', text: t('onboarding.consentGuidance') },
    { state: 'unable', text: t('onboarding.consentVary') },
    { state: 'safe', text: t('onboarding.consentYours') },
  ];
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.consentTitle')} />
      <View style={{ gap: 14, marginBottom: 18 }}>
        {lines.map((l) => (
          <View key={l.state} style={styles.notice}>
            <RiskMark state={l.state} size={22} />
            <Text style={styles.noticeBody}>{l.text}</Text>
          </View>
        ))}
      </View>
      <Pressable style={styles.consent} onPress={() => setAgreed(!agreed)}>
        <View style={[styles.check, agreed && styles.checkOn]}>{agreed && <IconCheck size={15} color="#fff" />}</View>
        <Text style={styles.consentText}>{t('onboarding.consentAgree')}</Text>
      </Pressable>
      <View style={styles.foot}>
        <Btn variant={agreed ? 'primary' : 'off'} icon={agreed ? <IconCheck size={18} color="#fff" /> : undefined} onPress={agreed ? onStart : undefined}>
          {t('onboarding.start')}
        </Btn>
        <Text style={[styles.tag, { textAlign: 'center' }]}>{t('onboarding.consentNote')}</Text>
      </View>
    </View>
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
  // P-032: 제출 성공 오버레이 — 뒤 터치 차단 + 중앙 체크
  doneSplash: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(252,245,239,0.96)', alignItems: 'center', justifyContent: 'center', zIndex: 30 },
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
  noticeBody: { flex: 1, fontFamily: font.body, fontSize: 14, color: C.ink, lineHeight: 20 },

  // chips
  group: { gap: 8, marginBottom: 14 },
  groupLbl: { fontFamily: font.bodyBold, fontSize: 10.5, letterSpacing: 1, color: C.ink3 },
  chipwrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipOnRisk: { backgroundColor: C.riskDanger, borderColor: C.riskDanger },
  chipText: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink },
  chipTextOn: { color: '#fff' },

  // spice
  bignum: { fontFamily: font.displayBlack, fontSize: 60, color: C.primary, lineHeight: 78 },
  bignumDen: { fontFamily: font.display, fontSize: 24, color: C.ink3 },
  analogy: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8, backgroundColor: 'rgba(226,88,12,0.08)' },
  analogyText: { fontFamily: font.bodyBold, fontSize: 14, color: C.primary },
  heatRow: { flexDirection: 'row', gap: 3, justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 6, backgroundColor: C.surface2, marginVertical: 16, justifyContent: 'center' },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.primary, borderRadius: 6 },
  knob: { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', borderWidth: 3, borderColor: C.primary, marginLeft: -13, ...shadow.sh1 },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between' },
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

  // consent
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: radius.sm, padding: 13, ...shadow.sh1 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: C.primary, borderColor: C.primary },
  consentText: { flex: 1, fontFamily: font.bodyBold, fontSize: 14, color: C.ink, lineHeight: 20 },

  // picker sheet
  sheetScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(42,33,27,0.42)' },
  sheet: { marginTop: 'auto', backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 34, gap: 4, ...shadow.shPop },
  grab: { width: 44, height: 5, borderRadius: 3, backgroundColor: C.ink3, opacity: 0.5, alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { fontFamily: font.display, fontSize: 18, color: C.ink, marginBottom: 6 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  sheetRowText: { flex: 1, fontFamily: font.bodyBold, fontSize: 15, color: C.ink },
  linkbtn: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink2, textAlign: 'center', padding: 6 },
});

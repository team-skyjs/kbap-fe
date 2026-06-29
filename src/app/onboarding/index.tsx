/**
 * Onboarding flow (mockup Screen A) — a single stepper holding shared state
 * across 7 steps with a 5-segment progress bar (TopBar). Mock only: sign-up
 * issues no real token, profile/consent are not persisted (MOCK_MODE). On
 * finish it routes to the app shell.
 *
 * Steps: welcome → verify → profile → restrictions → spice → interests → consent.
 * Constitution: no emoji (SVG), reader text via i18n, risk colors fixed.
 */
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import {
  Btn,
  Flag,
  RiskMark,
  TopBar,
  IconApple,
  IconCheck,
  IconChevron,
  IconEnvelope,
  IconFlame,
  IconGlobe,
  IconGoogleG,
  IconPlus,
  IconProfile,
} from '@/components';
import {
  ALLERGEN_GROUPS,
  LIFESTYLE_GROUPS,
  NATIONALITIES,
  POPULAR_DISHES,
  READER_LANGUAGES,
  SPICE_SCALE,
} from '@/lib/onboarding/data';

type Step = 'welcome' | 'verify' | 'profile' | 'restrictions' | 'spice' | 'interests' | 'consent';
const ORDER: Step[] = ['welcome', 'verify', 'profile', 'restrictions', 'spice', 'interests', 'consent'];
const SEG: Record<Step, number> = { welcome: 0, verify: 1, profile: 2, restrictions: 3, spice: 4, interests: 4, consent: 5 };

export default function Onboarding() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('welcome');

  // collected profile (mock — not persisted)
  const [email] = useState('you@email.com');
  const [otp, setOtp] = useState('');
  const [nickname, setNickname] = useState('');
  const [nationality, setNationality] = useState(NATIONALITIES[0]);
  const [language, setLanguage] = useState(READER_LANGUAGES[0]);
  const [restrictions, setRestrictions] = useState<Set<string>>(new Set());
  const [spice, setSpice] = useState(5);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [agreed, setAgreed] = useState(false);

  const [picker, setPicker] = useState<null | 'nationality' | 'language'>(null);

  const idx = ORDER.indexOf(step);
  const go = (to: Step) => setStep(to);
  const next = () => idx < ORDER.length - 1 && setStep(ORDER[idx + 1]);
  const back = () => (idx > 0 ? setStep(ORDER[idx - 1]) : router.back());
  const finish = () => router.replace('/(tabs)');

  const toggle = (set: Set<string>, key: string, apply: (s: Set<string>) => void) => {
    const copy = new Set(set);
    copy.has(key) ? copy.delete(key) : copy.add(key);
    apply(copy);
  };

  return (
    <View style={[styles.app, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {step !== 'welcome' && (
          <TopBar
            seg={SEG[step]}
            of={5}
            onBack={back}
            skipLabel={['restrictions', 'spice', 'interests'].includes(step) ? t('common.skip') : undefined}
            onSkip={next}
          />
        )}

        {step === 'welcome' && <Welcome onEmail={() => go('verify')} onSocial={() => go('profile')} t={t} />}

        {step === 'verify' && (
          <Verify email={email} otp={otp} setOtp={setOtp} onVerify={next} t={t} />
        )}

        {step === 'profile' && (
          <Profile
            nickname={nickname}
            setNickname={setNickname}
            nationality={nationality}
            language={language}
            onPickNationality={() => setPicker('nationality')}
            onPickLanguage={() => setPicker('language')}
            onContinue={next}
            t={t}
          />
        )}

        {step === 'restrictions' && (
          <Restrictions
            selected={restrictions}
            onToggle={(code) => toggle(restrictions, code, setRestrictions)}
            onContinue={next}
            onSkip={next}
            t={t}
          />
        )}

        {step === 'spice' && (
          <Spice level={spice} setLevel={setSpice} onContinue={next} onSkip={next} t={t} />
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

        {step === 'consent' && (
          <Consent agreed={agreed} setAgreed={setAgreed} onStart={finish} t={t} />
        )}
      </ScrollView>

      {/* nationality / language picker */}
      <PickerModal
        visible={picker === 'nationality'}
        title={t('onboarding.nationality')}
        options={NATIONALITIES}
        selectedCode={nationality.code}
        withFlag
        onSelect={(o) => {
          setNationality(o);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'language'}
        title={t('onboarding.readerLanguage')}
        options={READER_LANGUAGES}
        selectedCode={language.code}
        onSelect={(o) => {
          setLanguage(o);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

/* ---------- steps ---------- */

type TFn = ReturnType<typeof useTranslation>['t'];

function Welcome({ onEmail, onSocial, t }: { onEmail: () => void; onSocial: () => void; t: TFn }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.hero}>
        <View style={styles.heroMark}>
          <Text style={styles.heroMarkText}>K</Text>
        </View>
        <Text style={styles.word}>K-Bap</Text>
        <Text style={styles.heroTag}>{t('onboarding.welcomeTag')}</Text>
      </View>
      <View style={styles.foot}>
        <Btn icon={<IconEnvelope size={20} color="#fff" />} onPress={onEmail}>
          {t('onboarding.continueEmail')}
        </Btn>
        <Btn variant="ghost" icon={<IconApple size={20} color={C.ink} />} onPress={onSocial}>
          {t('onboarding.continueApple')}
        </Btn>
        <Btn variant="ghost" icon={<IconGoogleG size={20} color={C.ink} />} onPress={onSocial}>
          {t('onboarding.continueGoogle')}
        </Btn>
        <Text style={styles.fine}>{t('onboarding.terms')}</Text>
      </View>
    </View>
  );
}

function Verify({ email, otp, setOtp, onVerify, t }: { email: string; otp: string; setOtp: (s: string) => void; onVerify: () => void; t: TFn }) {
  const digits = otp.padEnd(6, ' ').slice(0, 6).split('');
  const ready = otp.length === 6;
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.verifyTitle')} sub={t('onboarding.verifySub', { email })} />
      <View style={styles.otpRow}>
        {digits.map((d, i) => {
          const active = i === otp.length;
          return (
            <View key={i} style={[styles.otp, active && styles.otpOn]}>
              <Text style={styles.otpText}>{d.trim()}</Text>
            </View>
          );
        })}
        {/* invisible field captures input */}
        <TextInput
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="number-pad"
          style={styles.otpInput}
          autoFocus
          maxLength={6}
        />
      </View>
      <Pressable hitSlop={8} style={{ marginTop: 16 }}>
        <Text style={styles.link}>{t('onboarding.resend')}</Text>
      </Pressable>
      <View style={styles.foot}>
        <Btn variant={ready ? 'primary' : 'off'} onPress={ready ? onVerify : undefined}>
          {t('onboarding.verify')}
        </Btn>
      </View>
    </View>
  );
}

function Profile(props: {
  nickname: string;
  setNickname: (s: string) => void;
  nationality: { code: string; label: string };
  language: { code: string; label: string };
  onPickNationality: () => void;
  onPickLanguage: () => void;
  onContinue: () => void;
  t: TFn;
}) {
  const { nickname, setNickname, nationality, language, onPickNationality, onPickLanguage, onContinue, t } = props;
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.profileTitle')} sub={t('onboarding.profileSub')} />
      <View style={{ gap: 15 }}>
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
            <Flag code={nationality.code} size={20} />
            <Text style={styles.fieldVal}>{nationality.label}</Text>
            <IconChevron size={16} color={C.ink3} style={{ transform: [{ rotate: '90deg' }] }} />
          </Pressable>
        </View>
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('onboarding.readerLanguage')} *</Text>
          <Pressable style={styles.field} onPress={onPickLanguage}>
            <IconGlobe size={18} color={C.ink2} />
            <Text style={styles.fieldVal}>{language.label}</Text>
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

function Restrictions({ selected, onToggle, onContinue, onSkip, t }: { selected: Set<string>; onToggle: (code: string) => void; onContinue: () => void; onSkip: () => void; t: TFn }) {
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.restrictionsTitle')} sub={t('onboarding.restrictionsSub')} />
      <View style={styles.notice}>
        <RiskMark state="caution" size={22} />
        <Text style={styles.noticeText}>{t('onboarding.restrictionsNotice')}</Text>
      </View>
      <Text style={[styles.fieldLbl, { marginBottom: 6 }]}>{t('onboarding.allergensLabel')}</Text>
      {ALLERGEN_GROUPS.map((g) => (
        <View key={g.label} style={styles.group}>
          <Text style={styles.groupLbl}>{g.label.toUpperCase()}</Text>
          <View style={styles.chipwrap}>
            {g.items.map((it) => (
              <Chip key={it.code} label={it.label} on={selected.has(it.code)} risk onPress={() => onToggle(it.code)} />
            ))}
          </View>
        </View>
      ))}
      {LIFESTYLE_GROUPS.map((g) => (
        <View key={g.label} style={styles.group}>
          <Text style={styles.groupLbl}>{g.label.toUpperCase()}</Text>
          <View style={styles.chipwrap}>
            {g.items.map((it) => (
              <Chip key={it.code} label={it.label} on={selected.has(it.code)} onPress={() => onToggle(it.code)} />
            ))}
          </View>
        </View>
      ))}
      <View style={styles.foot}>
        <Btn onPress={onContinue}>
          {t('onboarding.continue')}
          {selected.size ? ` · ${t('onboarding.added', { count: selected.size })}` : ''}
        </Btn>
        <Pressable onPress={onSkip} hitSlop={8}>
          <Text style={styles.linkbtn}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Spice({ level, setLevel, onContinue, onSkip, t }: { level: number; setLevel: (n: number) => void; onContinue: () => void; onSkip: () => void; t: TFn }) {
  return (
    <View style={{ flex: 1 }}>
      <ObTitle title={t('onboarding.spiceTitle')} sub={t('onboarding.spiceSub')} />
      <View style={{ alignItems: 'center', gap: 8, marginTop: 8 }}>
        <Text style={styles.bignum}>
          {level}
          <Text style={styles.bignumDen}>/10</Text>
        </Text>
        <View style={styles.analogy}>
          <IconFlame size={15} color={C.primary} />
          <Text style={styles.analogyText}>≈ {SPICE_SCALE[level]}</Text>
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

function Chip({ label, on, risk, onPress }: { label: string; on: boolean; risk?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && (risk ? styles.chipOnRisk : styles.chipOn)]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
      {on && <IconCheck size={13} color="#fff" />}
    </Pressable>
  );
}

function PickerModal({
  visible,
  title,
  options,
  selectedCode,
  withFlag,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { code: string; label: string }[];
  selectedCode: string;
  withFlag?: boolean;
  onSelect: (o: { code: string; label: string }) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grab} />
        <Text style={styles.sheetTitle}>{title}</Text>
        {options.map((o) => (
          <Pressable key={o.code} style={styles.sheetRow} onPress={() => onSelect(o)}>
            {withFlag && <Flag code={o.code} size={22} />}
            <Text style={styles.sheetRowText}>{o.label}</Text>
            {o.code === selectedCode && <IconCheck size={18} color={C.primary} />}
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 28, flexGrow: 1 },

  // welcome
  hero: { alignItems: 'center', gap: 10, marginTop: 36 },
  heroMark: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', ...shadow.sh2 },
  heroMarkText: { color: '#fff', fontFamily: font.display, fontSize: 42 },
  word: { fontFamily: font.display, fontSize: 34, color: C.primary },
  heroTag: { fontFamily: font.body, fontSize: 15, color: C.ink2, textAlign: 'center', maxWidth: 260 },
  foot: { marginTop: 'auto', gap: 10, paddingTop: 16 },
  fine: { fontFamily: font.body, fontSize: 11.5, color: C.ink3, textAlign: 'center', lineHeight: 16, marginTop: 2 },

  // titles
  obTitle: { fontFamily: font.display, fontSize: 25, color: C.ink, letterSpacing: -0.4 },
  obSub: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 20, marginTop: 6 },

  // otp
  otpRow: { flexDirection: 'row', gap: 9 },
  otp: { flex: 1, height: 56, borderRadius: 13, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  otpOn: { borderColor: C.primary },
  otpText: { fontFamily: font.display, fontSize: 24, color: C.ink },
  otpInput: { position: 'absolute', opacity: 0, width: '100%', height: 56 },
  link: { fontFamily: font.bodyBold, fontSize: 13, color: C.primary, textDecorationLine: 'underline' },

  // fields
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
  bignum: { fontFamily: font.displayBlack, fontSize: 60, color: C.primary, lineHeight: 64 },
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
